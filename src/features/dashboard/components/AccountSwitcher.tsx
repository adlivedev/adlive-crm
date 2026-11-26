"use client";

import { Building2, Check, ChevronDown, Eye, RotateCcw, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { roleLabel } from "@/shared/lib/format";
import { useCrm } from "@/shared/services/crmStore";

export interface AccountSwitcherProps {
  placement: "sidebar" | "topbar";
}

export function AccountSwitcher({ placement }: AccountSwitcherProps) {
  const {
    activeTenant, activeMember, session, isPlatformSuperadmin, availableTenants, members,
    viewingAsMemberId, switchTenant, setViewingAsMemberId, userAccounts,
  } = useCrm();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (!activeTenant) return null;

  if (placement === "topbar") {
    /* QA-NEW-005: superadmin ve todos los workspaces; el usuario con membresía
       activa en más de 1 workspace ve un selector limitado estrictamente a sus
       cuentas. Con 1 sola membresía el selector se mantiene oculto. */
    if (!isPlatformSuperadmin) {
      if (userAccounts.length <= 1) return null;
      const accounts = userAccounts.slice().sort((a, b) => a.tenant.name.localeCompare(b.tenant.name, "es"));
      return (
        <div ref={containerRef} className="relative">
          <button type="button" aria-haspopup="listbox" aria-expanded={isOpen} aria-label="Cambiar de workspace" onClick={() => setIsOpen((open) => !open)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-adlive-border bg-white p-3 text-left text-adlive-text-main transition-colors hover:bg-adlive-canvas-bg">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-adlive-primary to-adlive-cyan"><Building2 className="h-4 w-4 text-white" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{activeTenant.name}</span><span className="block truncate text-xs uppercase tracking-wide text-adlive-text-muted">{roleLabel(activeMember?.role ?? "agent")}</span></span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-adlive-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          {isOpen ? <div role="listbox" aria-label="Mis workspaces" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-adlive-border bg-adlive-card-bg p-2 shadow-card">
            <p className="px-3 py-2 text-sm font-semibold text-adlive-text-main">Mis workspaces</p>
            <ul>{accounts.map(({ tenant }) => {
              const isActive = tenant.id === activeTenant.id;
              return <li key={tenant.id}><button type="button" role="option" aria-selected={isActive} onClick={() => { switchTenant(tenant.id); setIsOpen(false); }}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${isActive ? "bg-adlive-primary-light" : "hover:bg-adlive-canvas-bg"}`}>
                <span className="min-w-0"><span className="block truncate text-sm font-medium text-adlive-text-main">{tenant.name}</span>{tenant.status === "suspended" ? <span className="block text-xs text-adlive-danger">Inhabilitado</span> : null}</span>
                {isActive ? <Check className="h-4 w-4 shrink-0 text-adlive-primary" aria-label="Workspace activo" /> : null}
              </button></li>;
            })}</ul>
          </div> : null}
        </div>
      );
    }
    const workspaces = availableTenants.slice().sort((a, b) => {
      if (a.slug === "adlive") return -1;
      if (b.slug === "adlive") return 1;
      return a.name.localeCompare(b.name, "es");
    });
    return (
      <div ref={containerRef} className="relative">
        <button type="button" aria-haspopup="listbox" aria-expanded={isOpen} aria-label="Cambiar de workspace" onClick={() => setIsOpen((open) => !open)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-adlive-border bg-white p-3 text-left text-adlive-text-main transition-colors hover:bg-adlive-canvas-bg">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-adlive-primary to-adlive-cyan"><Building2 className="h-4 w-4 text-white" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{activeTenant.name}</span><span className="block text-xs uppercase tracking-wide text-adlive-text-muted">Superadmin ADlive</span></span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-adlive-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen ? <div role="listbox" aria-label="Workspaces / Empresas" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-adlive-border bg-adlive-card-bg p-2 shadow-card">
          <p className="px-3 py-2 text-sm font-semibold text-adlive-text-main">Workspaces / Empresas</p>
          <ul>{workspaces.map((workspace) => {
            const isActive = workspace.id === activeTenant.id;
            return <li key={workspace.id}><button type="button" role="option" aria-selected={isActive} onClick={() => { switchTenant(workspace.id); setIsOpen(false); }}
              className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${isActive ? "bg-adlive-primary-light" : "hover:bg-adlive-canvas-bg"}`}>
              <span><span className="block text-sm font-medium text-adlive-text-main">{workspace.name}</span><span className="block text-xs text-adlive-text-muted">Superadmin ADlive{workspace.status === "suspended" ? " · Inhabilitado" : ""}</span></span>
              {isActive ? <Check className="h-4 w-4 text-adlive-primary" aria-label="Workspace activo" /> : null}
            </button></li>;
          })}</ul>
        </div> : null}
      </div>
    );
  }

  if (!isPlatformSuperadmin && activeMember?.role === "agent") {
    return <div className="flex items-center gap-3 rounded-xl bg-adlive-sidebar-card p-3 text-white">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10"><UserRound className="h-4 w-4" /></span>
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{activeMember.email}</span><span className="block text-xs uppercase tracking-wide text-white/50">AGENTE</span></span>
    </div>;
  }

  if (!isPlatformSuperadmin && !activeMember) return null;
  const selectedMember = members.find((member) => member.id === viewingAsMemberId && member.is_active) ?? null;
  const workspaceMembers = members.filter((member) => member.is_active).slice().sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, agent: 2 };
    return roleOrder[a.role] - roleOrder[b.role] || a.email.localeCompare(b.email, "es");
  });

  return (
    <div ref={containerRef} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={isOpen} aria-label="Ver como usuario" onClick={() => setIsOpen((open) => !open)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-adlive-sidebar-card p-3 text-left text-white transition-colors hover:bg-white/5">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-adlive-primary to-adlive-cyan"><Eye className="h-4 w-4 text-white" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">Ver como usuario</span><span className="block truncate text-xs text-white/50">{selectedMember?.email ?? "Todos los usuarios (Vista completa)"}</span></span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen ? <div role="listbox" aria-label="Ver como usuario" className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-adlive-border bg-adlive-card-bg p-2 shadow-card">
        <p className="px-3 py-2 text-sm font-semibold text-adlive-text-main">Ver como usuario</p>
        <ul>
          <li><button type="button" role="option" aria-selected={!selectedMember} onClick={() => { setViewingAsMemberId(null); setIsOpen(false); }} className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${!selectedMember ? "bg-adlive-primary-light" : "hover:bg-adlive-canvas-bg"}`}>
            <span className="text-sm font-medium text-adlive-text-main">Todos los usuarios (Vista completa)</span>{!selectedMember ? <Check className="h-4 w-4 shrink-0 text-adlive-primary" /> : null}
          </button></li>
          {workspaceMembers.map((member) => {
            const isActive = member.id === viewingAsMemberId;
            return <li key={member.id}><button type="button" role="option" aria-selected={isActive} onClick={() => { setViewingAsMemberId(member.id); setIsOpen(false); }} className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${isActive ? "bg-adlive-primary-light" : "hover:bg-adlive-canvas-bg"}`}>
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-adlive-text-main">{member.email}</span><span className="block text-xs text-adlive-text-muted">{roleLabel(member.role)}</span></span>{isActive ? <Check className="h-4 w-4 shrink-0 text-adlive-primary" /> : null}
            </button></li>;
          })}
        </ul>
      </div> : null}
      {selectedMember ? <div className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
        <p className="truncate" title={selectedMember.email}>Viendo como: {selectedMember.email}</p>
        <button type="button" onClick={() => setViewingAsMemberId(null)} className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 font-medium text-white hover:underline"><RotateCcw className="h-3 w-3" aria-hidden />Volver a vista global</button>
      </div> : null}
      <span className="sr-only">Sesión: {session?.email}</span>
    </div>
  );
}
