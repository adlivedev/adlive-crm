import type { Metadata } from "next";

import { AuthForm } from "@/features/auth-tenant/components/AuthForm";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  return <AuthForm initialTab="login" />;
}
