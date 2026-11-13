import type { Metadata } from "next";

import { AuthForm } from "@/features/auth-tenant/components/AuthForm";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

export default function RegisterPage() {
  return <AuthForm initialTab="register" />;
}
