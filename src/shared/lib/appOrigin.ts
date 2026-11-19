import "server-only";

const PRODUCTION_APP_ORIGIN = "https://adlive-crm.vercel.app";

/** Evita que aliases o variables antiguas generen enlaces externos incorrectos. */
export function getAppOrigin(request: Request): string {
  if (process.env.NODE_ENV === "production") return PRODUCTION_APP_ORIGIN;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return configured || new URL(request.url).origin;
}
