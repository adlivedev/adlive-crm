import type { NextConfig } from "next";

/**
 * Endurecimiento HTTP obligatorio (ISO/IEC 27001 A.8.28 Secure Coding / OWASP).
 * Se aplican a todas las rutas de la aplicación.
 */
const securityHeaders: { key: string; value: string }[] = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const embeddableHeaders = [
      ...securityHeaders.filter(({ key }) => key !== "X-Frame-Options"),
      { key: "Content-Security-Policy", value: "frame-ancestors *" },
    ];
    return [
      {
        source: "/((?!l/|embed/).*)",
        headers: securityHeaders,
      },
      {
        source: "/l/:path*",
        headers: embeddableHeaders,
      },
      {
        source: "/embed/:path*",
        headers: embeddableHeaders,
      },
    ];
  },
};

export default nextConfig;
