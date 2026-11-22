import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { shortsFeed } from "@/lib/browser/shorts";
import { listShortLinks, socialFor, withSocial } from "@/lib/browser/social";

export const maxDuration = 30;

/** GET /api/browser/shorts?cursor= — a page of real, publicly embeddable videos. */
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const saved = await listShortLinks(ctx).catch(() => []);
  const feed = await shortsFeed(req.nextUrl.searchParams.get("cursor"), saved);
  const social = await socialFor(ctx, feed.items.map((item) => item.key));
  return NextResponse.json({ ...feed, items: withSocial(feed.items, social) }, { headers: { "Cache-Control": "no-store" } });
}
