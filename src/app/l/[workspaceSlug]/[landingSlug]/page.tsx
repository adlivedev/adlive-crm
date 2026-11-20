import type { Metadata } from "next";
import { Check, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { PublicBrand } from "@/features/lead-capture/components/PublicBrand";
import { PublicLeadForm } from "@/features/lead-capture/components/PublicLeadForm";
import { resolveTenantBranding } from "@/shared/lib/branding";
import { contrastRatio, isLandingSlug, readableTextOn, safeHexColor } from "@/shared/lib/leadCapture";
import { getPublicTenantLanding } from "@/shared/services/leadCaptureService";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Formulario de contacto", robots: { index: true, follow: true } };

type PageProps = { params: Promise<{ workspaceSlug: string; landingSlug: string }> };
const benefits = ["Atención personalizada para tu solicitud", "Respuesta de un asesor del equipo", "Tus datos quedan en un espacio seguro"];

export default async function TenantLandingPage({ params }: PageProps) {
  const { workspaceSlug, landingSlug } = await params;
  if (!isLandingSlug(landingSlug)) notFound();
  const capture = await getPublicTenantLanding(workspaceSlug, landingSlug);
  if (!capture) notFound();
  const { workspace, fields, landing } = capture;
  const branding = resolveTenantBranding(workspace);
  const custom = landing.color_mode === "custom";
  const primary = safeHexColor(custom ? landing.custom_primary_color : null, branding.primary_color);
  let background = safeHexColor(custom ? landing.custom_bg_color : null, branding.canvas_bg);
  let text = safeHexColor(custom ? landing.custom_text_color : null, branding.ink_color);
  if (contrastRatio(background, text) < 4.5) {
    background = "#F6F7FB";
    text = "#18181B";
  }
  const style = { color: text, backgroundColor: background, minHeight: "100dvh" } as CSSProperties;
  const form = (
    <PublicLeadForm tenantId={workspace.id} token={workspace.public_webhook_token} fields={fields} ctaText={landing.cta_text} primary={primary} />
  );
  const formCard = <div className="rounded-3xl border border-black/10 bg-white p-5 text-[#18181B] shadow-2xl shadow-black/10 sm:p-7">{form}</div>;

  if (landing.template_key === "minimal_lead") {
    return (
      <main style={style} className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-xl">
          <div className="mb-8 text-center">
            <PublicBrand branding={branding} />
            <h1 className="mt-8 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{landing.title}</h1>
            {landing.subtitle ? <p className="mx-auto mt-4 max-w-lg text-base leading-7 opacity-80">{landing.subtitle}</p> : null}
          </div>
          {formCard}
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs font-medium opacity-75"><ShieldCheck className="h-4 w-4" aria-hidden /> Conexión segura · Información confidencial</p>
        </div>
      </main>
    );
  }

  if (landing.template_key === "promo_offer") {
    return (
      <main style={style}>
        <header className="px-5 py-5 sm:px-8" style={{ backgroundColor: primary, color: readableTextOn(primary) }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
            <PublicBrand branding={branding} light={readableTextOn(primary) === "#FFFFFF"} />
            <span className="rounded-full border border-current/25 px-4 py-2 text-xs font-bold uppercase tracking-wider">Oferta disponible</span>
          </div>
        </header>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:py-20">
          <section>
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: primary }}>Una oportunidad para ti</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{landing.title}</h1>
            {landing.subtitle ? <p className="mt-5 max-w-xl text-lg leading-8 opacity-80">{landing.subtitle}</p> : null}
            <ul className="mt-8 space-y-4">{benefits.map((benefit) => <li key={benefit} className="flex items-center gap-3 text-base"><Check className="h-5 w-5 shrink-0" style={{ color: primary }} aria-hidden />{benefit}</li>)}</ul>
          </section>
          <section aria-label="Formulario de la promoción">{formCard}</section>
        </div>
      </main>
    );
  }

  return (
    <main style={style} className="px-5 py-8 sm:px-8 lg:py-12">
      <div className="mx-auto grid min-h-[calc(100dvh-6rem)] w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <PublicBrand branding={branding} />
          <div className="mt-12 inline-flex items-center gap-2 rounded-full border border-current/15 px-4 py-2 text-xs font-bold uppercase tracking-wider"><ShieldCheck className="h-4 w-4" style={{ color: primary }} aria-hidden /> Atención confiable</div>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{landing.title}</h1>
          {landing.subtitle ? <p className="mt-5 max-w-xl text-lg leading-8 opacity-80">{landing.subtitle}</p> : null}
          <ul className="mt-8 space-y-4">{benefits.map((benefit) => <li key={benefit} className="flex items-center gap-3 text-base"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: primary, color: readableTextOn(primary) }}><Check className="h-4 w-4" aria-hidden /></span>{benefit}</li>)}</ul>
        </section>
        <section aria-label="Formulario de contacto">{formCard}</section>
      </div>
    </main>
  );
}
