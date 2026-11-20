/* eslint-disable @next/next/no-img-element */

import type { TenantBranding } from "@/shared/types/database";

export function PublicBrand({ branding, light = false }: { branding: TenantBranding; light?: boolean }) {
  const logo = light ? branding.logo_dark_url ?? branding.logo_url : branding.logo_url;
  return (
    <div className="flex min-w-0 items-center gap-3">
      {logo ? (
        <img src={logo} alt={`Logo de ${branding.brand_name}`} className={`h-12 w-12 shrink-0 rounded-xl object-contain ${light ? "bg-white p-1" : ""}`} />
      ) : (
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xl font-bold text-current ring-1 ring-current/20">{branding.brand_name.charAt(0).toUpperCase()}</span>
      )}
      <span className="truncate text-xl font-bold tracking-tight">{branding.brand_name}</span>
    </div>
  );
}
