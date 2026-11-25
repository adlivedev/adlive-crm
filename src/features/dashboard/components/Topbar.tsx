"use client";

import { LogOut, Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { useCrm } from "@/shared/services/crmStore";

import { AccountSwitcher } from "./AccountSwitcher";
import { NotificationBell } from "./NotificationBell";

interface ViewMeta {
  title: string;
  subtitle: string;
}

const VIEW_META: Record<string, ViewMeta> = {
  "/dashboard": { title: "Dashboard", subtitle: "Resumen general de tu operación comercial" },
  "/contactos": { title: "Contactos", subtitle: "Base de datos de leads y clientes" },
  "/oportunidades": { title: "Oportunidades", subtitle: "Tablero Kanban de tu pipeline comercial" },
  "/conversaciones": { title: "Conversaciones", subtitle: "Bandeja unificada de WhatsApp" },
  "/automatizaciones": { title: "Automatizaciones", subtitle: "Workflows visuales de marketing y reparto" },
  "/plantillas": { title: "Plantillas", subtitle: "Plantillas de WhatsApp aprobadas por Meta" },
  "/integraciones": { title: "Integraciones", subtitle: "Canales y proveedores conectados" },
  "/bots-ia": { title: "Bots IA", subtitle: "Asistentes inteligentes por línea de producto" },
  "/equipo": { title: "Equipo", subtitle: "Agentes, roles y reparto de leads" },
  "/atribucion": { title: "Atribución", subtitle: "Analítica UTM de Campañas, Conjuntos y Anuncios" },
  "/ajustes": { title: "Ajustes", subtitle: "Campos personalizados, marca y captura UTM" },
};

function resolveViewMeta(pathname: string, fallback: string): ViewMeta {
  const exact = VIEW_META[pathname];
  if (exact) return exact;
  const parent = `/${pathname.split("/")[1] ?? ""}`;
  return VIEW_META[parent] ?? { title: fallback, subtitle: "" };
}

interface TopbarProps {
  onOpenMenu: () => void;
}

export function Topbar({ onOpenMenu }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout, activeTenant, isPlatformSuperadmin } = useCrm();
  const meta = resolveViewMeta(pathname, activeTenant?.name ?? "CRM");

  async function handleLogout() {
    const loginPath = !isPlatformSuperadmin && activeTenant?.slug
      ? `/login?workspace=${encodeURIComponent(activeTenant.slug)}`
      : "/login";
    await logout();
    router.replace(loginPath);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-adlive-border bg-white px-3 sm:gap-4 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menú"
          aria-controls="workspace-navigation"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-adlive-text-muted hover:bg-adlive-canvas-bg hover:text-adlive-primary lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-adlive-text-main sm:text-lg">{meta.title}</h1>
          {meta.subtitle ? <p className="hidden truncate text-xs text-adlive-text-muted sm:block">{meta.subtitle}</p> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <NotificationBell />
        {isPlatformSuperadmin ? <div className="hidden w-52 md:block xl:w-64"><AccountSwitcher placement="topbar" /></div> : null}
        <span className="hidden max-w-56 truncate text-sm text-adlive-text-muted lg:block" title={session?.email}>
          {session?.email}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-adlive-text-muted transition-colors duration-150 hover:bg-red-50 hover:text-adlive-danger"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
    </header>
  );
}
