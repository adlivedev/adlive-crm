/**
 * M8 — Catálogo de proveedores de Integraciones.
 * Metadatos estáticos de presentación; el estado de conexión vive en el store
 * (bóveda `TenantIntegrationVault`, credenciales cifradas en servidor).
 */

import {
  Facebook,
  Instagram,
  MessageCircle,
  Music2,
  Phone,
  PhoneCall,
  type LucideIcon,
} from "lucide-react";

import type { IntegrationProvider } from "@/shared/types/database";

export interface IntegrationFieldSpec {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
  hint?: string;
}

export interface IntegrationSpec {
  provider: IntegrationProvider;
  name: string;
  description: string;
  icon: LucideIcon;
  fields: IntegrationFieldSpec[];
}

export const INTEGRATION_SPECS: IntegrationSpec[] = [
  {
    provider: "whatsapp_cloud_api",
    name: "WhatsApp Business API",
    description: "Envía y recibe mensajes de la API oficial de Meta Cloud para tu línea comercial.",
    icon: MessageCircle,
    fields: [
      { key: "phone_number_id", label: "Phone Number ID", placeholder: "Ej. 104928374610255" },
      { key: "waba_id", label: "WABA ID", placeholder: "Ej. 1049283746102555" },
      {
        key: "access_token", label: "Access Token", placeholder: "EAAG…", secret: true,
        hint: "Se guarda cifrado en el servidor (AES-256-GCM) y jamás vuelve a mostrarse.",
      },
    ],
  },
  {
    provider: "facebook_lead_ads",
    name: "Facebook Lead Ads",
    description: "Recibe leads de tus formularios de Facebook e Instagram en tiempo real vía webhook.",
    icon: Facebook,
    fields: [
      { key: "ad_account_id", label: "Ad Account ID", placeholder: "Ej. act_784512963" },
      { key: "page_id", label: "Página de Facebook", placeholder: "ID numérico de la página" },
    ],
  },
  {
    provider: "instagram",
    name: "Instagram",
    description: "Conecta tu cuenta profesional para recibir mensajes directos en la bandeja unificada.",
    icon: Instagram,
    fields: [
      { key: "ig_user_id", label: "IG User ID", placeholder: "Ej. 17841456321098765" },
      { key: "page_id", label: "Página vinculada", placeholder: "ID numérico de la página de Facebook" },
    ],
  },
  {
    provider: "tiktok_ads",
    name: "TikTok Ads",
    description: "Sincroniza tus campañas de TikTok y atribuye los leads que llegan por pauta.",
    icon: Music2,
    fields: [
      { key: "advertiser_id", label: "Advertiser ID", placeholder: "Ej. 7123456789012345678" },
      { key: "access_token", label: "Access Token", placeholder: "tltk…", secret: true },
    ],
  },
  {
    provider: "twilio",
    name: "Twilio (SMS y voz)",
    description: "Envía SMS y realiza llamadas de seguimiento automatizado con Twilio.",
    icon: Phone,
    fields: [
      { key: "account_sid", label: "Account SID", placeholder: "Ej. AC1a2b3c4d5e6f7g8h9i0j1k2l3" },
      { key: "auth_token", label: "Auth Token", placeholder: "Se guarda cifrado en el servidor", secret: true },
    ],
  },
  {
    provider: "telnyx",
    name: "Telnyx (SMS y voz)",
    description: "Canal alternativo de SMS y llamadas VoIP de alto volumen con Telnyx.",
    icon: PhoneCall,
    fields: [
      { key: "api_key", label: "API Key", placeholder: "KEY018…", secret: true },
      { key: "messaging_profile_id", label: "Messaging Profile ID", placeholder: "Ej. 4001789a-bc2d-4f3e-8a11-9c5e6f7a8b9d" },
    ],
  },
];

/** Enmascara un secreto para mostrar solo su prefijo: `EAAG••••••••`. */
export function maskSecret(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 4) return "••••••••";
  return `${trimmed.slice(0, 4)}${"•".repeat(Math.max(4, Math.min(12, trimmed.length - 4)))}`;
}
