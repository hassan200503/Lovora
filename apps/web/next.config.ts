import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@lovora/domain", "@lovora/sync-protocol"],
  // PGlite ships WASM and data files that must be loaded from node_modules, not bundled;
  // web-push relies on Node's crypto and https modules, so it runs as-is from node_modules too.
  serverExternalPackages: ["@electric-sql/pglite", "web-push"],
  // The migrations are read from disk at runtime when a server finds its database behind
  // (see withSchema in src/lib/db/client.ts), so every function carries them.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/*.sql", "./drizzle/meta/_journal.json"],
  },
  async headers() {
    const headers = securityHeaders(process.env.NODE_ENV === "production");
    return [
      {
        source: "/(.*)",
        headers: Object.entries(headers).map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default nextConfig;
