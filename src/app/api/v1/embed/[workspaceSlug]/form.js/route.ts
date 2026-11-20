import { z } from "zod";

import { getAppOrigin } from "@/shared/lib/appOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(150);

function embedScript(workspaceSlug: string, origin: string): string {
  return `(function () {
  var PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
  var KEY = "adlive_embed_attribution";
  var MAX_AGE = 90 * 24 * 60 * 60;
  function stored() {
    try {
      var value = JSON.parse(window.localStorage.getItem(KEY) || "null");
      if (!value || Date.now() - value.captured_at > MAX_AGE * 1000) return { captured_at: Date.now(), values: {} };
      return value;
    } catch (error) { return { captured_at: Date.now(), values: {} }; }
  }
  function attribution() {
    var data = stored();
    var search = new URLSearchParams(window.location.search);
    PARAMS.forEach(function (name) {
      var value = search.get(name);
      if (!value) {
        var match = document.cookie.split("; ").find(function (item) { return item.indexOf("adlive_" + name + "=") === 0; });
        if (match) value = decodeURIComponent(match.slice(name.length + 8));
      }
      if (value) {
        data.values[name] = value.slice(0, 2048);
        document.cookie = "adlive_" + name + "=" + encodeURIComponent(value.slice(0, 2048)) + "; Max-Age=" + MAX_AGE + "; Path=/; SameSite=Lax";
      }
    });
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch (error) {}
    return data.values;
  }
  function init() {
    var values = attribution();
    document.querySelectorAll("[data-crm-form]").forEach(function (container) {
      if (container.getAttribute("data-crm-loaded") === "true") return;
      var slug = container.getAttribute("data-crm-form") || ${JSON.stringify(workspaceSlug)};
      if (slug !== ${JSON.stringify(workspaceSlug)}) return;
      container.setAttribute("data-crm-loaded", "true");
      var theme = container.getAttribute("data-theme") || "light";
      var primary = container.getAttribute("data-primary") || "";
      var params = new URLSearchParams(values);
      params.set("theme", theme);
      if (/^#[0-9a-f]{6}$/i.test(primary)) params.set("primary", primary);
      params.set("landing_url", window.location.href.split("#")[0]);
      params.set("referrer_url", document.referrer || "");
      var iframe = document.createElement("iframe");
      iframe.src = ${JSON.stringify(origin)} + "/embed/" + encodeURIComponent(slug) + "/form?" + params.toString();
      iframe.title = "Formulario de contacto";
      iframe.loading = "lazy";
      iframe.style.width = "100%";
      iframe.style.minHeight = container.getAttribute("data-height") || "720px";
      iframe.style.border = "0";
      iframe.style.display = "block";
      iframe.setAttribute("scrolling", "auto");
      container.appendChild(iframe);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();`;
}

export async function GET(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const slug = slugSchema.safeParse((await context.params).workspaceSlug);
  if (!slug.success) return new Response("Workspace inválido", { status: 400 });
  return new Response(embedScript(slug.data, getAppOrigin(request)), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
