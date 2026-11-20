"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Card } from "@/shared/components/ui/Card";

interface CaptureGuideProps {
  webhookUrl: string;
  token: string;
  iframeCode: string;
  scriptCode: string;
}

export function CaptureGuide({ webhookUrl, token, iframeCode, scriptCode }: CaptureGuideProps) {
  const [open, setOpen] = useState(0);
  const fetchCode = `fetch("${webhookUrl}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    token: "${token}",\n    first_name: "Ana",\n    last_name: "Pérez",\n    phone: "+573001112233",\n    email: "ana@ejemplo.com",\n    custom_fields: { operador_actual: "Claro" },\n    utm_source: "facebook",\n    utm_campaign: "mi_campana"\n  })\n});`;
  const items = [
    { title: "1. Enviar leads desde un formulario personalizado", description: "Usa JSON con el token y el tenant de la URL. Nombre, apellido y teléfono son obligatorios.", code: fetchCode },
    { title: "2. Insertar una landing mediante iframe", description: "Abre la landing para comprobar sus textos y luego pega este bloque en tu sitio.", code: iframeCode },
    { title: "3. Insertar un formulario con script", description: "Cambia data-theme por light, dark o transparent. data-primary acepta un color hexadecimal.", code: scriptCode },
    { title: "4. Mapear campos y valores personalizados", description: "En Campos personalizados crea una clave como ciudad o plan_interes. Envíala dentro de custom_fields usando esa clave. Los Valores personalizados se reutilizan en plantillas con la sintaxis {{clave}}; no sustituyen los campos del formulario.", code: `custom_fields: {\n  operador_actual: "Movistar",\n  ciudad: "Bogotá",\n  plan_interes: "Plan 50 GB"\n}` },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-adlive-border px-6 py-5"><h3 className="text-sm font-semibold text-adlive-text-main">Guía interactiva de instalación</h3><p className="mt-1 text-xs text-adlive-text-muted">Sigue el método que mejor encaje con tu sitio. No necesitas modificar el CRM.</p></div>
      <div className="divide-y divide-adlive-border">
        {items.map((item, index) => {
          const expanded = open === index;
          return (
            <section key={item.title}>
              <h4><button type="button" aria-expanded={expanded} aria-controls={`capture-guide-${index}`} onClick={() => setOpen(expanded ? -1 : index)} className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 px-6 py-4 text-left text-sm font-semibold text-adlive-text-main hover:bg-adlive-canvas-bg/60"><span>{item.title}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden /></button></h4>
              {expanded ? <div id={`capture-guide-${index}`} className="px-6 pb-6"><p className="text-sm leading-6 text-adlive-text-muted">{item.description}</p><pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-adlive-sidebar-bg p-4 text-xs leading-6 text-emerald-200"><code>{item.code}</code></pre></div> : null}
            </section>
          );
        })}
      </div>
    </Card>
  );
}
