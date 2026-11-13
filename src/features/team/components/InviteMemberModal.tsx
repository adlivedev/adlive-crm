"use client";

/**
 * M10 — Modal de invitación de miembro al equipo.
 */

import { useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import type { UserRole } from "@/shared/types/database";

export interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, role: UserRole) => void;
}

export function InviteMemberModal({ open, onClose, onInvite }: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("agent");
  const roleId = "invite-member-role";

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleClose = () => {
    setEmail("");
    setRole("agent");
    onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    onInvite(email.trim().toLowerCase(), role);
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Invitar miembro" subtitle="Recibirá un correo para unirse al equipo de la agencia.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Correo"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="asesor@adlive.co"
          autoComplete="email"
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={roleId} className="text-sm font-medium text-adlive-text-main">
            Rol
          </label>
          <select
            id={roleId}
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          >
            <option value="admin">Admin</option>
            <option value="agent">Agente</option>
          </select>
          <p className="text-xs text-adlive-text-muted">
            Admin gestiona la cuenta y las integraciones; Agente atiende conversaciones y oportunidades.
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!isValid}>
            Enviar invitación
          </Button>
        </div>
      </form>
    </Modal>
  );
}
