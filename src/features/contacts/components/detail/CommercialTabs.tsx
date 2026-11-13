"use client";

/**
 * M3 — Columna derecha de la ficha 360° (Gestión Comercial):
 * pestañas Notas · Tareas · Empresas · Documentos · Citas.
 *
 * - Notas: textarea «Notas internas» con Guardar + Historial de actividad
 *   con input para registrar actividades/comentarios y línea de tiempo.
 * - Tareas: alta con fecha límite y marcado de completada (store).
 * - Empresas: ficha de la empresa del contacto y contactos relacionados.
 * - Documentos: adjuntos simulados persistidos como actividad (trazabilidad)
 *   más los archivos multimedia ya recibidos por WhatsApp.
 * - Citas: agenda de citas en memoria (mock Etapa A; en Etapa B se persiste
 *   en tabla dedicada vía MCP).
 */

import {
  Building2,
  CalendarDays,
  CheckSquare,
  Circle,
  CircleCheck,
  FileText,
  NotepadText,
  Paperclip,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { formatCOP, formatDate, formatRelativeTime, formatTime } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact } from "@/shared/types/database";

type TabKey = "notas" | "tareas" | "empresas" | "documentos" | "citas";

const TABS: Array<{ key: TabKey; label: string; icon: typeof NotepadText }> = [
  { key: "notas", label: "Notas", icon: NotepadText },
  { key: "tareas", label: "Tareas", icon: CheckSquare },
  { key: "empresas", label: "Empresas", icon: Building2 },
  { key: "documentos", label: "Documentos", icon: FileText },
  { key: "citas", label: "Citas", icon: CalendarDays },
];

const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-adlive-border bg-white px-3 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20";

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  creation: "Creación",
  note: "Nota",
  task: "Tarea",
  stage_change: "Pipeline",
  typification: "Tipificación",
  assignment: "Asignación",
  opportunity: "Oportunidad",
  conversation: "Conversación",
  comment: "Comentario",
  document: "Documento",
};

interface Appointment {
  id: string;
  title: string;
  scheduledAt: string;
  location: string;
}

function memberLabel(email: string | null | undefined): string {
  if (!email) return "Sistema";
  return email.split("@")[0] ?? email;
}

export function CommercialTabs({ contact }: { contact: Contact }) {
  const [activeTab, setActiveTab] = useState<TabKey>("notas");
  const { members } = useCrm();

  return (
    <Card className="flex min-h-[560px] flex-col">
      {/* Pestañas superiores */}
      <div role="tablist" aria-label="Gestión comercial del contacto" className="flex flex-wrap gap-1 border-b border-adlive-border px-3 pt-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-t-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-b-2 border-adlive-primary text-adlive-primary"
                  : "border-b-2 border-transparent text-adlive-text-muted hover:text-adlive-text-main"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 p-4">
        {activeTab === "notas" ? <NotesTab contact={contact} members={members} /> : null}
        {activeTab === "tareas" ? <TasksTab contact={contact} /> : null}
        {activeTab === "empresas" ? <CompaniesTab contact={contact} /> : null}
        {activeTab === "documentos" ? <DocumentsTab contact={contact} /> : null}
        {activeTab === "citas" ? <AppointmentsTab /> : null}
      </div>
    </Card>
  );
}

/* ============================================================================
 * NOTAS + HISTORIAL DE ACTIVIDAD
 * ========================================================================== */

function NotesTab({ contact, members }: { contact: Contact; members: ReturnType<typeof useCrm>["members"] }) {
  const { notes, activities, addContactNote, addContactActivity } = useCrm();
  const [noteDraft, setNoteDraft] = useState("");
  const [activityDraft, setActivityDraft] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  const contactNotes = notes.filter((note) => note.contact_id === contact.id);
  const contactActivities = activities
    .filter((activity) => activity.contact_id === contact.id)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const authorEmailOf = (memberId: string | null): string | null =>
    memberId ? (members.find((member) => member.id === memberId)?.email ?? null) : null;

  const handleSaveNote = () => {
    if (!noteDraft.trim()) return;
    addContactNote(contact.id, noteDraft);
    setNoteDraft("");
    setNoteSaved(true);
    window.setTimeout(() => setNoteSaved(false), 2000);
  };

  const handleRegisterActivity = () => {
    if (!activityDraft.trim()) return;
    addContactActivity(contact.id, "comment", activityDraft);
    setActivityDraft("");
  };

  return (
    <div id="panel-notas" role="tabpanel" aria-labelledby="tab-notas" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="notas-internas" className="text-sm font-medium text-adlive-text-main">
          Notas internas
        </label>
        <textarea
          id="notas-internas"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          rows={4}
          placeholder="Ej: Cliente pide que la llamemos después de las 6 pm…"
          className="w-full resize-y rounded-xl border border-adlive-border bg-white px-3 py-2.5 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
        />
        <div className="flex items-center gap-3">
          <Button type="button" variant="primary" size="sm" onClick={handleSaveNote} disabled={!noteDraft.trim()}>
            Guardar notas
          </Button>
          {noteSaved ? (
            <span role="status" className="text-xs font-medium text-adlive-success">
              Nota guardada.
            </span>
          ) : null}
        </div>
        {contactNotes.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-2">
            {contactNotes.map((note) => (
              <li key={note.id} className="rounded-xl border border-adlive-border bg-adlive-canvas-bg/50 px-3.5 py-3">
                <p className="text-sm leading-6 text-adlive-text-main">{note.content}</p>
                <p className="mt-1 text-xs text-adlive-text-muted">
                  {memberLabel(authorEmailOf(note.author_member_id))} · {formatRelativeTime(note.created_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-adlive-border pt-4">
        <p className="text-sm font-semibold text-adlive-text-main">Historial de actividad</p>
        <div className="flex gap-2">
          <label htmlFor="registrar-actividad" className="sr-only">
            Registrar actividad o comentario
          </label>
          <input
            id="registrar-actividad"
            type="text"
            value={activityDraft}
            onChange={(event) => setActivityDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleRegisterActivity();
            }}
            placeholder="Registra una actividad o comentario…"
            className={INPUT_CLASS}
          />
          <Button type="button" variant="secondary" size="sm" onClick={handleRegisterActivity} disabled={!activityDraft.trim()}>
            Registrar
          </Button>
        </div>
        {contactActivities.length > 0 ? (
          <ol className="relative flex flex-col gap-4 border-l-2 border-adlive-border pl-4" aria-label="Línea de tiempo de actividad">
            {contactActivities.map((activity) => (
              <li key={activity.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-adlive-primary" aria-hidden />
                <p className="text-sm leading-6 text-adlive-text-main">{activity.description}</p>
                <p className="text-xs text-adlive-text-muted">
                  <Badge tone="neutral" className="mr-1.5">
                    {ACTIVITY_TYPE_LABELS[activity.activity_type] ?? activity.activity_type}
                  </Badge>
                  {memberLabel(authorEmailOf(activity.actor_member_id))} · {formatRelativeTime(activity.created_at)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-adlive-text-muted">Sin actividad registrada todavía.</p>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * TAREAS
 * ========================================================================== */

function TasksTab({ contact }: { contact: Contact }) {
  const { tasks, addContactTask, toggleContactTask } = useCrm();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  const contactTasks = tasks.filter((task) => task.contact_id === contact.id);

  const handleAdd = () => {
    if (!title.trim()) return;
    addContactTask(contact.id, title, dueAt ? new Date(dueAt).toISOString() : null);
    setTitle("");
    setDueAt("");
  };

  return (
    <div id="panel-tareas" role="tabpanel" aria-labelledby="tab-tareas" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="nueva-tarea" className="sr-only">
          Título de la tarea
        </label>
        <input
          id="nueva-tarea"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAdd();
          }}
          placeholder="Ej: Llamar para cerrar el plan de $38.000"
          className={INPUT_CLASS}
        />
        <div className="flex items-center gap-2">
          <label htmlFor="tarea-fecha" className="text-xs text-adlive-text-muted">
            Vence
          </label>
          <input
            id="tarea-fecha"
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className={`${INPUT_CLASS} flex-1`}
          />
          <Button type="button" variant="secondary" size="sm" onClick={handleAdd} disabled={!title.trim()}>
            Agregar tarea
          </Button>
        </div>
      </div>

      {contactTasks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {contactTasks.map((task) => (
            <li key={task.id} className="flex items-start gap-3 rounded-xl border border-adlive-border px-3.5 py-3">
              <button
                type="button"
                onClick={() => toggleContactTask(task.id)}
                aria-label={task.is_completed ? `Marcar pendiente: ${task.title}` : `Marcar completada: ${task.title}`}
                className="mt-0.5 cursor-pointer text-adlive-text-muted transition-colors hover:text-adlive-primary"
              >
                {task.is_completed ? (
                  <CircleCheck className="h-5 w-5 text-adlive-success" aria-hidden />
                ) : (
                  <Circle className="h-5 w-5" aria-hidden />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm leading-6 ${task.is_completed ? "text-adlive-text-muted line-through" : "text-adlive-text-main"}`}>
                  {task.title}
                </p>
                <p className="text-xs text-adlive-text-muted">
                  {task.due_at ? `Vence ${formatDate(task.due_at)} · ${formatTime(task.due_at)}` : "Sin fecha límite"}
                </p>
              </div>
              <Badge tone={task.is_completed ? "success" : "warning"}>{task.is_completed ? "Completada" : "Pendiente"}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-adlive-text-muted">Sin tareas registradas.</p>
      )}
    </div>
  );
}

/* ============================================================================
 * EMPRESAS
 * ========================================================================== */

function CompaniesTab({ contact }: { contact: Contact }) {
  const { contacts, opportunities, updateContact } = useCrm();
  const [editing, setEditing] = useState(false);
  const [companyDraft, setCompanyDraft] = useState(contact.company_name ?? "");

  const relatedContacts = contact.company_name
    ? contacts.filter((item) => item.company_name === contact.company_name && item.id !== contact.id)
    : [];
  const relatedIds = new Set([contact.id, ...relatedContacts.map((item) => item.id)]);
  const companyOpportunities = opportunities.filter((opportunity) => relatedIds.has(opportunity.contact_id));
  const companyValue = companyOpportunities.reduce((sum, opportunity) => sum + opportunity.monetary_value, 0);

  const handleSaveCompany = () => {
    updateContact(contact.id, { company_name: companyDraft.trim() || null });
    setEditing(false);
  };

  if (!contact.company_name) {
    return (
      <div id="panel-empresas" role="tabpanel" aria-labelledby="tab-empresas" className="flex flex-col gap-3">
        <p className="text-sm text-adlive-text-muted">Este contacto no tiene una empresa asociada.</p>
        <div className="flex gap-2">
          <label htmlFor="asignar-empresa" className="sr-only">
            Nombre de la empresa
          </label>
          <input
            id="asignar-empresa"
            type="text"
            value={companyDraft}
            onChange={(event) => setCompanyDraft(event.target.value)}
            placeholder="Ej: Ferretería Suárez"
            className={INPUT_CLASS}
          />
          <Button type="button" variant="secondary" size="sm" onClick={handleSaveCompany} disabled={!companyDraft.trim()}>
            Asignar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div id="panel-empresas" role="tabpanel" aria-labelledby="tab-empresas" className="flex flex-col gap-4">
      <div className="rounded-xl border border-adlive-border bg-adlive-canvas-bg/50 px-4 py-3.5">
        {editing ? (
          <div className="flex gap-2">
            <label htmlFor="editar-empresa" className="sr-only">
              Nombre de la empresa
            </label>
            <input
              id="editar-empresa"
              type="text"
              value={companyDraft}
              onChange={(event) => setCompanyDraft(event.target.value)}
              className={INPUT_CLASS}
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleSaveCompany}>
              Guardar
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-adlive-text-main">
              <Building2 className="h-4 w-4 text-adlive-primary" aria-hidden />
              {contact.company_name}
            </p>
            <button type="button" onClick={() => setEditing(true)} className="cursor-pointer text-xs font-semibold text-adlive-primary hover:underline">
              Editar
            </button>
          </div>
        )}
        <p className="mt-2 text-xs text-adlive-text-muted">
          {relatedContacts.length + 1} contacto{relatedContacts.length + 1 === 1 ? "" : "s"} ·{" "}
          {companyOpportunities.length} oportunidad
          {companyOpportunities.length === 1 ? "" : "es"} · valor total {formatCOP(companyValue)}
        </p>
      </div>

      {relatedContacts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-adlive-text-muted">Contactos de la misma empresa</p>
          <ul className="flex flex-col gap-1.5">
            {relatedContacts.map((related) => (
              <li key={related.id}>
                <Link
                  href={`/contactos/${related.id}`}
                  className="flex items-center justify-between rounded-xl border border-adlive-border px-3.5 py-2.5 text-sm text-adlive-text-main transition-colors hover:border-adlive-primary hover:bg-adlive-primary-light/40"
                >
                  {related.full_name}
                  <span className="font-mono text-xs text-adlive-text-muted">{related.phone_e164}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-adlive-text-muted">No hay otros contactos registrados en esta empresa.</p>
      )}
    </div>
  );
}

/* ============================================================================
 * DOCUMENTOS
 * ========================================================================== */

function DocumentsTab({ contact }: { contact: Contact }) {
  const { activities, messages, conversations, addContactActivity } = useCrm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const conversation = conversations.find((item) => item.contact_id === contact.id) ?? null;
  const mediaMessages = conversation
    ? messages.filter(
        (message) =>
          message.conversation_id === conversation.id && message.media_url !== null && message.direction === "inbound",
      )
    : [];
  const uploadedDocuments = activities
    .filter((activity) => activity.contact_id === contact.id && activity.activity_type === "document")
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    addContactActivity(contact.id, "document", `Documento «${file.name}» adjunto a la ficha.`, {
      file_name: file.name,
      size_kb: String(sizeKb),
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div id="panel-documentos" role="tabpanel" aria-labelledby="tab-documentos" className="flex flex-col gap-4">
      <label
        htmlFor="adjuntar-documento"
        className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl border border-dashed border-adlive-border px-4 py-2.5 text-sm font-medium text-adlive-text-main transition-colors hover:border-adlive-primary hover:bg-adlive-primary-light/40"
      >
        <Paperclip className="h-4 w-4 text-adlive-primary" aria-hidden />
        Adjuntar documento
      </label>
      <input ref={fileInputRef} id="adjuntar-documento" type="file" className="sr-only" onChange={handleFileChange} />
      <p className="-mt-2 text-xs text-adlive-text-muted">
        Los adjuntos quedan registrados en el historial de actividad. En Etapa B se almacenan en Supabase Storage.
      </p>

      {uploadedDocuments.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Documentos adjuntos">
          {uploadedDocuments.map((document) => (
            <li key={document.id} className="flex items-center gap-3 rounded-xl border border-adlive-border px-3.5 py-3">
              <FileText className="h-4 w-4 shrink-0 text-adlive-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-adlive-text-main">{document.metadata["file_name"] ?? "Documento"}</p>
                <p className="text-xs text-adlive-text-muted">
                  {document.metadata["size_kb"] ? `${document.metadata["size_kb"]} KB · ` : ""}
                  {formatRelativeTime(document.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {mediaMessages.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-adlive-text-muted">Recibidos por WhatsApp</p>
          <ul className="flex flex-col gap-2" aria-label="Archivos multimedia recibidos">
            {mediaMessages.map((message) => (
              <li key={message.id} className="flex items-center gap-3 rounded-xl border border-adlive-border px-3.5 py-3">
                <FileText className="h-4 w-4 shrink-0 text-adlive-cyan" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-adlive-text-main">{message.body ?? message.media_mime_type ?? "Archivo"}</p>
                  <p className="text-xs text-adlive-text-muted">{formatRelativeTime(message.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {uploadedDocuments.length === 0 && mediaMessages.length === 0 ? (
        <p className="text-sm text-adlive-text-muted">No hay documentos asociados a este contacto.</p>
      ) : null}
    </div>
  );
}

/* ============================================================================
 * CITAS (agenda en memoria, mock de Etapa A)
 * ========================================================================== */

function AppointmentsTab() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");

  const handleAdd = () => {
    if (!title.trim() || !scheduledAt) return;
    setAppointments((previous) => [
      {
        id: `appt-${crypto.randomUUID()}`,
        title: title.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
        location: location.trim(),
      },
      ...previous,
    ]);
    setTitle("");
    setScheduledAt("");
    setLocation("");
  };

  const handleRemove = (id: string) => {
    setAppointments((previous) => previous.filter((appointment) => appointment.id !== id));
  };

  return (
    <div id="panel-citas" role="tabpanel" aria-labelledby="tab-citas" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="cita-titulo" className="sr-only">
          Título de la cita
        </label>
        <input
          id="cita-titulo"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ej: Llamada de cierre del plan"
          className={INPUT_CLASS}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_auto]">
          <div>
            <label htmlFor="cita-fecha" className="sr-only">
              Fecha y hora de la cita
            </label>
            <input
              id="cita-fecha"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="cita-lugar" className="sr-only">
              Lugar o medio
            </label>
            <input
              id="cita-lugar"
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Llamada / Zoom"
              className={INPUT_CLASS}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleAdd} disabled={!title.trim() || !scheduledAt}>
            Agendar
          </Button>
        </div>
      </div>

      {appointments.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Citas agendadas">
          {appointments
            .slice()
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
            .map((appointment) => (
              <li key={appointment.id} className="flex items-start gap-3 rounded-xl border border-adlive-border px-3.5 py-3">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-adlive-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-adlive-text-main">{appointment.title}</p>
                  <p className="text-xs text-adlive-text-muted">
                    {formatDate(appointment.scheduledAt)} · {formatTime(appointment.scheduledAt)}
                    {appointment.location ? ` · ${appointment.location}` : ""} ·{" "}
                    {formatRelativeTime(appointment.scheduledAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(appointment.id)}
                  aria-label={`Cancelar cita ${appointment.title}`}
                  className="cursor-pointer rounded-lg p-1.5 text-adlive-text-muted transition-colors hover:bg-red-50 hover:text-adlive-danger"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-sm text-adlive-text-muted">Sin citas agendadas para este contacto.</p>
      )}
    </div>
  );
}
