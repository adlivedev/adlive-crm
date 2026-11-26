"use client";

/**
 * M9 — Modal de creación y edición de un bot por producto.
 * Sprint 2: formulario guiado (objetivo, conocimiento, handoff, tono) que se
 * compila limpiamente en el system_prompt (la columna de la base de datos no
 * cambia) + validación QA-005 de proveedor con API Key conectada.
 */

import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";
import type { AiBot, AiBotProvider } from "@/shared/types/database";

import {
  AI_PROVIDER_SPECS,
  BOT_OBJECTIVE_PRESETS,
  BOT_ROLE_OPTIONS,
  BOT_TONE_OPTIONS,
  PROVIDER_MODELS,
  compileBotPrompt,
} from "./botsData";

export interface BotFormInput {
  name: string;
  product_line: string;
  provider: AiBotProvider;
  system_prompt: string;
  model_name: string | null;
  fallback_models: string[];
  priority: number;
  bot_role: "greeter" | "pricing" | "faq" | "custom";
  trigger_keywords: string[];
}

export interface NewBotModalProps {
  open: boolean;
  /** Si llega un bot, el modal opera en modo edición. */
  bot?: AiBot | null;
  onClose: () => void;
  onSave: (botId: string | null, input: BotFormInput) => void;
  /** QA-005: abre el modal de API Key del proveedor indicado. */
  onConfigureProvider: (provider: AiBotProvider) => void;
}

const SELECT_CLASS = "h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20";
const TEXTAREA_CLASS = "w-full resize-y rounded-xl border border-adlive-border bg-white px-4 py-3 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20";

export function NewBotModal({ open, bot, onClose, onSave, onConfigureProvider }: NewBotModalProps) {
  const { activeTenant } = useCrm();
  const isEditing = Boolean(bot);
  const [name, setName] = useState("");
  const [productLine, setProductLine] = useState("");
  const [provider, setProvider] = useState<AiBotProvider>("openai");
  const [mode, setMode] = useState<"guided" | "free">("guided");
  const [objectivePresetId, setObjectivePresetId] = useState(BOT_OBJECTIVE_PRESETS[0]!.id);
  const [customObjective, setCustomObjective] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [handoffRule, setHandoffRule] = useState("");
  const [toneId, setToneId] = useState(BOT_TONE_OPTIONS[0]!.id);
  const [freePrompt, setFreePrompt] = useState("");
  const [connectedProviders, setConnectedProviders] = useState<Set<string> | null>(null);
  const [modelName, setModelName] = useState("");
  const [fallbackModels, setFallbackModels] = useState<string[]>([]);
  const [botRole, setBotRole] = useState<"greeter" | "pricing" | "faq" | "custom">("custom");
  const [priority, setPriority] = useState(10);
  const [keywordsInput, setKeywordsInput] = useState("");

  // Al abrir: inicializa desde el bot (edición) o limpia (creación).
  useEffect(() => {
    if (!open) return;
    setName(bot?.name ?? "");
    setProductLine(bot?.product_line ?? "");
    setProvider(bot?.provider ?? "openai");
    setMode(bot ? "free" : "guided");
    setObjectivePresetId(BOT_OBJECTIVE_PRESETS[0]!.id);
    setCustomObjective("");
    setKnowledge("");
    setHandoffRule("");
    setToneId(BOT_TONE_OPTIONS[0]!.id);
    setFreePrompt(bot?.system_prompt ?? "");
    setConnectedProviders(null);
    setModelName(bot?.model_name ?? "");
    setFallbackModels(bot?.fallback_models ?? []);
    setBotRole(bot?.bot_role ?? "custom");
    setPriority(bot?.priority ?? 10);
    setKeywordsInput((bot?.trigger_keywords ?? []).join(", "));
  }, [open, bot]);

  // QA-005: consulta los proveedores realmente conectados del workspace.
  useEffect(() => {
    if (!open || !activeTenant) return;
    let cancelled = false;
    void fetch(`/api/v1/ai-bots/providers?tenantId=${activeTenant.id}`).then(async (response) => {
      if (!response.ok || cancelled) return;
      const result = await response.json() as { providers: Array<{ provider: string; is_connected: boolean }> };
      if (!cancelled) setConnectedProviders(new Set(result.providers.filter((p) => p.is_connected).map((p) => p.provider)));
    }).catch(() => { if (!cancelled) setConnectedProviders(new Set()); });
    return () => { cancelled = true; };
  }, [open, activeTenant]);

  const compiledPrompt = compileBotPrompt({ objectivePresetId, customObjective, knowledge, handoffRule, toneId });
  const systemPrompt = mode === "guided" ? compiledPrompt : freePrompt;
  const isProviderConnected = connectedProviders?.has(provider) ?? true;
  const providerBlocked = connectedProviders !== null && !isProviderConnected;

  const isValid =
    name.trim().length >= 3 &&
    productLine.trim().length >= 3 &&
    systemPrompt.trim().length >= 20 &&
    !providerBlocked;

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    onSave(bot?.id ?? null, {
      name: name.trim(),
      product_line: productLine.trim(),
      provider,
      system_prompt: systemPrompt.trim(),
      model_name: modelName.trim() || null,
      fallback_models: fallbackModels.filter((model) => model !== modelName),
      priority,
      bot_role: botRole,
      trigger_keywords: keywordsInput.split(",").map((keyword) => keyword.trim().toLowerCase()).filter(Boolean).slice(0, 20),
    });
    handleClose();
  };

  const availableModels = provider !== "integrated" ? PROVIDER_MODELS[provider] : [];

  return (
    <Modal open={open} onClose={handleClose} title={isEditing ? "Editar bot" : "Nuevo bot"} subtitle={isEditing ? "Ajusta el entrenamiento del bot sin recrearlo." : "Entrena al bot en 3 decisiones: para qué sirve, qué sabe y cuándo ceder el chat a un asesor."}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nombre del bot" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Asistente de bienvenida" required minLength={3} />
        <Input
          label="Línea de negocio"
          value={productLine}
          onChange={(event) => setProductLine(event.target.value)}
          placeholder="Ej. Ventas, soporte o servicio al cliente"
          required
          minLength={3}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bot-provider" className="text-sm font-medium text-adlive-text-main">
            Motor de IA (proveedor)
          </label>
          <select
            id="bot-provider"
            value={provider}
            onChange={(event) => {
              /* QA-NEW-007: al cambiar de proveedor los modelos del proveedor
                 anterior dejan de existir → se reinician ambos campos. */
              setProvider(event.target.value as AiBotProvider);
              setModelName("");
              setFallbackModels([]);
            }}
            className={SELECT_CLASS}
          >
            {AI_PROVIDER_SPECS.filter((spec) => spec.provider !== "integrated").map((spec) => (
              <option key={spec.provider} value={spec.provider}>
                {spec.name}
              </option>
            ))}
          </select>
          {providerBlocked ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5">
              <Badge tone="warning">Sin API Key</Badge>
              <span className="text-sm text-adlive-text-main">
                {AI_PROVIDER_SPECS.find((spec) => spec.provider === provider)?.name} no tiene una API Key guardada en este espacio de trabajo.
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onConfigureProvider(provider)}
                aria-label={`Configurar API Key de ${AI_PROVIDER_SPECS.find((spec) => spec.provider === provider)?.name} antes de guardar`}
              >
                <KeyRound className="h-4 w-4" aria-hidden /> Configurar API Key primero
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bot-model" className="text-sm font-medium text-adlive-text-main">Modelo principal</label>
            <select id="bot-model" value={modelName} onChange={(event) => setModelName(event.target.value)} className={SELECT_CLASS}>
              <option value="">Automático (recomendado)</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <p className="text-xs text-adlive-text-muted">Si lo dejas en automático, el CRM elige el mejor modelo disponible para tu proveedor.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bot-priority" className="text-sm font-medium text-adlive-text-main">Prioridad (orquestador)</label>
            <select id="bot-priority" value={priority} onChange={(event) => setPriority(Number(event.target.value))} className={SELECT_CLASS}>
              {[1, 2, 3, 4, 5, 10].map((value) => (
                <option key={value} value={value}>{value === 10 ? "10 (último)" : `${value}${value === 1 ? " (atiende primero)" : ""}`}</option>
              ))}
            </select>
            <p className="text-xs text-adlive-text-muted">El bot con menor número atiende el primer mensaje; los demás solo responden si coinciden sus palabras clave o rol.</p>
          </div>
        </div>

        {(modelName ? availableModels.filter((model) => model !== modelName) : availableModels).length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-adlive-text-main">Modelos de respaldo (fallback automático)</span>
            <div className="flex flex-wrap gap-2">
              {(modelName ? availableModels.filter((model) => model !== modelName) : availableModels).map((model) => {
                const checked = fallbackModels.includes(model);
                return (
                  <label key={model} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${checked ? "border-adlive-primary bg-adlive-primary-light text-adlive-primary" : "border-adlive-border bg-white text-adlive-text-muted"}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(event) => setFallbackModels((current) => event.target.checked ? [...current, model] : current.filter((item) => item !== model))}
                    />
                    {model}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-adlive-text-muted">Si el modelo principal falla por saturación o cuota (429/503), el bot cambia automáticamente al siguiente de esta lista.</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bot-role" className="text-sm font-medium text-adlive-text-main">Rol del bot</label>
            <select id="bot-role" value={botRole} onChange={(event) => setBotRole(event.target.value as "greeter" | "pricing" | "faq" | "custom")} className={SELECT_CLASS}>
              {BOT_ROLE_OPTIONS.map((role) => (
                <option key={role.id} value={role.id}>{role.label}</option>
              ))}
            </select>
            <p className="text-xs text-adlive-text-muted">{BOT_ROLE_OPTIONS.find((role) => role.id === botRole)?.hint}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Input
              label="Palabras clave de activación"
              value={keywordsInput}
              onChange={(event) => setKeywordsInput(event.target.value)}
              placeholder="precio, plan, contratar"
              hint="Sepáralas por comas. Si el cliente las escribe, este bot toma el chat aunque no sea el de mayor prioridad."
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-adlive-text-main">¿Cómo quieres definir las instrucciones?</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Modo de definición de instrucciones">
            <button
              type="button"
              role="radio"
              aria-checked={mode === "guided"}
              onClick={() => setMode("guided")}
              className={`h-11 flex-1 rounded-xl border px-4 text-sm font-medium transition-colors ${mode === "guided" ? "border-adlive-primary bg-adlive-primary-light text-adlive-primary" : "border-adlive-border bg-white text-adlive-text-muted hover:border-adlive-primary/40"}`}
            >
              Guiado (recomendado)
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "free"}
              onClick={() => setMode("free")}
              className={`h-11 flex-1 rounded-xl border px-4 text-sm font-medium transition-colors ${mode === "free" ? "border-adlive-primary bg-adlive-primary-light text-adlive-primary" : "border-adlive-border bg-white text-adlive-text-muted hover:border-adlive-primary/40"}`}
            >
              Prompt libre
            </button>
          </div>
        </div>

        {mode === "guided" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bot-objective" className="text-sm font-medium text-adlive-text-main">
                1. Objetivo del bot
              </label>
              <select id="bot-objective" value={objectivePresetId} onChange={(event) => setObjectivePresetId(event.target.value)} className={SELECT_CLASS}>
                {BOT_OBJECTIVE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
              {objectivePresetId === "personalizado" ? (
                <textarea
                  id="bot-custom-objective"
                  value={customObjective}
                  onChange={(event) => setCustomObjective(event.target.value)}
                  rows={2}
                  placeholder="Describe en una frase para qué sirve el bot. Ej. Agendar citas de instalación de internet fibra."
                  className={TEXTAREA_CLASS}
                  aria-label="Objetivo personalizado del bot"
                />
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bot-knowledge" className="text-sm font-medium text-adlive-text-main">
                2. Información del negocio
              </label>
              <textarea
                id="bot-knowledge"
                value={knowledge}
                onChange={(event) => setKnowledge(event.target.value)}
                rows={4}
                placeholder={"Ej. Planes: Fibra 300 Mbps $79.900/mes, Fibra 600 Mbps $119.900/mes.\nInstalación gratuita en Bogotá y Medellín.\nHorarios de atención: lunes a sábado 8:00–18:00."}
                className={TEXTAREA_CLASS}
              />
              <p className="text-xs text-adlive-text-muted">El bot solo debe usar estos datos: si algo no está aquí, lo dirá con honestidad en lugar de inventar precios.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bot-handoff" className="text-sm font-medium text-adlive-text-main">
                3. ¿Cuándo pasa el chat a un asesor humano?
              </label>
              <textarea
                id="bot-handoff"
                value={handoffRule}
                onChange={(event) => setHandoffRule(event.target.value)}
                rows={2}
                placeholder={'Ej. Cuando el cliente diga "quiero contratar", envíe su cédula o pida hablar con un asesor.'}
                className={TEXTAREA_CLASS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bot-tone" className="text-sm font-medium text-adlive-text-main">
                4. Tono de respuesta
              </label>
              <select id="bot-tone" value={toneId} onChange={(event) => setToneId(event.target.value)} className={SELECT_CLASS}>
                {BOT_TONE_OPTIONS.map((tone) => (
                  <option key={tone.id} value={tone.id}>{tone.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-adlive-border bg-adlive-canvas-bg p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-adlive-text-muted">Vista previa del prompt compilado</span>
              <p className="whitespace-pre-wrap text-xs leading-5 text-adlive-text-muted" aria-live="polite">{systemPrompt || "Completa los campos guiados para ver el prompt."}</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bot-free-prompt" className="text-sm font-medium text-adlive-text-main">
              System Prompt
            </label>
            <textarea
              id="bot-free-prompt"
              value={freePrompt}
              onChange={(event) => setFreePrompt(event.target.value)}
              rows={7}
              placeholder="Instrucciones completas del comportamiento del bot: tono, objetivo comercial, manejo de objeciones y escalado a asesor humano."
              className={TEXTAREA_CLASS}
            />
            <p className="text-xs text-adlive-text-muted">{freePrompt.length} caracteres · mínimo 20</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!isValid}>
            {isEditing ? "Guardar cambios" : "Crear bot"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
