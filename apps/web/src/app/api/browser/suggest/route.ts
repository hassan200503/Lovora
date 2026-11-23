import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { suggestTrends } from "@/lib/trends/query";
import { searchableQuery, topicSuggestions } from "@/lib/browser/search";
import type { BrowserSuggestions } from "@/lib/browser/types";

/** GET /api/browser/suggest?q= — typeahead over what Lovora already has. No external calls. */
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const q = searchableQuery(req.nextUrl.searchParams.get("q"));
  const empty: BrowserSuggestions = { query: q ?? "", trends: [], topics: [] };
  if (!q) return NextResponse.json(empty, { headers: { "Cache-Control": "no-store" } });
  try {
    const trends = await suggestTrends(ctx.me.id, q, 6);
    return NextResponse.json(
      { query: q, trends, topics: topicSuggestions(q) } satisfies BrowserSuggestions,
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch {
    return NextResponse.json({ query: q, trends: [], topics: topicSuggestions(q) } satisfies BrowserSuggestions, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
