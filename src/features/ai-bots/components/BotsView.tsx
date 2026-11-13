"use client";

/**
 * M9 — Bots IA (`/bots-ia`).
 * Proveedores de IA con API keys enmascaradas (ISO 27001) y bots por producto.
 */

import { Plus, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { formatRelativeTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { AiBotProvider } from "@/shared/types/database";

import { AiProviderCard } from "./AiProviderCard";
import { NewBotModal } from "./NewBotModal";
import { AI_PROVIDER_SPECS, DEMO_BOT_INPUT, PROVIDER_LABELS } from "./botsData";

export function BotsView() {
  const { aiBots, createAiBot, toggleAiBot } = useCrm();
  const [showNewBot, setShowNewBot] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const handleKeySaved = (provider: AiBotProvider, masked: string) => {
    setAnnouncement(`API Key de ${PROVIDER_LABELS[provider]} guardada en el servidor (${masked}).`);
  };

  const handleDemoBot = () => {
    createAiBot(DEMO_BOT_INPUT);
    setAnnouncement(`Bot de demostración «${DEMO_BOT_INPUT.name}» cargado con su configuración precargada.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Bots IA</h1>
          <p className="mt-1 text-sm text-adlive-text-muted">
            Configura los proveedores de inteligencia artificial y crea bots por línea de negocio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleDemoBot}>
            <Sparkles className="h-4 w-4" aria-hidden />
            Bot de ejemplo: Placita Express
          </Button>
          <Button size="sm" onClick={() => setShowNewBot(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo bot
          </Button>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-adlive-success" aria-hidden />
        <p className="text-sm leading-6 text-adlive-text-main">
          <strong className="font-semibold">Tus API keys se guardan en una tabla protegida del servidor:</strong>{" "}
          nunca se envían al navegador ni se muestran de nuevo después de guardarlas. Cumplimos ISO 27001:
          cifrado AES-256-GCM en reposo y en tránsito.
        </p>
      </div>

      <section aria-labelledby="ai-providers-title">
        <h2 id="ai-providers-title" className="mb-3 text-base font-semibold text-adlive-text-main">
          Proveedores de IA
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" role="list">
          {AI_PROVIDER_SPECS.map((spec) => (
            <div key={spec.provider} role="listitem">
              <AiProviderCard spec={spec} onKeySaved={handleKeySaved} />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="product-bots-title">
        <h2 id="product-bots-title" className="mb-3 text-base font-semibold text-adlive-text-main">
          Bots por producto
        </h2>
        {aiBots.length === 0 ? (
          <Card className="p-6 text-sm text-adlive-text-muted">
            Aún no hay bots creados. Pulsa <strong>+ Nuevo bot</strong> para crear el primero.
          </Card>
        ) : (
          <ul className="flex flex-col gap-3" role="list">
            {aiBots.map((bot) => (
              <li key={bot.id}>
                <Card className="flex flex-wrap items-center gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-adlive-text-main">{bot.name}</h3>
                      <Badge tone={bot.provider === "integrated" ? "success" : "cyan"}>{PROVIDER_LABELS[bot.provider]}</Badge>
                      <Badge tone="neutral">{bot.product_line}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-adlive-text-muted">{bot.system_prompt}</p>
                    <p className="mt-1 text-xs text-adlive-text-muted">Creado {formatRelativeTime(bot.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bot.is_active}
                    aria-label={`${bot.is_active ? "Desactivar" : "Activar"} ${bot.name}`}
                    onClick={() => {
                      toggleAiBot(bot.id);
                      setAnnouncement(`${bot.name} ${bot.is_active ? "desactivado" : "activado"}.`);
                    }}
                    className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${bot.is_active ? "bg-adlive-primary" : "bg-adlive-border"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${bot.is_active ? "left-[22px]" : "left-0.5"}`}
                      aria-hidden
                    />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NewBotModal open={showNewBot} onClose={() => setShowNewBot(false)} onCreate={(input) => {
        createAiBot(input);
        setAnnouncement(`Bot «${input.name}» creado para la línea ${input.product_line}.`);
      }} />
    </div>
  );
}
