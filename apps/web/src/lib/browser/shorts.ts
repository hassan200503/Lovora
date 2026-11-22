import "server-only";
import { unstable_cache } from "next/cache";
import { XMLParser } from "fast-xml-parser";
import { parseIsoDuration, youtubeThumb } from "@/lib/media/youtube";
import type { ShortItem } from "./types";

/**
 * Shorts are real, public videos embedded with each platform's own player.
 * Nothing is downloaded, re-hosted or proxied: TikTok and YouTube keep control
 * of playback, monetisation and their terms. We only read public profile pages
 * for ids and public counts, cache the result for half an hour, and always link
 * back to the original.
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const PAGE_SIZE = 6;
const CYCLE_PAGE_LIMIT = 10_000;

type Cursor = { o: number; c: number };

const PROFILES: { handle: string; name: string }[] = [
  { handle: "nasa", name: "NASA" },
  { handle: "natgeo", name: "National Geographic" },
  { handle: "fifa", name: "FIFA" },
  { handle: "nba", name: "NBA" },
  { handle: "f1", name: "Formula 1" },
  { handle: "bbcnews", name: "BBC News" },
  { handle: "redbull", name: "Red Bull" },
  { handle: "guinnessworldrecords", name: "Guinness World Records" },
  { handle: "thedodo", name: "The Dodo" },
  { handle: "wwf", name: "WWF" },
];

const CHANNELS: { id: string; name: string }[] = [
  { id: "UCLA_DiR1FfKNvjuUpBHmylQ", name: "NASA" },
  { id: "UCpVm7bg6pXKo1Pr6k5kxG9A", name: "National Geographic" },
  { id: "UCpcTrCXblq78GZrTUTLWeBw", name: "FIFA" },
  { id: "UCWJ2lWNubArHWmf3FIHbfcQ", name: "NBA" },
  { id: "UCB_qr75-ydFVKSF9Dmo6izg", name: "Formula 1" },
  { id: "UC16niRr50-MSBwiO3YDb3RA", name: "BBC News" },
  { id: "UCblfuW_4rakIf2h6aqANefA", name: "Red Bull" },
];

const VIDEO_PER_PROFILE = 8;
const VIDEOS_PER_CHANNEL = 14;

/** Extracts the first complete JSON object/array after a marker, respecting strings. */
function jsonAfter<T>(text: string, marker: string, open: "{" | "[", close: "}" | "]"): T | null {
  const at = text.indexOf(marker);
  if (at < 0) return null;
  const start = text.indexOf(open, at + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, i + 1)) as T;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function str(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function https(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function count(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

type TtListItem = {
  id?: string;
  desc?: string;
  coverUrl?: string;
  originCoverUrl?: string;
  playCount?: number | string;
  authorUniqueId?: string;
};

async function readTikTokProfile(handle: string, name: string): Promise<ShortItem[]> {
  const res = await fetch(`https://www.tiktok.com/embed/@${encodeURIComponent(handle)}`, {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TikTok ${res.status}`);
  const html = await res.text();
  const list = jsonAfter<TtListItem[]>(html, '"videoList":', "[", "]");
  if (!list) return [];
  const rawName = /\"nickname\":\"((?:\\.|[^\"\\])*)\"/.exec(html)?.[1];
  let nickname = name;
  try {
    nickname = str(rawName ? JSON.parse(`"${rawName}"`) : "", 80) || name;
  } catch {
    nickname = name;
  }
  const seen = new Set<string>();
  const items: ShortItem[] = [];
  for (const item of list) {
    const id = String(item.id ?? "");
    if (!/^\d{15,25}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const cover = https(item.coverUrl) ?? https(item.originCoverUrl);
    items.push({
      key: `tt:${id}`,
      platform: "tiktok",
      videoId: id,
      title: str(item.desc, 180) || `${nickname} on TikTok`,
      author: nickname,
      authorUrl: `https://www.tiktok.com/@${handle}`,
      url: `https://www.tiktok.com/@${handle}/video/${id}`,
      thumb: cover,
      publishedAt: null,
      durationSec: null,
      viewCount: count(item.playCount),
      likeCount: null,
      commentCount: null,
      hearts: 0,
      liked: false,
      saved: false,
      comments: 0,
    });
    if (items.length >= VIDEO_PER_PROFILE) break;
  }
  return items;
}

const cachedProfiles = PROFILES.map((profile) => ({
  ...profile,
  load: unstable_cache(() => readTikTokProfile(profile.handle, profile.name), ["browser-tiktok", profile.handle], { revalidate: 1800 }),
}));

type YtEntry = {
  id?: string;
  title?: string;
  published?: string;
  author?: { name?: string };
  "media:group"?: { "media:thumbnail"?: { "@_url"?: string } };
  "yt:videoId"?: string;
};

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });

async function readYouTubeChannel(id: string, name: string): Promise<ShortItem[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`, {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`YouTube ${res.status}`);
  const feed = xml.parse(await res.text()) as { feed?: { entry?: YtEntry | YtEntry[] } };
  const raw = feed.feed?.entry;
  const entries = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
  const items: ShortItem[] = [];
  for (const entry of entries.slice(0, VIDEOS_PER_CHANNEL)) {
    const videoId = String(entry["yt:videoId"] ?? String(entry.id ?? "").replace("yt:video:", ""));
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) continue;
    const published = entry.published ? new Date(entry.published) : null;
    items.push({
      key: `yt:${videoId}`,
      platform: "youtube",
      videoId,
      title: str(entry.title, 180) || `${name} on YouTube`,
      author: str(entry.author?.name, 80) || name,
      authorUrl: `https://www.youtube.com/channel/${id}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumb: https(entry["media:group"]?.["media:thumbnail"]?.["@_url"]) ?? youtubeThumb(videoId),
      publishedAt: published && !Number.isNaN(published.getTime()) ? published.toISOString() : null,
      durationSec: null,
      viewCount: null,
      likeCount: null,
      commentCount: null,
      hearts: 0,
      liked: false,
      saved: false,
      comments: 0,
    });
  }
  return items;
}

const cachedChannels = CHANNELS.map((channel) => ({
  ...channel,
  load: unstable_cache(() => readYouTubeChannel(channel.id, channel.name), ["browser-youtube", channel.id], { revalidate: 1800 }),
}));

type YtStats = { id?: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }; contentDetails?: { duration?: string } };

async function statsFor(ids: string[]): Promise<Map<string, { views: number | null; likes: number | null; comments: number | null; secs: number | null }>> {
  const key = process.env.YOUTUBE_API_KEY;
  const out = new Map<string, { views: number | null; likes: number | null; comments: number | null; secs: number | null }>();
  if (!key || ids.length === 0) return out;
  const sorted = [...new Set(ids)].sort();
  const load = unstable_cache(
    async () => {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${sorted.join(",")}&key=${key}`, {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`YouTube stats ${res.status}`);
      return ((await res.json()) as { items?: YtStats[] }).items ?? [];
    },
    ["browser-youtube-stats", sorted.join(",")],
    { revalidate: 600 },
  );
  try {
    for (const item of await load()) {
      const id = String(item.id ?? "");
      if (!id) continue;
      out.set(id, {
        views: count(item.statistics?.viewCount),
        likes: count(item.statistics?.likeCount),
        comments: count(item.statistics?.commentCount),
        secs: item.contentDetails?.duration ? parseIsoDuration(item.contentDetails.duration) : null,
      });
    }
  } catch {
    // Counts are a nicety; the video still plays without them.
  }
  return out;
}

/** Round-robin across profiles so the first screen isn't all one creator. */
function spread(lists: ShortItem[][], limit: number): ShortItem[] {
  const out: ShortItem[] = [];
  for (let round = 0; round < limit; round++) {
    for (const list of lists) {
      const item = list[round];
      if (item) out.push(item);
    }
  }
  return out;
}

async function readPool(): Promise<ShortItem[]> {
  const [tiktok, youtube] = await Promise.all([
    Promise.all(cachedProfiles.map((p) => p.load().catch(() => [] as ShortItem[]))),
    Promise.all(cachedChannels.map((c) => c.load().catch(() => [] as ShortItem[]))),
  ]);
  const tt = spread(tiktok, VIDEO_PER_PROFILE);
  const yt = spread(youtube, VIDEOS_PER_CHANNEL);
  const out: ShortItem[] = [];
  for (let i = 0; i < Math.max(Math.ceil(tt.length / 2), yt.length); i++) {
    if (tt[i * 2]) out.push(tt[i * 2]!);
    if (tt[i * 2 + 1]) out.push(tt[i * 2 + 1]!);
    if (yt[i]) out.push(yt[i]!);
  }
  return out;
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function decodeCursor(raw: string | null | undefined): Cursor {
  if (!raw) return { o: 0, c: 0 };
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<Cursor>;
    const o = Math.max(0, Math.min(CYCLE_PAGE_LIMIT * PAGE_SIZE, Math.floor(Number(parsed.o) || 0)));
    const c = Math.max(0, Math.min(1000, Math.floor(Number(parsed.c) || 0)));
    return { o, c };
  } catch {
    return { o: 0, c: 0 };
  }
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function dedupe(items: ShortItem[]): ShortItem[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.key) ? false : (seen.add(item.key), true)));
}

/**
 * A page of the vertical feed. `saved` (this couple's added links) comes first.
 * Once the curated pool is exhausted the cursor starts a new cycle with a
 * different deterministic order, so the feed keeps going without repeating
 * back-to-back; fresh upstream items arrive as caches refresh.
 */
export async function shortsFeed(cursorRaw: string | null | undefined, saved: ShortItem[]): Promise<{ items: ShortItem[]; nextCursor: string | null; notice: string | null }> {
  const { o, c } = decodeCursor(cursorRaw);
  const pool = await readPool();
  let all = dedupe([...saved, ...pool]);
  if (c > 0 && all.length > 1) {
    all = [...all].sort((a, b) => hash(`${a.key}:${c}`) - hash(`${b.key}:${c}`));
  }
  if (all.length === 0) {
    return { items: [], nextCursor: null, notice: "Shorts are quiet right now. Add a TikTok link, or check back in a few minutes." };
  }
  const offset = o % all.length;
  const page = all.slice(offset, offset + PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;
  const next: Cursor = nextOffset >= all.length ? { o: 0, c: Math.min(1000, c + 1) } : { o: nextOffset, c };
  const ytIds = page.filter((i) => i.platform === "youtube").map((i) => i.videoId);
  const stats = await statsFor(ytIds);
  const items = page.map((item) => {
    const s = item.platform === "youtube" ? stats.get(item.videoId) : undefined;
    return s ? { ...item, viewCount: s.views, likeCount: s.likes, commentCount: s.comments, durationSec: s.secs } : item;
  });
  return { items, nextCursor: encodeCursor(next), notice: null };
}

export function isShortKey(value: unknown): value is string {
  return typeof value === "string" && /^(?:tt:\d{15,25}|yt:[A-Za-z0-9_-]{11})$/.test(value);
}

const TIKTOK_HOSTS = new Set(["tiktok.com", "m.tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);

function tiktokId(url: URL): { id: string; handle: string | null } | null {
  const byVideo = /^\/@([\w.-]{2,30})\/video\/(\d{15,25})\/?$/.exec(url.pathname);
  if (byVideo) return { id: byVideo[2]!, handle: byVideo[1]! };
  const legacy = /^\/v\/(\d{15,25})\.html$/.exec(url.pathname);
  if (legacy) return { id: legacy[1]!, handle: null };
  return null;
}

/** Resolves a full TikTok video URL (or a vm./vt. short link) into a feed item. No media is fetched. */
export async function resolveTikTokLink(raw: string): Promise<ShortItem | null> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!TIKTOK_HOSTS.has(url.hostname.toLowerCase())) return null;
  if (url.username || url.password) return null;
  if (url.protocol === "http:") url.protocol = "https:";
  if (!tiktokId(url)) {
    const shortHost = url.hostname === "vm.tiktok.com" || url.hostname === "vt.tiktok.com";
    if (!shortHost && !url.pathname.startsWith("/t/")) return null;
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
      if (!res.ok) return null;
      url = new URL(res.url);
    } catch {
      return null;
    }
  }
  const parsed = tiktokId(url);
  if (!parsed) return null;
  const canonical = `https://www.tiktok.com/${parsed.handle ? `@${parsed.handle}/` : ""}video/${parsed.id}`;
  const fallback: ShortItem = {
    key: `tt:${parsed.id}`,
    platform: "tiktok",
    videoId: parsed.id,
    title: "TikTok video",
    author: parsed.handle ? `@${parsed.handle}` : "TikTok",
    authorUrl: parsed.handle ? `https://www.tiktok.com/@${parsed.handle}` : null,
    url: canonical,
    thumb: null,
    publishedAt: null,
    durationSec: null,
    viewCount: null,
    likeCount: null,
    commentCount: null,
    hearts: 0,
    liked: false,
    saved: false,
    comments: 0,
  };
  try {
    const res = await fetch(canonical, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!res.ok) return fallback;
    const html = await res.text();
    const item = jsonAfter<{
      desc?: string;
      createTime?: string | number;
      id?: string;
      author?: { nickname?: string; uniqueId?: string };
      stats?: { playCount?: number | string; diggCount?: number | string; commentCount?: number | string };
      video?: { cover?: string; duration?: number };
    }>(html, '"itemStruct":', "{", "}");
    if (!item || String(item.id ?? parsed.id) !== parsed.id) return fallback;
    const handle = str(item.author?.uniqueId, 30) || parsed.handle;
    const created = Number(item.createTime);
    return {
      ...fallback,
      title: str(item.desc, 180) || fallback.title,
      author: str(item.author?.nickname, 80) || fallback.author,
      authorUrl: handle ? `https://www.tiktok.com/@${handle}` : fallback.authorUrl,
      url: handle ? `https://www.tiktok.com/@${handle}/video/${parsed.id}` : canonical,
      thumb: https(item.video?.cover) ?? fallback.thumb,
      publishedAt: Number.isFinite(created) && created > 0 ? new Date(created * 1000).toISOString() : null,
      durationSec: Number.isFinite(item.video?.duration) ? Math.round(item.video!.duration!) : null,
      viewCount: count(item.stats?.playCount),
      likeCount: count(item.stats?.diggCount),
      commentCount: count(item.stats?.commentCount),
    };
  } catch {
    return fallback;
  }
}
