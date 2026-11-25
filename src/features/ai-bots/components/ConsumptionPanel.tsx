"use client";

import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/shared/components/ui/Card";
import { useCrm } from "@/shared/services/crmStore";

interface UsageData {
  totals: { requests: number; errors: number; totalTokens: number; estimatedCostUsd: number; avgLatencyMs: number };
  byModel: Array<{ model: string; requests: number; tokens: number; costUsd: number }>;
  byBot: Array<{ bot: string; requests: number; tokens: number; costUsd: number }>;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO").format(value);
}

/** Fase 2 — Panel de Consumo IA: consumo total del workspace y desglose por
 *  modelo/bot en tokens y costo estimado (últimos 30 días). */
export function ConsumptionPanel() {
  const { activeTenant } = useCrm();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenant) return;
    let cancelled = false;
    void fetch(`/api/v1/ai-bots/usage?tenantId=${activeTenant.id}`).then(async (response) => {
      if (!response.ok) { if (!cancelled) setError("No se pudo cargar el consumo."); return; }
      const result = await response.json() as UsageData;
      if (!cancelled) setUsage(result);
    }).catch(() => { if (!cancelled) setError("No se pudo cargar el consumo."); });
    return () => { cancelled = true; };
  }, [activeTenant]);

  return (
    <section aria-labelledby="ai-consumption-title">
      <h2 id="ai-consumption-title" className="mb-3 flex items-center gap-2 text-base font-semibold text-adlive-text-main"><BarChart3 className="h-4 w-4 text-adlive-primary" aria-hidden /> Consumo de IA · últimos 30 días</h2>
      {error ? <Card className="p-4 text-sm text-adlive-text-muted">{error}</Card> : !usage ? <Card className="p-4 text-sm text-adlive-text-muted">Cargando consumo…</Card> : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5" role="list" aria-label="Totales de consumo">
            {[
              { label: "Peticiones", value: formatNumber(usage.totals.requests) },
              { label: "Tokens totales", value: formatNumber(usage.totals.totalTokens) },
              { label: "Costo estimado", value: `$${usage.totals.estimatedCostUsd.toFixed(4)} USD` },
              { label: "Latencia media", value: `${usage.totals.avgLatencyMs} ms` },
              { label: "Errores", value: formatNumber(usage.totals.errors) },
            ].map((item) => (
              <div key={item.label} role="listitem" className="rounded-xl border border-adlive-border bg-white p-4">
                <p className="text-xs font-medium text-adlive-text-muted">{item.label}</p>
                <p className="mt-1 text-lg font-bold text-adlive-text-main">{item.value}</p>
              </div>
            ))}
          </div>
          {usage.totals.requests === 0 ? (
            <Card className="p-4 text-sm text-adlive-text-muted">Aún no hay consumo registrado: el contador arranca cuando un bot responde su primera conversación o haces una prueba.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-adlive-text-main">Por modelo</h3>
                <ul className="flex flex-col gap-2">
                  {usage.byModel.map((row) => (
                    <li key={row.model} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-mono text-xs text-adlive-text-main">{row.model}</span>
                      <span className="shrink-0 text-xs text-adlive-text-muted">{formatNumber(row.tokens)} tok · ${row.costUsd.toFixed(4)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-adlive-text-main">Por bot</h3>
                <ul className="flex flex-col gap-2">
                  {usage.byBot.map((row) => (
                    <li key={row.bot} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-adlive-text-main">{row.bot}</span>
                      <span className="shrink-0 text-xs text-adlive-text-muted">{formatNumber(row.tokens)} tok · ${row.costUsd.toFixed(4)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
