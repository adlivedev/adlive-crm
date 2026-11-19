"use client";

/* eslint-disable @next/next/no-img-element */

import type { HTMLAttributes } from "react";

import { resolveTenantBranding } from "@/shared/lib/branding";
import { useCrm } from "@/shared/services/crmStore";
import type { Tenant, TenantBranding } from "@/shared/types/database";

export interface BrandLogoProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "dark" | "light";
  size?: "sm" | "md";
  tenant?: Pick<Tenant, "name" | "branding"> | null;
  branding?: TenantBranding;
  showName?: boolean;
}

export function BrandLogo({
  tone = "dark",
  size = "md",
  tenant: tenantOverride,
  branding: brandingOverride,
  showName = true,
  className = "",
  ...rest
}: BrandLogoProps) {
  const { activeTenant } = useCrm();
  const branding = resolveTenantBranding({
    name: tenantOverride === undefined ? activeTenant?.name ?? "CRM" : tenantOverride?.name ?? "CRM",
    branding: brandingOverride ?? (tenantOverride === undefined ? activeTenant?.branding : tenantOverride?.branding),
  });
  const logo = tone === "light" ? branding.logo_dark_url ?? branding.logo_url : branding.logo_url;
  const boxClass = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const initial = branding.brand_name.charAt(0).toUpperCase();

  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`} {...rest}>
      {logo ? (
        <img
          src={logo}
          alt={`Logo de ${branding.brand_name}`}
          className={`${boxClass} shrink-0 rounded-xl object-contain ${tone === "light" ? "bg-white p-1" : ""}`}
        />
      ) : (
        <span
          aria-hidden={showName}
          className={`flex ${boxClass} shrink-0 items-center justify-center rounded-xl bg-adlive-primary font-bold text-white shadow-card`}
        >
          {initial}
        </span>
      )}
      {showName ? (
        <span className={`truncate font-bold tracking-tight ${size === "sm" ? "text-base" : "text-xl"} ${tone === "light" ? "text-white" : "text-adlive-text-main"}`}>
          {branding.brand_name}
        </span>
      ) : <span className="sr-only">{branding.brand_name}</span>}
    </div>
  );
}
