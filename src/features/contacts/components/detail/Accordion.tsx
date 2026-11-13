"use client";

/**
 * M3 — Acordeón colapsable accesible (aria-expanded + región controlada).
 * Base de la columna izquierda de la ficha 360°.
 */

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Card } from "@/shared/components/ui/Card";

export interface AccordionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Accordion({ title, subtitle, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-adlive-text-main">{title}</span>
          {subtitle ? <span className="mt-0.5 block text-xs text-adlive-text-muted">{subtitle}</span> : null}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-adlive-text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div id={panelId} className="border-t border-adlive-border px-5 py-4">
          {children}
        </div>
      ) : null}
    </Card>
  );
}
