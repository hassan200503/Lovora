import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { resolveGoogleAccount } from "@/lib/auth/accounts";
import { exchangeGoogleCode, googleConfigured, googleRedirectUri, safeNextPath } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";
import {
  GOOGLE_SIGNUP_AUDIENCE,
  GOOGLE_SIGNUP_COOKIE,
  OAUTH_STATE_AUDIENCE,
  OAUTH_STATE_COOKIE,
  signTicket,
  ticketCookie,
  verifyTicket,
} from "@/lib/auth/tickets";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

function back(origin: string, path: string) {
  return NextResponse.redirect(new URL(path, origin), { headers: { "cache-control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const origin = (process.env.APP_URL?.trim() || req.nextUrl.origin).replace(/\/+$/, "");
  const jar = await cookies();
  const stateToken = jar.get(OAUTH_STATE_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE);

  if (!googleConfigured()) return back(origin, "/login?error=google-unavailable");
  if (req.nextUrl.searchParams.get("error")) return back(origin, "/login?error=google-cancelled");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stored = await verifyTicket(OAUTH_STATE_AUDIENCE, stateToken);
  if (!code || !state || !stored || stored.state !== state || typeof stored.verifier !== "string" || typeof stored.state !== "string") {
    return back(origin, "/login?error=google-state");
  }

  const profile = await exchangeGoogleCode({ code, verifier: stored.verifier, redirectUri: googleRedirectUri(origin) });
  if (!profile) return back(origin, "/login?error=google-failed");

  const db = await getDb();
  const resolved = await resolveGoogleAccount(db, profile);
  if (!resolved.ok) return back(origin, "/login?error=google-linked");

  if (resolved.kind === "existing") {
    await createSession({ personId: resolved.personId, slug: resolved.slug, version: resolved.sessionVersion });
    revalidatePath("/", "layout");
    return back(origin, safeNextPath(typeof stored.next === "string" ? stored.next : "/"));
  }

  const signupTicket = await signTicket(
    GOOGLE_SIGNUP_AUDIENCE,
    { sub: profile.providerAccountId, email: profile.email, name: profile.displayName },
    15 * 60,
  );
  jar.set(GOOGLE_SIGNUP_COOKIE, signupTicket, ticketCookie(15 * 60));
  return back(origin, "/welcome/google");
}
