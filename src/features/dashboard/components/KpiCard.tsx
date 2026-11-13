import type { LucideIcon } from "lucide-react";

import { Card } from "@/shared/components/ui/Card";

export interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  iconTone?: "primary" | "cyan" | "success" | "danger";
}

const ICON_TONE_CLASSES: Record<NonNullable<KpiCardProps["iconTone"]>, string> = {
  primary: "bg-adlive-primary-light text-adlive-primary",
  cyan: "bg-adlive-cyan-light text-adlive-cyan",
  success: "bg-emerald-50 text-adlive-success",
  danger: "bg-red-50 text-adlive-danger",
};

/** Tarjeta KPI superior del Dashboard Ejecutivo (M2). */
export function KpiCard({ label, value, subtitle, icon: Icon, iconTone = "primary" }: KpiCardProps) {
  return (
    <Card className="flex items-start justify-between gap-4 p-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-adlive-text-muted">{label}</p>
        <p className="adlive-tabular mt-2 truncate font-mono text-3xl font-bold text-adlive-text-main">{value}</p>
        <p className="mt-1 truncate text-xs text-adlive-text-muted">{subtitle}</p>
      </div>
      <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ICON_TONE_CLASSES[iconTone]}`}>
        <Icon className="h-5 w-5" />
      </span>
    </Card>
  );
}
