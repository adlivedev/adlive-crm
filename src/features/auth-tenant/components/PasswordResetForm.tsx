"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { BrandLogo } from "@/shared/components/BrandLogo";
import { TenantThemeProvider } from "@/shared/components/TenantThemeProvider";
import { Button } from "@/shared/components/ui/Button";
import { createClient } from "@/shared/lib/supabase/client";

import { useWorkspaceBrand } from "./useWorkspaceBrand";

export function PasswordResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceSlug = searchParams.get("workspace")?.trim().toLowerCase() ?? "";
  const workspaceTenant = useWorkspaceBrand(workspaceSlug);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginPath = `/login${workspaceSlug ? `?workspace=${encodeURIComponent(workspaceSlug)}` : ""}`;

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    const markReady = () => {
      if (!mounted) return;
      setIsReady(true);
      setMessage(null);
      setIsError(false);
    };
    const { data: listener } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (authSession && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) markReady();
    });
    const initialize = async () => {
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session && mounted) {
            setIsError(true);
            setMessage("El enlace venció o ya fue utilizado. Solicita uno nuevo.");
            return;
          }
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) markReady();
      else if (mounted && !code) {
        setIsError(true);
        setMessage("Abre esta pantalla desde el enlace de recuperación enviado a tu correo.");
      }
    };
    void initialize();
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setIsError(true);
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setIsSubmitting(false);
      setIsError(true);
      setMessage("No se pudo actualizar la contraseña. Solicita un enlace nuevo e inténtalo de nuevo.");
      return;
    }
    await supabase.auth.signOut();
    setMessage("Contraseña actualizada. Ya puedes iniciar sesión.");
    router.replace(loginPath);
  }

  return (
    <TenantThemeProvider tenant={workspaceTenant} className="min-h-screen bg-adlive-canvas-bg">
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:py-12">
        <BrandLogo tenant={workspaceTenant} className="mb-8" />
        <div className="w-full max-w-md rounded-2xl border border-adlive-border bg-adlive-card-bg p-5 shadow-card sm:p-8">
          <h1 className="text-xl font-bold text-adlive-text-main">Restablecer contraseña</h1>
          <p className="mb-6 mt-2 text-sm leading-6 text-adlive-text-muted">Define una contraseña nueva de 12 a 72 caracteres.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-adlive-text-main">Nueva contraseña
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={12} maxLength={72} disabled={!isReady || isSubmitting} className="h-11 rounded-xl border border-adlive-border bg-white px-4 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20 disabled:opacity-60" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-adlive-text-main">Confirmar contraseña
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required minLength={12} maxLength={72} disabled={!isReady || isSubmitting} className="h-11 rounded-xl border border-adlive-border bg-white px-4 text-sm focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20 disabled:opacity-60" />
            </label>
            {message ? <p role={isError ? "alert" : "status"} className={`rounded-xl border px-4 py-2.5 text-sm ${isError ? "border-red-200 bg-red-50 text-adlive-danger" : "border-emerald-200 bg-emerald-50 text-adlive-success"}`}>{message}</p> : null}
            <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={!isReady} className="w-full">Guardar nueva contraseña</Button>
          </form>
          <Link href={`/recuperar-contrasena${workspaceSlug ? `?workspace=${encodeURIComponent(workspaceSlug)}` : ""}`} className="mt-6 block cursor-pointer text-center text-sm font-medium text-adlive-primary hover:underline">Solicitar un enlace nuevo</Link>
        </div>
      </main>
    </TenantThemeProvider>
  );
}
