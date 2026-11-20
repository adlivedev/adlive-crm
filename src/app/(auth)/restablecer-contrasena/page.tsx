import type { Metadata } from "next";
import { Suspense } from "react";

import { PasswordResetForm } from "@/features/auth-tenant/components/PasswordResetForm";

export const metadata: Metadata = { title: "Restablecer contraseña" };

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-adlive-canvas-bg text-sm text-adlive-text-muted">Cargando restablecimiento…</main>}><PasswordResetForm /></Suspense>;
}
