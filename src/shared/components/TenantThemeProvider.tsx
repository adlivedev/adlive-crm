"use client";

import type { CSSProperties, ReactNode } from "react";

import { resolveTenantBranding } from "@/shared/lib/branding";
import { useCrm } from "@/shared/services/crmStore";
import type { Tenant } from "@/shared/types/database";

type ThemeStyle = CSSProperties & Record<`--brand-${string}`, string>;

interface TenantThemeProviderProps {
  children: ReactNode;
  tenant?: Pick<Tenant, "name" | "branding"> | null;
  className?: string;
}

export function TenantThemeProvider({ children, tenant: tenantOverride, className = "" }: TenantThemeProviderProps) {
  const { activeTenant } = useCrm();
  const tenant = tenantOverride === undefined ? activeTenant : tenantOverride;
  const branding = resolveTenantBranding(tenant);
  const style: ThemeStyle = {
    "--brand-primary": branding.primary_color,
    "--brand-primary-hover": branding.primary_hover,
    "--brand-accent": branding.accent_color,
    "--brand-sidebar-bg": branding.sidebar_bg,
    "--brand-canvas-bg": branding.canvas_bg,
    "--brand-ink": branding.ink_color,
  };

  return (
    <div className={className} style={style} data-workspace={tenant?.name ?? "neutral"}>
      {children}
    </div>
  );
}
