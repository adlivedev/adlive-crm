"use client";

/**
 * M1 — Formulario unificado de autenticación multi-tenant.
 * Pestañas conmutables: Iniciar sesión / Crear cuenta (nueva agencia aislada).
 */

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { AdliveLogo } from "@/shared/components/AdliveLogo";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { useCrm } from "@/shared/services/crmStore";

export type AuthTab = "login" | "register";

export interface AuthFormProps {
  initialTab: AuthTab;
}

export function AuthForm({ initialTab }: AuthFormProps) {
  const router = useRouter();
  const { isHydrated, session, login, register } = useCrm();

  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Si ya hay sesión mock activa, entrar directo al CRM. */
  useEffect(() => {
    if (isHydrated && session) router.replace("/dashboard");
  }, [isHydrated, session, router]);

  const isRegister = tab === "register";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const ok = isRegister
      ? register(agencyName, email, password)
      : login(email, password);

    if (ok) {
      router.push("/dashboard");
      return;
    }
    setIsSubmitting(false);
    setErrorMessage(
      isRegister
        ? "Revisa el nombre de la agencia y el correo electrónico."
        : "Ingresa un correo electrónico válido para continuar.",
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-adlive-canvas-bg px-4 py-12">
      <AdliveLogo className="mb-8" />

      <div className="w-full max-w-md rounded-2xl border border-adlive-border bg-adlive-card-bg p-8 shadow-card">
        {/* Pestañas conmutables */}
        <div role="tablist" aria-label="Autenticación" className="mb-8 grid grid-cols-2 rounded-xl bg-adlive-canvas-bg p-1">
          {(["login", "register"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => {
                setTab(value);
                setErrorMessage(null);
              }}
              className={`h-10 cursor-pointer rounded-lg text-sm font-semibold transition-all duration-150 ${
                tab === value
                  ? "bg-white text-adlive-text-main shadow-card"
                  : "text-adlive-text-muted hover:text-adlive-text-main"
              }`}
            >
              {value === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate={false} className="flex flex-col gap-5">
          {isRegister ? (
            <Input
              label="Nombre de la agencia"
              placeholder="Agencia Aurora"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              autoComplete="organization"
              required
              minLength={2}
            />
          ) : null}

          <Input
            label="Correo electrónico"
            type="email"
            inputMode="email"
            placeholder="tu@agencia.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="auth-password" className="text-sm font-medium text-adlive-text-main">
                Contraseña
              </label>
              {!isRegister ? (
                <button
                  type="button"
                  onClick={() => setErrorMessage("Te enviaremos un enlace de restablecimiento cuando conectemos Supabase Auth (Etapa B).")}
                  className="cursor-pointer text-xs font-medium text-adlive-cyan transition-colors duration-150 hover:text-cyan-700 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              ) : null}
            </div>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={6}
              className="h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main transition-colors duration-150 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
            />
          </div>

          {errorMessage ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" variant="primary" isLoading={isSubmitting} className="w-full">
            {isRegister ? "Crear cuenta gratis" : "Ingresar"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-adlive-border" />
          <span className="text-xs text-adlive-text-muted">o continúa con</span>
          <span className="h-px flex-1 bg-adlive-border" />
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setErrorMessage("El inicio de sesión con Google se habilita al conectar Supabase Auth (Etapa B).")}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.6Z" />
            <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24Z" />
            <path fill="#FBBC05" d="M5.2 14.4c-.3-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3Z" />
            <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c1-2.9 3.7-4.9 6.8-4.9Z" />
          </svg>
          Continuar con Google
        </Button>
      </div>

      <p className="mt-6 max-w-md text-center text-xs leading-5 text-adlive-text-muted">
        Cada cuenta ve únicamente sus propios contactos, oportunidades y conversaciones.
      </p>
    </main>
  );
}
