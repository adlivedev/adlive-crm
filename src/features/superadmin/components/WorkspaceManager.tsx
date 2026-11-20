"use client";

import { Building2, ExternalLink, Pencil, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AdliveLogo } from "@/shared/components/AdliveLogo";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { formatNumber } from "@/shared/lib/format";

import type { PlatformTenantMetric } from "../types";
import { CreateTenantModal } from "./CreateTenantModal";
import { EditTenantModal } from "./EditTenantModal";

interface WorkspaceManagerProps {
  initialTenants?: PlatformTenantMetric[];
  variant?: "platform" | "embedded";
}

export function WorkspaceManager({ initialTenants, variant = "embedded" }: WorkspaceManagerProps) {
  const [tenants, setTenants] = useState<PlatformTenantMetric[]>(initialTenants ?? []);
  const [loading, setLoading] = useState(initialTenants === undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformTenantMetric | null>(null);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const accessUrlFor = useCallback((slug: string) => `${origin}/login?workspace=${slug}`, [origin]);

  const copyToClipboard = useCallback(async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied((current) => (current === label ? null : current)), 2500);
    } catch {
      setError("No se pudo copiar la URL. Selecciónala y cópiala manualmente.");
    }
  }, []);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/superadmin/tenants", { cache: "no-store" });
      const result = await response.json() as { tenants?: PlatformTenantMetric[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudieron cargar los workspaces.");
      setTenants(result.tenants ?? []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los workspaces.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialTenants !== undefined) {
      setTenants(initialTenants);
      setLoading(false);
    } else {
      void loadTenants();
    }
  }, [initialTenants, loadTenants]);

  const updateStatus = async (tenant: PlatformTenantMetric) => {
    const status = tenant.status === "active" ? "suspended" : "active";
    try {
      const response = await fetch("/api/v1/superadmin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id, status }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo cambiar el estado del workspace.");
      setTenants((current) => current.map((item) => item.id === tenant.id ? { ...item, status } : item));
      setError("");
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo cambiar el estado.");
    }
  };

  const createButton = <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden />Crear Empresa / Workspace</Button>;
  const accessBanner = accessUrl ? (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <span className="min-w-0 flex-1"><strong>Workspace creado.</strong> Comparte esta URL de acceso con el cliente: <code className="break-all font-mono text-xs">{accessUrl}</code></span>
      <span className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => void copyToClipboard("created-access-url", accessUrl)}>{copied === "created-access-url" ? "¡Copiada!" : "Copiar URL"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setAccessUrl(null)}>Cerrar</Button>
      </span>
    </div>
  ) : null;
  const directory = (
    <Card className={variant === "platform" ? "mt-6 overflow-hidden" : "overflow-hidden"}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-gray-950">Empresas / Workspaces</h2>
          <p className="text-sm text-gray-500">Propietarios, marca, accesos y estado de cada empresa arrendada.</p>
        </div>
        {variant === "embedded" ? createButton : null}
      </div>
      {error ? <p role="alert" className="bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p role="status" className="px-5 py-12 text-center text-sm text-gray-500">Cargando workspaces…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">Empresa</th><th className="px-4 py-3">Propietario</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Usuarios</th><th className="px-4 py-3 text-right">Contactos</th><th className="px-4 py-3">URL de acceso del cliente</th><th className="px-4 py-3 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="px-5 py-4"><p className="font-semibold text-gray-950">{tenant.name}</p><p className="font-mono text-xs text-gray-500">{tenant.slug}</p></td>
                  <td className="px-4 py-4 text-gray-600">{tenant.admin_email ?? "—"}</td>
                  <td className="px-4 py-4"><Badge tone={tenant.status === "active" ? "success" : "neutral"}>{tenant.status === "active" ? "Activo" : "Inhabilitado"}</Badge></td>
                  <td className="px-4 py-4 text-right font-mono">{formatNumber(Number(tenant.user_count))}</td>
                  <td className="px-4 py-4 text-right font-mono">{formatNumber(Number(tenant.contact_count))}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <code className="max-w-[260px] truncate rounded-lg bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600" title={accessUrlFor(tenant.slug)}>{accessUrlFor(tenant.slug)}</code>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => void copyToClipboard(`access-${tenant.id}`, accessUrlFor(tenant.slug))}>{copied === `access-${tenant.id}` ? "¡Copiada!" : "Copiar"}</Button>
                        <Link href={`/login?workspace=${tenant.slug}`} target="_blank" className="inline-flex items-center gap-1 px-2 text-xs font-medium text-adlive-primary hover:underline">Abrir <ExternalLink className="h-3 w-3" aria-hidden /></Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(tenant)}><Pencil className="h-4 w-4" aria-hidden />Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => void updateStatus(tenant)}>{tenant.status === "active" ? "Inhabilitar" : "Habilitar"}</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 ? <tr><td colSpan={7} className="px-5 py-14 text-center text-gray-500">Aún no hay empresas. Crea el primer workspace para comenzar.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
  const modals = (
    <>
      <CreateTenantModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={({ warning, accessUrl: createdUrl }) => { if (warning) setError(warning); if (createdUrl) setAccessUrl(createdUrl); void loadTenants(); }} />
      <EditTenantModal tenant={editing} onClose={() => setEditing(null)} onSaved={() => void loadTenants()} />
    </>
  );

  if (variant === "embedded") return <section aria-label="Gestión de empresas">{accessBanner}{directory}{modals}</section>;

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-6 text-gray-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-xl"><AdliveLogo />{createButton}</header>
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Métricas de plataforma">
          <Card className="p-5"><Building2 className="h-5 w-5 text-adlive-primary" aria-hidden /><p className="mt-3 text-2xl font-bold">{tenants.length}</p><p className="text-sm text-gray-500">Workspaces</p></Card>
          <Card className="p-5"><Users className="h-5 w-5 text-adlive-primary" aria-hidden /><p className="mt-3 text-2xl font-bold">{formatNumber(tenants.reduce((sum, tenant) => sum + Number(tenant.user_count), 0))}</p><p className="text-sm text-gray-500">Usuarios</p></Card>
          <Card className="p-5"><Users className="h-5 w-5 text-adlive-primary" aria-hidden /><p className="mt-3 text-2xl font-bold">{formatNumber(tenants.reduce((sum, tenant) => sum + Number(tenant.contact_count), 0))}</p><p className="text-sm text-gray-500">Contactos</p></Card>
        </section>
        {accessBanner}
        {directory}
      </div>
      {modals}
    </main>
  );
}
