"use client";

import { BarChart3, DollarSign, Target, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { formatCOP, formatNumber } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";

import { buildAttributionRows, type AttributionTab } from "./attributionData";

const TABS: Array<{ key: AttributionTab; label: string }> = [
  { key: "campaigns", label: "Campañas" },
  { key: "adsets", label: "Conjuntos" },
  { key: "ads", label: "Anuncios" },
  { key: "sources", label: "Fuentes" },
  { key: "landings", label: "Landings" },
];

export function AttributionView() {
  const { opportunities, contacts } = useCrm();
  const [tab, setTab] = useState<AttributionTab>("campaigns");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const rows = useMemo(() => buildAttributionRows(tab, opportunities, contacts, from || null, to || null), [tab, opportunities, contacts, from, to]);
  const totals = useMemo(() => rows.reduce((sum, row) => ({ leads: sum.leads + row.leads, won: sum.won + row.won, wonValue: sum.wonValue + row.wonValue }), { leads: 0, won: 0, wonValue: 0 }), [rows]);
  const kpis = [
    { label: "Leads atribuidos", value: formatNumber(totals.leads), icon: Users },
    { label: "Ganados", value: formatNumber(totals.won), icon: Target },
    { label: "Valor ganado", value: formatCOP(totals.wonValue), icon: DollarSign },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Atribución</h1>
        <p className="mt-1 text-sm text-adlive-text-muted">Resultados calculados con los UTM de tus contactos y las oportunidades ganadas. Conjuntos usa <code>utm_term</code> y anuncios usa <code>utm_content</code>; Fuentes usa <code>utm_source</code> y Landings la URL donde llegó el lead. Solo ves los datos de tu workspace.</p>
      </header>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-44"><Input label="Desde" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
          <div className="w-44"><Input label="Hasta" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
        </div>
        <div role="tablist" aria-label="Dimensión de atribución" className="flex rounded-xl border border-adlive-border bg-white p-1">
          {TABS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)} className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium ${tab === item.key ? "bg-adlive-primary text-white shadow-card" : "text-adlive-text-muted hover:text-adlive-text-main"}`}>{item.label}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => { const Icon = kpi.icon; return <Card key={kpi.label} className="flex items-center gap-4 p-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-adlive-primary-light text-adlive-primary"><Icon className="h-5 w-5" aria-hidden /></span><div><p className="text-xs font-medium uppercase tracking-wide text-adlive-text-muted">{kpi.label}</p><p className="mt-0.5 text-2xl font-bold tabular-nums text-adlive-text-main">{kpi.value}</p></div></Card>; })}
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-adlive-border px-6 py-4"><BarChart3 className="h-4 w-4 text-adlive-primary" aria-hidden /><h2 className="text-sm font-semibold text-adlive-text-main">{TABS.find((item) => item.key === tab)?.label} con UTM</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="border-b border-adlive-border bg-adlive-canvas-bg text-xs uppercase tracking-wide text-adlive-text-muted"><th scope="col" className="px-6 py-3 font-semibold">Nombre</th><th scope="col" className="px-4 py-3 text-right font-semibold">Leads</th><th scope="col" className="px-4 py-3 text-right font-semibold">Ganados</th><th scope="col" className="px-4 py-3 text-right font-semibold">Conversión</th><th scope="col" className="px-6 py-3 text-right font-semibold">Valor ganado</th></tr></thead>
            <tbody className="divide-y divide-adlive-border">
              {rows.length === 0 ? <tr><td colSpan={5} className="px-6 py-10 text-center text-adlive-text-muted">No hay contactos con esta dimensión UTM en el período seleccionado.</td></tr> : rows.map((row) => <tr key={row.key}><td className="px-6 py-4"><p className="max-w-md font-medium text-adlive-text-main">{row.name}</p><p className="text-xs text-adlive-text-muted">{row.detail}</p></td><td className="px-4 py-4 text-right font-mono tabular-nums">{formatNumber(row.leads)}</td><td className="px-4 py-4 text-right font-mono tabular-nums">{formatNumber(row.won)}</td><td className="px-4 py-4 text-right font-mono tabular-nums text-adlive-text-muted">{row.conversionPct.toFixed(2)} %</td><td className="px-6 py-4 text-right font-mono tabular-nums font-semibold text-adlive-success">{formatCOP(row.wonValue)}</td></tr>)}
            </tbody>
            <tfoot><tr className="border-t border-adlive-border bg-adlive-canvas-bg font-semibold"><td className="px-6 py-3">Total</td><td className="px-4 py-3 text-right font-mono">{formatNumber(totals.leads)}</td><td className="px-4 py-3 text-right font-mono">{formatNumber(totals.won)}</td><td className="px-4 py-3 text-right font-mono text-adlive-text-muted">{totals.leads > 0 ? ((totals.won / totals.leads) * 100).toFixed(2) : "0.00"} %</td><td className="px-6 py-3 text-right font-mono text-adlive-success">{formatCOP(totals.wonValue)}</td></tr></tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
