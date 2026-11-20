-- Actualiza únicamente los nombres internos predeterminados heredados.
-- No sobrescribe nombres que el workspace ya haya personalizado.
UPDATE public.tenant_landings AS landing
SET name = replacement.new_name
FROM (VALUES
  ('captacion-hero', 'Captación principal', 'Split Hero Conversión'),
  ('captacion-minimal', 'Formulario rápido', 'Minimal Centrada'),
  ('oferta-destacada', 'Oferta promocional', 'Oferta Promocional')
) AS replacement(slug, old_name, new_name)
WHERE landing.slug = replacement.slug
  AND landing.name = replacement.old_name;
