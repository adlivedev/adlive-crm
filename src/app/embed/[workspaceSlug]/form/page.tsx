import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { PublicLeadForm } from "@/features/lead-capture/components/PublicLeadForm";
import { EmbedResizer } from "@/features/lead-capture/components/EmbedResizer";
import { resolveTenantBranding } from "@/shared/lib/branding";
import { isCaptureTheme, safeHexColor } from "@/shared/lib/leadCapture";
import { getPublicCaptureWorkspace, getPublicTenantForm } from "@/shared/services/leadCaptureService";
import type { CaptureField } from "@/shared/lib/leadCapture";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Formulario de contacto", robots: { index: false, follow: false } };

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ theme?: string; primary?: string; form?: string }>;
};

export default async function EmbedFormPage({ params, searchParams }: PageProps) {
  const [{ workspaceSlug }, query] = await Promise.all([params, searchParams]);
  const capture = await getPublicCaptureWorkspace(workspaceSlug);
  if (!capture) notFound();
  const branding = resolveTenantBranding(capture.workspace);
  const requestedTheme = query.theme ?? "";
  const theme = isCaptureTheme(requestedTheme) ? requestedTheme : "light";
  const primary = safeHexColor(query.primary, branding.primary_color);

  // Fase 2 — formulario del constructor (?form=<slug>): campos seleccionados,
  // layout, pasos, bloques HTML y tema personalizados.
  const tenantForm = query.form ? await getPublicTenantForm(capture.workspace.id, query.form) : null;
  let fields: CaptureField[] = capture.fields;
  let heading = "Déjanos tus datos";
  let cardBg = theme === "dark" ? "#111217" : "#FFFFFF";
  if (tenantForm) {
    const selected = tenantForm.fields
      .map((key) => capture.fields.find((field) => field.field_key === key))
      .filter((field): field is CaptureField => Boolean(field));
    const htmlAsFields: CaptureField[] = tenantForm.html_blocks.map((block) => ({
      id: block.id, field_key: `html_${block.id}`, field_label: "", field_type: "html", options: [block.content_html],
    }));
    fields = [...selected, ...htmlAsFields];
    heading = tenantForm.name;
    cardBg = safeHexColor(tenantForm.theme_config.card_bg ?? null, cardBg);
  }

  const fontFamily = tenantForm?.theme_config.font_family;
  const cardStyle = { backgroundColor: cardBg } as CSSProperties;

  return (
    <main className="px-3 py-5 sm:px-5">
      {/* El fondo exterior siempre es transparente: solo la tarjeta pinta fondo. */}
      <style>{"html,body{background:transparent !important;margin:0;padding:0;}"}</style>
      <EmbedResizer />
      <div style={cardStyle} className={`mx-auto w-full max-w-2xl rounded-2xl p-4 sm:p-6 ${theme === "light" ? "border border-slate-200 shadow-lg shadow-slate-900/5" : ""} ${theme === "dark" ? "border border-white/10" : ""}`}>
        <PublicLeadForm
          tenantId={capture.workspace.id}
          token={capture.workspace.public_webhook_token}
          fields={fields}
          ctaText="Quiero más información"
          primary={primary}
          theme={theme}
          heading={heading}
          columns={tenantForm?.columns ?? 2}
          multistep={tenantForm?.is_multistep ?? false}
          inputBg={tenantForm?.theme_config.input_bg}
          buttonColor={tenantForm?.theme_config.button_color}
          fontFamily={fontFamily}
        />
      </div>
    </main>
  );
}
