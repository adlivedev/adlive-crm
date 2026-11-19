"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { useCrm, type CreateContactInput } from "@/shared/services/crmStore";

import { Modal } from "./Modal";
import { parseContactsCsv } from "./contactsUtils";

export interface ImportContactsModalProps { open: boolean; onClose: () => void }

export function ImportContactsModal({ open, onClose }: ImportContactsModalProps) {
  const { importContacts, isMutating } = useCrm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedRows, setParsedRows] = useState<CreateContactInput[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const importTag = `importado-${new Date().toISOString().slice(0, 10)}`;

  const reset = () => {
    setParsedRows(null); setFileName(null); setParseError(null); setImportedCount(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleClose = () => { reset(); onClose(); };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    reset();
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setParseError("El archivo supera el límite de 5 MB."); return; }
    const rows = parseContactsCsv(await file.text());
    if (rows.length === 0) { setParseError("No se encontraron filas válidas. Usa: nombre; teléfono; email; empresa; fuente."); return; }
    if (rows.length > 5000) { setParseError("Cada importación admite máximo 5.000 contactos."); return; }
    setParsedRows(rows);
    setFileName(file.name);
  };

  const importRows = async () => {
    if (!parsedRows) return;
    setParseError(null);
    const result = await importContacts(parsedRows.map((row) => ({ ...row, tags: [importTag] })));
    if (result.failed > 0) { setParseError("No se completó la importación. Revisa teléfonos duplicados y permisos; no se confirmó ninguna fila."); return; }
    setImportedCount(result.imported);
    setParsedRows(null); setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Modal open={open} onClose={handleClose} title="Importar contactos" subtitle="Carga contactos reales desde un archivo CSV de hasta 5 MB.">
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-adlive-border bg-adlive-canvas-bg/60 px-4 py-3 text-xs leading-5 text-adlive-text-muted">
          <p className="font-semibold text-adlive-text-main">Formato esperado del CSV</p>
          <p className="mt-1 font-mono">nombre;teléfono;email;empresa;fuente<br />Nombre Ejemplo;573001112233;correo@ejemplo.com;Empresa;WhatsApp</p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="importar-archivo-csv" className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-adlive-border px-4 py-5 hover:border-adlive-primary hover:bg-adlive-primary-light/40">
            <Upload className="h-5 w-5 shrink-0 text-adlive-primary" aria-hidden />
            <span className="text-sm text-adlive-text-main">{fileName ? <><span className="font-semibold">{fileName}</span> — listo para importar</> : "Selecciona un archivo .csv con los contactos"}</span>
          </label>
          <input ref={fileInputRef} id="importar-archivo-csv" type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(event) => void handleFileChange(event)} />
          {parseError ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">{parseError}</p> : null}
        </div>
        {parsedRows ? <div className="flex flex-col gap-2 rounded-xl border border-adlive-border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-adlive-text-main"><FileSpreadsheet className="h-4 w-4 text-adlive-primary" aria-hidden />{parsedRows.length} contactos detectados</p>
          <ul className="max-h-36 overflow-y-auto text-xs text-adlive-text-muted">{parsedRows.slice(0, 50).map((row, index) => <li key={`${row.phone_e164}-${index}`} className="border-b border-adlive-border/60 py-1.5 last:border-0"><span className="font-mono">{row.phone_e164}</span> · {row.full_name}{row.email ? ` · ${row.email}` : ""}</li>)}</ul>
          <Button variant="primary" size="sm" className="self-start" isLoading={isMutating} onClick={() => void importRows()}>Importar {parsedRows.length} contactos</Button>
        </div> : null}
        {importedCount !== null ? <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-adlive-success"><Badge tone="success">{importedCount} contactos</Badge>importados con la etiqueta {importTag}.</p> : null}
        <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={handleClose}>Cerrar</Button></div>
      </div>
    </Modal>
  );
}
