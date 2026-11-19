"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function publicSupabaseKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/** Devuelve true sin crear un cliente cuando faltan variables públicas. */
export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && publicSupabaseKey());
}

/** Cliente singleton para componentes de navegador y Supabase Realtime. */
export function createClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = publicSupabaseKey();
  if (!url || !publicKey) {
    throw new Error("Supabase browser: falta la URL o la clave pública (publishable/anon).");
  }

  browserClient = createBrowserClient(url, publicKey);
  return browserClient;
}
