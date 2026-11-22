import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { searchTrends } from "@/lib/trends/query";
import { queryAsUrl, searchableQuery, searchEngines, toLovoraItem, webAnswer } from "@/lib/browser/search";
import type { BrowserSearchResult } from "@/lib/browser/types";

export const maxDuration = 30;

/**
 * GET /api/browser/search?q= — Lovora's own matches plus a short, sourced web
 * answer. A bare address is never fetched or proxied; we hand the person the
 * link to open, which is the only safe way to honour the address bar.
 */
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const q = searchableQuery(req.nextUrl.searchParams.get("q"));
  if (!q) return NextResponse.json({ error: "Type at least two characters" }, { status: 400 });
  const url = queryAsUrl(q);
  if (url) {
    const result: BrowserSearchResult = { query: q, url, lovora: [], abstract: null, related: [], wikipedia: [], engines: searchEngines(q), notice: null };
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  }
  const [lovora, web] = await Promise.allSettled([
    searchTrends(ctx.members, { query: q, personId: ctx.me.id, limit: 12 }),
    webAnswer(q),
  ]);
  const result: BrowserSearchResult = {
    query: q,
    url: null,
    lovora: lovora.status === "fulfilled" ? lovora.value.map(toLovoraItem) : [],
    abstract: web.status === "fulfilled" ? web.value.abstract : null,
    related: web.status === "fulfilled" ? web.value.related : [],
    wikipedia: web.status === "fulfilled" ? web.value.wikipedia : [],
    engines: searchEngines(q),
    notice: web.status === "fulfilled" ? web.value.notice : "Web results are unavailable right now. Lovora's own results are still below.",
  };
  return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=60" } });
}
