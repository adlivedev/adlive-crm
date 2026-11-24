/**
 * M12 — Utilidades puras de Ajustes: tokens, portapapeles y script UTM.
 */

/** QA-012: enmascara el token mostrando solo sus últimos 4 caracteres (`••••••1234`). */
export function maskToken(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.length <= 4) return "••••••";
  return `••••••${trimmed.slice(-4)}`;
}

/** Genera un token hexadecimal aleatorio (mock del servidor en Etapa A). */
export function generateHexToken(bytes = 24): string {
  const chars = "0123456789abcdef";
  let token = "";
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const buffer = new Uint8Array(bytes);
    cryptoObj.getRandomValues(buffer);
    token = [...buffer].map((byte) => chars[byte % 16]!).join("");
  } else {
    for (let i = 0; i < bytes * 2; i += 1) token += chars[Math.floor(Math.random() * 16)];
  }
  return token;
}

/** Copia texto al portapapeles con fallback para contextos no seguros. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Script listo para pegar en la landing: captura utm_source, utm_medium,
 * utm_campaign, utm_content, utm_term, fbclid, landing_url y referrer, los
 * conserva 90 días (localStorage con expiración) y los envía al webhook del CRM.
 */
export function buildUtmScript(webhookUrl: string, token: string): string {
  return `<script>
(function () {
  var STORAGE_KEY = "adlive_utm_attribution";
  var PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
  var NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

  function readStored() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.captured_at || Date.now() - data.captured_at > NINETY_DAYS_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
    } catch (err) { return null; }
  }

  function capture() {
    var stored = readStored() || { captured_at: Date.now(), params: {} };
    var search = new URLSearchParams(window.location.search);
    PARAMS.forEach(function (name) {
      var value = search.get(name);
      if (value) stored.params[name] = value;
    });
    stored.landing_url = window.location.href.split("#")[0];
    stored.referrer = document.referrer || null;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch (err) {}
    return stored;
  }

  function readField(form, names, fallbackSelector) {
    var explicit = form.querySelector('[data-adlive-field="' + names[0] + '"]');
    if (explicit && explicit.value) return explicit.value.trim();
    for (var index = 0; index < names.length; index += 1) {
      var field = form.elements.namedItem(names[index]);
      if (field && typeof field.value === "string" && field.value.trim()) return field.value.trim();
    }
    var fallback = fallbackSelector ? form.querySelector(fallbackSelector) : null;
    return fallback && fallback.value ? fallback.value.trim() : "";
  }

  function send(form) {
    var stored = capture();
    var payload = Object.assign({}, stored.params, {
      public_webhook_token: "${token}",
      full_name: readField(form, ["full_name", "name", "nombre", "nombre_completo"], 'input[type="text"][required]'),
      phone_e164: readField(form, ["phone_e164", "phone", "telefono", "whatsapp", "celular"], 'input[type="tel"]'),
      email: readField(form, ["email", "correo"], 'input[type="email"]') || null,
      company_name: readField(form, ["company_name", "company", "empresa"], null) || null,
      lead_source: "Formulario web",
      landing_url: stored.landing_url,
      referrer_url: stored.referrer || null
    });
    if (!payload.full_name || !payload.phone_e164) return;
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("${webhookUrl}", new Blob([body], { type: "text/plain;charset=UTF-8" }));
    } else {
      fetch("${webhookUrl}", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: body,
        keepalive: true
      }).catch(function () {});
    }
  }

  document.addEventListener("submit", function (event) {
    if (event.target && event.target.tagName === "FORM") send(event.target);
  }, true);
})();
</script>`;
}
