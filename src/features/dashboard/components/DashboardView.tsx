"use client";

/**
 * M2 — Dashboard Ejecutivo: KPIs, gráfico mensual, pipeline por etapa
 * y conversaciones recientes. Todos los datos salen de `useCrm()`.
 */

import { DollarSign, MessageCircle, TrendingUp, Users } from "lucide-react";

import { formatCOP, formatNumber } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";

import { KpiCard } from "./KpiCard";
import { OpportunitiesChart } from "./OpportunitiesChart";
import { PipelineStageCard } from "./PipelineStageCard";
import { RecentConversations } from "./RecentConversations";

export function DashboardView() {
  const { dashboardStats, monthlyPerformance, pipelineSummary, conversations, contacts, activeTenant } = useCrm();

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">
        Mostrando datos de la cuenta {activeTenant?.name ?? ""}
      </p>

      {/* 4 Tarjetas KPI */}
      <section aria-label="Indicadores clave" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total de contactos"
          value={formatNumber(dashboardStats.totalContacts)}
          subtitle="Leads en tu base de datos"
          icon={Users}
          iconTone="cyan"
        />
        <KpiCard
          label="Oportunidades abiertas"
          value={formatNumber(dashboardStats.openOpportunities)}
          subtitle="En proceso de negociación"
          icon={TrendingUp}
          iconTone="primary"
        />
        <KpiCard
          label="Facturación total"
          value={formatCOP(dashboardStats.totalRevenue)}
          subtitle="Suma de oportunidades ganadas"
          icon={DollarSign}
          iconTone="success"
        />
        <KpiCard
          label="Sin responder"
          value={formatNumber(dashboardStats.unanswered)}
          subtitle="Conversaciones esperando respuesta del asesor"
          icon={MessageCircle}
          iconTone="danger"
        />
      </section>

      {/* Gráfico principal + Pipeline por etapa */}
      <section aria-label="Rendimiento comercial" className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <OpportunitiesChart data={monthlyPerformance} />
        </div>
        <PipelineStageCard stages={pipelineSummary} />
      </section>

      {/* Conversaciones recientes */}
      <section aria-label="Actividad reciente">
        <RecentConversations conversations={conversations} contacts={contacts} />
      </section>
    </div>
  );
}
