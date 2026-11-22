export const CSP_REPORT_PATH = "/api/csp-report";

const BASE_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Reporting-Endpoints": `csp-endpoint="${CSP_REPORT_PATH}"`,
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(self), display-capture=(self), clipboard-write=(self), fullscreen=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
};

export function securityHeaders(production: boolean): Record<string, string> {
  return {
    ...BASE_HEADERS,
    ...(production ? { "Strict-Transport-Security": "max-age=63072000" } : {}),
  };
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function contentSecurityPolicy(nonce: string, options: { dev?: boolean } = {}): string {
  const dev = options.dev ?? process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.youtube.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://vercel.com https://blob.vercel-storage.com https://*.blob.vercel-storage.com https://www.youtube.com https://www.youtube-nocookie.com",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${CSP_REPORT_PATH}`,
    "report-to csp-endpoint",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function safeDirective(value: unknown): string {
  return String(value ?? "unknown")
    .trim()
    .split(/\s+/)[0]
    .replace(/[^a-z0-9-]/gi, "")
    .slice(0, 80) || "unknown";
}

function safeBlockedOrigin(value: unknown): string {
  const raw = String(value ?? "");
  if (!raw || raw === "inline" || raw === "eval" || raw === "self") return raw || "unknown";
  if (raw.startsWith("data:")) return "data:";
  if (raw.startsWith("blob:")) return "blob:";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : url.protocol;
  } catch {
    return "unknown";
  }
}

export function summarizeCspReport(input: unknown): { directive: string; blocked: string } | null {
  const envelope = record(input);
  if (!envelope) return null;
  const body = Array.isArray(envelope.body) ? record(envelope.body[0]) : record(envelope.body);
  const report = record(envelope["csp-report"]) ?? record(body?.body) ?? body ?? envelope;
  if (!report) return null;
  return {
    directive: safeDirective(report["effective-directive"] ?? report.effectiveDirective ?? report["violated-directive"] ?? report.violatedDirective),
    blocked: safeBlockedOrigin(report["blocked-uri"] ?? report.blockedURL),
  };
}
