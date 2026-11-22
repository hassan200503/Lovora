import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: () => {} }));

const holder = vi.hoisted(() => ({
  db: undefined as unknown,
  sent: [] as { to: string; subject: string; text: string }[],
}));

vi.mock("@/lib/db/client", () => ({
  getDb: async () => holder.db,
}));

vi.mock("@/lib/email/mailer", () => {
  class EmailNotConfiguredError extends Error {}
  class EmailDeliveryError extends Error {
    constructor(
      public readonly provider: string,
      public readonly status?: number,
    ) {
      super("failed");
    }
  }
  return {
    emailConfigured: () => true,
    sendMail: async (mail: { to: string; subject: string; text: string }) => {
      holder.sent.push({ to: mail.to, subject: mail.subject, text: mail.text });
      return { id: "test", provider: "console" };
    },
    EmailNotConfiguredError,
    EmailDeliveryError,
  };
});

import { normalizeEmail, registerCouple, resetPassword, setPassword, verifyPassword } from "@/lib/auth/accounts";
import { requestRecoveryOtp, verifyRecoveryOtp, OTP_INVALID, OTP_SENT } from "@/lib/auth/otp";

type DbArg = Parameters<typeof registerCouple>[0];

let client: PGlite;
let appDb: DbArg;

const PASSWORD = "correct horse battery";
const SIGNUP = {
  email: "Recovery@Example.com",
  password: PASSWORD,
  displayName: "Recovery",
  theme: "us" as const,
  worldName: "Our World",
  topics: ["software"],
};

function codeFromLastEmail(): string {
  const mail = holder.sent.at(-1);
  if (!mail) throw new Error("No email was captured");
  const match = mail.text.match(/(?:^|\s)(\d{6})(?:\s|$)/m);
  if (!match) throw new Error("No code in email");
  return match[1];
}

beforeAll(async () => {
  client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  appDb = db as unknown as DbArg;
  holder.db = db;
}, 60_000);

beforeEach(async () => {
  holder.sent.length = 0;
  await client.exec('TRUNCATE TABLE "auth_attempts", "email_otps", "people", "couples" RESTART IDENTITY CASCADE');
}, 30_000);

afterAll(async () => {
  await client.close();
});

async function register(overrides: Partial<typeof SIGNUP> = {}) {
  const result = await registerCouple(appDb, { ...SIGNUP, ...overrides });
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("email recovery codes", () => {
  it("sends a code, stores only its hash, and accepts it once", async () => {
    const created = await register();
    const requested = await requestRecoveryOtp(appDb, { email: SIGNUP.email, ip: "1.1.1.1" });
    expect(requested).toMatchObject({ ok: true, message: OTP_SENT, retryAfter: 60 });
    expect(holder.sent).toHaveLength(1);
    expect(holder.sent[0].to).toBe(normalizeEmail(SIGNUP.email));

    const code = codeFromLastEmail();
    const [row] = await appDb.select().from(schema.emailOtps);
    expect(row.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.codeHash).not.toContain(code);
    expect(row.email).toBe(normalizeEmail(SIGNUP.email));
    expect(row.personId).toBe(created.personId);

    const verified = await verifyRecoveryOtp(appDb, { email: SIGNUP.email, code, ip: "1.1.1.1" });
    expect(verified).toEqual({ ok: true, personId: created.personId, sessionVersion: created.sessionVersion });

    const replay = await verifyRecoveryOtp(appDb, { email: SIGNUP.email, code, ip: "1.1.1.1" });
    expect(replay).toEqual({ ok: false, error: OTP_INVALID });
  });

  it("answers the same way for an unknown address and sends nothing", async () => {
    const result = await requestRecoveryOtp(appDb, { email: "nobody@example.com", ip: "2.2.2.2" });
    expect(result).toMatchObject({ ok: true, message: OTP_SENT });
    expect(holder.sent).toHaveLength(0);
  });

  it("enforces the 60-second resend cooldown without a second email", async () => {
    await register();
    await requestRecoveryOtp(appDb, { email: SIGNUP.email, ip: "3.3.3.3" });
    const again = await requestRecoveryOtp(appDb, { email: SIGNUP.email, ip: "3.3.3.3" });
    expect(again.ok).toBe(true);
    expect(again.ok && again.retryAfter).toBeGreaterThan(0);
    expect(holder.sent).toHaveLength(1);
    const [count] = await appDb.select({ n: sql<number>`count(*)::int` }).from(schema.emailOtps);
    expect(count.n).toBe(1);
  });

  it("invalidates the previous code when a new one is sent", async () => {
    await register();
    await requestRecoveryOtp(appDb, { email: SIGNUP.email, ip: "4.4.4.4" });
    const first = codeFromLastEmail();
    await appDb.update(schema.emailOtps).set({ createdAt: new Date(Date.now() - 5 * 60_000) });
    await requestRecoveryOtp(appDb, { email: SIGNUP.email, ip: "4.4.4.4" });
    const second = codeFromLastEmail();
    expect(second).not.toBe(first);

    expect((await verifyRecoveryOtp(appDb, { email: SIGNUP.email, code: first, ip: "4.4.4.4" })).ok).toBe(false);
    expect((await verifyRecoveryOtp(appDb, { email: SIGNUP.email, code: second, ip: "4.4.4.4" })).ok).toBe(true);
  });

  it("allows the last attempts but consumes the code after five wrong guesses", async () => {
    await register();
    await requestRecoveryOtp(appDb, { email: SIGNUP.email, ip: "5.5.5.5" });
    const code = codeFromLastEmail();
    for (let i = 0; i < 5; i += 1) {
      const wrong = await verifyRecoveryOtp(appDb, { email: SIGNUP.email, code: "000001", ip: "5.5.5.5" });
      expect(wrong).toEqual({ ok: false, error: OTP_INVALID });
    }
    expect((await verifyRecoveryOtp(appDb, { email: SIGNUP.email, code, ip: "5.5.5.5" })).ok).toBe(false);
  });

  it("refuses an expired code and a malformed one", async () => {
    await register();
    await requestRecoveryOtp(appDb, { email: SIGNUP.email, ip: "6.6.6.6" });
    const code = codeFromLastEmail();
    await appDb.update(schema.emailOtps).set({ expiresAt: new Date(Date.now() - 1_000) });
    expect(await verifyRecoveryOtp(appDb, { email: SIGNUP.email, code, ip: "6.6.6.6" })).toEqual({ ok: false, error: OTP_INVALID });
    expect((await verifyRecoveryOtp(appDb, { email: SIGNUP.email, code: "12ab", ip: "6.6.6.6" })).ok).toBe(false);
  });

  it("resets the password once, rotates the code and rejects a replayed ticket", async () => {
    const created = await register();
    await requestRecoveryOtp(appDb, { email: SIGNUP.email, ip: "7.7.7.7" });
    const verified = await verifyRecoveryOtp(appDb, { email: SIGNUP.email, code: codeFromLastEmail(), ip: "7.7.7.7" });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    const reset = await resetPassword(appDb, {
      personId: verified.personId,
      expectedVersion: verified.sessionVersion,
      newPassword: "an entirely new password",
    });
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.sessionVersion).toBe(created.sessionVersion + 1);

    const [person] = await appDb.select().from(schema.people).where(eq(schema.people.id, created.personId));
    expect(await verifyPassword("an entirely new password", person.passwordHash)).toBe(true);
    expect(person.recoveryHash).toMatch(/^[a-f0-9]{64}$/);

    const replay = await resetPassword(appDb, {
      personId: verified.personId,
      expectedVersion: verified.sessionVersion,
      newPassword: "yet another password",
    });
    expect(replay.ok).toBe(false);
  });

  it("sets a first password for an account that had none", async () => {
    const created = await register();
    await appDb.update(schema.people).set({ passwordSet: false }).where(eq(schema.people.id, created.personId));
    const result = await setPassword(appDb, created.personId, "a password chosen later");
    expect(result).toEqual({ ok: true, sessionVersion: created.sessionVersion + 1 });
    const [person] = await appDb.select().from(schema.people).where(eq(schema.people.id, created.personId));
    expect(person.passwordSet).toBe(true);
    expect(await verifyPassword("a password chosen later", person.passwordHash)).toBe(true);
    expect((await setPassword(appDb, created.personId, "another password later")).ok).toBe(false);
  });
});
