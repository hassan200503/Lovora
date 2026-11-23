/** Small display helpers shared by the browser UI. */

export function compact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return "";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0).replace(/\.0$/, "")}M`;
  return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const COMMON_TLDS = new Set(["com", "org", "net", "io", "dev", "app", "co", "ai", "edu", "gov", "me", "info", "news", "blog", "xyz", "uk", "ke", "za", "ng", "gh", "eu", "us", "ca", "au", "in", "de", "fr", "es", "it", "br"]);

/** Mirrors the server's address detection just for the "Open" hint; the server is authoritative. */
export function looksLikeAddress(input: string): boolean {
  const text = input.trim();
  if (!text || /\s/.test(text) || text.length > 200) return false;
  const explicit = /^https?:\/\//i.test(text);
  try {
    const url = new URL(explicit ? text : `https://${text}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname.includes(".")) return false;
    const tld = url.hostname.split(".").pop()?.toLowerCase() ?? "";
    return explicit || text.startsWith("www.") || text.includes("/") || COMMON_TLDS.has(tld);
  } catch {
    return false;
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
