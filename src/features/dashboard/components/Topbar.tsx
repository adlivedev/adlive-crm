"use client";

/**
 * Topbar blanca del layout protegido: título dinámico de la vista,
 * selector de cuenta, correo del usuario y cierre de sesión.
 */

import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { useCrm } from "@/shared/services/crmStore";

import { AccountSwitcher } from "./AccountSwitcher";

interface ViewMeta {
  title: string;
  subtitle: string;
}

const VIEW_META: Record<string, ViewMeta> = {
  "/dashboard": { title: "Dashboard", subtitle: "Resumen general de tu operación comercial" },
  "/contactos": { title: "Contactos", subtitle: "Base de datos de leads y clientes de portabilidad" },
  "/oportunidades": { title: "Oportunidades", subtitle: "Tablero Kanban de tu pipeline comercial" },
  "/conversaciones": { title: "Conversaciones", subtitle: "Bandeja unificada de WhatsApp del Call Center" },
  "/automatizaciones": { title: "Automatizaciones", subtitle: "Workflows visuales de marketing y reparto" },
  "/plantillas": { title: "Plantillas", subtitle: "Plantillas de WhatsApp aprobadas por Meta" },
  "/integraciones": { title: "Integraciones", subtitle: "Canales y proveedores conectados" },
  "/bots-ia": { title: "Bots IA", subtitle: "Asistentes inteligentes por línea de producto" },
  "/equipo": { title: "Equipo", subtitle: "Agentes, roles y reparto de leads" },
  "/atribucion": { title: "Atribución", subtitle: "Analítica UTM de Campañas, Conjuntos y Anuncios" },
  "/ajustes": { title: "Ajustes", subtitle: "Campos personalizados y captura UTM" },
};

function resolveViewMeta(pathname: string): ViewMeta {
  const exact = VIEW_META[pathname];
  if (exact) return exact;
  const parent = `/${pathname.split("/")[1] ?? ""}`;
  return VIEW_META[parent] ?? { title: "ADlive CRM", subtitle: "" };
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout } = useCrm();
  const meta = resolveViewMeta(pathname);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-adlive-border bg-white px-6">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold text-adlive-text-main">{meta.title}</h1>
        {meta.subtitle ? <p className="truncate text-xs text-adlive-text-muted">{meta.subtitle}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="w-64">
          <AccountSwitcher placement="topbar" />
        </div>
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
