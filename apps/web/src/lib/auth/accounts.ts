import "server-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { ThemeKey } from "@lovora/domain";
import { getDb } from "@/lib/db/client";
import { authAttempts, authIdentities, coupleMembers, couples, interests, people, preferences, profiles } from "@/lib/db/schema";
import { hashRecoveryCode, matchesRecovery, newRecoveryCode } from "./recovery";
import type { GoogleProfile } from "./google";

export { hashRecoveryCode, newRecoveryCode } from "./recovery";

type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const BCRYPT_COST = 12;
export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;

/** A bcrypt hash of a random value, compared when no account exists so timing does not reveal it. */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5W5pX1Z8sZ3J9W8X8Q0sW2m7R9oY1qS";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type AccountError = { ok: false; error: string };
export type Registered = { ok: true; personId: string; slug: string; sessionVersion: number; recoveryCode: string; coupleId: string };

export const GENERIC_LOGIN_ERROR = "Email or password is incorrect.";
export const THROTTLED = "Too many attempts. Try again in a few minutes.";
const GENERIC_RECOVERY_ERROR = "That email or recovery code isn't right.";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailProblem(email: string): string | null {
  if (!EMAIL.test(normalizeEmail(email))) return "Enter a valid email address.";
  return null;
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters.`;
  return null;
}

export function displayNameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1) return "Tell us your name.";
  if (trimmed.length > 80) return "Use 80 characters or fewer.";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function attemptKey(scope: "ip" | "account", value: string): string {
  return `${scope}:${createHash("sha256").update(value).digest("hex")}`;
}

/**
 * Counts one attempt against a bucket. Returns false when the caller has already
 * used its allowance in this window. The row is locked so parallel requests
 * cannot all read the same count.
 */
export async function consumeAttempt(db: Db, scope: "ip" | "account", value: string, limit: number, windowMs: number): Promise<boolean> {
  const key = attemptKey(scope, value);
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(authAttempts).where(eq(authAttempts.key, key)).for("update");
    if (!row || row.resetAt <= now) {
      await tx
        .insert(authAttempts)
        .values({ key, count: 1, resetAt, updatedAt: now })
        .onConflictDoUpdate({ target: authAttempts.key, set: { count: 1, resetAt, updatedAt: now } });
      return true;
    }
    if (row.count >= limit) return false;
    await tx.update(authAttempts).set({ count: row.count + 1, updatedAt: now }).where(eq(authAttempts.key, key));
    return true;
  });
}

export async function clearAttempts(db: Db, scope: "ip" | "account", value: string): Promise<void> {
  await db.delete(authAttempts).where(eq(authAttempts.key, attemptKey(scope, value)));
}

const IP_WINDOW = { limit: 30, ms: 15 * 60_000 };
const ACCOUNT_WINDOW = { limit: 10, ms: 15 * 60_000 };

function baseSlug(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "me"
  );
}

async function uniqueAccountSlug(db: Db | Tx, name: string): Promise<string> {
  const base = baseSlug(name);
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [found] = await db.select({ id: people.id }).from(people).where(eq(people.slug, candidate)).limit(1);
    if (!found) return candidate;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

async function uniqueMemberSlug(tx: Tx, coupleId: string, name: string): Promise<string> {
  const base = baseSlug(name);
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [found] = await tx
      .select({ id: coupleMembers.personId })
      .from(coupleMembers)
      .where(and(eq(coupleMembers.coupleId, coupleId), eq(coupleMembers.slug, candidate)))
      .limit(1);
    if (!found) return candidate;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

export type MemberInput = {
  displayName: string;
  email: string;
  passwordHash: string;
  /** Null for Google-created accounts; a code can be minted later from Settings. */
  recoveryHash: string | null;
  /** False until a Google-created account chooses a password. */
  passwordSet?: boolean;
  theme: ThemeKey;
  topics: string[];
};

/** Inserts one person and their membership. Caller owns the transaction. */
export async function insertCoupleMember(tx: Tx, coupleId: string, slot: 1 | 2, input: MemberInput) {
  const slug = await uniqueMemberSlug(tx, coupleId, input.displayName);
  const [person] = await tx
    .insert(people)
    .values({
      slug: await uniqueAccountSlug(tx, input.displayName),
      displayName: input.displayName,
      email: input.email,
      theme: input.theme,
      passwordHash: input.passwordHash,
      passwordSet: input.passwordSet ?? true,
      recoveryHash: input.recoveryHash,
      journalTitle: "Learning Journal",
      radarTitle: "Curiosity Radar",
      features: [],
    })
    .returning({ id: people.id, sessionVersion: people.sessionVersion });
  await tx.insert(coupleMembers).values({ coupleId, personId: person.id, slug, slot });
  if (input.topics.length) {
    await tx.insert(interests).values(input.topics.map((topic, position) => ({ personId: person.id, topic, position })));
  }
  await tx.insert(preferences).values({ personId: person.id });
  await tx.insert(profiles).values({ personId: person.id, onboardingCompletedAt: new Date() });
  return { ...person, slug };
}

function duplicateEmail(error: unknown): boolean {
  const code = (error as { code?: string }).code ?? (error as { cause?: { code?: string } }).cause?.code;
  return code === "23505";
}

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
  theme: ThemeKey;
  worldName: string;
  startedOn?: string | null;
  topics: string[];
};

/** Creates a new couple and its first account. Signup is self-serve; nothing is global. */
export async function registerCouple(db: Db, input: RegisterInput): Promise<Registered | AccountError> {
  const email = normalizeEmail(input.email);
  const problem = emailProblem(email) ?? passwordProblem(input.password) ?? displayNameProblem(input.displayName);
  if (problem) return { ok: false, error: problem };

  const [existing] = await db.select({ id: people.id }).from(people).where(sql`lower(${people.email}) = ${email}`).limit(1);
  if (existing) return { ok: false, error: "An account with this email already exists. Sign in instead." };

  const recoveryCode = newRecoveryCode();
  const passwordHash = await hashPassword(input.password);
  try {
    const person = await db.transaction(async (tx) => {
      const [couple] = await tx.insert(couples).values({ name: input.worldName.trim().slice(0, 60), startedOn: input.startedOn ?? null }).returning();
      const created = await insertCoupleMember(tx, couple.id, 1, {
        displayName: input.displayName.trim(),
        email,
        passwordHash,
        recoveryHash: hashRecoveryCode(recoveryCode),
        theme: input.theme,
        topics: input.topics,
      });
      return { ...created, coupleId: couple.id };
    });
    return { ok: true, personId: person.id, slug: person.slug, sessionVersion: person.sessionVersion, recoveryCode, coupleId: person.coupleId };
  } catch (error) {
    if (duplicateEmail(error)) return { ok: false, error: "An account with this email already exists. Sign in instead." };
    throw error;
  }
}

export type LoginInput = { email: string; password: string; ip: string };
export type LoginResult = { ok: true; personId: string; slug: string; sessionVersion: number } | AccountError;

/** Verifies an email and password. Errors never say whether the account exists. */
export async function authenticate(db: Db, input: LoginInput): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  const ipOk = await consumeAttempt(db, "ip", input.ip, IP_WINDOW.limit, IP_WINDOW.ms);
  const accountOk = await consumeAttempt(db, "account", email, ACCOUNT_WINDOW.limit, ACCOUNT_WINDOW.ms);
  if (!ipOk || !accountOk) return { ok: false, error: THROTTLED };

  const [person] = await db
    .select({ id: people.id, slug: people.slug, hash: people.passwordHash, version: people.sessionVersion })
    .from(people)
    .where(sql`lower(${people.email}) = ${email}`)
    .limit(1);

  const matches = await bcrypt.compare(input.password, person?.hash ?? DUMMY_HASH);
  if (!person || !matches) return { ok: false, error: GENERIC_LOGIN_ERROR };

  await clearAttempts(db, "account", email);
  return { ok: true, personId: person.id, slug: person.slug, sessionVersion: person.version };
}

export type RecoveryInput = { email: string; code: string; newPassword: string; ip: string };
export type RecoveryResult = { ok: true; personId: string; slug: string; sessionVersion: number; recoveryCode: string } | AccountError;

/** Resets a password with the one-time recovery code issued at signup, then issues a new code. */
export async function recoverAccount(db: Db, input: RecoveryInput): Promise<RecoveryResult> {
  const email = normalizeEmail(input.email);
  const passwordIssue = passwordProblem(input.newPassword);
  if (passwordIssue) return { ok: false, error: passwordIssue };

  const ipOk = await consumeAttempt(db, "ip", input.ip, 10, 15 * 60_000);
  const accountOk = await consumeAttempt(db, "account", email, 5, 15 * 60_000);
  if (!ipOk || !accountOk) return { ok: false, error: THROTTLED };

  const [person] = await db
    .select({ id: people.id, slug: people.slug, recovery: people.recoveryHash, version: people.sessionVersion })
    .from(people)
    .where(sql`lower(${people.email}) = ${email}`)
    .limit(1);

  const ok = person?.recovery ? matchesRecovery(input.code, person.recovery) : false;
  if (!person || !ok) return { ok: false, error: GENERIC_RECOVERY_ERROR };

  const recoveryCode = newRecoveryCode();
  const [updated] = await db
    .update(people)
    .set({
      passwordHash: await hashPassword(input.newPassword),
      recoveryHash: hashRecoveryCode(recoveryCode),
      sessionVersion: person.version + 1,
    })
    .where(eq(people.id, person.id))
    .returning({ version: people.sessionVersion });
  await clearAttempts(db, "account", email);
  return { ok: true, personId: person.id, slug: person.slug, sessionVersion: updated.version, recoveryCode };
}

/** Changes a password for a signed-in person. Returns the new session version. */
export async function changePassword(db: Db, personId: string, current: string, next: string): Promise<{ ok: true; sessionVersion: number } | AccountError> {
  const issue = passwordProblem(next);
  if (issue) return { ok: false, error: issue };
  const [person] = await db.select({ hash: people.passwordHash, version: people.sessionVersion }).from(people).where(eq(people.id, personId));
  if (!person || !(await verifyPassword(current, person.hash))) return { ok: false, error: "Your current password isn't right." };
  const [updated] = await db
    .update(people)
    .set({ passwordHash: await hashPassword(next), sessionVersion: person.version + 1 })
    .where(eq(people.id, personId))
    .returning({ version: people.sessionVersion });
  return { ok: true, sessionVersion: updated.version };
}

/** Sets a first password for an account created through Google. */
export async function setPassword(db: Db, personId: string, next: string): Promise<{ ok: true; sessionVersion: number } | AccountError> {
  const issue = passwordProblem(next);
  if (issue) return { ok: false, error: issue };
  const [person] = await db.select({ passwordSet: people.passwordSet, version: people.sessionVersion }).from(people).where(eq(people.id, personId));
  if (!person) return { ok: false, error: "Your account could not be found." };
  if (person.passwordSet) return { ok: false, error: "A password is already set. Use Change password instead." };
  const [updated] = await db
    .update(people)
    .set({ passwordHash: await hashPassword(next), passwordSet: true, sessionVersion: person.version + 1 })
    .where(eq(people.id, personId))
    .returning({ version: people.sessionVersion });
  return { ok: true, sessionVersion: updated.version };
}

/**
 * Completes an email-verified reset. The ticket carries the session version the
 * account had when the code was verified, so a used or superseded ticket cannot
 * be replayed after the password changes.
 */
export async function resetPassword(
  db: Db,
  input: { personId: string; expectedVersion: number; newPassword: string },
): Promise<{ ok: true; slug: string; sessionVersion: number; recoveryCode: string } | AccountError> {
  const issue = passwordProblem(input.newPassword);
  if (issue) return { ok: false, error: issue };
  const recoveryCode = newRecoveryCode();
  const [updated] = await db
    .update(people)
    .set({
      passwordHash: await hashPassword(input.newPassword),
      passwordSet: true,
      recoveryHash: hashRecoveryCode(recoveryCode),
      sessionVersion: sql`${people.sessionVersion} + 1`,
    })
    .where(and(eq(people.id, input.personId), eq(people.sessionVersion, input.expectedVersion)))
    .returning({ slug: people.slug, version: people.sessionVersion });
  if (!updated) return { ok: false, error: "This reset has expired. Start again." };
  return { ok: true, slug: updated.slug, sessionVersion: updated.version, recoveryCode };
}

/** Issues a new one-time recovery code after re-checking the current password (when there is one). */
export async function rotateRecovery(db: Db, personId: string, current: string, code: string): Promise<boolean> {
  const [person] = await db.select({ hash: people.passwordHash, passwordSet: people.passwordSet }).from(people).where(eq(people.id, personId));
  if (!person) return false;
  if (person.passwordSet && !(await verifyPassword(current, person.hash))) return false;
  await db.update(people).set({ recoveryHash: hashRecoveryCode(code) }).where(eq(people.id, personId));
  return true;
}

/** Revokes every other device. */
export async function revokeOtherSessions(db: Db, personId: string): Promise<number> {
  const [updated] = await db
    .update(people)
    .set({ sessionVersion: sql`${people.sessionVersion} + 1` })
    .where(eq(people.id, personId))
    .returning({ version: people.sessionVersion });
  return updated.version;
}

export type GoogleResolution =
  | { ok: true; kind: "existing"; personId: string; slug: string; sessionVersion: number }
  | { ok: true; kind: "onboarding" }
  | AccountError;

const GOOGLE_LINK_ERROR = "This Google account can't be used to sign in. Try another account or your password.";

/**
 * Looks up a verified Google identity by its stable subject, then by verified
 * email. A first-time Google user is left in the onboarding step so no
 * half-configured account is created.
 */
export async function resolveGoogleAccount(db: Db, profile: GoogleProfile): Promise<GoogleResolution> {
  const email = normalizeEmail(profile.email);
  if (!profile.providerAccountId || emailProblem(email)) return { ok: false, error: GOOGLE_LINK_ERROR };
  if (!profile.emailVerified) return { ok: false, error: "Google could not verify this email address." };

  const [linked] = await db
    .select({ personId: authIdentities.personId })
    .from(authIdentities)
    .where(and(eq(authIdentities.provider, "google"), eq(authIdentities.providerAccountId, profile.providerAccountId)))
    .limit(1);

  if (linked) {
    const [account] = await db
      .select({ id: people.id, slug: coupleMembers.slug, version: people.sessionVersion })
      .from(people)
      .innerJoin(coupleMembers, and(eq(coupleMembers.personId, people.id), eq(coupleMembers.status, "active")))
      .where(eq(people.id, linked.personId))
      .limit(1);
    if (!account) return { ok: false, error: GOOGLE_LINK_ERROR };
    await db
      .update(authIdentities)
      .set({ lastUsedAt: new Date(), email, emailVerified: true })
      .where(and(eq(authIdentities.provider, "google"), eq(authIdentities.providerAccountId, profile.providerAccountId)));
    return { ok: true, kind: "existing", personId: account.id, slug: account.slug, sessionVersion: account.version };
  }

  const [byEmail] = await db
    .select({ id: people.id, slug: coupleMembers.slug, version: people.sessionVersion })
    .from(people)
    .innerJoin(coupleMembers, and(eq(coupleMembers.personId, people.id), eq(coupleMembers.status, "active")))
    .where(sql`lower(${people.email}) = ${email}`)
    .limit(1);

  if (!byEmail) return { ok: true, kind: "onboarding" };

  try {
    await db.insert(authIdentities).values({
      personId: byEmail.id,
      provider: "google",
      providerAccountId: profile.providerAccountId,
      email,
      emailVerified: true,
    });
  } catch (error) {
    if (duplicateEmail(error)) return { ok: false, error: GOOGLE_LINK_ERROR };
    throw error;
  }
  return { ok: true, kind: "existing", personId: byEmail.id, slug: byEmail.slug, sessionVersion: byEmail.version };
}

export type GoogleRegisterInput = {
  profile: GoogleProfile;
  displayName: string;
  theme: ThemeKey;
  worldName: string;
  startedOn?: string | null;
  topics: string[];
};

export type OAuthRegistered = { ok: true; personId: string; slug: string; sessionVersion: number; coupleId: string };

/** Creates a first world for a verified Google user, with no password until they choose one. */
export async function createGoogleAccount(db: Db, input: GoogleRegisterInput): Promise<OAuthRegistered | AccountError> {
  const email = normalizeEmail(input.profile.email);
  const worldName = input.worldName.trim().slice(0, 60);
  const problem = emailProblem(email) ?? displayNameProblem(input.displayName);
  if (problem) return { ok: false, error: problem };
  if (!worldName) return { ok: false, error: "Name your world." };
  if (!input.profile.emailVerified) return { ok: false, error: "Google could not verify this email address." };

  const [existing] = await db.select({ id: people.id }).from(people).where(sql`lower(${people.email}) = ${email}`).limit(1);
  if (existing) return { ok: false, error: "An account with this email already exists. Sign in with Google instead." };

  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  try {
    const person = await db.transaction(async (tx) => {
      const [couple] = await tx.insert(couples).values({ name: worldName, startedOn: input.startedOn ?? null }).returning();
      const created = await insertCoupleMember(tx, couple.id, 1, {
        displayName: input.displayName.trim(),
        email,
        passwordHash,
        passwordSet: false,
        recoveryHash: null,
        theme: input.theme,
        topics: input.topics,
      });
      await tx.insert(authIdentities).values({
        personId: created.id,
        provider: "google",
        providerAccountId: input.profile.providerAccountId,
        email,
        emailVerified: true,
      });
      return { ...created, coupleId: couple.id };
    });
    return { ok: true, personId: person.id, slug: person.slug, sessionVersion: person.sessionVersion, coupleId: person.coupleId };
  } catch (error) {
    if (duplicateEmail(error)) return { ok: false, error: "An account with this email already exists. Sign in with Google instead." };
    throw error;
  }
}

export function personForEmail(db: Db, email: string) {
  return db
    .select({ id: people.id })
    .from(people)
    .where(sql`lower(${people.email}) = ${normalizeEmail(email)}`)
    .limit(1);
}

