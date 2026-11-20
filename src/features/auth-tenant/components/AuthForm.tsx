"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

import { BrandLogo } from "@/shared/components/BrandLogo";
import { TenantThemeProvider } from "@/shared/components/TenantThemeProvider";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";

import { useWorkspaceBrand } from "./useWorkspaceBrand";

export type AuthTab = "login" | "register";
export interface AuthFormProps { initialTab: AuthTab }

function AuthFormContent({ initialTab }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isHydrated, session, login, register, dataError } = useCrm();
  const workspaceSlug = searchParams.get("workspace")?.trim().toLowerCase() ?? "";
  const workspaceTenant = useWorkspaceBrand(workspaceSlug);
  const publicSignup = process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true";
  const [tab, setTab] = useState<AuthTab>(publicSignup ? initialTab : "login");
  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = tab === "register" && publicSignup;

  useEffect(() => {
    if (isHydrated && session) router.replace("/dashboard");
  }, [isHydrated, session, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsError(false);
    setIsSubmitting(true);
    const result = isRegister ? await register(agencyName, email, password) : await login(email, password, workspaceSlug || null);
    setIsSubmitting(false);
    if (!result.ok) {
      setIsError(true);
      setMessage(result.error ?? "No se pudo completar el acceso.");
      return;
    }
    if (isRegister) {
      setTab("login");
      setPassword("");
      if (result.loginPath) router.replace(result.loginPath);
      setMessage(result.requiresEmailConfirmation
        ? "Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión."
        : "Cuenta creada. Ya puedes iniciar sesión.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <TenantThemeProvider tenant={workspaceTenant} className="min-h-screen bg-adlive-canvas-bg">
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:py-12">
        <BrandLogo tenant={workspaceTenant} className="mb-8" />
        <div className="w-full max-w-md rounded-2xl border border-adlive-border bg-adlive-card-bg p-5 shadow-card sm:p-8">
          {publicSignup ? (
            <div role="tablist" aria-label="Autenticación" className="mb-8 grid grid-cols-2 rounded-xl bg-adlive-canvas-bg p-1">
              {(["login", "register"] as const).map((value) => (
                <button key={value} type="button" role="tab" aria-selected={tab === value}
                  onClick={() => { setTab(value); setMessage(null); setIsError(false); }}
                  className={`h-10 cursor-pointer rounded-lg text-sm font-semibold transition-all duration-150 ${tab === value ? "bg-white text-adlive-text-main shadow-card" : "text-adlive-text-muted hover:text-adlive-text-main"}`}>
                  {value === "login" ? "Iniciar sesión" : "Crear cuenta"}
                </button>
              ))}
            </div>
          ) : <h1 className="mb-6 text-xl font-bold text-adlive-text-main">Iniciar sesión</h1>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {isRegister ? <Input label="Nombre de la empresa" placeholder="Tu empresa" value={agencyName} onChange={(event) => setAgencyName(event.target.value)} autoComplete="organization" required minLength={2} /> : null}
            <Input label="Correo electrónico" type="email" inputMode="email" placeholder="tu@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="auth-password" className="text-sm font-medium text-adlive-text-main">Contraseña</label>
                {!isRegister ? <Link href={`/recuperar-contrasena${workspaceSlug ? `?workspace=${encodeURIComponent(workspaceSlug)}` : ""}`} className="cursor-pointer text-right text-xs font-medium text-adlive-primary hover:underline">¿Olvidaste tu contraseña?</Link> : null}
              </div>
              <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 12 : 6}
                className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20" />
              {isRegister ? <p className="text-xs text-adlive-text-muted">Usa entre 12 y 72 caracteres.</p> : null}
            </div>
            {message || dataError ? <p role={isError || dataError ? "alert" : "status"} className={`rounded-xl border px-4 py-2.5 text-sm ${isError || dataError ? "border-red-200 bg-red-50 text-adlive-danger" : "border-emerald-200 bg-emerald-50 text-adlive-success"}`}>{message ?? dataError}</p> : null}
            <Button type="submit" variant="primary" isLoading={isSubmitting} className="w-full">{isRegister ? "Crear cuenta" : "Ingresar"}</Button>
          </form>
        </div>
        <p className="mt-6 max-w-md text-center text-xs leading-5 text-adlive-text-muted">Cada empresa ve únicamente sus propios contactos, oportunidades y conversaciones.</p>
      </main>
    </TenantThemeProvider>
  );
}

export function AuthForm(props: AuthFormProps) {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-adlive-canvas-bg text-sm text-adlive-text-muted">Cargando acceso…</main>}><AuthFormContent {...props} /></Suspense>;
}
