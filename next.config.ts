import type { NextConfig } from "next";

/**
 * Security headers are set here (not only in middleware) so every response,
 * including static assets and API routes, carries them.
 * The CSP is intentionally strict: no inline scripts, no third-party origins.
 * `unsafe-inline` is limited to styles because React emits inline style attributes.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The workspace may contain parent lockfiles; trace only this project.
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
