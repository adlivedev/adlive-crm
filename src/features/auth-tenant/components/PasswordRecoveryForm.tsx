"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { BrandLogo } from "@/shared/components/BrandLogo";
import { TenantThemeProvider } from "@/shared/components/TenantThemeProvider";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";

import { useWorkspaceBrand } from "./useWorkspaceBrand";

export function PasswordRecoveryForm() {
  const searchParams = useSearchParams();
  const workspaceSlug = searchParams.get("workspace")?.trim().toLowerCase() ?? "";
  const workspaceTenant = useWorkspaceBrand(workspaceSlug);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginPath = `/login${workspaceSlug ? `?workspace=${encodeURIComponent(workspaceSlug)}` : ""}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);
    try {
      const response = await fetch("/api/v1/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), workspaceSlug: workspaceSlug || null }),
      });
      const result = await response.json() as { error?: string; message?: string };
      setIsError(!response.ok);
      setMessage(result.error ?? result.message ?? "Solicitud procesada.");
    } catch {
      setIsError(true);
      setMessage("No se pudo procesar la solicitud. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <TenantThemeProvider tenant={workspaceTenant} className="min-h-screen bg-adlive-canvas-bg">
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:py-12">
        <BrandLogo tenant={workspaceTenant} className="mb-8" />
        <div className="w-full max-w-md rounded-2xl border border-adlive-border bg-adlive-card-bg p-5 shadow-card sm:p-8">
          <h1 className="text-xl font-bold text-adlive-text-main">Recuperar contraseña</h1>
          <p className="mb-6 mt-2 text-sm leading-6 text-adlive-text-muted">Te enviaremos un enlace seguro si el correo tiene acceso a este workspace.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input label="Correo electrónico" type="email" inputMode="email" placeholder="tu@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            {message ? <p role={isError ? "alert" : "status"} className={`rounded-xl border px-4 py-2.5 text-sm ${isError ? "border-red-200 bg-red-50 text-adlive-danger" : "border-emerald-200 bg-emerald-50 text-adlive-success"}`}>{message}</p> : null}
            <Button type="submit" variant="primary" isLoading={isSubmitting} className="w-full">Enviar enlace de recuperación</Button>
          </form>
          <Link href={loginPath} className="mt-6 block cursor-pointer text-center text-sm font-medium text-adlive-primary hover:underline">Volver a iniciar sesión</Link>
        </div>
      </main>
    </TenantThemeProvider>
  );
}
