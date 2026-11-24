"use client";

/**
 * M10 — Modal de invitación de miembro al equipo.
 * QA-002: espera la respuesta real del servidor; solo cierra y anuncia éxito
 * tras un 2xx. Ante 4xx/5xx muestra el error real dentro del modal y no
 * anuncia un falso "Invitación enviada".
 */

import { useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import type { UserRole } from "@/shared/types/database";

export interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  /** Ejecuta la invitación; lanza un Error con el mensaje del servidor si falla. */
  onInvite: (email: string, role: UserRole) => Promise<void>;
  /** Solo se invoca tras un envío exitoso (para el banner verde). */
  onInvited?: (email: string, role: UserRole) => void;
}

export function InviteMemberModal({ open, onClose, onInvite, onInvited }: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("agent");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const roleId = "invite-member-role";

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleClose = () => {
    setEmail("");
    setRole("agent");
    setError("");
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await onInvite(normalizedEmail, role);
      onInvited?.(normalizedEmail, role);
      handleClose();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "No se pudo enviar la invitación.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Invitar miembro" subtitle="Recibirá un correo para unirse al equipo de la agencia.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Correo"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
          }}
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
        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!isValid || isSubmitting} isLoading={isSubmitting}>
            Enviar invitación
          </Button>
        </div>
      </form>
    </Modal>
  );
}
