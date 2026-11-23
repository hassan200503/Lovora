import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type GoogleProfile = {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
};

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function clientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

function clientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
}

/** An explicit GOOGLE_REDIRECT_URI wins; otherwise derive it from APP_URL/origin. */
export function googleRedirectUri(origin: string): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = (process.env.APP_URL?.trim() || origin).replace(/\/+$/, "");
  return `${base}/api/auth/google/callback`;
}

/** Only same-origin paths are allowed after a provider redirect. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export function newPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(24).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, state, challenge };
}

export function googleAuthorizeUrl(input: { state: string; challenge: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    access_type: "online",
  });
  return `${AUTHORIZE}?${params.toString()}`;
}

type TokenResponse = { id_token?: unknown };

/**
 * Exchanges the authorization code server-to-server with the PKCE verifier,
 * then verifies Google's signature on the ID token. Nothing is trusted from
 * the query string.
 */
export async function exchangeGoogleCode(input: { code: string; verifier: string; redirectUri: string }): Promise<GoogleProfile | null> {
  let token: TokenResponse;
  try {
    const res = await fetch(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId(),
        client_secret: clientSecret(),
        code: input.code,
        code_verifier: input.verifier,
        grant_type: "authorization_code",
        redirect_uri: input.redirectUri,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    token = (await res.json()) as TokenResponse;
  } catch {
    return null;
  }
  if (typeof token.id_token !== "string") return null;

  try {
    const { payload } = await jwtVerify(token.id_token, JWKS, {
      algorithms: ["RS256"],
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId(),
      clockTolerance: 60,
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const subject = typeof payload.sub === "string" ? payload.sub : "";
    if (!email || !subject) return null;
    const verified = payload.email_verified === true || payload.email_verified === "true";
    const name =
      (typeof payload.name === "string" && payload.name.trim()) ||
      (typeof payload.given_name === "string" && payload.given_name.trim()) ||
      email.split("@")[0];
    return {
      providerAccountId: subject,
      email,
      emailVerified: verified,
      displayName: name.trim().slice(0, 80),
    };
  } catch {
    return null;
  }
}
