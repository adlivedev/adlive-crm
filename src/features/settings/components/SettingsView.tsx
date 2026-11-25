"use client";

import { useState } from "react";

import { WorkspaceManager } from "@/features/superadmin/components/WorkspaceManager";
import { useCrm } from "@/shared/services/crmStore";

import { BrandingTab } from "./BrandingTab";
import { CustomFieldsTab } from "./CustomFieldsTab";
import { CustomValuesTab } from "./CustomValuesTab";
import { FormsBuilderTab } from "./FormsBuilderTab";
import { SmtpSettingsTab } from "./SmtpSettingsTab";
import { WebhookUtmTab } from "./WebhookUtmTab";

type SettingsTab = "fields" | "forms" | "values" | "webhook" | "branding" | "workspaces" | "smtp";

const BASE_TABS: Array<{ key: SettingsTab; label: string }> = [
  { key: "fields", label: "Campos personalizados" },
  { key: "forms", label: "Constructor de formularios" },
  { key: "values", label: "Valores personalizados" },
  { key: "webhook", label: "Landings, Formularios y Guía" },
];

export function SettingsView() {
  const { activeMember, isPlatformSuperadmin } = useCrm();
  const [tab, setTab] = useState<SettingsTab>("fields");
  const canEditBrand = activeMember?.role === "owner" || activeMember?.role === "admin";
  const tabs: Array<{ key: SettingsTab; label: string }> = [...BASE_TABS];
  if (canEditBrand) tabs.push({ key: "branding", label: "Marca y Apariencia" });
  if (isPlatformSuperadmin) {
    tabs.push({ key: "workspaces", label: "Empresas / Workspaces" });
    tabs.push({ key: "smtp", label: "SMTP Global" });
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Ajustes</h1>
        <p className="mt-1 text-sm text-adlive-text-muted">Campos, variables, captación, marca y gobernanza de plataforma.</p>
      </header>

      <div role="tablist" aria-label="Secciones de ajustes" className="flex w-full max-w-full gap-1 overflow-x-auto rounded-xl border border-adlive-border bg-white p-1 sm:w-fit">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            aria-controls={`settings-panel-${item.key}`}
            id={`settings-tab-${item.key}`}
            onClick={() => setTab(item.key)}
            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === item.key ? "bg-adlive-primary text-white shadow-card" : "text-adlive-text-muted hover:text-adlive-text-main"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
        {tab === "fields" ? <CustomFieldsTab /> : null}
        {tab === "forms" ? <FormsBuilderTab /> : null}
        {tab === "values" ? <CustomValuesTab /> : null}
        {tab === "webhook" ? <WebhookUtmTab /> : null}
        {tab === "branding" && canEditBrand ? <BrandingTab /> : null}
        {tab === "workspaces" && isPlatformSuperadmin ? <WorkspaceManager /> : null}
        {tab === "smtp" && isPlatformSuperadmin ? <SmtpSettingsTab /> : null}
      </div>
    </div>
  );
}
