import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CONTINUE_AUDIENCE, CONTINUE_COOKIE, verifyTicket } from "@/lib/auth/tickets";
import { createSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Turns the post-signup ticket into a session once the recovery code is saved. */
export async function GET(request: Request) {
  const jar = await cookies();
  const ticket = await verifyTicket(CONTINUE_AUDIENCE, jar.get(CONTINUE_COOKIE)?.value);
  jar.delete(CONTINUE_COOKIE);
  const personId = typeof ticket?.sub === "string" ? ticket.sub : "";
  const slug = typeof ticket?.slug === "string" ? ticket.slug : "";
  const version = typeof ticket?.ver === "number" ? ticket.ver : NaN;
  if (!personId || !slug || !Number.isInteger(version)) {
    return NextResponse.redirect(new URL("/login", request.url), { headers: { "cache-control": "no-store" } });
  }
  await createSession({ personId, slug, version });
  return NextResponse.redirect(new URL("/", request.url), { headers: { "cache-control": "no-store" } });
}
