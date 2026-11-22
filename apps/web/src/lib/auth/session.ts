import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { authSecret } from "./secret";

export const SESSION_COOKIE = "lovora_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days; sign-out-everywhere revokes older tokens.
const ISSUER = "lovora";

function secret(): Uint8Array {
  return authSecret();
}

export type Session = { personId: string; slug: string; version: number };

/** A short signature for links that must work without a session (e.g. "Decline" on a call notification). */
export function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function verifySignature(value: string, signature: string): boolean {
  const a = Buffer.from(sign(value));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createSession(s: Session) {
  const token = await new SignJWT({ slug: s.slug, ver: s.version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.personId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], issuer: ISSUER });
    if (!payload.sub || typeof payload.slug !== "string") return null;
    const version = typeof payload.ver === "number" && Number.isInteger(payload.ver) && payload.ver >= 0 ? payload.ver : 0;
    return { personId: payload.sub, slug: payload.slug, version };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}
