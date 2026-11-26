import { describe, expect, it } from "vitest";

import { sanitizeHtmlBlock } from "@/shared/lib/sanitizeHtml";

/* QA-NEW-003 — Reemplazo real del sanitizador regex por DOMPurify con lista
 * blanca estricta: solo h2, h3, p, strong, em, ul, li, a, br y href limitado
 * a https:// y mailto:. */
describe("sanitizeHtmlBlock — endurecimiento QA-NEW-003 (DOMPurify, lista blanca)", () => {
  it("conserva el formato básico permitido", () => {
    expect(sanitizeHtmlBlock("<h2>Título</h2><p>Hola <strong>mundo</strong> <em>sí</em></p><ul><li>uno</li></ul><br>"))
      .toBe("<h2>Título</h2><p>Hola <strong>mundo</strong> <em>sí</em></p><ul><li>uno</li></ul><br>");
  });

  it("permite href https:// y mailto:, y elimina javascript:", () => {
    expect(sanitizeHtmlBlock('<a href="https://example.com">ok</a>')).toContain('href="https://example.com"');
    expect(sanitizeHtmlBlock('<a href="mailto:test@example.com">mail</a>')).toContain('href="mailto:test@example.com"');
    expect(sanitizeHtmlBlock('<a href="javascript:alert(1)">click</a>')).not.toContain("javascript:");
    expect(sanitizeHtmlBlock('<a href="http://inseguro.com">http</a>')).not.toContain("http://inseguro.com");
  });

  it("bloquea <img src=x onerror=alert(1)//>", () => {
    const clean = sanitizeHtmlBlock('<img src=x onerror=alert(1)//>');
    expect(clean).not.toContain("img");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("alert");
  });

  it("bloquea <svg onload=…> conservando solo el contenido permitido", () => {
    const clean = sanitizeHtmlBlock('<svg onload=alert(1)><p>x</p></svg>');
    expect(clean).not.toContain("svg");
    expect(clean).not.toContain("onload");
  });

  it("bloquea <script> malformado (tag roto para evadir filtros)", () => {
    const clean = sanitizeHtmlBlock('<scr<script>ipt>alert(1)</scr</script>ipt>');
    expect(clean).not.toContain("<script");
    /* El payload queda neutralizado como texto escapado inerte, sin elemento script. */
    expect(clean).not.toContain("alert(1)</script");
    expect(clean).toContain("&gt;");
  });

  it("elimina eventos on* de cualquier etiqueta permitida", () => {
    const clean = sanitizeHtmlBlock('<p onclick="steal()" onmouseover="x()">texto</p>');
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onmouseover");
    expect(clean).toContain("texto");
  });

  it("rechaza atributos de datos y aria inyectados", () => {
    const clean = sanitizeHtmlBlock('<p data-evil="1" aria-label="x">ok</p>');
    expect(clean).not.toContain("data-evil");
    expect(clean).not.toContain("aria-label");
  });

  it("recorta a 10.000 caracteres (anti-DoS)", () => {
    expect(sanitizeHtmlBlock(`<p>${"a".repeat(20_000)}</p>`).length).toBeLessThanOrEqual(10_050);
  });
});
