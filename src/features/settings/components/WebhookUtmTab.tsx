"use client";

/**
 * M12 — Pestaña Formulario web y UTM.
 * Webhook de captación, token de la cuenta con regeneración en vivo y el
 * bloque <script> listo para copiar que captura UTM + fbclid durante 90 días.
 */

import { Check, Copy, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";

import { buildUtmScript, copyText, generateHexToken } from "./settingsUtils";

export function WebhookUtmTab() {
  const { activeTenant } = useCrm();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<"url" | "token" | "script" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [appOrigin, setAppOrigin] = useState("");

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  const currentToken = token ?? activeTenant?.public_webhook_token ?? "";
  const webhookUrl = `${appOrigin}/api/v1/webhooks/lead-web`;
  const script = useMemo(() => buildUtmScript(webhookUrl, currentToken), [webhookUrl, currentToken]);

  const handleCopy = async (kind: "url" | "token" | "script", text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(kind);
      setAnnouncement(kind === "url" ? "Dirección del webhook copiada." : kind === "token" ? "Token de la cuenta copiado." : "Script UTM copiado al portapapeles.");
      window.setTimeout(() => setCopied((prev) => (prev === kind ? null : prev)), 2000);
    }
  };

  const handleRegenerate = () => {
    setToken(generateHexToken());
    setAnnouncement("Token regenerado. Actualiza el script en tu landing lo antes posible.");
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-adlive-text-main">Dirección del webhook</h3>
        <p className="mt-1 text-xs text-adlive-text-muted">
          Apunta aquí el formulario web o el script de tu landing para crear contactos con atribución UTM en esta cuenta.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <Input readOnly label="Webhook" value={webhookUrl} onFocus={(event) => event.target.select()} />
          </div>
          <Button variant="secondary" onClick={() => void handleCopy("url", webhookUrl)}>
            {copied === "url" ? <Check className="h-4 w-4 text-adlive-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied === "url" ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-adlive-text-main">Token de la cuenta</h3>
            <p className="mt-1 text-xs text-adlive-text-muted">
              Identifica las capturas de esta agencia. Si lo regeneras, el token anterior deja de funcionar.
            </p>
          </div>
          {token ? <Badge tone="warning">Pendiente de confirmar en servidor (Etapa B)</Badge> : <Badge tone="success">Activo</Badge>}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <Input readOnly label="Token" value={currentToken} onFocus={(event) => event.target.select()} className="font-mono" />
          </div>
          <Button variant="secondary" onClick={() => void handleCopy("token", currentToken)}>
            {copied === "token" ? <Check className="h-4 w-4 text-adlive-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied === "token" ? "Copiado" : "Copiar"}
          </Button>
          <Button variant="ghost" className="text-adlive-danger hover:text-adlive-danger" onClick={handleRegenerate}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Regenerar
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-adlive-border px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-adlive-text-main">Script de captura UTM</h3>
            <p className="mt-0.5 text-xs text-adlive-text-muted">
              Pégalo antes del cierre de <span className="font-mono">&lt;/body&gt;</span> en tu landing. Captura{" "}
              <span className="font-mono">utm_source</span>, <span className="font-mono">utm_medium</span>,{" "}
              <span className="font-mono">utm_campaign</span>, <span className="font-mono">utm_content</span>,{" "}
              <span className="font-mono">utm_term</span>, <span className="font-mono">fbclid</span>,{" "}
              <span className="font-mono">landing_url</span> y <span className="font-mono">referrer</span> durante 90 días.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void handleCopy("script", script)}>
            {copied === "script" ? <Check className="h-4 w-4 text-adlive-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied === "script" ? "Copiado" : "Copiar script"}
          </Button>
        </div>
        <pre className="max-h-96 overflow-auto bg-adlive-sidebar-bg px-6 py-4 text-xs leading-6 text-emerald-200">
          <code>{script}</code>
        </pre>
      </Card>
    </div>
  );
}
