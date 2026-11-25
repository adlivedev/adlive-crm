import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicLeadForm } from "@/features/lead-capture/components/PublicLeadForm";
import { EmbedResizer } from "@/features/lead-capture/components/EmbedResizer";
import { resolveTenantBranding } from "@/shared/lib/branding";
import { isCaptureTheme, safeHexColor } from "@/shared/lib/leadCapture";
import { getPublicCaptureWorkspace } from "@/shared/services/leadCaptureService";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Formulario de contacto", robots: { index: false, follow: false } };

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ theme?: string; primary?: string }>;
};

export default async function EmbedFormPage({ params, searchParams }: PageProps) {
  const [{ workspaceSlug }, query] = await Promise.all([params, searchParams]);
  const capture = await getPublicCaptureWorkspace(workspaceSlug);
  if (!capture) notFound();
  const branding = resolveTenantBranding(capture.workspace);
  const requestedTheme = query.theme ?? "";
  const theme = isCaptureTheme(requestedTheme) ? requestedTheme : "light";
  const primary = safeHexColor(query.primary, branding.primary_color);
  return (
    <main className="px-3 py-5 sm:px-5">
      {/* El fondo exterior siempre es transparente: solo la tarjeta pinta fondo. */}
      <style>{"html,body{background:transparent !important;margin:0;padding:0;}"}</style>
      <EmbedResizer />
      <div className={`mx-auto w-full max-w-2xl rounded-2xl p-4 sm:p-6 ${theme === "light" ? "border border-slate-200 bg-white shadow-lg shadow-slate-900/5" : ""} ${theme === "dark" ? "border border-white/10 bg-[#111217]" : ""}`}>
        <h1 className={`mb-5 text-xl font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Déjanos tus datos</h1>
        <PublicLeadForm tenantId={capture.workspace.id} token={capture.workspace.public_webhook_token} fields={capture.fields} ctaText="Quiero más información" primary={primary} theme={theme} />
      </div>
    </main>
  );
}
