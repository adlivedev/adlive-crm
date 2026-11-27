import { NextResponse } from "next/server";

import { nextRetryRunAfter } from "@/shared/lib/backgroundJobs";
import { isCronAuthorized, partitionJobsByActiveTenants } from "@/shared/lib/cronSecurity";
import { processCampaignSendBatch } from "@/shared/services/campaignService";
import { emailSlaAlert, sendDailySummary } from "@/shared/services/conversationAlertService";
import { runSlaWorkflowsSweep } from "@/shared/services/workflowExecutionService";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Procesador de la cola anti-timeout (background_jobs).
 * Scheduler oficial: Supabase `pg_cron` (`adlive-crm-process-jobs` cada 5 min),
 * que llama este endpoint con `Authorization: Bearer ${CRON_SECRET}`.
 * Acepta GET y POST (pg_net puede usar cualquiera de los dos).
 *
 * Blindaje multi-tenant: se iteran SOLO los tenants `active` (los `suspended`
 * nunca se procesan) y cada tenant se ejecuta dentro de su propio try/catch,
 * de modo que un fallo en una empresa no detiene a las demás. Toda consulta de
 * los jobs ya filtra por `tenant_id` (los jobs nacen con tenant del workspace).
 */
async function handle(request: Request): Promise<Response> {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: tenants, error: tenantsError } = await admin.from("tenants").select("id").eq("status", "active");
  if (tenantsError) return NextResponse.json({ error: tenantsError.message }, { status: 502 });
  const activeTenantIds = new Set<string>((tenants ?? []).map((tenant) => tenant.id as string));

  /* Barrido de workflows con disparador SLA: solo sobre tenants activos y nunca
     bloquea la cola de trabajos. */
  let sweepEnrolled = 0;
  try {
    const sweep = await runSlaWorkflowsSweep(activeTenantIds);
    sweepEnrolled = sweep.enrolled;
    if (sweep.enrolled > 0) console.info("workflow.sla.sweep", JSON.stringify(sweep));
  } catch (cause) {
    console.error("workflow.sla.sweep.failed", cause instanceof Error ? cause.message : "unknown error");
  }

  const now = new Date().toISOString();
  const { data: jobs, error } = await admin.from("background_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("run_after", now)
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  const { runnable, skipped } = partitionJobsByActiveTenants(
    activeTenantIds,
    (jobs ?? []) as Array<JobRow & { attempts?: number; max_attempts?: number }>,
  );

  let processed = 0;
  let failed = 0;
  for (const job of runnable) {
    try {
      await processJob(admin, job);
      await admin.from("background_jobs").update({
        status: "completed", completed_at: new Date().toISOString(), locked_at: null,
      }).eq("id", job.id);
      processed += 1;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Error desconocido";
      const attempts = ((job.attempts as number | undefined) ?? 0) + 1;
      const exhausted = attempts >= ((job.max_attempts as number | undefined) ?? 3);
      await admin.from("background_jobs").update({
        status: exhausted ? "failed" : "pending",
        attempts,
        last_error: message.slice(0, 500),
        locked_at: null,
        ...(exhausted ? {} : { run_after: nextRetryRunAfter(attempts) }),
      }).eq("id", job.id);
      failed += 1;
    }
  }
  return NextResponse.json({
    ok: true, pending: jobs?.length ?? 0, processed, failed, skipped: skipped.length, sla_enrolled: sweepEnrolled,
  });
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

type JobRow = { id: string; tenant_id: string; job_type: string; payload: Record<string, unknown> };

async function processJob(admin: ReturnType<typeof createAdminClient>, job: JobRow): Promise<void> {
  switch (job.job_type) {
    /* Alerta de conversaciones sin respuesta humana > 1 h. Si el payload trae
       conversation_id, solo evalúa esa conversación; si no, escanea el tenant. */
    case "conversation_sla_alert": {
      const hours = Number(job.payload.hours ?? 1);
      const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
      let query = admin.from("conversations")
        .select("id, contact_id, assigned_member_id").eq("tenant_id", job.tenant_id)
        .eq("handler_mode", "human").eq("needs_reply", true).lte("last_inbound_at", cutoff);
      if (typeof job.payload.conversation_id === "string") query = query.eq("id", job.payload.conversation_id);
      const { data: stale } = await query;
      for (const conversation of stale ?? []) {
        const { data: contact } = await admin.from("contacts").select("full_name").eq("id", conversation.contact_id).eq("tenant_id", job.tenant_id).maybeSingle();
        await admin.from("notifications").insert({
          tenant_id: job.tenant_id,
          recipient_member_id: conversation.assigned_member_id,
          target_role: conversation.assigned_member_id ? null : "admin",
          type: "sla_unanswered",
          title: "Conversación sin responder",
          body: `Lleva más de ${hours} h sin respuesta humana.`,
          action_url: `/conversaciones?open=${conversation.id}`,
          metadata: { conversation_id: conversation.id, contact_id: conversation.contact_id },
        });
        await emailSlaAlert({
          tenantId: job.tenant_id,
          memberId: conversation.assigned_member_id,
          conversationId: conversation.id,
          hours,
          contactName: contact?.full_name ?? "un contacto",
        });
      }
      return;
    }
    /* Resumen diario de contactos creados con origen por formulario/UTM.
       Al completarse, programa el siguiente para mañana a las 9:00. */
    case "daily_summary": {
      await sendDailySummary(job.tenant_id);
      const next = new Date();
      next.setHours(9, 0, 0, 0);
      next.setDate(next.getDate() + 1);
      await admin.from("background_jobs").insert({
        tenant_id: job.tenant_id, job_type: "daily_summary", payload: {}, run_after: next.toISOString(),
      });
      return;
    }
    /* Reactivar workflows con nodos en espera cuyo wait_expires_at ya venció. */
    case "workflow_wait_resume": {
      const { data: enrollments } = await admin.from("workflow_enrollments")
        .select("id, workflow_id, contact_id").eq("tenant_id", job.tenant_id)
        .eq("status", "active").not("wait_expires_at", "is", null)
        .lte("wait_expires_at", new Date().toISOString());
      for (const enrollment of enrollments ?? []) {
        await admin.from("workflow_enrollments").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", enrollment.id);
      }
      return;
    }
    /* Envío masivo 1x1 de una campaña: procesa un lote y se re-encola
       automáticamente mientras queden contactos pendientes. */
    case "campaign_send_batch": {
      const campaignId = typeof job.payload.campaign_id === "string" ? job.payload.campaign_id : "";
      if (!campaignId) throw new Error("campaign_send_batch sin campaign_id.");
      await processCampaignSendBatch(job.tenant_id, campaignId);
      return;
    }
    default:
      throw new Error(`Tipo de trabajo no soportado: ${job.job_type}`);
  }
}
