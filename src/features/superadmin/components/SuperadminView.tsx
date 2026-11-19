"use client";

import { Building2, ExternalLink, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AdliveLogo } from "@/shared/components/AdliveLogo";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { formatNumber } from "@/shared/lib/format";

import type { PlatformTenantMetric } from "../types";
import { CreateTenantModal } from "./CreateTenantModal";

export function SuperadminView({ initialTenants }: { initialTenants: PlatformTenantMetric[] }) {
  const router = useRouter();
  const [tenants, setTenants] = useState(initialTenants);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setTenants(initialTenants), [initialTenants]);

  const updateStatus = async (tenant: PlatformTenantMetric) => {
    const status = tenant.status === "active" ? "suspended" : "active";
    const response = await fetch("/api/v1/superadmin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: tenant.id, status }),
    });
    if (!response.ok) {
      setError("No se pudo cambiar el estado del workspace.");
      return;
    }
    setTenants((current) => current.map((item) => item.id === tenant.id ? { ...item, status } : item));
  };

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-6 text-gray-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-xl">
          <AdliveLogo />
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden />Nueva empresa</Button>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Métricas de plataforma">
          <Card className="p-5"><Building2 className="h-5 w-5 text-adlive-primary" aria-hidden /><p className="mt-3 text-2xl font-bold">{tenants.length}</p><p className="text-sm text-gray-500">Workspaces</p></Card>
          <Card className="p-5"><Users className="h-5 w-5 text-adlive-primary" aria-hidden /><p className="mt-3 text-2xl font-bold">{formatNumber(tenants.reduce((sum, tenant) => sum + Number(tenant.user_count), 0))}</p><p className="text-sm text-gray-500">Usuarios</p></Card>
          <Card className="p-5"><Users className="h-5 w-5 text-adlive-primary" aria-hidden /><p className="mt-3 text-2xl font-bold">{formatNumber(tenants.reduce((sum, tenant) => sum + Number(tenant.contact_count), 0))}</p><p className="text-sm text-gray-500">Contactos</p></Card>
        </section>

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-gray-200 px-5 py-4">
            <h1 className="text-lg font-bold">Empresas arrendadas</h1>
            <p className="text-sm text-gray-500">Accesos, estado y adopción por workspace.</p>
          </div>
          {error ? <p role="alert" className="bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-5 py-3">Empresa</th><th className="px-4 py-3">Administrador</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Usuarios</th><th className="px-4 py-3 text-right">Contactos</th><th className="px-4 py-3">Login branded</th><th className="px-4 py-3 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="px-5 py-4"><p className="font-semibold">{tenant.name}</p><p className="font-mono text-xs text-gray-500">{tenant.slug}</p></td>
                    <td className="px-4 py-4 text-gray-600">{tenant.admin_email ?? "—"}</td>
                    <td className="px-4 py-4"><Badge tone={tenant.status === "active" ? "success" : "neutral"}>{tenant.status === "active" ? "Activo" : "Suspendido"}</Badge></td>
                    <td className="px-4 py-4 text-right font-mono">{formatNumber(Number(tenant.user_count))}</td>
                    <td className="px-4 py-4 text-right font-mono">{formatNumber(Number(tenant.contact_count))}</td>
                    <td className="px-4 py-4"><Link href={`/login?workspace=${tenant.slug}`} target="_blank" className="inline-flex items-center gap-1 text-adlive-primary hover:underline">Abrir <ExternalLink className="h-3 w-3" aria-hidden /></Link></td>
                    <td className="px-4 py-4 text-right"><Button size="sm" variant="ghost" onClick={() => updateStatus(tenant)}>{tenant.status === "active" ? "Suspender" : "Activar"}</Button></td>
                  </tr>
                ))}
                {tenants.length === 0 ? <tr><td colSpan={7} className="px-5 py-14 text-center text-gray-500">Aún no hay empresas. Crea el primer workspace para comenzar.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <CreateTenantModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => router.refresh()} />
    </main>
  );
}
