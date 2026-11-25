import { describe, expect, it } from "vitest";

import { selectBotForMessage, type BotOrchestrationCandidate } from "@/shared/lib/aiOrchestration";

const greeter: BotOrchestrationCandidate = { id: "bot-greeter", priority: 1, bot_role: "greeter", trigger_keywords: [] };
const pricing: BotOrchestrationCandidate = { id: "bot-pricing", priority: 2, bot_role: "pricing", trigger_keywords: ["precio", "plan"] };
const faq: BotOrchestrationCandidate = { id: "bot-faq", priority: 3, bot_role: "faq", trigger_keywords: ["horario"] };
const custom: BotOrchestrationCandidate = { id: "bot-custom", priority: 10, bot_role: "custom", trigger_keywords: ["factura"] };

describe("orquestador multi-bot (Fase 2)", () => {
  it("devuelve null cuando no hay bots", () => {
    expect(selectBotForMessage([], "hola", true)).toBeNull();
    expect(selectBotForMessage([], "hola", false)).toBeNull();
  });

  it("en el primer mensaje responde siempre el bot de mayor prioridad (menor número)", () => {
    const bots = [custom, faq, pricing, greeter];
    expect(selectBotForMessage(bots, "cuánto cuesta el plan 50gb", true)?.id).toBe("bot-greeter");
  });

  it("nunca devuelve dos bots: siempre un único candidato determinista", () => {
    const bots = [greeter, pricing, faq, custom];
    const result = selectBotForMessage(bots, "quiero el precio del plan", false);
    expect(result).not.toBeNull();
    // keywords explícitas del bot de precios ganan aunque el greeter tenga mayor prioridad
    expect(result?.id).toBe("bot-pricing");
  });

  it("delega por palabras clave aunque el mensaje también mencione precios genéricos", () => {
    const bots = [greeter, pricing, faq, custom];
    expect(selectBotForMessage(bots, "necesito la factura del mes pasado", false)?.id).toBe("bot-custom");
  });

  it("delega por intención de rol cuando no hay keywords explícitas", () => {
    const bots = [greeter, pricing, faq];
    expect(selectBotForMessage(bots, "¿qué horarios de atención tienen?", false)?.id).toBe("bot-faq");
    expect(selectBotForMessage(bots, "¿cuánto vale el plan de 100 gigas?", false)?.id).toBe("bot-pricing");
  });

  it("sin coincidencias vuelve al bot de mayor prioridad", () => {
    const bots = [greeter, pricing, faq];
    expect(selectBotForMessage(bots, "ok gracias", false)?.id).toBe("bot-greeter");
  });

  it("ignora keywords vacías y es insensible a mayúsculas", () => {
    const bots = [greeter, { ...pricing, trigger_keywords: ["", "PROMO"] } as BotOrchestrationCandidate];
    expect(selectBotForMessage(bots, "Aprovecho la Promo de hoy", false)?.id).toBe("bot-pricing");
  });
});
