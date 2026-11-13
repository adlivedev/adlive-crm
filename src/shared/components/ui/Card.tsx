import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Superficie de tarjeta blanca ADlive (KPIs, paneles, tablas y modales). */
export function Card({ className = "", children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-adlive-border bg-adlive-card-bg shadow-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-adlive-border px-6 py-4">
      <div>
        <h2 className="text-base font-semibold text-adlive-text-main">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-adlive-text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
