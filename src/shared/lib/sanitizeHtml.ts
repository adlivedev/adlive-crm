/** Sanitizador de HTML para bloques de texto del constructor de formularios.
 *  QA-NEW-003: reemplaza el enfoque basado en regex (eludible) por DOMPurify
 *  con una lista blanca estricta — solo etiquetas de formato básico y `href`
 *  restringido a https:// y mailto:. Bloquea on*, javascript:, <svg>, <img>,
 *  <script> malformado y cualquier atributo de datos. */
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["h2", "h3", "p", "strong", "em", "ul", "li", "a", "br"];
const ALLOWED_ATTR = ["href"];

export function sanitizeHtmlBlock(html: string): string {
  const clean = DOMPurify.sanitize(html.slice(0, 10_000), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https:\/\/|mailto:)/i,
  });
  return clean.trim();
}
