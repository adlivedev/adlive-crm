import type { Metadata } from "next";
import { Suspense } from "react";

import { PasswordRecoveryForm } from "@/features/auth-tenant/components/PasswordRecoveryForm";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoverPasswordPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-adlive-canvas-bg text-sm text-adlive-text-muted">Cargando recuperación…</main>}><PasswordRecoveryForm /></Suspense>;
}
