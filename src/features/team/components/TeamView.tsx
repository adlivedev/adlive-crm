"use client";

/**
 * M10 — Equipo y Permisos Call Center (`/equipo`).
 * Invitación de miembros, presencia Conectado/Desconectado, rol, toggle Activo
 * (Round Robin), permiso de visibilidad de contactos y eliminación en dos pasos.
 */

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { initials } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";

import { InviteMemberModal } from "./InviteMemberModal";

function emailInitials(email: string): string {
  return initials(email.split("@")[0]?.replace(/[._-]+/g, " ") ?? email);
}

export function TeamView() {
  const { members, session, inviteMember, updateMember, deleteMember } = useCrm();
  const [showInvite, setShowInvite] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const handleDelete = (memberId: string, email: string) => {
    if (pendingDeleteId !== memberId) {
      setPendingDeleteId(memberId);
      return;
    }
    deleteMember(memberId);
    setPendingDeleteId(null);
    setAnnouncement(`Miembro ${email} eliminado del equipo.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-adlive-text-main">Equipo</h1>
          <p className="mt-1 text-sm text-adlive-text-muted">
            Miembros del call center, roles y permisos de reparto Round Robin.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowInvite(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Invitar miembro
        </Button>
      </header>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-adlive-border bg-adlive-canvas-bg text-xs uppercase tracking-wide text-adlive-text-muted">
                <th scope="col" className="px-6 py-3 font-semibold">Miembro</th>
                <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
                <th scope="col" className="px-4 py-3 font-semibold">Rol</th>
                <th scope="col" className="px-4 py-3 font-semibold">Activo en reparto</th>
                <th scope="col" className="px-4 py-3 font-semibold">Puede ver todos los contactos</th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-adlive-border">
              {members.map((member) => {
                const connected = member.presence !== "offline";
                const isSelf = session?.email === member.email;
                return (
                  <tr key={member.id} className="transition-colors hover:bg-adlive-canvas-bg/60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-adlive-primary-light text-xs font-bold text-adlive-primary"
                        >
                          {emailInitials(member.email)}
                        </span>
                        <div>
                          <p className="font-medium text-adlive-text-main">
                            {member.email}
                            {isSelf ? <span className="ml-2 text-xs text-adlive-text-muted">(tú)</span> : null}
                          </p>
                          <p className="font-mono text-xs text-adlive-text-muted">
                            Último reparto: {member.last_assigned_at ? new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" }).format(new Date(member.last_assigned_at)) : "nunca"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={connected ? "success" : "neutral"}>
                        <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-adlive-success" : "bg-adlive-text-muted"}`} aria-hidden />
                        {connected ? "Conectado" : "Desconectado"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={member.role === "agent" ? "neutral" : "primary"}>
                        {member.role === "agent" ? "Agente" : member.role === "admin" ? "Admin" : "Dueño"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        aria-pressed={member.is_active}
                        aria-label={`${member.is_active ? "Excluir" : "Incluir"} a ${member.email} del reparto Round Robin`}
                        onClick={() => {
                          updateMember(member.id, { is_active: !member.is_active });
                          setAnnouncement(
                            member.is_active
                              ? `${member.email} excluido del reparto Round Robin.`
                              : `${member.email} incluido en el reparto Round Robin.`,
                          );
                        }}
                        className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${member.is_active ? "bg-adlive-primary" : "bg-adlive-border"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${member.is_active ? "left-[22px]" : "left-0.5"}`}
                          aria-hidden
                        />
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      {member.role === "agent" ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={member.can_view_all_contacts}
                          aria-label={`${member.can_view_all_contacts ? "Restringir" : "Permitir"} que ${member.email} vea todos los contactos`}
                          onClick={() => updateMember(member.id, { can_view_all_contacts: !member.can_view_all_contacts })}
                          className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${member.can_view_all_contacts ? "bg-adlive-primary" : "bg-adlive-border"}`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${member.can_view_all_contacts ? "left-[22px]" : "left-0.5"}`}
                            aria-hidden
                          />
                        </button>
                      ) : (
                        <span className="text-xs text-adlive-text-muted">Siempre (rol {member.role === "admin" ? "admin" : "dueño"})</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {isSelf ? null : (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={pendingDeleteId === member.id ? `Confirmar eliminación de ${member.email}` : `Eliminar a ${member.email}`}
                          className={pendingDeleteId === member.id ? "text-adlive-danger" : "text-adlive-text-muted"}
                          onClick={() => handleDelete(member.id, member.email)}
                          onBlur={() => setPendingDeleteId((prev) => (prev === member.id ? null : prev))}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          {pendingDeleteId === member.id ? "Confirmar" : ""}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-adlive-text-muted">
        El toggle <strong>Activo en reparto</strong> incluye o excluye al asesor del reparto automático
        Round Robin de los workflows publicados.
      </p>

      <InviteMemberModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={(email, role) => {
          inviteMember(email, role);
          setAnnouncement(`Invitación enviada a ${email} con rol ${role === "admin" ? "Admin" : "Agente"}.`);
        }}
      />
    </div>
  );
}
