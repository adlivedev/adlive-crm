"use client";

/**
 * M5 — Bandeja Unificada de Conversaciones para Call Center (`/conversaciones`).
 * Tres columnas: hilos filtrables | chat en vivo con validador de 24 h | inspector del contacto.
 */

import { InboxView } from "@/features/inbox-conversations/components/InboxView";

export default function ConversacionesPage() {
  return <InboxView />;
}
