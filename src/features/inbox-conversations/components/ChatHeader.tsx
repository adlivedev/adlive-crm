"use client";

/**
 * M5 — Cabecera del chat activo: identidad del contacto, canal, estrella,
 * tipificación en caliente, reasignación de agente en caliente,
 * botón de prueba de recepción y eliminación en dos pasos.
 */

import { MousePointerClick, Star, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { initials } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";
import type { Contact, ConversationWithDetails, TenantMember } from "@/shared/types/database";

import { TYPIFICATION_OPTIONS } from "./inboxUtils";

interface ChatHeaderProps {
  thread: ConversationWithDetails;
  contact: Contact;
  members: TenantMember[];
  onSimulateInbound: () => void;
}

export function ChatHeader({ thread, contact, members, onSimulateInbound }: ChatHeaderProps) {
  const { toggleContactStar, setContactTypification, assignConversation, deleteConversation } = useCrm();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isStarred = contact.is_starred;
  const activeAgents = members.filter((member) => member.is_active);

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteConversation(thread.id);
    setConfirmDelete(false);
  };

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-adlive-border px-4 py-3">
      {/* Identidad del contacto */}
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-adlive-primary text-sm font-bold text-adlive-text-inverse"
      >
        {initials(contact.full_name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-bold text-adlive-text-main">{contact.full_name}</h2>
          <Badge tone="success" className="px-1.5 py-0 text-[10px]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-adlive-success" aria-hidden />
            Conectado
          </Badge>
          <Badge tone="cyan" className="px-1.5 py-0 text-[10px]">
            {thread.channel === "whatsapp" ? "WhatsApp" : thread.channel}
          </Badge>
        </div>
        <p className="truncate text-[11px] text-adlive-text-muted">{contact.phone_e164}</p>
      </div>

      {/* Acciones en caliente */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => toggleContactStar(contact.id)}
          aria-pressed={isStarred}
          aria-label={isStarred ? "Quitar de seguimiento" : "Marcar como seguimiento"}
          className={`cursor-pointer rounded-full border border-adlive-border p-1.5 transition-colors ${
            isStarred ? "border-amber-300 bg-amber-50 text-amber-400" : "text-adlive-text-muted hover:text-amber-400"
          }`}
        >
          <Star className={`h-4 w-4 ${isStarred ? "fill-current" : ""}`} aria-hidden />
        </button>

        <label htmlFor="chat-typification" className="sr-only">
          Tipificación del contacto
        </label>
        <select
          id="chat-typification"
          value={contact.typification ?? ""}
          onChange={(event) => setContactTypification(contact.id, event.target.value || null)}
          className="h-8 cursor-pointer rounded-lg border border-adlive-border bg-white px-2 text-xs font-medium text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
        >
          <option value="">Sin tipificar</option>
          {TYPIFICATION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label htmlFor="chat-assignee" className="sr-only">
          Reasignar agente
        </label>
        <select
          id="chat-assignee"
          value={thread.assigned_member_id ?? ""}
          onChange={(event) => assignConversation(thread.id, event.target.value || null)}
          className="h-8 max-w-[190px] cursor-pointer truncate rounded-lg border border-adlive-border bg-white px-2 text-xs font-medium text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
        >
          <option value="">Sin asignar</option>
          {activeAgents.map((member) => (
            <option key={member.id} value={member.id}>
              {member.email}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onSimulateInbound}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-adlive-cyan-light px-2.5 text-xs font-semibold text-cyan-800 transition-colors hover:bg-adlive-cyan/20"
        >
          <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
          Simular mensaje del cliente
        </button>

        {confirmDelete ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-adlive-danger px-2.5 text-xs font-semibold text-white hover:bg-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              aria-label="Cancelar eliminación"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-adlive-border px-2 text-xs font-medium text-adlive-text-muted hover:text-adlive-text-main"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-adlive-border px-2 text-adlive-text-muted transition-colors hover:border-adlive-danger/40 hover:text-adlive-danger"
            aria-label="Eliminar conversación"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </header>
  );
}
