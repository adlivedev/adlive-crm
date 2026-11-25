/** Sanitizador mínimo de HTML para bloques de texto del constructor de
 *  formularios: elimina scripts, iframes y manejadores de eventos on* antes de
 *  guardar o renderizar. No es un parser completo; bloquea vectores comunes de
 *  XSS (script, iframe, object, embed, on*, javascript:). */
const BLOCKED_TAGS = /<\s*(script|iframe|object|embed|form|meta|link|base)[^>]*>[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi;

export function sanitizeHtmlBlock(html: string): string {
  return html
    .replace(BLOCKED_TAGS, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|xlink:href)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, "$1=#")
    .trim()
    .slice(0, 10_000);
}
