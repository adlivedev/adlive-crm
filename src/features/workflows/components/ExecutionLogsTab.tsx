"use client";

/**
 * Pestaña Execution logs (M6): trazabilidad técnica paso a paso de los
 * nodos ejecutados por cada inscripción: respuesta recibida ("Sí"/"No"),
 * etapa aplicada y agente asignado por el algoritmo Round Robin.
 */

import { Badge } from "@/shared/components/ui/Badge";
import { Card } from "@/shared/components/ui/Card";
import { formatDate, formatTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { WorkflowEnrollment } from "@/shared/types/database";

import { outcomeLabel, outcomeTone } from "./workflowUtils";

interface ExecutionLogsTabProps {
  enrollments: WorkflowEnrollment[];
}

interface FlatLogRow {
  key: string;
  contactId: string;
  executedAt: string;
  nodeLabel: string;
  outcome: "success" | "error" | "skipped";
  detail: string;
}

export function ExecutionLogsTab({ enrollments }: ExecutionLogsTabProps) {
  const { contacts } = useCrm();
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));

  const rows: FlatLogRow[] = enrollments
    .flatMap((enrollment) =>
      enrollment.execution_logs.map((log, index) => ({
        key: `${enrollment.id}-${log.node_id}-${index}`,
        contactId: enrollment.contact_id,
        executedAt: log.executed_at,
        nodeLabel: log.node_label,
        outcome: log.outcome,
        detail: log.detail,
      })),
    )
    .sort((a, b) => b.executedAt.localeCompare(a.executedAt));

  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <p className="text-sm font-semibold text-adlive-text-main">Sin logs de ejecución</p>
        <p className="max-w-md text-sm text-adlive-text-muted">
          Inscribe un contacto para ver aquí la trazabilidad de su ejecución.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-adlive-border px-6 py-4">
        <h2 className="text-base font-semibold text-adlive-text-main">Logs de ejecución</h2>
        <p className="mt-0.5 text-sm text-adlive-text-muted">
          {rows.length} evento{rows.length === 1 ? "" : "s"} registrados, del más reciente al más antiguo.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-adlive-border bg-adlive-canvas-bg/60 text-xs uppercase tracking-wide text-adlive-text-muted">
              <th scope="col" className="px-6 py-3.5 font-semibold">Fecha</th>
              <th scope="col" className="px-4 py-3.5 font-semibold">Contacto</th>
              <th scope="col" className="px-4 py-3.5 font-semibold">Nodo ejecutado</th>
              <th scope="col" className="px-4 py-3.5 font-semibold">Resultado</th>
              <th scope="col" className="px-4 py-3.5 font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const contact = contactById.get(row.contactId);
              return (
                <tr key={row.key} className="border-b border-adlive-border/70 transition-colors last:border-0 hover:bg-adlive-primary-light/40">
                  <td className="whitespace-nowrap px-6 py-3.5 text-adlive-text-muted">
                    {formatDate(row.executedAt)} · {formatTime(row.executedAt)}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-adlive-text-main">{contact?.full_name ?? "Contacto eliminado"}</p>
                    <p className="font-mono text-xs text-adlive-text-muted">{contact?.phone_e164 ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-adlive-text-main">{row.nodeLabel}</td>
                  <td className="px-4 py-3.5">
                    <Badge tone={outcomeTone(row.outcome)}>{outcomeLabel(row.outcome)}</Badge>
                  </td>
                  <td className="max-w-[360px] px-4 py-3.5 text-adlive-text-muted">
                    <span className={row.detail.includes("Round Robin") ? "font-mono text-xs text-adlive-text-main" : ""}>
                      {row.detail}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
