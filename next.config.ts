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

const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co").replace(/^https?:\/\//, "");

/** CSP estricta para las rutas del CRM (QA-NEW-002). 'unsafe-inline' en script
 *  es requerido por el payload RSC en línea de Next.js App Router; el resto de
 *  directivas cierran XSS, clickjacking e inyección de objetos. */
const cspValue = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} https://*.supabase.co wss://${supabaseHost} wss://*.supabase.co`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const crmHeaders = [...securityHeaders, { key: "Content-Security-Policy", value: cspValue }];
    const embeddableHeaders = [
      ...securityHeaders.filter(({ key }) => key !== "X-Frame-Options"),
      { key: "Content-Security-Policy", value: "frame-ancestors *" },
    ];
    return [
      {
        source: "/((?!l/|embed/).*)",
        headers: crmHeaders,
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
