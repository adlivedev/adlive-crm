/**
 * M3 — Utilidades puras de la vista Contactos (filtros, CSV, importación).
 *
 * Lógica desacoplada de React para reutilización y pruebas (Skill 4):
 * filtrado multi-criterio, generación de CSV con BOM UTF-8 (Excel es-CO)
 * y parser tolerante de CSV (; o , con comillas) para la importación masiva.
 */

import type { CreateContactInput } from "@/shared/services/crmActions";
import type { Contact, Conversation, Opportunity } from "@/shared/types/database";
import { formatDate } from "@/shared/lib/format";

/* ============================================================================
 * FILTROS
 * ========================================================================== */

export interface ContactsFilters {
  search: string;
  tag: string;
  source: string;
  pipelineId: string;
  stageId: string;
  createdFrom: string;
  createdTo: string;
  actionFrom: string;
  actionTo: string;
}

export const EMPTY_CONTACTS_FILTERS: ContactsFilters = {
  search: "",
  tag: "all",
  source: "all",
  pipelineId: "all",
  stageId: "all",
  createdFrom: "",
  createdTo: "",
  actionFrom: "",
  actionTo: "",
};

export type ContactsColumnKey =
  | "phone"
  | "email"
  | "company"
  | "tags"
  | "source"
  | "created"
  | "lastActivity"
  | "closedClient";

export const CONTACTS_COLUMN_LABELS: Record<ContactsColumnKey, string> = {
  phone: "Teléfono",
  email: "Email",
  company: "Negocio / Empresa",
  tags: "Etiquetas",
  source: "Fuente",
  created: "Creado",
  lastActivity: "Última actividad",
  closedClient: "Cliente cerrado",
};

export const ALL_CONTACTS_COLUMNS = Object.keys(CONTACTS_COLUMN_LABELS) as ContactsColumnKey[];

/** Minúsculas sin acentos: búsqueda insensible a tildes y mayúsculas. */
function normalizeText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Filtro estricto del lote: búsqueda instantánea (nombre, email, empresa o
 * teléfono), etiqueta, fuente, pipeline/etapa vía oportunidades del contacto
 * y rangos de fecha por `Creado` y `Última acción / pedido`.
 */
export function filterContacts(
  contacts: Contact[],
  opportunities: Opportunity[],
  filters: ContactsFilters,
): Contact[] {
  const search = normalizeText(filters.search.trim());
  return contacts.filter((contact) => {
    if (search) {
      const haystack = normalizeText(
        [contact.full_name, contact.email ?? "", contact.company_name ?? "", contact.phone_e164].join(" "),
      );
      if (!haystack.includes(search)) return false;
    }
    if (filters.tag !== "all" && !contact.tags.includes(filters.tag)) return false;
    if (filters.source !== "all" && contact.lead_source !== filters.source) return false;

    if (filters.pipelineId !== "all" || filters.stageId !== "all") {
      const contactOpportunities = opportunities.filter((o) => o.contact_id === contact.id);
      if (filters.pipelineId !== "all" && !contactOpportunities.some((o) => o.pipeline_id === filters.pipelineId)) {
        return false;
      }
      if (filters.stageId !== "all" && !contactOpportunities.some((o) => o.stage_id === filters.stageId)) {
        return false;
      }
    }

    const createdDay = contact.created_at.slice(0, 10);
    if (filters.createdFrom && createdDay < filters.createdFrom) return false;
    if (filters.createdTo && createdDay > filters.createdTo) return false;

    const actionDay = (contact.last_interaction_at ?? contact.created_at).slice(0, 10);
    if (filters.actionFrom && actionDay < filters.actionFrom) return false;
    if (filters.actionTo && actionDay > filters.actionTo) return false;

    return true;
  });
}

/* ============================================================================
 * EXPORTACIÓN CSV (descarga real, separador ; para Excel es-CO, BOM UTF-8)
 * ========================================================================== */

function csvCell(value: string | null): string {
  if (value === null) return "";
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildContactsCsv(contacts: Contact[]): string {
  const header = [
    "Nombre",
    "Teléfono",
    "Email",
    "Negocio / Empresa",
    "Etiquetas",
    "Fuente",
    "Cliente cerrado",
    "Creado",
    "Última actividad",
  ].join(";");
  const rows = contacts.map((contact) =>
    [
      csvCell(contact.full_name),
      csvCell(contact.phone_e164),
      csvCell(contact.email),
      csvCell(contact.company_name),
      csvCell(contact.tags.join(", ")),
      csvCell(contact.lead_source),
      contact.is_closed_client ? "Sí" : "No",
      csvCell(formatDate(contact.created_at)),
      csvCell(contact.last_interaction_at ? formatDate(contact.last_interaction_at) : null),
    ].join(";"),
  );
  return [header, ...rows].join("\r\n");
}

/** Reporte de respuestas: una fila por conversación de los contactos dados. */
export function buildResponsesCsv(conversations: Conversation[], contacts: Contact[]): string {
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const header = [
    "Nombre",
    "Teléfono",
    "Último mensaje",
    "Tipo",
    "Fecha último mensaje",
    "Sin responder",
  ].join(";");
  const rows = conversations
    .filter((conversation) => contactsById.has(conversation.contact_id))
    .map((conversation) => {
      const contact = contactsById.get(conversation.contact_id);
      return [
        csvCell(contact?.full_name ?? null),
        csvCell(contact?.phone_e164 ?? null),
        csvCell(conversation.last_message_preview),
        conversation.last_message_media_type === "audio" ? "Nota de voz" : conversation.last_message_media_type,
        csvCell(formatDate(conversation.last_message_at)),
        conversation.needs_reply ? "Sí" : "No",
      ].join(";");
    });
  return [header, ...rows].join("\r\n");
}

/** Dispara la descarga del CSV en el navegador (Etapa A, 100 % cliente). */
export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/* ============================================================================
 * IMPORTACIÓN CSV (parser tolerante: ; o , y celdas entre comillas)
 * ========================================================================== */

const IMPORT_NAME_KEYS = ["nombre", "name"];
const IMPORT_PHONE_KEYS = ["telefono", "tel", "phone", "celular", "movil"];
const IMPORT_EMAIL_KEYS = ["email", "correo"];
const IMPORT_COMPANY_KEYS = ["empresa", "negocio", "company"];
const IMPORT_SOURCE_KEYS = ["fuente", "source"];

/**
 * Parsea texto CSV/Excel a inputs de creación. Espera encabezado con las
 * columnas habituales (nombre, teléfono, email, empresa, fuente); las filas
 * sin nombre ni teléfono se descartan.
 */
export function parseContactsCsv(text: string): CreateContactInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = lines[0]!.includes(";") ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    cells.push(current.trim());
    return cells;
  };

  const headerCells = parseLine(lines[0]!).map(normalizeText);
  const columnIndex = (keys: string[]): number =>
    headerCells.findIndex((cell) => keys.some((key) => cell.includes(key)));

  const idxName = columnIndex(IMPORT_NAME_KEYS);
  const idxPhone = columnIndex(IMPORT_PHONE_KEYS);
  const idxEmail = columnIndex(IMPORT_EMAIL_KEYS);
  const idxCompany = columnIndex(IMPORT_COMPANY_KEYS);
  const idxSource = columnIndex(IMPORT_SOURCE_KEYS);

  const rows: CreateContactInput[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseLine(line);
    const name = (idxName >= 0 ? cells[idxName] : cells[0]) ?? "";
    const phone = (idxPhone >= 0 ? cells[idxPhone] : cells[1]) ?? "";
    if (!name && !phone) continue;
    if (IMPORT_NAME_KEYS.some((key) => normalizeText(name).includes(key))) continue; // encabezado repetido
    rows.push({
      full_name: name || "Sin nombre",
      phone_e164: phone.replace(/\D/g, ""),
      email: idxEmail >= 0 ? cells[idxEmail] || null : null,
      company_name: idxCompany >= 0 ? cells[idxCompany] || null : null,
      lead_source: idxSource >= 0 && cells[idxSource] ? cells[idxSource]! : "WhatsApp",
    });
  }
  return rows;
}

/* ============================================================================
 * FORMATO
 * ========================================================================== */

/** 573207949885 → +57 320 794 9885 (fuente monoespaciada en la tabla). */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) {
    return `+57 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return digits ? `+${digits}` : "—";
}
