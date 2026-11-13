import Link from "next/link";

import { AdliveLogo } from "@/shared/components/AdliveLogo";

/** Estado de error global (ruta inexistente / módulo aún no construido). */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-adlive-canvas-bg px-6">
      <AdliveLogo />
      <div className="max-w-md text-center">
        <p className="font-mono text-sm font-semibold text-adlive-primary">404</p>
        <h1 className="mt-2 text-2xl font-bold text-adlive-text-main">Página no encontrada</h1>
        <p className="mt-2 text-sm text-adlive-text-muted">
          La ruta que buscas no existe o el módulo todavía no está disponible en esta iteración del CRM.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-adlive-primary px-5 text-sm font-semibold text-adlive-text-inverse transition-colors duration-150 hover:bg-adlive-primary-hover"
      >
        Volver al Dashboard
      </Link>
    </main>
  );
}
