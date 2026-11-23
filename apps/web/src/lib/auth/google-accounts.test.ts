import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: () => {} }));

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/lib/db/client", () => ({
  getDb: async () => holder.db,
}));

import { createGoogleAccount, registerCouple, resolveGoogleAccount } from "@/lib/auth/accounts";
import type { GoogleProfile } from "@/lib/auth/google";

type DbArg = Parameters<typeof registerCouple>[0];

let client: PGlite;
let appDb: DbArg;

const PASSWORD = "correct horse battery";
const SIGNUP = {
  email: "Person@Example.com",
  password: PASSWORD,
  displayName: "Person",
  theme: "us" as const,
  worldName: "Our World",
  topics: ["software"],
};

const PROFILE: GoogleProfile = {
  providerAccountId: "google-sub-123",
  email: "google@example.com",
  emailVerified: true,
  displayName: "Google Person",
};

beforeAll(async () => {
  client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  appDb = db as unknown as DbArg;
  holder.db = db;
}, 60_000);

beforeEach(async () => {
  await client.exec('TRUNCATE TABLE "auth_attempts", "auth_identities", "people", "couples" RESTART IDENTITY CASCADE');
}, 30_000);

afterAll(async () => {
  await client.close();
});

describe("Google sign-up", () => {
  it("creates a world, a passwordless person and a verified identity", async () => {
    const created = await createGoogleAccount(appDb, {
      profile: PROFILE,
      displayName: "Google Person",
      theme: "us",
      worldName: "Cloud World",
      topics: ["software", "nature"],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const [person] = await appDb.select().from(schema.people).where(eq(schema.people.id, created.personId));
    expect(person).toMatchObject({ email: "google@example.com", passwordSet: false, recoveryHash: null });

    const [identity] = await appDb.select().from(schema.authIdentities).where(eq(schema.authIdentities.personId, created.personId));
    expect(identity).toMatchObject({ provider: "google", providerAccountId: PROFILE.providerAccountId, emailVerified: true });
  });

  it("finds the same person by stable subject on the next sign-in", async () => {
    const created = await createGoogleAccount(appDb, { profile: PROFILE, displayName: "Google Person", theme: "us", worldName: "Cloud World", topics: ["software"] });
    if (!created.ok) throw new Error(created.error);

    const again = await resolveGoogleAccount(appDb, { ...PROFILE, email: "GOOGLE@example.com" });
    expect(again).toEqual({ ok: true, kind: "existing", personId: created.personId, slug: created.slug, sessionVersion: created.sessionVersion });

    const [identity] = await appDb.select().from(schema.authIdentities);
    expect(identity.lastUsedAt).toBeInstanceOf(Date);
  });

  it("asks for onboarding for a new verified email", async () => {
    expect(await resolveGoogleAccount(appDb, PROFILE)).toEqual({ ok: true, kind: "onboarding" });
  });

  it("refuses an unverified email", async () => {
    const result = await resolveGoogleAccount(appDb, { ...PROFILE, emailVerified: false });
    expect(result.ok).toBe(false);
  });

  it("refuses creating a second account for an existing email", async () => {
    await registerCouple(appDb, SIGNUP);
    const result = await createGoogleAccount(appDb, {
      profile: { ...PROFILE, email: SIGNUP.email },
      displayName: "Google Person",
      theme: "us",
      worldName: "Cloud World",
      topics: ["software"],
    });
    expect(result).toEqual({ ok: false, error: "An account with this email already exists. Sign in with Google instead." });
  });
});

describe("Google linking", () => {
  it("links a verified Google account to the existing password account with that email", async () => {
    const registered = await registerCouple(appDb, SIGNUP);
    if (!registered.ok) throw new Error(registered.error);

    const linked = await resolveGoogleAccount(appDb, { ...PROFILE, email: SIGNUP.email });
    expect(linked).toMatchObject({ ok: true, kind: "existing", personId: registered.personId, slug: registered.slug });

    const [identity] = await appDb.select().from(schema.authIdentities).where(eq(schema.authIdentities.personId, registered.personId));
    expect(identity.providerAccountId).toBe(PROFILE.providerAccountId);

    const again = await resolveGoogleAccount(appDb, { ...PROFILE, email: SIGNUP.email });
    expect(again).toMatchObject({ ok: true, kind: "existing", personId: registered.personId });
    expect(await appDb.select().from(schema.authIdentities)).toHaveLength(1);
  });

  it("refuses a second Google subject for the same person", async () => {
    const registered = await registerCouple(appDb, SIGNUP);
    if (!registered.ok) throw new Error(registered.error);
    await resolveGoogleAccount(appDb, { ...PROFILE, email: SIGNUP.email });

    const second = await resolveGoogleAccount(appDb, { ...PROFILE, providerAccountId: "another-sub", email: SIGNUP.email });
    expect(second.ok).toBe(false);
  });
});
