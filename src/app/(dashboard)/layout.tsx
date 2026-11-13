"use client";

/**
 * Layout protegido del CRM: guardia de sesión (mock) + Sidebar oscuro + Topbar.
 * Renderiza un skeleton durante la hidratación para garantizar CLS = 0.
 */

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Topbar } from "@/features/dashboard/components/Topbar";
import { useCrm } from "@/shared/services/crmStore";

function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen bg-adlive-canvas-bg pl-64">
      <div className="fixed inset-y-0 left-0 w-64 animate-pulse bg-adlive-sidebar-bg" aria-hidden />
      <div className="flex-1">
        <div className="h-16 animate-pulse border-b border-adlive-border bg-white" aria-hidden />
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-adlive-border bg-white" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 px-6 pb-6 xl:grid-cols-3">
          <div className="h-80 animate-pulse rounded-2xl border border-adlive-border bg-white xl:col-span-2" />
          <div className="h-80 animate-pulse rounded-2xl border border-adlive-border bg-white" />
        </div>
      </div>
      <span className="sr-only">Cargando ADlive CRM…</span>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isHydrated, session } = useCrm();

  useEffect(() => {
    if (isHydrated && !session) router.replace("/login");
  }, [isHydrated, session, router]);

  if (!isHydrated || !session) return <DashboardSkeleton />;

  return (
    <div className="min-h-screen bg-adlive-canvas-bg">
      <Sidebar />
      <div className="pl-64">
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
