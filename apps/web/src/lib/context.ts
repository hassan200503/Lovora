import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { coupleMembers, couples, people, type Person } from "@/lib/db/schema";
import { readSession } from "@/lib/auth/session";
import { viewUrl } from "@/lib/media/storage";

export type PublicPerson = Omit<Person, "passwordHash" | "recoveryHash" | "sessionVersion"> & {
  /** The couple-scoped member slug: what `/world/<slug>` and `?as=` mean. */
  slug: string;
  avatarUrl: string | null;
};

async function strip(p: Person, slug: string): Promise<PublicPerson> {
  // Verifiers and the session-version counter stay on the server.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, recoveryHash, sessionVersion, ...rest } = p;
  const avatarUrl = p.avatarPath ? await viewUrl(p.avatarPath).catch(() => null) : null;
  // `slug` here is the membership slug, which replaces the account handle on
  // everything the couple's world renders or links to.
  return { ...rest, slug, avatarUrl };
}

export type Ctx = {
  me: PublicPerson;
  relationship: typeof couples.$inferSelect;
  /** Everyone else in the relationship (one person today, but not assumed). */
  partners: PublicPerson[];
  /** The other half, which is what every screen means by "your partner": null until they join. */
  partner: PublicPerson | null;
  members: PublicPerson[];
};

/**
 * The couple a person belongs to, from their own membership.
 *
 * A person can only be in one couple at a time — `couple_members_active_person`
 * enforces it in the database — so this is the couple, never one of several.
 * If the data ever disagrees, fail closed rather than guess whose world a
 * request belongs to.
 */
function soleActiveLink<T>(personId: string, links: T[]): T | null {
  if (links.length > 1) throw new Error(`person ${personId} belongs to ${links.length} active couples`);
  return links[0] ?? null;
}

/** Someone's context by id: their relationship and partner. Only for trusted server code. */
export async function ctxFor(personId: string, sessionVersion?: number): Promise<Ctx | null> {
  const db = await getDb();
  const [me] = await db.select().from(people).where(eq(people.id, personId));
  if (!me) return null;
  // A token issued before a password change or "sign out everywhere" is dead.
  if (sessionVersion !== undefined && me.sessionVersion !== sessionVersion) return null;
  const links = await db
    .select({ r: couples, slug: coupleMembers.slug })
    .from(coupleMembers)
    .innerJoin(couples, eq(couples.id, coupleMembers.coupleId))
    .where(and(eq(coupleMembers.personId, me.id), eq(coupleMembers.status, "active")));
  const link = soleActiveLink(me.id, links);
  if (!link) return null;
  const others = await db
    .select({ p: people, slug: coupleMembers.slug })
    .from(coupleMembers)
    .innerJoin(people, eq(people.id, coupleMembers.personId))
    .where(and(eq(coupleMembers.coupleId, link.r.id), eq(coupleMembers.status, "active"), ne(people.id, me.id)));
  const meP = await strip(me, link.slug);
  const partners = await Promise.all(others.map((o) => strip(o.p, o.slug)));
  const [partner = null] = partners;
  return { me: meP, relationship: link.r, partners, partner, members: [meP, ...partners] };
}

/** The signed-in person and their relationship, or null. Cached per request. */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const session = await readSession();
  return session ? ctxFor(session.personId, session.version) : null;
});

/** For pages and actions: the context, or a redirect to sign in. */
export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  return ctx;
}

/** A relationship member by slug, or null. Outsiders can never be resolved here. */
export async function memberBySlug(ctx: Ctx, slug: string): Promise<PublicPerson | null> {
  return ctx.members.find((m) => m.slug === slug) ?? null;
}

/**
 * Visibility rule used everywhere: the owner sees everything; other members of
 * the relationship see "shared" and "public"; nobody else sees anything but
 * "public" (and only via the public profile).
 */
export function visibleTo(ctx: Ctx, ownerId: string): ("private" | "shared" | "public")[] {
  return ctx.me.id === ownerId ? ["private", "shared", "public"] : ["shared", "public"];
}
