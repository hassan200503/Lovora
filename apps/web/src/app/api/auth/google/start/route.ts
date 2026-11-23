import { NextResponse, type NextRequest } from "next/server";
import { googleAuthorizeUrl, googleConfigured, googleRedirectUri, newPkce, safeNextPath } from "@/lib/auth/google";
import { OAUTH_STATE_AUDIENCE, OAUTH_STATE_COOKIE, signTicket, ticketCookie } from "@/lib/auth/tickets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = (process.env.APP_URL?.trim() || req.nextUrl.origin).replace(/\/+$/, "");
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google-unavailable", origin));
  }

  const intent = req.nextUrl.searchParams.get("intent") === "signup" ? "signup" : "signin";
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const { verifier, state, challenge } = newPkce();
  const ticket = await signTicket(OAUTH_STATE_AUDIENCE, { state, verifier, next, intent }, 10 * 60);

  const res = NextResponse.redirect(
    googleAuthorizeUrl({ state, challenge, redirectUri: googleRedirectUri(origin) }),
    { headers: { "cache-control": "no-store" } },
  );
  res.cookies.set(OAUTH_STATE_COOKIE, ticket, ticketCookie(10 * 60));
  return res;
}
