"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export type UrlSessionResult = "session" | "error" | "none";

/**
 * Los enlaces generados con `admin.generateLink` (recuperación de contraseña e
 * invitaciones) usan flujo implícito y llegan como `#access_token=…`.
 * El cliente de navegador de `@supabase/ssr` se crea con `flowType: "pkce"`,
 * cuya detección automática rechaza ese hash (`Not a valid PKCE flow url`),
 * por lo que se establece la sesión de forma explícita y se limpia la URL.
 */
export async function establishSessionFromUrl(supabase: SupabaseClient): Promise<UrlSessionResult> {
  if (typeof window === "undefined") return "none";
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const urlError = hash.get("error_code") ?? hash.get("error");
  if (!accessToken && !refreshToken && !urlError) return "none";

  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  if (!accessToken || !refreshToken) return "error";

  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return error ? "error" : "session";
}
