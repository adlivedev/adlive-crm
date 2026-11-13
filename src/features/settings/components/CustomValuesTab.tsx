"use client";

/**
 * M12 — Pestaña Valores personalizados: variables globales de la agencia
 * (link de términos, precio promo del mes, respuestas comunes de bots…).
 */

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";

export function CustomValuesTab() {
  const { customValues, addCustomValue, deleteCustomValue } = useCrm();
  const [key, setKey] = useState("");
  const [content, setContent] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, "_");
  const keyTaken = customValues.some((value) => value.value_key === normalizedKey);
  const isValid = normalizedKey.length >= 2 && content.trim().length > 0 && !keyTaken;

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    addCustomValue(normalizedKey, content.trim());
    setAnnouncement(`Variable «${normalizedKey}» guardada. Úsala en bots y plantillas como {{${normalizedKey}}}.`);
    setKey("");
    setContent("");
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-adlive-text-main">Nueva variable global</h3>
        <p className="mt-1 text-xs text-adlive-text-muted">
          Variables reutilizables en plantillas, bots y workflows. Ej.: link de términos, precio promo del mes.
        </p>
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr_auto]">
          <Input label="Clave" value={key} onChange={(event) => setKey(event.target.value)} placeholder="precio_promo_mes" />
          <Input label="Contenido" value={content} onChange={(event) => setContent(event.target.value)} placeholder="El plan de 50GB queda a $23.000 el primer mes" />
          <div className="flex items-end">
            <Button type="submit" disabled={!isValid}>
              <Plus className="h-4 w-4" aria-hidden />
              Guardar
            </Button>
          </div>
          {normalizedKey ? (
            <p className={`text-xs md:col-span-3 ${keyTaken ? "text-adlive-danger" : "text-adlive-text-muted"}`}>
              Se usará como <span className="font-mono">{`{{${normalizedKey}}}`}</span>
              {keyTaken ? " · ya existe una variable con esta clave" : ""}
            </p>
          ) : null}
        </form>
      </Card>

      {customValues.length === 0 ? (
        <Card className="p-6 text-sm text-adlive-text-muted">No hay variables globales todavía.</Card>
      ) : (
        <ul className="flex flex-col gap-3" role="list">
          {customValues.map((value) => (
            <li key={value.id}>
              <Card className="flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-semibold text-adlive-primary">{`{{${value.value_key}}}`}</p>
                  <p className="mt-1 text-sm text-adlive-text-main">{value.value_content}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={pendingDeleteId === value.id ? "Confirmar eliminación de la variable" : `Eliminar variable ${value.value_key}`}
                  className={pendingDeleteId === value.id ? "text-adlive-danger" : "text-adlive-text-muted"}
                  onClick={() => {
                    if (pendingDeleteId !== value.id) {
                      setPendingDeleteId(value.id);
                      return;
                    }
                    deleteCustomValue(value.id);
                    setPendingDeleteId(null);
                    setAnnouncement(`Variable «${value.value_key}» eliminada.`);
                  }}
                  onBlur={() => setPendingDeleteId((prev) => (prev === value.id ? null : prev))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {pendingDeleteId === value.id ? "Confirmar" : ""}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
