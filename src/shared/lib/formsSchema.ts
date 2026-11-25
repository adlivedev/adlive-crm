import { z } from "zod";

const formSlugSchema = z.string().trim().regex(/^[a-z0-9-]{2,120}$/, "El slug solo puede tener letras minúsculas, números y guiones.");
const htmlBlockSchema = z.object({ id: z.string().min(1).max(60), content_html: z.string().max(12_000) });
const stepSchema = z.object({ title: z.string().trim().min(1).max(120), field_keys: z.array(z.string().min(1).max(100)).max(30) });

/** Schema del constructor de formularios (Fase 2), compartido por las rutas
 *  /api/v1/forms. NO exportar desde el archivo de ruta: Next.js solo admite
 *  exportaciones específicas en route handlers. */
export const formInputSchema = z.object({
  tenantId: z.string().uuid(),
  slug: formSlugSchema,
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).optional().nullable(),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  is_multistep: z.boolean().default(false),
  steps: z.array(stepSchema).max(10).default([]),
  fields: z.array(z.string().min(1).max(100)).min(0).max(30),
  html_blocks: z.array(htmlBlockSchema).max(10).default([]),
  theme_config: z.object({
    card_bg: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    input_bg: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    button_color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    font_family: z.enum(["Inter", "Plus Jakarta Sans", "DM Sans", "Roboto", "Poppins"]).optional(),
  }).default({}),
  is_active: z.boolean().default(true),
});
