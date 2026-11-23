import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { authSecret } from "./secret";

const ISSUER = "lovora";

/**
 * Short-lived, purpose-bound tokens for flows that span a redirect (Google
 * OAuth state, the Google onboarding step, and the password reset ticket).
 * The audience separates purposes so a token cannot be replayed elsewhere.
 */
export async function signTicket(
  audience: string,
  payload: Record<string, unknown>,
  seconds: number,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${seconds}s`)
    .sign(authSecret());
}

export async function verifyTicket(audience: string, token: string | undefined): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"], issuer: ISSUER, audience });
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const OAUTH_STATE_COOKIE = "lovora_oauth_state";
export const OAUTH_STATE_AUDIENCE = "lovora/oauth-state";

export const GOOGLE_SIGNUP_COOKIE = "lovora_google_signup";
export const GOOGLE_SIGNUP_AUDIENCE = "lovora/google-signup";

export const RESET_TICKET_COOKIE = "lovora_reset";
export const RESET_TICKET_AUDIENCE = "lovora/password-reset";

/** Signup and invitation pages hold the session until the one-time code is acknowledged. */
export const CONTINUE_COOKIE = "lovora_continue";
export const CONTINUE_AUDIENCE = "lovora/sign-in-continue";

/** Cookies for these tickets are short-lived and never readable by page scripts. */
export function ticketCookie(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
