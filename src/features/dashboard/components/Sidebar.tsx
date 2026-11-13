"use client";

/**
 * Sidebar lateral fijo ADlive (Negro Obsidiana #0A0A12, 260px).
 * Logo + selector de cuenta + 11 enlaces de navegación + pie informativo.
 */

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
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdliveLogo } from "@/shared/components/AdliveLogo";

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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="adlive-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-adlive-sidebar-bg shadow-sidebar">
      <div className="px-5 pb-5 pt-6">
        <Link href="/dashboard" aria-label="ADlive CRM — Dashboard" className="cursor-pointer rounded-lg">
          <AdliveLogo tone="light" size="sm" />
        </Link>
      </div>

      <div className="px-4 pb-4">
        <AccountSwitcher placement="sidebar" />
      </div>

      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-4 py-2">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
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
        <p className="text-xs leading-5 text-white/40">
          Conecta WhatsApp, Meta Ads y TikTok Ads desde Integraciones.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-white/30">
          <Shuffle className="h-3 w-3" aria-hidden />
          ADlive CRM · Etapa A (Mock)
        </p>
      </footer>
    </aside>
  );
}
