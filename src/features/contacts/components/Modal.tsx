"use client";

/**
 * Modal accesible ADlive: `role="dialog"`, cierre con Escape y con clic en el
 * velo, foco inicial en el botón de cierre. Base reutilizable de M3.
 */

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Ancho máximo del panel: por defecto `max-w-lg`. */
  maxWidthClassName?: string;
}

export function Modal({ open, onClose, title, subtitle, children, maxWidthClassName = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Cerrar modal"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-adlive-sidebar-bg/60 backdrop-blur-sm"
      />
      <div className={`relative flex max-h-[85vh] w-full ${maxWidthClassName} flex-col rounded-2xl border border-adlive-border bg-white shadow-card`}>
        <div className="flex items-start justify-between gap-4 border-b border-adlive-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-adlive-text-main">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-adlive-text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer rounded-lg p-1.5 text-adlive-text-muted transition-colors hover:bg-adlive-canvas-bg hover:text-adlive-text-main"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
