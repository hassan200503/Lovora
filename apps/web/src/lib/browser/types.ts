import type { TopicKey } from "@/lib/trends/topics";

/** Everything here crosses the network as JSON, so dates are ISO strings. */

export type BrowserHit = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

export type BrowserLovoraItem = {
  id: string;
  title: string;
  summary: string;
  topic: TopicKey;
  category: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  author: string | null;
  contentType: string;
  publishedAt: string | null;
};

export type BrowserSearchResult = {
  query: string;
  /** Set when the query looks like a web address rather than a search. */
  url: string | null;
  lovora: BrowserLovoraItem[];
  abstract: { text: string; source: string; url: string } | null;
  related: BrowserHit[];
  wikipedia: BrowserHit[];
  engines: { label: string; href: string }[];
  /** Set when an upstream lookup failed; results that did arrive are still shown. */
  notice: string | null;
};

export type BrowserTopicSuggestion = { key: TopicKey; label: string; emoji: string };

export type BrowserSuggestions = {
  query: string;
  trends: { id: string; title: string; topic: TopicKey; category: string; sourceName: string }[];
  topics: BrowserTopicSuggestion[];
};

export type ShortPlatform = "tiktok" | "youtube";

export type ShortItem = {
  /** Stable across sessions: `tt:<id>` or `yt:<videoId>`. */
  key: string;
  platform: ShortPlatform;
  videoId: string;
  title: string;
  author: string;
  authorUrl: string | null;
  url: string;
  thumb: string | null;
  publishedAt: string | null;
  durationSec: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  /** Lovora reactions, not platform numbers. */
  hearts: number;
  liked: boolean;
  saved: boolean;
  comments: number;
};

export type ShortsFeed = {
  items: ShortItem[];
  nextCursor: string | null;
  notice: string | null;
};

export type ShortComment = {
  id: string;
  body: string;
  createdAt: string;
  name: string;
  slug: string | null;
  mine: boolean;
};

/** NDJSON events from /api/browser/ai. */
export type BrowserAiEvent =
  | { t: "status"; text: string }
  | { t: "delta"; text: string }
  | { t: "sources"; items: { title: string; url: string }[] }
  | { t: "usage"; used: number; limit: number }
  | { t: "done"; model: string; grounded: boolean }
  | { t: "safety"; message: string }
  | { t: "error"; message: string; retry?: boolean };
