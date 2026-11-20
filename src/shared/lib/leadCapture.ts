import type { CustomFieldDefinition, Tenant } from "@/shared/types/database";

export const LANDING_SLUGS = ["captacion-hero", "captacion-minimal", "oferta-destacada"] as const;
export const CAPTURE_THEMES = ["light", "dark", "transparent"] as const;

export type LandingSlug = typeof LANDING_SLUGS[number];
export type CaptureTheme = typeof CAPTURE_THEMES[number];
export type LandingTemplate = "hero_split" | "minimal_lead" | "promo_offer";
export type CaptureField = Pick<CustomFieldDefinition, "id" | "field_key" | "field_label" | "field_type" | "options">;
export type CaptureWorkspace = Pick<Tenant, "id" | "name" | "slug" | "public_webhook_token" | "branding">;

export interface TenantLanding {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  template_key: LandingTemplate;
  title: string;
  subtitle: string | null;
  cta_text: string;
  color_mode: "workspace" | "custom";
  custom_primary_color: string | null;
  custom_bg_color: string | null;
  custom_text_color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaptureAttribution {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  fbclid?: string | null;
  landing_url?: string | null;
  referrer_url?: string | null;
}

export function isLandingSlug(value: string): value is LandingSlug {
  return (LANDING_SLUGS as readonly string[]).includes(value);
}

export function isCaptureTheme(value: string): value is CaptureTheme {
  return (CAPTURE_THEMES as readonly string[]).includes(value);
}

export function safeHexColor(value: string | null | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
}

export function contrastRatio(first: string, second: string): number {
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

export function readableTextOn(background: string): string {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#18181B") ? "#FFFFFF" : "#18181B";
}
