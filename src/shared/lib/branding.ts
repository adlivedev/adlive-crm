import type { Tenant, TenantBranding } from "@/shared/types/database";

export const NEUTRAL_BRANDING: TenantBranding = {
  brand_name: "CRM",
  logo_url: null,
  logo_dark_url: null,
  primary_color: "#4F46E5",
  primary_hover: "#4338CA",
  accent_color: "#0891B2",
  sidebar_bg: "#111827",
  canvas_bg: "#F3F4F6",
  ink_color: "#111827",
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function safeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function safeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback;
}

function safeLogo(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const logo = value.trim();
  if (logo.startsWith("/") && !logo.startsWith("//")) return logo;
  try {
    const url = new URL(logo);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function resolveTenantBranding(tenant?: Pick<Tenant, "name" | "branding"> | null): TenantBranding {
  const branding = tenant?.branding;
  const fallbackName = tenant?.name?.trim() || NEUTRAL_BRANDING.brand_name;
  return {
    brand_name: safeText(branding?.brand_name, fallbackName),
    logo_url: safeLogo(branding?.logo_url),
    logo_dark_url: safeLogo(branding?.logo_dark_url),
    primary_color: safeColor(branding?.primary_color, NEUTRAL_BRANDING.primary_color),
    primary_hover: safeColor(branding?.primary_hover, NEUTRAL_BRANDING.primary_hover),
    accent_color: safeColor(branding?.accent_color, NEUTRAL_BRANDING.accent_color),
    sidebar_bg: safeColor(branding?.sidebar_bg, NEUTRAL_BRANDING.sidebar_bg),
    canvas_bg: safeColor(branding?.canvas_bg, NEUTRAL_BRANDING.canvas_bg),
    ink_color: safeColor(branding?.ink_color, NEUTRAL_BRANDING.ink_color),
  };
}
