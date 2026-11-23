import "server-only";
import { TOPIC_KEYS, TOPICS } from "@/lib/trends/topics";
import type { TrendCard } from "@/lib/trends/query";
import type { BrowserHit, BrowserLovoraItem, BrowserSearchResult, BrowserTopicSuggestion } from "./types";

/**
 * The browser's web lookups are deliberately narrow: a short, sanitised query
 * in, a handful of sourced results out. We never fetch the page itself, so
 * arbitrary HTML, tracking pixels and prompt injection can't reach the app.
 */

const UA = "LovoraBrowser/1.0 (+https://lovora-app.vercel.app)";
const MAX_QUERY = 200;

/** Collapses whitespace, strips control/zero-width characters, and caps length. */
export function cleanQuery(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY);
}

export function searchableQuery(raw: unknown): string | null {
  const q = cleanQuery(raw);
  return q.length >= 2 ? q : null;
}

const COMMON_TLDS = new Set(["com", "org", "net", "io", "dev", "app", "co", "ai", "edu", "gov", "me", "info", "news", "blog", "xyz", "uk", "ke", "za", "ng", "gh", "eu", "us", "ca", "au", "in", "de", "fr", "es", "it", "br"]);

/**
 * Turns an address-bar-style query into a safe http(s) URL. Anything with a
 * space, credentials, or a non-web scheme is treated as a search instead.
 */
export function queryAsUrl(raw: unknown): string | null {
  const text = cleanQuery(raw);
  if (!text || /\s/.test(text)) return null;
  const explicit = /^https?:\/\//i.test(text);
  let url: URL;
  try {
    url = new URL(explicit ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".")) return null;
  const tld = url.hostname.split(".").pop()?.toLowerCase() ?? "";
  const looksLikeAddress = explicit || text.startsWith("www.") || text.includes("/") || COMMON_TLDS.has(tld);
  return looksLikeAddress ? url.toString() : null;
}

function cleanText(value: unknown, max = 280): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function webUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function fetchJson(url: string, ms: number): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(ms),
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  return res.json();
}

type DdgTopic = { Text?: string; FirstURL?: string; Topics?: DdgTopic[] };
type Ddg = {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  RelatedTopics?: DdgTopic[];
};

async function duckDuckGo(q: string): Promise<{ abstract: BrowserSearchResult["abstract"]; related: BrowserHit[] }> {
  const data = (await fetchJson(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&no_redirect=1&skip_disambig=0&t=lovora-browser`,
    6500,
  )) as Ddg;
  const abstractUrl = webUrl(data.AbstractURL);
  const abstractText = cleanText(data.AbstractText, 420);
  const abstract = abstractText && abstractUrl ? { text: abstractText, source: cleanText(data.AbstractSource, 60) || "Web", url: abstractUrl } : null;
  const related: BrowserHit[] = [];
  const walk = (items: DdgTopic[] | undefined) => {
    for (const item of items ?? []) {
      if (item.Topics) walk(item.Topics);
      const url = webUrl(item.FirstURL);
      const text = cleanText(item.Text, 160);
      if (url && text && related.length < 8) related.push({ title: text.split(" - ")[0]!, url, snippet: text, source: "DuckDuckGo" });
    }
  };
  walk(data.RelatedTopics);
  return { abstract, related };
}

type WikiPage = { pageid?: number; title?: string; extract?: string; fullurl?: string; index?: number };
type Wiki = { query?: { pages?: Record<string, WikiPage> | WikiPage[] } };

async function wikipedia(q: string): Promise<BrowserHit[]> {
  const data = (await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=4&prop=extracts|info&exintro=1&explaintext=1&exsentences=3&inprop=url&format=json&utf8=1`,
    6500,
  )) as Wiki;
  const pages = data.query?.pages;
  const list = Array.isArray(pages) ? pages : Object.values(pages ?? {});
  return list
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((page) => {
      const url = webUrl(page.fullurl);
      const snippet = cleanText(page.extract, 260);
      const title = cleanText(page.title, 120);
      return url && title ? [{ title, url, snippet, source: "Wikipedia" }] : [];
    })
    .slice(0, 4);
}

/** Web abstract, encyclopedia entries and related links, each independently fallible. */
export async function webAnswer(q: string): Promise<Pick<BrowserSearchResult, "abstract" | "related" | "wikipedia" | "notice">> {
  const [ddg, wiki] = await Promise.allSettled([duckDuckGo(q), wikipedia(q)]);
  const abstract = ddg.status === "fulfilled" ? ddg.value.abstract : null;
  const related = ddg.status === "fulfilled" ? ddg.value.related : [];
  const wikiItems = wiki.status === "fulfilled" ? wiki.value : [];
  const failed = ddg.status === "rejected" && wiki.status === "rejected";
  return {
    abstract,
    related,
    wikipedia: wikiItems,
    notice: failed ? "Web results are unavailable right now. Lovora's own results are still below." : null,
  };
}

export function searchEngines(q: string): { label: string; href: string }[] {
  const term = encodeURIComponent(q);
  return [
    { label: "Google", href: `https://www.google.com/search?q=${term}` },
    { label: "Bing", href: `https://www.bing.com/search?q=${term}` },
    { label: "DuckDuckGo", href: `https://duckduckgo.com/?q=${term}` },
    { label: "Brave", href: `https://search.brave.com/search?q=${term}` },
  ];
}

export function topicSuggestions(q: string, limit = 3): BrowserTopicSuggestion[] {
  const needle = q.toLowerCase();
  if (!needle) return [];
  return TOPIC_KEYS.filter((key) => {
    const t = TOPICS[key];
    return t.label.toLowerCase().includes(needle) || t.categories.some((c) => c.name.toLowerCase().includes(needle));
  })
    .slice(0, limit)
    .map((key) => ({ key, label: TOPICS[key].label, emoji: TOPICS[key].emoji }));
}

export function toLovoraItem(card: TrendCard): BrowserLovoraItem {
  return {
    id: card.id,
    title: card.title,
    summary: card.summary ?? "",
    topic: card.topic,
    category: card.category,
    sourceName: card.sourceName,
    sourceUrl: card.sourceUrl,
    imageUrl: card.imageUrl,
    author: card.author,
    contentType: card.contentType,
    publishedAt: card.publishedAt,
  };
}
