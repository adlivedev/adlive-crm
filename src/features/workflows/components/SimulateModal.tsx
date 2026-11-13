"use client";

/**
 * Modal «Simular Ejecución de Workflow» (M6): elige un contacto real del
 * store (y la respuesta simulada cuando el flujo tiene ramas), ejecuta el
 * lienzo paso a paso en el estado reactivo y muestra la trazabilidad con
 * el agente asignado por el algoritmo Round Robin.
 */

import { FlaskConical, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { formatTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { SimulatedReply } from "@/shared/services/crmActions";
import type { Workflow } from "@/shared/types/database";

import { branchOptionsOf, outcomeTone } from "./workflowUtils";

interface SimulateModalProps {
  workflow: Workflow;
  open: boolean;
  onClose: () => void;
}

export function SimulateModal({ workflow, open, onClose }: SimulateModalProps) {
  const { contacts, workflowEnrollments, enrollContactInWorkflow } = useCrm();
  const [query, setQuery] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [reply, setReply] = useState<SimulatedReply | null>("Si");
  const [executedFor, setExecutedFor] = useState<string | null>(null);

  const branchNode = workflow.canvas_definition.nodes.find((node) => node.type === "branch");
  const branchOptions = branchNode ? branchOptionsOf(branchNode.config) : [];

  const filteredContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const pool = normalized
      ? contacts.filter(
          (contact) =>
            contact.full_name.toLowerCase().includes(normalized) || contact.phone_e164.includes(normalized),
        )
      : contacts;
    return pool.slice(0, 8);
  }, [contacts, query]);

  const selectedContact = contacts.find((contact) => contact.id === contactId) ?? null;
  const alreadyEnrolled =
    selectedContact !== null &&
    !workflow.allow_reenrollment &&
    workflowEnrollments.some(
      (enrollment) => enrollment.workflow_id === workflow.id && enrollment.contact_id === selectedContact.id,
    );

  const lastEnrollment = executedFor
    ? workflowEnrollments.find(
        (enrollment) => enrollment.workflow_id === workflow.id && enrollment.contact_id === executedFor,
      )
    : null;

  const handleRun = () => {
    if (!selectedContact) return;
    enrollContactInWorkflow(workflow.id, selectedContact.id, branchNode ? reply : null);
    setExecutedFor(selectedContact.id);
  };

  const handleClose = () => {
    setQuery("");
    setContactId(null);
    setReply(branchOptions[0] === "No" ? "No" : "Si");
    setExecutedFor(null);
    onClose();
  };

  const roundRobinLog = lastEnrollment?.execution_logs.find((log) => log.detail.includes("Round Robin"));

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Simular Ejecución de Workflow"
      subtitle={`Prueba el flujo «${workflow.name}» en vivo sobre un contacto.`}
      maxWidthClassName="max-w-2xl"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="simulate-search" className="text-sm font-medium text-adlive-text-main">
            Contacto de prueba
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-adlive-text-muted" aria-hidden />
            <input
              id="simulate-search"
              type="search"
              placeholder="Buscar por nombre o teléfono…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-xl border border-adlive-border bg-white pl-10 pr-4 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 transition-colors duration-150 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
            />
          </div>
          <ul className="flex max-h-48 flex-col overflow-y-auto rounded-xl border border-adlive-border" role="listbox" aria-label="Contactos disponibles">
            {filteredContacts.length === 0 ? (
              <li className="px-4 py-3 text-sm text-adlive-text-muted">Sin resultados para «{query}».</li>
            ) : (
              filteredContacts.map((contact) => (
                <li key={contact.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={contactId === contact.id}
                    onClick={() => {
                      setContactId(contact.id);
                      setExecutedFor(null);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-150 ${
                      contactId === contact.id ? "bg-adlive-primary-light" : "hover:bg-adlive-canvas-bg"
                    }`}
                  >
                    <span className="font-medium text-adlive-text-main">{contact.full_name}</span>
                    <span className="font-mono text-xs text-adlive-text-muted">{contact.phone_e164}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        {branchNode ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-adlive-text-main">Respuesta simulada del cliente</legend>
            <div className="flex flex-wrap gap-2">
              {branchOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={reply === option}
                  onClick={() => setReply(option as SimulatedReply)}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adlive-primary ${
                    reply === option
                      ? "border-adlive-primary bg-adlive-primary text-white"
                      : "border-adlive-border bg-white text-adlive-text-muted hover:border-adlive-primary/50 hover:text-adlive-primary"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {alreadyEnrolled ? (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-adlive-warning">
            Este contacto ya está inscrito y el workflow no permite re-inscripción (Settings).
          </p>
        ) : null}

        {lastEnrollment ? (
          <div className="flex flex-col gap-2.5 rounded-xl border border-adlive-border bg-adlive-canvas-bg/50 px-4 py-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-adlive-text-main">
              <FlaskConical className="h-4 w-4 text-adlive-cyan" aria-hidden />
              Resultado de la simulación
              <Badge tone={lastEnrollment.status === "completed" ? "success" : "warning"}>{lastEnrollment.status}</Badge>
            </p>
            {roundRobinLog ? (
              <p className="rounded-lg bg-adlive-lime/40 px-3 py-2 font-mono text-xs text-adlive-text-main">
                {roundRobinLog.detail}
              </p>
            ) : null}
            <ol className="flex flex-col gap-1.5">
              {lastEnrollment.execution_logs.map((log, index) => (
                <li key={`${log.node_id}-${index}`} className="flex items-start gap-2.5 text-xs">
                  <Badge tone={outcomeTone(log.outcome)}>{log.outcome}</Badge>
                  <div>
                    <p className="font-semibold text-adlive-text-main">{log.node_label}</p>
                    <p className="text-adlive-text-muted">
                      {log.detail} · {formatTime(log.executed_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cerrar
          </Button>
          <Button onClick={handleRun} disabled={!selectedContact || alreadyEnrolled}>
            <FlaskConical className="h-4 w-4" aria-hidden />
            Ejecutar simulación
          </Button>
        </div>
      </div>
    </Modal>
  );
}
