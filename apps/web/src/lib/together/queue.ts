/**
 * The room's up-next list, in order. It holds two kinds of things:
 * a song or video from the shared gallery (by media id), or a YouTube video
 * that was queued straight from search and never added to the gallery.
 *
 * The helpers here are pure so the ordering and de-duplication rules can be
 * tested without a database. `parseQueueData` is deliberately defensive: the
 * value comes back from a jsonb column and an older build may have written it,
 * so anything malformed is dropped rather than allowed to break the room.
 */
export type MediaQueueEntry = { kind: "media"; id: string };
export type YouTubeQueueEntry = { kind: "youtube"; videoId: string; title: string | null };
export type QueueEntry = MediaQueueEntry | YouTubeQueueEntry;

export const MAX_QUEUE = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YOUTUBE_ID = /^[\w-]{11}$/;

export function entryKey(entry: QueueEntry): string {
  return entry.kind === "media" ? `m:${entry.id}` : `y:${entry.videoId}`;
}

/** The key of whatever is on screen; `""` when the room is idle. */
export function currentEntryKey(mediaId: string | null, youtubeId: string | null): string {
  return mediaId ? `m:${mediaId}` : youtubeId ? `y:${youtubeId}` : "";
}

/**
 * Whether an `ended` report names the item still on screen. Players report the
 * bare id (the iframe never knew about the `m:`/`y:` prefix), so both forms count.
 */
export function isCurrentEntry(key: string, mediaId: string | null, youtubeId: string | null): boolean {
  return key === currentEntryKey(mediaId, youtubeId) || key === (mediaId ?? youtubeId ?? "");
}

export const mediaEntry = (id: string): MediaQueueEntry => ({ kind: "media", id });
export const youtubeEntry = (videoId: string, title: string | null = null): YouTubeQueueEntry => ({ kind: "youtube", videoId, title });

export function hasEntry(queue: readonly QueueEntry[], key: string): boolean {
  return queue.some((entry) => entryKey(entry) === key);
}

/** Adds to the end, ignoring an item that is already waiting or a queue that is already full. */
export function appendEntry(queue: readonly QueueEntry[], entry: QueueEntry, max = MAX_QUEUE): QueueEntry[] {
  const key = entryKey(entry);
  if (hasEntry(queue, key) || max <= 0 || queue.length >= max) return [...queue];
  return [...queue, entry];
}

export function removeEntry(queue: readonly QueueEntry[], key: string): QueueEntry[] {
  if (!queue.some((entry) => entryKey(entry) === key)) return [...queue];
  return queue.filter((entry) => entryKey(entry) !== key);
}

/** The gallery ids waiting, in order. Kept in step with the legacy `queue` uuid[] column. */
export function mediaIdsOf(queue: readonly QueueEntry[]): string[] {
  return queue.flatMap((entry) => (entry.kind === "media" ? [entry.id] : []));
}

/** The first item and the rest, or `null` for an empty queue. */
export function takeFirst(queue: readonly QueueEntry[]): { first: QueueEntry; rest: QueueEntry[] } | null {
  const [first, ...rest] = queue;
  return first ? { first, rest } : null;
}

export function parseQueueData(value: unknown): QueueEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: QueueEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    let entry: QueueEntry | null = null;
    if (item.kind === "media" && typeof item.id === "string" && UUID.test(item.id)) {
      entry = mediaEntry(item.id.toLowerCase());
    } else if (item.kind === "youtube" && typeof item.videoId === "string" && YOUTUBE_ID.test(item.videoId)) {
      const title = typeof item.title === "string" ? item.title.replace(/\s+/g, " ").trim().slice(0, 200) : "";
      entry = youtubeEntry(item.videoId, title || null);
    }
    if (!entry) continue;
    const key = entryKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= MAX_QUEUE) break;
  }
  return out;
}

/** Reads the legacy uuid[] column for rooms that queued something before this format existed. */
export function legacyQueueData(ids: readonly string[]): QueueEntry[] {
  return parseQueueData(ids.map((id) => ({ kind: "media", id })));
}
