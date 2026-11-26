import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente para Server Components y Server Actions; nunca usa Service Role. */
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publicKey) {
    throw new Error("Supabase server: falta la URL o la clave pública (publishable/anon).");
  }

  return createServerClient(url, publicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              /* QA-NEW-002: sesión máx. 8 h (sliding), SameSite=Lax y Secure en prod. */
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              maxAge: Math.min(options.maxAge ?? 28_800, 28_800),
            });
          });
        } catch {
          /* Los Server Components no pueden escribir cookies; lo hará middleware/action. */
        }
      },
    },
  });
}
