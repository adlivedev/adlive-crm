"use client";

import { Play, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { formatTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Workflow } from "@/shared/types/database";

import { outcomeTone } from "./workflowUtils";

interface SimulateModalProps { workflow: Workflow; open: boolean; onClose: () => void }

/** Inscribe un contacto real; la ejecución asíncrona queda trazada en sus logs. */
export function SimulateModal({ workflow, open, onClose }: SimulateModalProps) {
  const { contacts, workflowEnrollments, enrollContactInWorkflow, isMutating } = useCrm();
  const [query, setQuery] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [executedFor, setExecutedFor] = useState<string | null>(null);
  const filteredContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return contacts.filter((contact) => !normalized || contact.full_name.toLowerCase().includes(normalized) || contact.phone_e164.includes(normalized)).slice(0, 8);
  }, [contacts, query]);
  const selectedContact = contacts.find((contact) => contact.id === contactId) ?? null;
  const alreadyEnrolled = selectedContact !== null && !workflow.allow_reenrollment && workflowEnrollments.some((enrollment) => enrollment.workflow_id === workflow.id && enrollment.contact_id === selectedContact.id);
  const lastEnrollment = executedFor ? workflowEnrollments.find((enrollment) => enrollment.workflow_id === workflow.id && enrollment.contact_id === executedFor) : null;
  const handleClose = () => { setQuery(""); setContactId(null); setExecutedFor(null); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="Inscribir contacto" subtitle={`Inscribe un contacto en «${workflow.name}». Las acciones se procesan en el servidor.`} maxWidthClassName="max-w-2xl">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="simulate-search" className="text-sm font-medium text-adlive-text-main">Contacto</label>
          <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-adlive-text-muted" aria-hidden /><input id="simulate-search" type="search" placeholder="Buscar por nombre o teléfono…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-xl border border-adlive-border bg-white pl-10 pr-4 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20" /></div>
          <ul className="flex max-h-48 flex-col overflow-y-auto rounded-xl border border-adlive-border" role="listbox" aria-label="Contactos disponibles">
            {filteredContacts.length === 0 ? <li className="px-4 py-3 text-sm text-adlive-text-muted">No hay contactos disponibles en esta página.</li> : filteredContacts.map((contact) => <li key={contact.id}><button type="button" role="option" aria-selected={contactId === contact.id} onClick={() => { setContactId(contact.id); setExecutedFor(null); }} className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${contactId === contact.id ? "bg-adlive-primary-light" : "hover:bg-adlive-canvas-bg"}`}><span className="font-medium text-adlive-text-main">{contact.full_name}</span><span className="font-mono text-xs text-adlive-text-muted">{contact.phone_e164}</span></button></li>)}
          </ul>
        </div>
        {alreadyEnrolled ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-adlive-warning">Este contacto ya está inscrito y el workflow no permite una nueva inscripción.</p> : null}
        {lastEnrollment ? <div className="flex flex-col gap-2.5 rounded-xl border border-adlive-border bg-adlive-canvas-bg/50 px-4 py-3.5"><p className="flex items-center gap-2 text-sm font-semibold">Última inscripción <Badge tone={lastEnrollment.status === "completed" ? "success" : "warning"}>{lastEnrollment.status}</Badge></p><ol className="flex flex-col gap-1.5">{lastEnrollment.execution_logs.map((log, index) => <li key={`${log.node_id}-${index}`} className="flex items-start gap-2.5 text-xs"><Badge tone={outcomeTone(log.outcome)}>{log.outcome}</Badge><div><p className="font-semibold">{log.node_label}</p><p className="text-adlive-text-muted">{log.detail} · {formatTime(log.executed_at)}</p></div></li>)}</ol></div> : null}
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={handleClose}>Cerrar</Button><Button isLoading={isMutating} onClick={() => { if (!selectedContact) return; enrollContactInWorkflow(workflow.id, selectedContact.id, null); setExecutedFor(selectedContact.id); }} disabled={!selectedContact || alreadyEnrolled}><Play className="h-4 w-4" aria-hidden />Inscribir contacto</Button></div>
      </div>
    </Modal>
  );
}
