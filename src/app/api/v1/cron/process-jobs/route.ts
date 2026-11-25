import { NextResponse } from "next/server";

import { nextRetryRunAfter } from "@/shared/lib/backgroundJobs";
import { emailSlaAlert, sendDailySummary } from "@/shared/services/conversationAlertService";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Procesador de la cola anti-timeout (background_jobs).
 * Protegido por CRON_SECRET en la cabecera Authorization: Bearer …
 * Reintenta trabajos pendientes con retraso, en lotes pequeños para no
 * superar el límite de duración de la función.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: jobs, error } = await admin.from("background_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("run_after", now)
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  let processed = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    try {
      await processJob(admin, job);
      await admin.from("background_jobs").update({
        status: "completed", completed_at: new Date().toISOString(), locked_at: null,
      }).eq("id", job.id);
      processed += 1;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Error desconocido";
      const attempts = (job.attempts ?? 0) + 1;
      const exhausted = attempts >= (job.max_attempts ?? 3);
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
  return NextResponse.json({ ok: true, pending: jobs?.length ?? 0, processed, failed });
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
    default:
      throw new Error(`Tipo de trabajo no soportado: ${job.job_type}`);
  }
}
