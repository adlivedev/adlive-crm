import { describe, expect, it } from "vitest";

import { buildTemplateVariables, fillTemplateBody, isOptOutMessage, isWithinMetaWindow, META_WINDOW_MS } from "@/shared/lib/whatsapp";
import type { Contact, WhatsAppTemplate } from "@/shared/types/database";

const now = new Date("2026-11-18T12:00:00.000Z");
const contact = {
  full_name: "María Fernanda López",
  custom_fields: { variable_2: "plan comercial" },
} as unknown as Contact;

describe("TC-009 / TC-012 — ventana de 24 horas y opt-out", () => {
  it("acepta una ventana válida y rechaza null, fechas futuras, inválidas o expiradas", () => {
    expect(isWithinMetaWindow(new Date(now.getTime() - META_WINDOW_MS + 1).toISOString(), now)).toBe(true);
    expect(isWithinMetaWindow(new Date(now.getTime() - META_WINDOW_MS).toISOString(), now)).toBe(false);
    expect(isWithinMetaWindow(new Date(now.getTime() + 1).toISOString(), now)).toBe(false);
    expect(isWithinMetaWindow("fecha-invalida", now)).toBe(false);
    expect(isWithinMetaWindow(null, now)).toBe(false);
  });

  it.each(["No", " no ", "NO.", "no!"])("reconoce opt-out: %s", (body) => {
    expect(isOptOutMessage(body)).toBe(true);
  });

  it.each(["No gracias", "norte", "sí", null, ""])("no confunde otro texto con opt-out: %s", (body) => {
    expect(isOptOutMessage(body)).toBe(false);
  });

  it("completa variables sin ocultar valores faltantes", () => {
    expect(buildTemplateVariables(contact, 3)).toEqual(["María", "plan comercial", ""]);
    const template = { body_text: "Hola {{1}}, conoce {{2}}. Dato: {{3}}", variables_count: 3 } as WhatsAppTemplate;
    expect(fillTemplateBody(template, contact)).toBe("Hola María, conoce plan comercial. Dato: {{3}}");
  });
});
