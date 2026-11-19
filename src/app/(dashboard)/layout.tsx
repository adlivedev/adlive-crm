"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Topbar } from "@/features/dashboard/components/Topbar";
import { TenantThemeProvider } from "@/shared/components/TenantThemeProvider";
import { useCrm } from "@/shared/services/crmStore";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-adlive-canvas-bg lg:pl-64">
      <div className="fixed inset-y-0 left-0 hidden w-64 animate-pulse bg-adlive-sidebar-bg lg:block" aria-hidden />
      <div className="h-16 animate-pulse border-b border-adlive-border bg-white" aria-hidden />
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl border border-adlive-border bg-white" />
        ))}
      </div>
      <span className="sr-only">Cargando tu espacio de trabajo…</span>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isHydrated, session, dataError, isLoadingData, isMutating, activeMember } = useCrm();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (isHydrated && !session) router.replace("/login");
  }, [isHydrated, session, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  if (!isHydrated || !session) return <DashboardSkeleton />;
  if (!activeMember) {
    return <main className="flex min-h-screen items-center justify-center bg-adlive-canvas-bg p-6 text-center text-sm text-adlive-danger">{dataError ?? "No se encontró una membresía activa."}</main>;
  }

  return (
    <TenantThemeProvider className="min-h-screen bg-adlive-canvas-bg text-adlive-text-main">
      <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 cursor-pointer bg-black/50 backdrop-blur-sm lg:hidden"
        />
      ) : null}
      <div className="min-w-0 lg:pl-64">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        {dataError ? <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-adlive-danger">{dataError}</div> : null}
        {isLoadingData || isMutating ? <p role="status" className="border-b border-adlive-border bg-white px-4 py-1.5 text-xs text-adlive-text-muted">{isMutating ? "Guardando cambios…" : "Actualizando datos…"}</p> : null}
        <main className="min-w-0 p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </TenantThemeProvider>
  );
}
