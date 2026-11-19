import { z } from "zod";

const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Usa un color hexadecimal de 6 dígitos.");
const logo = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "El logo debe ser una ruta local o una URL HTTPS.").nullable().optional();

export const brandingSchema = z.object({
  brand_name: z.string().trim().min(2).max(80),
  logo_url: logo,
  logo_dark_url: logo,
  primary_color: color,
  primary_hover: color,
  accent_color: color,
  sidebar_bg: color,
  canvas_bg: color,
  ink_color: color,
});

export type BrandingInput = z.infer<typeof brandingSchema>;
