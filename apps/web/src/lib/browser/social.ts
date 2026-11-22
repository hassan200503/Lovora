import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Ctx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { people, shortComments, shortLinks, shortReactions, type ShortLinkMeta } from "@/lib/db/schema";
import type { ShortComment, ShortItem } from "./types";

/**
 * Lovora's half of Shorts: private reactions, comments and saved links. Platform
 * counts come from the public video pages; these numbers are only this couple's.
 * Every statement carries both person and couple scope.
 */

export type Social = Pick<ShortItem, "hearts" | "liked" | "saved" | "comments">;

export async function socialFor(ctx: Ctx, keys: string[]): Promise<Map<string, Social>> {
  const out = new Map<string, Social>();
  const unique = [...new Set(keys)].slice(0, 200);
  for (const key of unique) out.set(key, { hearts: 0, liked: false, saved: false, comments: 0 });
  if (unique.length === 0) return out;
  const db = await getDb();
  const coupleId = ctx.relationship.id;
  const [reactions, comments] = await Promise.all([
    db
      .select({ videoKey: shortReactions.videoKey, kind: shortReactions.kind, personId: shortReactions.personId })
      .from(shortReactions)
      .where(and(eq(shortReactions.coupleId, coupleId), inArray(shortReactions.videoKey, unique))),
    db
      .select({ videoKey: shortComments.videoKey, n: sql<number>`count(*)` })
      .from(shortComments)
      .where(and(eq(shortComments.coupleId, coupleId), inArray(shortComments.videoKey, unique)))
      .groupBy(shortComments.videoKey),
  ]);
  for (const row of reactions) {
    const entry = out.get(row.videoKey);
    if (!entry) continue;
    if (row.kind === "like") entry.hearts += 1;
    if (row.personId === ctx.me.id) {
      if (row.kind === "like") entry.liked = true;
      if (row.kind === "save") entry.saved = true;
    }
  }
  for (const row of comments) {
    const entry = out.get(row.videoKey);
    if (entry) entry.comments = Number(row.n) || 0;
  }
  return out;
}

export function withSocial(items: ShortItem[], social: Map<string, Social>): ShortItem[] {
  return items.map((item) => ({ ...item, ...(social.get(item.key) ?? { hearts: 0, liked: false, saved: false, comments: 0 }) }));
}

export async function setReaction(ctx: Ctx, videoKey: string, kind: "like" | "save", on: boolean): Promise<Social> {
  const db = await getDb();
  const coupleId = ctx.relationship.id;
  if (on) {
    await db
      .insert(shortReactions)
      .values({ personId: ctx.me.id, coupleId, videoKey, kind })
      .onConflictDoNothing();
  } else {
    await db
      .delete(shortReactions)
      .where(and(eq(shortReactions.coupleId, coupleId), eq(shortReactions.personId, ctx.me.id), eq(shortReactions.videoKey, videoKey), eq(shortReactions.kind, kind)));
  }
  return (await socialFor(ctx, [videoKey])).get(videoKey)!;
}

export async function listComments(ctx: Ctx, videoKey: string): Promise<ShortComment[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: shortComments.id, body: shortComments.body, createdAt: shortComments.createdAt, personId: shortComments.personId, name: people.displayName })
    .from(shortComments)
    .innerJoin(people, eq(people.id, shortComments.personId))
    .where(and(eq(shortComments.coupleId, ctx.relationship.id), eq(shortComments.videoKey, videoKey)))
    .orderBy(asc(shortComments.createdAt))
    .limit(100);
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    name: row.name,
    slug: null,
    mine: row.personId === ctx.me.id,
  }));
}

export function cleanComment(raw: unknown): string | null {
  const body = String(raw ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  return body.length >= 1 && body.length <= 500 ? body : null;
}

const recentComments = new Map<string, number[]>();
function commentingAllowed(personId: string): boolean {
  const now = Date.now();
  const list = (recentComments.get(personId) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 12) return false;
  list.push(now);
  recentComments.set(personId, list);
  return true;
}

export async function addComment(ctx: Ctx, videoKey: string, body: string): Promise<ShortComment | null> {
  if (!commentingAllowed(ctx.me.id)) return null;
  const db = await getDb();
  const [row] = await db
    .insert(shortComments)
    .values({ coupleId: ctx.relationship.id, personId: ctx.me.id, videoKey, body })
    .returning();
  if (!row) return null;
  return { id: row.id, body: row.body, createdAt: row.createdAt.toISOString(), name: ctx.me.displayName, slug: null, mine: true };
}

export async function deleteComment(ctx: Ctx, id: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .delete(shortComments)
    .where(and(eq(shortComments.id, id), eq(shortComments.coupleId, ctx.relationship.id), eq(shortComments.personId, ctx.me.id)))
    .returning({ id: shortComments.id });
  return rows.length > 0;
}

const MAX_LINKS = 60;

export async function addShortLink(ctx: Ctx, item: ShortItem): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const db = await getDb();
  const coupleId = ctx.relationship.id;
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(shortLinks).where(eq(shortLinks.coupleId, coupleId));
  if ((Number(n) || 0) >= MAX_LINKS) return { ok: false, error: `You can keep up to ${MAX_LINKS} links. Remove one from the saved list first.` };
  const meta: ShortLinkMeta = { title: item.title, author: item.author, thumb: item.thumb, url: item.url };
  await db
    .insert(shortLinks)
    .values({ coupleId, addedBy: ctx.me.id, videoKey: item.key, url: item.url, meta })
    .onConflictDoUpdate({ target: [shortLinks.coupleId, shortLinks.videoKey], set: { url: item.url, meta } });
  return { ok: true, message: "Added to Shorts" };
}

export async function listShortLinks(ctx: Ctx): Promise<ShortItem[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(shortLinks)
    .where(eq(shortLinks.coupleId, ctx.relationship.id))
    .orderBy(desc(shortLinks.createdAt))
    .limit(MAX_LINKS);
  return rows.map((row) => {
    let authorUrl: string | null = null;
    try {
      const url = new URL(row.url);
      const handle = /^\/@([\w.-]{2,30})\//.exec(url.pathname)?.[1];
      if (handle && url.hostname.endsWith("tiktok.com")) authorUrl = `https://www.tiktok.com/@${handle}`;
    } catch {
      // A stored URL we can no longer parse still renders as a link.
    }
    return {
      key: row.videoKey,
      platform: "tiktok" as const,
      videoId: row.videoKey.slice(3),
      title: row.meta.title,
      author: row.meta.author,
      authorUrl,
      url: row.url,
      thumb: row.meta.thumb,
      publishedAt: row.createdAt.toISOString(),
      durationSec: null,
      viewCount: null,
      likeCount: null,
      commentCount: null,
      hearts: 0,
      liked: false,
      saved: true,
      comments: 0,
    };
  });
}
