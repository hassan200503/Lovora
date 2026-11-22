import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, newNonce, securityHeaders, summarizeCspReport } from "./headers";

describe("security headers", () => {
  it("adds HSTS only in production and never emits wildcard CORS", () => {
    const dev = securityHeaders(false);
    const prod = securityHeaders(true);
    expect(dev["Strict-Transport-Security"]).toBeUndefined();
    expect(prod["Strict-Transport-Security"]).toBe("max-age=63072000");
    expect(prod["X-Frame-Options"]).toBe("DENY");
    expect(prod["X-Content-Type-Options"]).toBe("nosniff");
    expect(Object.keys(prod).some((key) => key.toLowerCase().startsWith("access-control-"))).toBe(false);
  });

  it("builds a nonce CSP that permits Next and YouTube without unsafe script inline", () => {
    const nonce = newNonce();
    const policy = contentSecurityPolicy(nonce, { dev: false });
    expect(nonce.length).toBeGreaterThan(16);
    expect(policy).toContain(`'nonce-${nonce}'`);
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).toContain("https://www.youtube.com");
    expect(policy).toContain("https://www.youtube-nocookie.com");
    expect(policy).toContain("https://www.tiktok.com");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("report-uri /api/csp-report");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy.match(/script-src[^;]*/)?.[0]).not.toContain("'unsafe-inline'");
  });

  it("allows React eval only in development", () => {
    expect(contentSecurityPolicy("n", { dev: true })).toContain("'unsafe-eval'");
  });

  it("lets the browser upload directly to Vercel Blob", () => {
    const connect = contentSecurityPolicy("n", { dev: false }).match(/connect-src[^;]*/)?.[0];
    expect(connect).toContain("https://vercel.com");
    expect(connect).toContain("https://*.blob.vercel-storage.com");
  });

  it("reports only the directive and masked blocked origin", () => {
    const report = summarizeCspReport({
      "csp-report": {
        "document-uri": "https://app.example/join/secret-token",
        referrer: "https://app.example/settings?private=1",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/steal?token=secret",
      },
    });
    expect(report).toEqual({ directive: "script-src-elem", blocked: "https://evil.example" });
    expect(JSON.stringify(report)).not.toContain("secret");
  });

  it("normalises Reporting API batches and inline blocks", () => {
    expect(
      summarizeCspReport({
        body: [{ type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "data:image/png;base64,secret" } }],
      }),
    ).toEqual({ directive: "img-src", blocked: "data:" });
    expect(summarizeCspReport(null)).toBeNull();
  });
});
