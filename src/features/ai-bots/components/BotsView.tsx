"use client";

import { FlaskConical, Pencil, Plus, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { formatRelativeTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { AiBot, AiBotProvider } from "@/shared/types/database";

import { AiProviderCard } from "./AiProviderCard";
import { AiProviderKeyModal } from "./AiProviderKeyModal";
import { NewBotModal } from "./NewBotModal";
import { TestBotModal } from "./TestBotModal";
import { AI_PROVIDER_SPECS, PROVIDER_LABELS } from "./botsData";

const GUIDE_STEPS = [
  {
    title: "Paso 1: Conecta tu motor de IA",
    body: "Elige un proveedor (por ejemplo Google Gemini), pega tu API Key en su tarjeta y guárdala. La llave se cifra en el servidor y nunca se muestra de vuelta.",
  },
  {
    title: "Paso 2: Crea y entrena tu bot",
    body: "Pulsa «Nuevo bot» y define en lenguaje simple qué vende, los precios y planes que debe conocer, y en qué momento debe pasar el chat a un asesor humano.",
  },
  {
    title: "Paso 3: Actívalo y pruébalo",
    body: "Activa el bot con el interruptor: responderá automáticamente en las conversaciones en modo Bot dentro de «Conversaciones», y cualquier asesor puede tomar el control humano en 1 clic. Usa «Probar» para ensayar antes de activarlo.",
  },
];

export function BotsView() {
  const { aiBots, createAiBot, updateAiBot, deleteAiBot, toggleAiBot } = useCrm();
  const [showNewBot, setShowNewBot] = useState(false);
  const [editingBot, setEditingBot] = useState<AiBot | null>(null);
  const [testingBot, setTestingBot] = useState<AiBot | null>(null);
  const [configuringProvider, setConfiguringProvider] = useState<AiBotProvider | null>(null);
  const [deletingBotId, setDeletingBotId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const handleKeySaved = (provider: AiBotProvider, masked: string) => setAnnouncement(`API Key de ${PROVIDER_LABELS[provider]} guardada en el servidor (${masked}).`);

  const handleSaveBot = (botId: string | null, input: { name: string; product_line: string; provider: AiBotProvider; system_prompt: string }) => {
    if (botId) {
      updateAiBot(botId, input);
      setAnnouncement(`Bot «${input.name}» actualizado.`);
    } else {
      createAiBot(input);
      setAnnouncement(`Bot «${input.name}» creado para la línea ${input.product_line}.`);
    }
    setEditingBot(null);
  };

  const handleDeleteBot = (bot: AiBot) => {
    deleteAiBot(bot.id);
    setDeletingBotId(null);
    setAnnouncement(`Bot «${bot.name}» eliminado.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Bots IA</h1><p className="mt-1 text-sm text-adlive-text-muted">Configura los proveedores de inteligencia artificial y crea bots por línea de negocio.</p></div>
        <Button size="sm" onClick={() => { setEditingBot(null); setShowNewBot(true); }}><Plus className="h-4 w-4" aria-hidden />Nuevo bot</Button>
      </header>

      {/* Guía rápida en 3 pasos — lenguaje de negocio para clientes no técnicos. */}
      <section aria-labelledby="bots-quick-guide-title" className="rounded-2xl border border-adlive-border bg-adlive-card-bg p-5">
        <button
          type="button"
          onClick={() => setGuideOpen((current) => !current)}
          aria-expanded={guideOpen}
          aria-controls="bots-quick-guide-steps"
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span id="bots-quick-guide-title" className="flex items-center gap-2 text-sm font-semibold text-adlive-text-main"><Sparkles className="h-4 w-4 text-adlive-primary" aria-hidden /> Guía rápida: configura tu Bot IA en 3 pasos</span>
          <span className="text-xs font-medium text-adlive-primary">{guideOpen ? "Ocultar" : "Ver guía"}</span>
        </button>
        {guideOpen ? (
          <ol id="bots-quick-guide-steps" className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {GUIDE_STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-2 rounded-xl border border-adlive-border bg-white p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-adlive-primary-light text-sm font-bold text-adlive-primary" aria-hidden>{index + 1}</span>
                <h3 className="text-sm font-semibold text-adlive-text-main">{step.title}</h3>
                <p className="text-sm leading-6 text-adlive-text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-adlive-success" aria-hidden />
        <p className="text-sm leading-6 text-adlive-text-main"><strong className="font-semibold">Tus API keys se guardan cifradas en el servidor:</strong> nunca se envían de vuelta al navegador ni se muestran después de guardarlas. El almacenamiento usa AES-256-GCM.</p>
      </div>
      <section aria-labelledby="ai-providers-title">
        <h2 id="ai-providers-title" className="mb-3 text-base font-semibold text-adlive-text-main">Proveedores de IA de este workspace</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" role="list">{AI_PROVIDER_SPECS.filter((spec) => spec.provider !== "integrated").map((spec) => <div key={spec.provider} role="listitem"><AiProviderCard spec={spec} onKeySaved={handleKeySaved} /></div>)}</div>
      </section>
      <section aria-labelledby="product-bots-title">
        <h2 id="product-bots-title" className="mb-3 text-base font-semibold text-adlive-text-main">Bots por producto</h2>
        {aiBots.length === 0 ? <Card className="p-6 text-sm text-adlive-text-muted">Aún no hay bots creados. Pulsa <strong>+ Nuevo bot</strong> para crear el primero.</Card> : (
          <ul className="flex flex-col gap-3" role="list">
            {aiBots.map((bot) => (
              <li key={bot.id}>
                <Card className="flex flex-wrap items-center gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-adlive-text-main">{bot.name}</h3><Badge tone={bot.provider === "integrated" ? "success" : "cyan"}>{PROVIDER_LABELS[bot.provider]}</Badge><Badge tone="neutral">{bot.product_line}</Badge>{bot.is_active ? <Badge tone="success">Activo</Badge> : <Badge tone="neutral">Inactivo</Badge>}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-adlive-text-muted">{bot.system_prompt}</p>
                    <p className="mt-1 text-xs text-adlive-text-muted">Creado {formatRelativeTime(bot.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setEditingBot(bot); setShowNewBot(true); }} aria-label={`Editar ${bot.name}`}><Pencil className="h-4 w-4" aria-hidden />Editar</Button>
                    <Button size="sm" variant="secondary" onClick={() => setTestingBot(bot)} aria-label={`Probar ${bot.name} en vivo`}><FlaskConical className="h-4 w-4" aria-hidden />Probar</Button>
                    {deletingBotId === bot.id ? (
                      <span className="flex items-center gap-2" role="group" aria-label={`Confirmar eliminación de ${bot.name}`}>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteBot(bot)} aria-label={`Confirmar eliminación de ${bot.name}`}><Trash2 className="h-4 w-4" aria-hidden />Confirmar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeletingBotId(null)}>Cancelar</Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setDeletingBotId(bot.id)} aria-label={`Eliminar ${bot.name}`}><Trash2 className="h-4 w-4" aria-hidden />Eliminar</Button>
                    )}
                    <button type="button" role="switch" aria-checked={bot.is_active} aria-label={`${bot.is_active ? "Desactivar" : "Activar"} ${bot.name}`} onClick={() => { toggleAiBot(bot.id); setAnnouncement(`${bot.name} ${bot.is_active ? "desactivado" : "activado"}.`); }} className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${bot.is_active ? "bg-adlive-primary" : "bg-adlive-border"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${bot.is_active ? "left-[22px]" : "left-0.5"}`} aria-hidden /></button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <NewBotModal
        open={showNewBot}
        bot={editingBot}
        onClose={() => { setShowNewBot(false); setEditingBot(null); }}
        onSave={handleSaveBot}
        onConfigureProvider={(provider) => setConfiguringProvider(provider)}
      />
      <TestBotModal bot={testingBot} open={testingBot !== null} onClose={() => setTestingBot(null)} />
      <AiProviderKeyModal
        spec={configuringProvider ? AI_PROVIDER_SPECS.find((spec) => spec.provider === configuringProvider) ?? null : null}
        open={configuringProvider !== null}
        onClose={() => setConfiguringProvider(null)}
        onKeySaved={handleKeySaved}
      />
    </div>
  );
}
