"use client";

/**
 * Pestaña Enrollment history (M6): tabla de contactos inscritos en el
 * workflow con nodo actual, estado y fecha de inscripción, más alta manual
 * de contactos mediante la simulación de ejecución.
 */

import { UserPlus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { formatDate } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Workflow, WorkflowEnrollment } from "@/shared/types/database";

import { SimulateModal } from "./SimulateModal";
import { enrollmentStatusMeta } from "./workflowUtils";

interface EnrollmentHistoryTabProps {
  workflow: Workflow;
  enrollments: WorkflowEnrollment[];
}

export function EnrollmentHistoryTab({ workflow, enrollments }: EnrollmentHistoryTabProps) {
  const { contacts } = useCrm();
  const [showEnroll, setShowEnroll] = useState(false);

  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const nodeLabelById = new Map(workflow.canvas_definition.nodes.map((node) => [node.id, node.label]));

  const sorted = [...enrollments].sort((a, b) => b.enrolled_at.localeCompare(a.enrolled_at));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-adlive-border px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-adlive-text-main">Contactos inscritos</h2>
          <p className="mt-0.5 text-sm text-adlive-text-muted">
            {sorted.length} inscripción{sorted.length === 1 ? "" : "es"} en este workflow.
          </p>
        </div>
        <Button onClick={() => setShowEnroll(true)}>
          <UserPlus className="h-4 w-4" aria-hidden />
          Inscribir contactos
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <p className="text-sm font-semibold text-adlive-text-main">Sin inscripciones todavía</p>
          <p className="max-w-md text-sm text-adlive-text-muted">
            Inscribe contactos manualmente para probar el flujo antes de publicarlo.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-adlive-border bg-adlive-canvas-bg/60 text-xs uppercase tracking-wide text-adlive-text-muted">
                <th scope="col" className="px-6 py-3.5 font-semibold">Contacto</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Nodo actual</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Estado</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Inscrito el</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((enrollment) => {
                const contact = contactById.get(enrollment.contact_id);
                const meta = enrollmentStatusMeta(enrollment.status);
                return (
                  <tr key={enrollment.id} className="border-b border-adlive-border/70 transition-colors last:border-0 hover:bg-adlive-primary-light/40">
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-adlive-text-main">{contact?.full_name ?? "Contacto eliminado"}</p>
                      <p className="font-mono text-xs text-adlive-text-muted">{contact?.phone_e164 ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3.5 text-adlive-text-main">
                      {enrollment.current_node_id ? (nodeLabelById.get(enrollment.current_node_id) ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-adlive-text-muted">{formatDate(enrollment.enrolled_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SimulateModal workflow={workflow} open={showEnroll} onClose={() => setShowEnroll(false)} />
    </Card>
  );
}
