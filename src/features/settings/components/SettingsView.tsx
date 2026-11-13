"use client";

/**
 * M12 — Ajustes (`/ajustes`).
 * Tres pestañas: Campos personalizados, Valores personalizados y
 * Formulario web y UTM (webhook, token y script de captura).
 */

import { useState } from "react";

import { CustomFieldsTab } from "./CustomFieldsTab";
import { CustomValuesTab } from "./CustomValuesTab";
import { WebhookUtmTab } from "./WebhookUtmTab";

type SettingsTab = "fields" | "values" | "webhook";

const TABS: Array<{ key: SettingsTab; label: string }> = [
  { key: "fields", label: "Campos personalizados" },
  { key: "values", label: "Valores personalizados" },
  { key: "webhook", label: "Formulario web y UTM" },
];

export function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>("fields");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Ajustes</h1>
        <p className="mt-1 text-sm text-adlive-text-muted">
          Campos personalizados, variables globales de la agencia y captación web con atribución UTM.
        </p>
      </header>

      <div role="tablist" aria-label="Secciones de ajustes" className="flex w-fit rounded-xl border border-adlive-border bg-white p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            aria-controls={`settings-panel-${item.key}`}
            id={`settings-tab-${item.key}`}
            onClick={() => setTab(item.key)}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.key ? "bg-adlive-primary text-white shadow-card" : "text-adlive-text-muted hover:text-adlive-text-main"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
        {tab === "fields" ? <CustomFieldsTab /> : null}
        {tab === "values" ? <CustomValuesTab /> : null}
        {tab === "webhook" ? <WebhookUtmTab /> : null}
      </div>
    </div>
  );
}
