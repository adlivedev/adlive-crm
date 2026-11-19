"use client";

/**
 * Vista previa en vivo estilo WhatsApp (M7): burbuja realista sobre fondo
 * crema, con header, cuerpo (variables reemplazadas por ejemplos y formato
 * *negrita* / _cursiva_ / ~tachado~ renderizado), footer y botones.
 */

import { CheckCheck, FileText, Image as ImageIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { WhatsAppTemplateButton } from "@/shared/types/database";

import { applyExampleVariables } from "./templateUtils";

/** Mini-parser de formato WhatsApp: *b* → negrita, _i_ → cursiva, ~s_ → tachado. */
function renderFormatted(text: string): ReactNode[] {
  const tokens = text.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~)/g).filter(Boolean);
  return tokens.map((token, index) => {
    if (token.length > 2 && token.startsWith("*") && token.endsWith("*")) {
      return (
        <strong key={index} className="font-semibold">
          {token.slice(1, -1)}
        </strong>
      );
    }
    if (token.length > 2 && token.startsWith("_") && token.endsWith("_")) {
      return (
        <em key={index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.length > 2 && token.startsWith("~") && token.endsWith("~")) {
      return (
        <del key={index} className="opacity-70">
          {token.slice(1, -1)}
        </del>
      );
    }
    return <span key={index}>{token}</span>;
  });
}

export interface TemplatePreviewProps {
  headerType: "NONE" | "TEXT" | "IMAGE" | "DOCUMENT";
  headerContent: string;
  body: string;
  footer: string;
  buttons: WhatsAppTemplateButton[];
}

export function TemplatePreview({ headerType, headerContent, body, footer, buttons }: TemplatePreviewProps) {
  const resolvedBody = applyExampleVariables(body);
  const quickReplies = buttons.filter((button) => button.type === "QUICK_REPLY");
  const urlButtons = buttons.filter((button) => button.type === "URL");

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-2xl border border-adlive-border bg-[#ECE5DD] p-4">
      <p className="sr-only">Vista previa de la plantilla con datos de ejemplo</p>

      {/* Cabecera del chat simulado */}
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-[#075E54] px-3 py-2 text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">WA</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">Cuenta de WhatsApp Business</p>
          <p className="text-[10px] text-white/70">en línea</p>
        </div>
        <span className="rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-medium">Vista previa</span>
      </div>

      {/* Burbuja de la plantilla */}
      <div className="flex flex-1 flex-col justify-end">
        <div className="max-w-[95%] rounded-xl rounded-tl-none bg-white p-3 shadow-sm">
          {headerType === "TEXT" && headerContent.trim().length > 0 ? (
            <p className="mb-1 text-[13px] font-semibold text-adlive-text-main">{headerContent}</p>
          ) : null}
          {headerType === "IMAGE" ? (
            <div className="mb-2 flex h-28 items-center justify-center rounded-lg bg-gradient-to-br from-adlive-primary/30 to-adlive-cyan/30 text-adlive-text-muted">
              <span className="flex flex-col items-center gap-1 text-[10px] font-medium">
                <ImageIcon className="h-6 w-6" aria-hidden />
                Imagen del header
              </span>
            </div>
          ) : null}
          {headerType === "DOCUMENT" ? (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-adlive-canvas-bg px-3 py-2 text-[11px] text-adlive-text-muted">
              <FileText className="h-4 w-4" aria-hidden />
              Documento adjunto del header
            </div>
          ) : null}

          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-adlive-text-main">
            {resolvedBody.length > 0 ? renderFormatted(resolvedBody) : <span className="text-adlive-text-muted/60">Escribe el cuerpo del mensaje…</span>}
          </p>

          {footer.trim().length > 0 ? (
            <p className="mt-2 border-t border-adlive-border/60 pt-1.5 text-[11px] text-adlive-text-muted">{footer}</p>
          ) : null}

          <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-adlive-text-muted/70">
            14:32 <CheckCheck className="h-3 w-3 text-adlive-cyan" aria-label="Leído" />
          </span>
        </div>

        {/* Botones de respuesta rápida */}
        {quickReplies.length > 0 ? (
          <div className="mt-1.5 flex max-w-[95%] flex-wrap gap-1.5" aria-label="Respuestas rápidas">
            {quickReplies.map((button) => (
              <span key={button.text} className="rounded-full border border-adlive-cyan/40 bg-white px-3 py-1 text-[11px] font-semibold text-cyan-700">
                {button.text}
              </span>
            ))}
          </div>
        ) : null}

        {/* Botones de URL */}
        {urlButtons.length > 0 ? (
          <div className="mt-1.5 flex max-w-[95%] flex-col gap-1.5" aria-label="Botones de enlace">
            {urlButtons.map((button) => (
              <span key={button.text} className="rounded-lg bg-white px-3 py-1.5 text-center text-[11px] font-semibold text-adlive-primary shadow-sm">
                {button.text}
                <span className="mt-0.5 block truncate text-[9px] font-normal text-adlive-text-muted">{button.url}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
