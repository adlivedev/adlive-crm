"use client";

/**
 * Selector funcional «Cambiar de cuenta» — alterna en vivo entre las cuentas
 * donde el usuario tiene membresía (dueño / admin / agente).
 */

import { Building2, Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { roleLabel } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";

export interface AccountSwitcherProps {
  /** `sidebar` estilo oscuro, `topbar` estilo claro. */
  placement: "sidebar" | "topbar";
}

export function AccountSwitcher({ placement }: AccountSwitcherProps) {
  const { activeTenant, activeMember, userAccounts, switchTenant } = useCrm();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Cierre con clic fuera y tecla Escape (accesibilidad). */
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!activeTenant || !activeMember) return null;

  const isSidebar = placement === "sidebar";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Cambiar de cuenta"
        onClick={() => setIsOpen((open) => !open)}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition-colors duration-150 ${
          isSidebar
            ? "bg-adlive-sidebar-card text-white hover:bg-white/5"
            : "border border-adlive-border bg-white text-adlive-text-main hover:bg-adlive-canvas-bg"
        }`}
      >
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-adlive-primary to-adlive-cyan"
        >
          <Building2 className="h-4 w-4 text-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{activeTenant.name}</span>
          <span className={`block text-xs uppercase tracking-wide ${isSidebar ? "text-white/50" : "text-adlive-text-muted"}`}>
            {roleLabel(activeMember.role)}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""} ${isSidebar ? "text-white/50" : "text-adlive-text-muted"}`} />
      </button>

      {isOpen ? (
        <div
          role="listbox"
          aria-label="Cambiar de cuenta"
          className={`absolute z-50 mt-2 w-72 rounded-2xl border border-adlive-border bg-adlive-card-bg p-2 shadow-card ${
            isSidebar ? "left-0 top-full" : "right-0 top-full"
          }`}
        >
          <p className="px-3 py-2 text-sm font-semibold text-adlive-text-main">Cambiar de cuenta</p>
          <ul>
            {userAccounts.map((account) => {
              const isActive = account.tenant.id === activeTenant.id;
              return (
                <li key={account.tenant.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      switchTenant(account.tenant.id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
                      isActive ? "bg-adlive-primary-light" : "hover:bg-adlive-canvas-bg"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium text-adlive-text-main">{account.tenant.name}</span>
                      <span className="block text-xs text-adlive-text-muted">{roleLabel(account.role)}</span>
                    </span>
                    {isActive ? <Check className="h-4 w-4 text-adlive-primary" aria-label="Cuenta activa" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
