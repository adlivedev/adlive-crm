import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorStatus, requireTenantAdminOrPlatformSuperadmin } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";

const tenantSchema = z.string().uuid();

/** Fase 2 — Panel de Consumo IA: totales del workspace y desglose por
 *  modelo/bot (tokens y costo estimado) de los últimos 30 días. */
export async function GET(request: Request) {
  try {
    const tenantId = tenantSchema.parse(new URL(request.url).searchParams.get("tenantId"));
    await requireTenantAdminOrPlatformSuperadmin(tenantId);
    const admin = createAdminClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: logs, error } = await admin.from("ai_usage_logs")
      .select("bot_id,provider,model_name,total_tokens,estimated_cost_usd,status,latency_ms,created_at")
      .eq("tenant_id", tenantId).gte("created_at", since).order("created_at", { ascending: false }).limit(500);
    if (error) throw error;

    const rows = logs ?? [];
    const totals = {
      requests: rows.length,
      errors: rows.filter((row) => row.status === "error").length,
      totalTokens: rows.reduce((sum, row) => sum + (row.total_tokens ?? 0), 0),
      estimatedCostUsd: Number(rows.reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0).toFixed(4)),
      avgLatencyMs: rows.length ? Math.round(rows.reduce((sum, row) => sum + (row.latency_ms ?? 0), 0) / rows.length) : 0,
    };
    const byModel = Object.values(rows.reduce<Record<string, { model: string; requests: number; tokens: number; costUsd: number }>>((acc, row) => {
      const key = row.model_name ?? "desconocido";
      acc[key] ??= { model: key, requests: 0, tokens: 0, costUsd: 0 };
      acc[key]!.requests += 1;
      acc[key]!.tokens += row.total_tokens ?? 0;
      acc[key]!.costUsd = Number((acc[key]!.costUsd + Number(row.estimated_cost_usd ?? 0)).toFixed(4));
      return acc;
    }, {})).sort((a, b) => b.tokens - a.tokens);

    const botIds = [...new Set(rows.map((row) => row.bot_id).filter(Boolean))] as string[];
    const { data: bots } = botIds.length
      ? await admin.from("ai_bots").select("id,name").eq("tenant_id", tenantId).in("id", botIds)
      : { data: [] as Array<{ id: string; name: string }> };
    const botNames = new Map((bots ?? []).map((bot) => [bot.id, bot.name]));
    const byBot = Object.values(rows.reduce<Record<string, { bot: string; requests: number; tokens: number; costUsd: number }>>((acc, row) => {
      const key = row.bot_id ? (botNames.get(row.bot_id) ?? "Bot eliminado") : "Pruebas sin bot";
      acc[key] ??= { bot: key, requests: 0, tokens: 0, costUsd: 0 };
      acc[key]!.requests += 1;
      acc[key]!.tokens += row.total_tokens ?? 0;
      acc[key]!.costUsd = Number((acc[key]!.costUsd + Number(row.estimated_cost_usd ?? 0)).toFixed(4));
      return acc;
    }, {})).sort((a, b) => b.tokens - a.tokens);

    return NextResponse.json({ totals, byModel, byBot }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = authErrorStatus(error);
    if (status === 500) console.error("[ai-bots/usage]", error);
    return NextResponse.json({ error: status === 500 ? "No se pudo cargar el consumo de IA." : "No autorizado." }, { status: status === 500 && error instanceof z.ZodError ? 400 : status });
  }
}
