import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCtx } from "@/lib/context";
import { isShortKey } from "@/lib/browser/shorts";
import { setReaction } from "@/lib/browser/social";

const schema = z.object({ key: z.string(), kind: z.enum(["like", "save"]), on: z.boolean() });

/** POST /api/browser/shorts/react {key, kind, on} — this couple's like/save. Idempotent. */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isShortKey(parsed.data.key)) return NextResponse.json({ error: "Unknown video" }, { status: 400 });
  const social = await setReaction(ctx, parsed.data.key, parsed.data.kind, parsed.data.on);
  return NextResponse.json({ ok: true, social }, { headers: { "Cache-Control": "no-store" } });
}
