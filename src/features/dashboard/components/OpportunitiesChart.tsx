"use client";

/**
 * Gráfico de barras «Oportunidades ganadas y perdidas por mes» (últimos 6 meses).
 * SVG puro (sin dependencias): verde = Ganadas, rojo = Perdidas.
 */

import { Card, CardHeader } from "@/shared/components/ui/Card";
import { formatNumber, monthShortLabel } from "@/shared/lib/format";
import type { MonthlyPerformancePoint } from "@/shared/services/crmStore";

const SVG_WIDTH = 640;
const SVG_HEIGHT = 300;
const PADDING_LEFT = 52;
const PADDING_RIGHT = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 40;

/** Redondea el tope del eje Y a múltiplos de 700 (escala del gráfico de referencia). */
function niceCeil(value: number): number {
  if (value <= 0) return 700;
  return Math.ceil(value / 700) * 700;
}

/** QA-008: detecta cuando todas las barras están en 0 para mostrar el estado vacío. */
function hasAnyClosures(data: MonthlyPerformancePoint[]): boolean {
  return data.some((point) => point.ganadas > 0 || point.perdidas > 0);
}

export interface OpportunitiesChartProps {
  data: MonthlyPerformancePoint[];
}

export function OpportunitiesChart({ data }: OpportunitiesChartProps) {
  const maxValue = niceCeil(Math.max(0, ...data.map((d) => Math.max(d.ganadas, d.perdidas))));
  const gridLines = Array.from({ length: 5 }, (_, i) => (maxValue / 4) * i);
  const plotWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const groupWidth = data.length > 0 ? plotWidth / data.length : plotWidth;
  const barWidth = Math.min(28, groupWidth / 3);

  return (
    <Card>
      <CardHeader title="Oportunidades ganadas y perdidas por mes" subtitle="Últimos 6 meses" />
      <div className="px-6 py-6">
        {data.length === 0 || !hasAnyClosures(data) ? (
          <p className="py-12 text-center text-sm text-adlive-text-muted">Aún no hay oportunidades cerradas en los últimos 6 meses.</p>
        ) : (
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="h-auto w-full"
            role="img"
            aria-label="Gráfico de oportunidades ganadas y perdidas por mes"
          >
            {/* Líneas guía + etiquetas del eje Y */}
            {gridLines.map((value) => {
              const y = PADDING_TOP + plotHeight - (value / maxValue) * plotHeight;
              return (
                <g key={value}>
                  <line x1={PADDING_LEFT} x2={SVG_WIDTH - PADDING_RIGHT} y1={y} y2={y} stroke="#E2E5EC" strokeDasharray="4 4" />
                  <text x={PADDING_LEFT - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#5E6478" fontFamily="var(--font-jetbrains-mono)">
                    {formatNumber(Math.round(value))}
                  </text>
                </g>
              );
            })}

            {/* Barras agrupadas por mes */}
            {data.map((point, index) => {
              const groupX = PADDING_LEFT + groupWidth * index + groupWidth / 2;
              const ganadasHeight = (point.ganadas / maxValue) * plotHeight;
              const perdidasHeight = (point.perdidas / maxValue) * plotHeight;
              const baseline = PADDING_TOP + plotHeight;
              return (
                <g key={point.monthKey}>
                  <rect
                    x={groupX - barWidth - 2}
                    y={baseline - ganadasHeight}
                    width={barWidth}
                    height={Math.max(ganadasHeight, 0)}
                    rx={3}
                    fill="#10B981"
                  >
                    <title>{`${monthShortLabel(point.monthKey)} · Ganadas: ${formatNumber(point.ganadas)}`}</title>
                  </rect>
                  <rect
                    x={groupX + 2}
                    y={baseline - perdidasHeight}
                    width={barWidth}
                    height={Math.max(perdidasHeight, 0)}
                    rx={3}
                    fill="#EF4444"
                  >
                    <title>{`${monthShortLabel(point.monthKey)} · Perdidas: ${formatNumber(point.perdidas)}`}</title>
                  </rect>
                  <text x={groupX} y={baseline + 18} textAnchor="middle" fontSize="11" fill="#5E6478">
                    {monthShortLabel(point.monthKey)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Leyenda */}
        <div className="mt-2 flex items-center justify-center gap-6 text-xs text-adlive-text-muted">
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-adlive-success" />
            Ganadas
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-adlive-danger" />
            Perdidas
          </span>
        </div>
      </div>
    </Card>
  );
}
