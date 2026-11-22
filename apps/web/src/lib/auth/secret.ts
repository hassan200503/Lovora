import "server-only";
import { createHmac } from "node:crypto";

/**
 * The one server secret. SESSION_SECRET wins when set; otherwise the key is
 * derived from DATABASE_URL (which already holds the database password), so a
 * deployment needs only one setting. Resetting the database password therefore
 * also signs everyone out and invalidates in-flight email codes.
 */
export function authSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  const db = process.env.DATABASE_URL;
  if (db) return new Uint8Array(createHmac("sha256", db).update("lovora/session-v1").digest());
  if (process.env.NODE_ENV === "production") throw new Error("Set DATABASE_URL (or SESSION_SECRET) in production");
  return new TextEncoder().encode("dev-only-secret-not-for-production-use-000");
}

/** A context-separated key, so a token made for one purpose cannot verify as another. */
export function derivedKey(context: string): Buffer {
  return createHmac("sha256", authSecret()).update(context).digest();
}
