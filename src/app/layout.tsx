import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { CrmProvider } from "@/shared/services/crmStore";

import "./globals.css";

// Mantener las fuentes en el repositorio evita descargas externas durante el build.
const plusJakartaSans = localFont({
  src: "./fonts/plus-jakarta-sans-latin.woff2",
  weight: "400 700",
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  weight: "400 600",
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CRM",
    template: "%s · CRM",
  },
  description:
    "Espacio de trabajo comercial: contactos, oportunidades, conversaciones de WhatsApp y automatización.",
  applicationName: "CRM",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0A12",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <CrmProvider>{children}</CrmProvider>
      </body>
    </html>
  );
}
