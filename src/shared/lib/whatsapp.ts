import type { Contact, Conversation, WhatsAppTemplate } from "@/shared/types/database";

export const META_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinMetaWindow(lastInboundAt: string | null, now: Date): boolean {
  if (!lastInboundAt) return false;
  const timestamp = new Date(lastInboundAt).getTime();
  return Number.isFinite(timestamp) && now.getTime() - timestamp >= 0 && now.getTime() - timestamp < META_WINDOW_MS;
}

export function isMetaWindowOpen(conversation: Pick<Conversation, "last_inbound_at">, now: Date): boolean {
  return isWithinMetaWindow(conversation.last_inbound_at, now);
}

export function isOptOutMessage(body: string | null): boolean {
  return ["no", "no.", "no!"].includes(body?.trim().toLowerCase() ?? "");
}

/** {{1}} usa el primer nombre; las demás variables se leen de variable_N. */
export function buildTemplateVariables(contact: Contact, count: number): string[] {
  const firstName = contact.full_name.trim().split(/\s+/)[0] ?? contact.full_name;
  return Array.from({ length: count }, (_, index) => index === 0
    ? firstName
    : contact.custom_fields[`variable_${index + 1}`]?.trim() ?? "");
}

export function fillTemplateBody(template: WhatsAppTemplate, contact: Contact): string {
  const variables = buildTemplateVariables(contact, template.variables_count);
  return variables.reduce((body, value, index) => body.replaceAll(`{{${index + 1}}}`, value || `{{${index + 1}}}`), template.body_text);
}
