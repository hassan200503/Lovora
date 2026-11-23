import "server-only";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Ctx } from "@/lib/context";
import { getDb, type Db } from "@/lib/db/client";
import { media, presence, roomEvents, roomState } from "@/lib/db/schema";
import { mediaByIds, type MediaCard } from "@/lib/media/queries";
import { youtubeThumb } from "@/lib/media/youtube";
import { roomAvailable } from "@/lib/entitlements/server";
import {
  appendEntry,
  entryKey,
  hasEntry,
  isCurrentEntry,
  legacyQueueData,
  mediaEntry,
  mediaIdsOf,
  parseQueueData,
  removeEntry,
  takeFirst,
  youtubeEntry,
  type QueueEntry,
} from "./queue";

export class RoomUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoomUnavailableError";
  }
}

/** One waiting item, already resolved for the screen: a gallery card or a YouTube video. */
export type RoomQueueItem = {
  key: string;
  kind: "media" | "youtube";
  media: MediaCard | null;
  youtube: { id: string; title: string | null } | null;
  title: string;
  thumbUrl: string | null;
};

export type RoomPayload = {
  serverNow: string;
  version: number;
  state?: {
    playing: boolean;
    position: number;
    updatedAt: string;
    updatedBy: string | null;
    current: MediaCard | null;
    youtube: { id: string; title: string | null } | null;
    /** Gallery-only queue, kept for clients built before `queueItems` existed. */
    queue: MediaCard[];
    /** The ordered queue, including YouTube videos that aren't in the gallery. */
    queueItems: RoomQueueItem[];
  };
  events: { id: number; kind: string; body: string; slug: string; createdAt: string }[];
  partners: { slug: string; here: boolean; online: boolean; lastSeenAt: string | null }[];
};

const ONLINE_MS = 70_000;
const HERE_MS = 12_000;

const entriesOf = (row: typeof roomState.$inferSelect): QueueEntry[] => {
  const entries = parseQueueData(row.queueData);
  // A room that queued something before this column existed still has its uuid[] list.
  return entries.length ? entries : legacyQueueData(row.queue);
};

async function ensureRow(ctx: Ctx) {
  const access = await roomAvailable(ctx.relationship.id);
  if (!access.ok) throw new RoomUnavailableError(access.error);
  const db = await getDb();
  await db.insert(roomState).values({ coupleId: ctx.relationship.id }).onConflictDoNothing();
  const [row] = await db.select().from(roomState).where(eq(roomState.coupleId, ctx.relationship.id));
  return row;
}

/**
 * Everything a client needs to steer its player; the full state only when it changed.
 *
 * Presence is deliberately not written here. The site-wide pulse owns presence
 * (it is already running and knows which page you're on), so a one-second room
 * poll no longer writes a row on every tick.
 */
export async function readRoom(ctx: Ctx, knownVersion: number | null, afterEvent: number | null): Promise<RoomPayload> {
  const db = await getDb();
  const now = new Date();
  const row = await ensureRow(ctx);
  const partnerIds = ctx.partners.map((p) => p.id);
  const [events, states] = await Promise.all([
    afterEvent === null
      ? db
          .select()
          .from(roomEvents)
          .where(and(eq(roomEvents.coupleId, ctx.relationship.id), inArray(roomEvents.kind, ["chat", "react", "system"])))
          .orderBy(desc(roomEvents.id))
          .limit(40)
          .then((r) => r.reverse())
      : db
          .select()
          .from(roomEvents)
          .where(and(eq(roomEvents.coupleId, ctx.relationship.id), gt(roomEvents.id, afterEvent)))
          .orderBy(roomEvents.id)
          .limit(100),
    partnerIds.length ? db.select().from(presence).where(inArray(presence.personId, partnerIds)) : Promise.resolve([]),
  ]);

  const slug = (id: string | null) => ctx.members.find((m) => m.id === id)?.slug ?? "";
  const payload: RoomPayload = {
    serverNow: "",
    version: row.version,
    events: events.map((e) => ({ id: e.id, kind: e.kind, body: e.body, slug: slug(e.personId), createdAt: e.createdAt.toISOString() })),
    partners: ctx.partners.map((p) => {
      const s = states.find((x) => x.personId === p.id);
      const age = s ? now.getTime() - s.lastSeenAt.getTime() : Infinity;
      return { slug: p.slug, online: !!s && s.place !== "away" && age < ONLINE_MS, here: !!s && s.place === "room" && age < HERE_MS, lastSeenAt: s?.lastSeenAt.toISOString() ?? null };
    }),
  };

  if (knownVersion !== row.version) {
    const entries = entriesOf(row);
    const ids = [...new Set([row.mediaId, ...mediaIdsOf(entries)].filter((x): x is string => !!x))];
    const cards = await mediaByIds(ctx, ids);
    const cardOf = (id: string) => cards.find((c) => c.id === id) ?? null;
    const queueItems: RoomQueueItem[] = [];
    for (const entry of entries) {
      if (entry.kind === "youtube") {
        queueItems.push({
          key: entryKey(entry),
          kind: "youtube",
          media: null,
          youtube: { id: entry.videoId, title: entry.title },
          title: entry.title ?? "YouTube video",
          thumbUrl: youtubeThumb(entry.videoId, "mq"),
        });
        continue;
      }
      const card = cardOf(entry.id);
      if (!card || card.kind === "photo") continue;
      queueItems.push({ key: entryKey(entry), kind: "media", media: card, youtube: null, title: titleOf(card), thumbUrl: card.thumbUrl });
    }
    payload.state = {
      playing: row.playing,
      position: row.position,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: slug(row.updatedBy),
      current: row.mediaId ? cardOf(row.mediaId) : null,
      youtube: !row.mediaId && row.youtubeId ? { id: row.youtubeId, title: row.title } : null,
      queue: queueItems.flatMap((item) => (item.media ? [item.media] : [])),
      queueItems,
    };
  }
  // Stamped as the reply leaves, so a phone can estimate the server's clock from the round trip.
  payload.serverNow = new Date().toISOString();
  return payload;
}

export const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("load"), mediaId: z.uuid().optional(), youtubeId: z.string().regex(/^[\w-]{11}$/).optional(), title: z.string().max(200).optional(), play: z.boolean().default(true) }),
  // `at`: the moment (server clock, as the phone estimates it) the position was read, so the
  // time the request spent travelling doesn't put the other phone behind.
  z.object({ type: z.literal("play"), position: z.number().min(0).max(86400), at: z.number().optional() }),
  z.object({ type: z.literal("pause"), position: z.number().min(0).max(86400), at: z.number().optional() }),
  z.object({ type: z.literal("seek"), position: z.number().min(0).max(86400), at: z.number().optional() }),
  z.object({ type: z.literal("next") }),
  // `version`: the state the phone judged finished; a newer state (the same track started again) isn't.
  z.object({ type: z.literal("ended"), key: z.string().max(64), version: z.number().int().optional() }),
  z.object({ type: z.literal("queue"), mediaId: z.uuid() }),
  z.object({ type: z.literal("dequeue"), mediaId: z.uuid() }),
  z.object({ type: z.literal("queueYouTube"), videoId: z.string().regex(/^[\w-]{11}$/), title: z.string().max(200).optional() }),
  z.object({ type: z.literal("dequeueYouTube"), videoId: z.string().regex(/^[\w-]{11}$/) }),
  z.object({ type: z.literal("chat"), body: z.string().min(1).max(500) }),
  z.object({ type: z.literal("react"), emoji: z.enum(["❤️", "😂", "😍", "🔥", "😮", "👏", "🥹", "💃"]) }),
]);
export type RoomAction = z.infer<typeof action>;

async function youtubeTitle(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: AbortSignal.timeout(4000) });
    return res.ok ? (((await res.json()) as { title?: string }).title?.slice(0, 200) ?? null) : null;
  } catch {
    return null;
  }
}

const titleOf = (c: MediaCard | undefined) => c?.title ?? (c?.kind === "photo" ? "a photo" : c?.kind === "video" ? "a video" : "a song");

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Locks the couple's room row while a queue change is computed, so two phones
 * queueing at the same moment cannot overwrite each other's addition.
 */
async function mutateQueue(ctx: Ctx, mutate: (entries: QueueEntry[]) => QueueEntry[] | null): Promise<{ entries: QueueEntry[]; changed: boolean }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(roomState).where(eq(roomState.coupleId, ctx.relationship.id)).for("update");
    if (!row) return { entries: [], changed: false };
    const before = entriesOf(row);
    const after = mutate(before);
    if (!after) return { entries: before, changed: false };
    await tx
      .update(roomState)
      .set({
        version: sql`${roomState.version} + 1`,
        updatedAt: new Date(),
        updatedBy: ctx.me.id,
        queueData: after,
        queue: mediaIdsOf(after),
      })
      .where(eq(roomState.coupleId, ctx.relationship.id));
    return { entries: after, changed: true };
  });
}

/** Pops the first item that can still play; deleted gallery items are skipped. */
async function advanceRoom(ctx: Ctx, tx: Tx, row: typeof roomState.$inferSelect): Promise<void> {
  const current = entriesOf(row);
  const mediaIds = mediaIdsOf(current);
  const existing = mediaIds.length ? await tx.select({ id: media.id }).from(media).where(and(eq(media.coupleId, ctx.relationship.id), inArray(media.id, mediaIds))) : [];
  const playable = new Set(existing.map((m) => m.id));
  const clean = current.filter((entry) => entry.kind === "youtube" || playable.has(entry.id));
  const next = takeFirst(clean);
  const rest = next?.rest ?? [];
  const base = {
    version: sql`${roomState.version} + 1`,
    updatedAt: new Date(),
    updatedBy: ctx.me.id,
    position: 0,
    queueData: rest,
    queue: mediaIdsOf(rest),
  };
  if (!next) {
    await tx.update(roomState).set({ ...base, playing: false }).where(eq(roomState.coupleId, ctx.relationship.id));
    return;
  }
  await tx
    .update(roomState)
    .set(
      next.first.kind === "media"
        ? { ...base, mediaId: next.first.id, youtubeId: null, title: null, playing: true }
        : { ...base, mediaId: null, youtubeId: next.first.videoId, title: next.first.title, playing: true },
    )
    .where(eq(roomState.coupleId, ctx.relationship.id));
}

/** Loads one item and removes it from wherever it was waiting in the queue. */
async function startItem(ctx: Ctx, fields: { mediaId?: string; youtubeId?: string; title?: string | null; play: boolean }) {
  const db = await getDb();
  const key = fields.mediaId ? `m:${fields.mediaId}` : fields.youtubeId ? `y:${fields.youtubeId}` : "";
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(roomState).where(eq(roomState.coupleId, ctx.relationship.id)).for("update");
    if (!row) return;
    const entries = removeEntry(entriesOf(row), key);
    await tx
      .update(roomState)
      .set({
        version: sql`${roomState.version} + 1`,
        updatedAt: new Date(),
        updatedBy: ctx.me.id,
        mediaId: fields.mediaId ?? null,
        youtubeId: fields.mediaId ? null : (fields.youtubeId ?? null),
        title: fields.mediaId ? null : (fields.title ?? null),
        position: 0,
        playing: fields.play,
        queueData: entries,
        queue: mediaIdsOf(entries),
      })
      .where(eq(roomState.coupleId, ctx.relationship.id));
  });
}

/** Applies one action. Player changes bump the version so every client re-syncs. */
export async function applyRoom(ctx: Ctx, a: RoomAction): Promise<void> {
  const db = await getDb();
  const rel = ctx.relationship.id;
  const row = await ensureRow(ctx);
  const bump = { version: sql`${roomState.version} + 1`, updatedAt: new Date(), updatedBy: ctx.me.id };
  const log = (kind: string, body: string) => db.insert(roomEvents).values({ coupleId: rel, personId: ctx.me.id, kind, body });

  switch (a.type) {
    case "chat":
      await log("chat", a.body.trim());
      return;
    case "react":
      await log("react", a.emoji);
      return;
    case "play":
    case "pause":
    case "seek": {
      const now = Date.now();
      // A clock estimate can be a few seconds out after a tunnel; anything further is this phone's clock, not the room's.
      const at = a.at !== undefined && Math.abs(now - a.at) < 5000 ? new Date(a.at) : new Date(now);
      await db
        .update(roomState)
        .set({ ...bump, updatedAt: at, position: a.position, ...(a.type === "seek" ? {} : { playing: a.type === "play" }) })
        .where(eq(roomState.coupleId, rel));
      return;
    }
    case "load": {
      if (a.mediaId) {
        const [card] = await mediaByIds(ctx, [a.mediaId]);
        if (!card || card.kind === "photo") return;
        await startItem(ctx, { mediaId: card.id, play: a.play });
        await log("system", `started ${card.kind === "song" ? "playing" : "watching"} ${titleOf(card)}`);
      } else if (a.youtubeId) {
        const title = a.title?.trim().slice(0, 200) || (await youtubeTitle(a.youtubeId));
        await startItem(ctx, { youtubeId: a.youtubeId, title, play: a.play });
        await log("system", `started ${title ? `“${title}”` : "a video"}`);
      }
      return;
    }
    case "next":
    case "ended": {
      // "ended" names the track that finished, so two phones finishing together advance only once.
      if (a.type === "ended" && (!isCurrentEntry(a.key, row.mediaId, row.youtubeId) || (a.version !== undefined && a.version !== row.version))) return;
      await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(roomState).where(eq(roomState.coupleId, rel)).for("update");
        if (!locked) return;
        // A partner may have advanced already while this phone was finishing.
        if (a.type === "ended") {
          if (locked.version !== row.version || !isCurrentEntry(a.key, locked.mediaId, locked.youtubeId)) return;
        }
        await advanceRoom(ctx, tx, locked);
      });
      return;
    }
    case "queue": {
      const [card] = await mediaByIds(ctx, [a.mediaId]);
      if (!card || card.kind === "photo") return;
      const result = await mutateQueue(ctx, (entries) => (hasEntry(entries, `m:${card.id}`) ? null : appendEntry(entries, mediaEntry(card.id))));
      if (result.changed) await log("system", `queued ${titleOf(card)}`);
      return;
    }
    case "dequeue":
      await mutateQueue(ctx, (entries) => (hasEntry(entries, `m:${a.mediaId}`) ? removeEntry(entries, `m:${a.mediaId}`) : null));
      return;
    case "queueYouTube": {
      const title = a.title?.trim().slice(0, 200) || (await youtubeTitle(a.videoId));
      const result = await mutateQueue(ctx, (entries) => (hasEntry(entries, `y:${a.videoId}`) ? null : appendEntry(entries, youtubeEntry(a.videoId, title))));
      if (result.changed) await log("system", `queued ${title ? `“${title}”` : "a video"}`);
      return;
    }
    case "dequeueYouTube":
      await mutateQueue(ctx, (entries) => (hasEntry(entries, `y:${a.videoId}`) ? removeEntry(entries, `y:${a.videoId}`) : null));
      return;
  }
}
