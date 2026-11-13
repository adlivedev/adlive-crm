import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "cyan" | "lime";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-adlive-canvas-bg text-adlive-text-muted border-adlive-border",
  primary: "bg-adlive-primary-light text-adlive-primary border-adlive-primary/20",
  success: "bg-emerald-50 text-adlive-success border-emerald-200",
  warning: "bg-amber-50 text-adlive-warning border-amber-200",
  danger: "bg-red-50 text-adlive-danger border-red-200",
  cyan: "bg-adlive-cyan-light text-cyan-700 border-adlive-cyan/30",
  lime: "bg-adlive-lime/40 text-adlive-text-main border-adlive-lime",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

/** Píldora de estado ADlive (etiquetas, tipificaciones, estados de conexión). */
export function Badge({ tone = "neutral", className = "", children, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 ${TONE_CLASSES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
