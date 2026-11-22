import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCtx } from "@/lib/context";
import { isShortKey } from "@/lib/browser/shorts";
import { addComment, cleanComment, deleteComment, listComments } from "@/lib/browser/social";

const createSchema = z.object({ key: z.string(), body: z.string() });
const deleteSchema = z.object({ id: z.string().uuid() });

/** GET /api/browser/shorts/comments?key= — only this couple's comments. */
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const key = req.nextUrl.searchParams.get("key");
  if (!isShortKey(key)) return NextResponse.json({ error: "Unknown video" }, { status: 400 });
  return NextResponse.json({ comments: await listComments(ctx, key) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isShortKey(parsed.data.key)) return NextResponse.json({ error: "Unknown video" }, { status: 400 });
  const body = cleanComment(parsed.data.body);
  if (!body) return NextResponse.json({ error: "Write something up to 500 characters" }, { status: 400 });
  const comment = await addComment(ctx, parsed.data.key, body);
  if (!comment) return NextResponse.json({ error: "That's a lot of comments in a minute. Try again shortly." }, { status: 429 });
  return NextResponse.json({ ok: true, comment }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown comment" }, { status: 400 });
  const removed = await deleteComment(ctx, parsed.data.id);
  return NextResponse.json({ ok: removed }, { status: removed ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
