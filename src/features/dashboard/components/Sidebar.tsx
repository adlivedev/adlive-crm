"use client";

import {
  BarChart3,
  Bot,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shuffle,
  Target,
  UserCog,
  Users,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandLogo } from "@/shared/components/BrandLogo";
import { canAgentAccessPath } from "@/shared/lib/auth/roleAccess";
import { useCrm } from "@/shared/services/crmStore";

import { AccountSwitcher } from "./AccountSwitcher";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contactos", label: "Contactos", icon: Users },
  { href: "/oportunidades", label: "Oportunidades", icon: Target },
  { href: "/conversaciones", label: "Conversaciones", icon: MessageSquare },
  { href: "/automatizaciones", label: "Automatizaciones", icon: Workflow },
  { href: "/plantillas", label: "Plantillas", icon: FileText },
  { href: "/integraciones", label: "Integraciones", icon: Zap },
  { href: "/bots-ia", label: "Bots IA", icon: Bot },
  { href: "/equipo", label: "Equipo", icon: UserCog },
  { href: "/atribucion", label: "Atribución", icon: BarChart3 },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { activeMember, isPlatformSuperadmin } = useCrm();
  const isAgent = !isPlatformSuperadmin && activeMember?.role === "agent";
  const visibleNavItems = isAgent ? NAV_ITEMS.filter((item) => canAgentAccessPath(item.href)) : NAV_ITEMS;

  return (
    <aside
      id="workspace-navigation"
      aria-label="Navegación del workspace"
      className={`adlive-sidebar fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col bg-adlive-sidebar-bg shadow-sidebar transition-transform duration-200 lg:z-40 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex items-center justify-between gap-2 px-5 pb-5 pt-6">
        <Link href="/dashboard" aria-label="Ir al Dashboard" onClick={onClose} className="min-w-0 cursor-pointer rounded-lg">
          <BrandLogo tone="light" size="sm" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="px-4 pb-4">
        <AccountSwitcher placement="sidebar" />
      </div>

      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-4 py-2">
        <ul className="flex flex-col gap-1">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-adlive-primary text-adlive-text-inverse shadow-card"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <footer className="border-t border-white/10 px-5 py-4">
        <p className="text-xs leading-5 text-white/50">
          {isAgent ? "Gestiona tus contactos, conversaciones y oportunidades asignadas." : "Conecta WhatsApp, Meta Ads y TikTok Ads desde Integraciones."}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-white/40">
          <Shuffle className="h-3 w-3" aria-hidden />
          Espacio de trabajo seguro
        </p>
      </footer>
    </aside>
  );
}
