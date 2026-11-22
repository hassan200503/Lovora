import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCtx } from "@/lib/context";
import { resolveTikTokLink } from "@/lib/browser/shorts";
import { addShortLink } from "@/lib/browser/social";

const schema = z.object({ url: z.string().trim().min(10).max(500) });

export const maxDuration = 30;

/** POST /api/browser/shorts/link {url} — add a public TikTok video to this couple's Shorts. */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paste a TikTok video link" }, { status: 400 });
  const item = await resolveTikTokLink(parsed.data.url);
  if (!item) return NextResponse.json({ error: "That doesn't look like a public TikTok video link." }, { status: 400 });
  const result = await addShortLink(ctx, item);
  return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}
