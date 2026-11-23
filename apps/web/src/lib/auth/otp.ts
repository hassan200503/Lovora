import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { emailOtps, people } from "@/lib/db/schema";
import { emailConfigured, EmailDeliveryError, sendMail } from "@/lib/email/mailer";
import { recoveryCodeEmail } from "@/lib/email/templates";
import { clearAttempts, consumeAttempt, emailProblem, normalizeEmail, THROTTLED } from "./accounts";
import { derivedKey } from "./secret";

type Db = Awaited<ReturnType<typeof getDb>>;

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_RESEND_MS = 60_000;
export const OTP_MAX_ATTEMPTS = 5;

export const OTP_SENT = "If that email has a Lovora account, a 6-digit code is on its way. It expires in 10 minutes.";
export const OTP_INVALID = "That code isn't right or has expired. Try again or request a new code.";
export const OTP_UNAVAILABLE = "Email recovery isn't available here yet. Use your recovery code instead.";

export type OtpRequestResult = { ok: true; message: string; retryAfter: number } | { ok: false; error: string };
export type OtpVerifyResult =
  | { ok: true; personId: string; sessionVersion: number }
  | { ok: false; error: string };

/** Users often paste "123 456" or "123-456"; only the six digits matter. */
export function normalizeOtpCode(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export function otpCodeProblem(code: string): string | null {
  if (!/^\d{6}$/.test(normalizeOtpCode(code))) return "Enter the 6-digit code from the email.";
  return null;
}

function codeHash(email: string, code: string, salt: string): string {
  return createHmac("sha256", derivedKey(`lovora/email-otp/${email}`)).update(`${salt}.${code}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

async function pruneExpired(db: Db) {
  await db.delete(emailOtps).where(lt(emailOtps.createdAt, new Date(Date.now() - 24 * 60 * 60_000)));
}

/**
 * Sends a recovery code if the address belongs to an account. The response is
 * the same either way, so the endpoint cannot be used to enumerate accounts.
 */
export async function requestRecoveryOtp(db: Db, input: { email: string; ip: string }): Promise<OtpRequestResult> {
  const email = normalizeEmail(input.email);
  if (emailProblem(email)) return { ok: false, error: "Enter a valid email address." };
  if (!emailConfigured()) return { ok: false, error: OTP_UNAVAILABLE };

  const ipOk = await consumeAttempt(db, "ip", `otp-send:${input.ip}`, 15, 60 * 60_000);
  const emailOk = await consumeAttempt(db, "account", `otp-send:${email}`, 5, 60 * 60_000);
  if (!ipOk || !emailOk) return { ok: false, error: THROTTLED };

  const [person] = await db.select({ id: people.id }).from(people).where(sql`lower(${people.email}) = ${email}`).limit(1);
  if (!person) return { ok: true, message: OTP_SENT, retryAfter: 0 };

  const [latest] = await db
    .select({ createdAt: emailOtps.createdAt })
    .from(emailOtps)
    .where(and(eq(emailOtps.email, email), eq(emailOtps.purpose, "recovery")))
    .orderBy(desc(emailOtps.createdAt))
    .limit(1);

  if (latest) {
    const elapsed = Date.now() - latest.createdAt.getTime();
    if (elapsed < OTP_RESEND_MS) {
      return { ok: true, message: OTP_SENT, retryAfter: Math.ceil((OTP_RESEND_MS - elapsed) / 1000) };
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  const now = new Date();

  await db
    .update(emailOtps)
    .set({ consumedAt: now })
    .where(and(eq(emailOtps.email, email), eq(emailOtps.purpose, "recovery"), isNull(emailOtps.consumedAt)));

  const [row] = await db
    .insert(emailOtps)
    .values({
      purpose: "recovery",
      email,
      personId: person.id,
      codeHash: codeHash(email, code, salt),
      salt,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      ipHash: hashIp(input.ip),
    })
    .returning({ id: emailOtps.id });

  const mail = recoveryCodeEmail(code, OTP_TTL_MS / 60_000);
  try {
    await sendMail({ to: email, ...mail });
  } catch (error) {
    await db.update(emailOtps).set({ consumedAt: new Date() }).where(eq(emailOtps.id, row.id));
    console.error("Recovery email could not be delivered", error instanceof EmailDeliveryError ? error.status : "network");
    return { ok: false, error: "We couldn't send the email just now. Try again in a moment." };
  }

  await pruneExpired(db);
  return { ok: true, message: OTP_SENT, retryAfter: 60 };
}

/**
 * Checks a code exactly once. Wrong guesses are counted on the row; the row is
 * consumed on success or after the last allowed attempt.
 */
export async function verifyRecoveryOtp(db: Db, input: { email: string; code: string; ip: string }): Promise<OtpVerifyResult> {
  const email = normalizeEmail(input.email);
  const problem = otpCodeProblem(input.code);
  if (problem) return { ok: false, error: problem };

  const ipOk = await consumeAttempt(db, "ip", `otp-verify:${input.ip}`, 30, 15 * 60_000);
  const emailOk = await consumeAttempt(db, "account", `otp-verify:${email}`, 10, 15 * 60_000);
  if (!ipOk || !emailOk) return { ok: false, error: THROTTLED };

  const code = normalizeOtpCode(input.code);
  const outcome = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(emailOtps)
      .where(and(eq(emailOtps.email, email), eq(emailOtps.purpose, "recovery"), isNull(emailOtps.consumedAt)))
      .orderBy(desc(emailOtps.createdAt))
      .limit(1)
      .for("update");
    const now = new Date();
    if (!row || row.expiresAt <= now || row.attempts >= OTP_MAX_ATTEMPTS) return { kind: "invalid" } as const;

    if (!sameHash(codeHash(email, code, row.salt), row.codeHash)) {
      const attempts = row.attempts + 1;
      await tx
        .update(emailOtps)
        .set({ attempts, consumedAt: attempts >= OTP_MAX_ATTEMPTS ? now : null })
        .where(eq(emailOtps.id, row.id));
      return { kind: "invalid" } as const;
    }

    await tx.update(emailOtps).set({ consumedAt: now, attempts: row.attempts + 1 }).where(eq(emailOtps.id, row.id));
    if (!row.personId) return { kind: "invalid" } as const;
    const [person] = await tx.select({ id: people.id, version: people.sessionVersion }).from(people).where(eq(people.id, row.personId)).limit(1);
    return person ? ({ kind: "ok", personId: person.id, sessionVersion: person.version } as const) : ({ kind: "invalid" } as const);
  });

  if (outcome.kind !== "ok") return { ok: false, error: OTP_INVALID };
  await clearAttempts(db, "account", `otp-verify:${email}`);
  return { ok: true, personId: outcome.personId, sessionVersion: outcome.sessionVersion };
}
