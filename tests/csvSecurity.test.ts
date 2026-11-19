import { describe, expect, it } from "vitest";

import { buildContactsCsv, parseContactsCsv, sanitizeSpreadsheetCell } from "@/features/contacts/components/contactsUtils";
import type { Contact } from "@/shared/types/database";

const dangerousCells = [
  "=CMD|' /C calc'!A0",
  "+SUM(1,2)",
  "-2+3",
  "@SUM(1,2)",
  "  =HYPERLINK(\"https://example.invalid\")",
  "\t+SUM(1,2)",
  "\r@SUM(1,2)",
];

describe("TC-024 — neutralización de fórmulas CSV", () => {
  it.each(dangerousCells)("antepone comilla simple a una fórmula: %j", (value) => {
    expect(sanitizeSpreadsheetCell(value)).toBe(`'${value}`);
  });

  it.each(["Ana María", "+57 320 123 4567".replace("+", "tel "), "correo@example.com", ""])(
    "conserva valores que no son fórmulas: %j",
    (value) => {
      expect(sanitizeSpreadsheetCell(value)).toBe(value);
    },
  );

  it("sanitiza nombre, email, empresa y fuente durante la importación", () => {
    const [contact] = parseContactsCsv([
      "Nombre;Teléfono;Email;Empresa;Fuente",
      "=CMD|' /C calc'!A0;573201234567;+SUM(1,2);  @SUM(1,2);\t-2+3",
    ].join("\r\n"));

    expect(contact).toMatchObject({
      full_name: "'=CMD|' /C calc'!A0",
      phone_e164: "573201234567",
      email: "'+SUM(1,2)",
      company_name: "'@SUM(1,2)",
      lead_source: "'-2+3",
    });
  });

  it("sanitiza todos los campos de texto durante la exportación", () => {
    const contact = {
      id: "contact-1",
      full_name: "=CMD|' /C calc'!A0",
      phone_e164: "+573201234567",
      email: "+SUM(1,2)",
      company_name: "\t@SUM(1,2)",
      tags: ["=HYPERLINK(\"https://example.invalid\")", "cliente"],
      lead_source: "  -2+3",
      is_closed_client: false,
      created_at: "2026-11-18T12:00:00.000Z",
      last_interaction_at: null,
    } as unknown as Contact;

    const csv = buildContactsCsv([contact]);
    expect(csv).toContain("\"'=CMD|' /C calc'!A0\"");
    expect(csv).toContain("\"'+SUM(1,2)\"");
    expect(csv).toContain("\"'\t@SUM(1,2)\"");
    expect(csv).toContain("\"'=HYPERLINK(\"\"https://example.invalid\"\"), cliente\"");
    expect(csv).toContain("\"'  -2+3\"");
  });
});
