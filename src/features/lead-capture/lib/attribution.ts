"use client";

import type { CaptureAttribution } from "@/shared/lib/leadCapture";

const STORAGE_KEY = "adlive_capture_attribution";
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;

type StoredAttribution = { captured_at: number; values: CaptureAttribution };

function readStored(): StoredAttribution | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = raw ? JSON.parse(raw) as StoredAttribution : null;
    if (!value || Date.now() - value.captured_at > MAX_AGE_SECONDS * 1000) return null;
    return value;
  } catch {
    return null;
  }
}

function readCookie(name: string): string | null {
  const entry = document.cookie.split("; ").find((item) => item.startsWith(`adlive_${name}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(name.length + 8));
  } catch {
    return null;
  }
}

export function captureAttribution(search: URLSearchParams): CaptureAttribution {
  const stored = readStored() ?? { captured_at: Date.now(), values: {} };
  const values: CaptureAttribution = { ...stored.values };
  for (const key of PARAMS) {
    const value = search.get(key)?.trim() || readCookie(key);
    if (value) {
      values[key] = value.slice(0, 2048);
      document.cookie = `adlive_${key}=${encodeURIComponent(value.slice(0, 2048))}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
    }
  }
  values.landing_url = search.get("landing_url") || values.landing_url || window.location.href.split("#")[0];
  values.referrer_url = search.get("referrer_url") || values.referrer_url || document.referrer || null;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, values }));
  } catch {
    // Las cookies mantienen la atribución cuando el almacenamiento está bloqueado.
  }
  return values;
}
