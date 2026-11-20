/** Catálogo de presentación; todas las credenciales se cifran por tenant en el servidor. */
import { Facebook, Instagram, MessageCircle, Music2, Phone, PhoneCall, type LucideIcon } from "lucide-react";
import type { IntegrationProvider } from "@/shared/types/database";

export interface IntegrationFieldSpec {
  key: string; label: string; placeholder: string; secret?: boolean; hint?: string; required?: boolean;
}
export interface IntegrationSpec {
  provider: IntegrationProvider; name: string; description: string; icon: LucideIcon; fields: IntegrationFieldSpec[];
}

export const INTEGRATION_SPECS: IntegrationSpec[] = [
  {
    provider: "whatsapp_cloud_api", name: "WhatsApp Business API", icon: MessageCircle,
    description: "Envía y recibe mensajes de la API oficial de Meta Cloud para la línea de esta empresa.",
    fields: [
      { key: "phone_number_id", label: "Phone Number ID", placeholder: "Ej. 104928374610255" },
      { key: "waba_id", label: "WABA ID", placeholder: "Ej. 1049283746102555" },
      { key: "access_token", label: "Access Token Permanente", placeholder: "EAAG…", secret: true, hint: "Se cifra con AES-256-GCM y nunca vuelve al navegador." },
      { key: "app_secret", label: "App Secret", placeholder: "Secreto de la aplicación de Meta", secret: true },
      { key: "verify_token", label: "Verify Token manual (opcional)", placeholder: "Se autogeneran 32 caracteres si lo dejas vacío", secret: true, required: false },
    ],
  },
  {
    provider: "facebook_lead_ads", name: "Facebook Lead Ads", icon: Facebook,
    description: "Recibe leads de formularios de Facebook en el webhook individual de esta empresa.",
    fields: [
      { key: "ad_account_id", label: "Ad Account ID", placeholder: "Ej. act_784512963" },
      { key: "page_id", label: "Página de Facebook", placeholder: "ID numérico de la página" },
      { key: "access_token", label: "Access Token", placeholder: "EAAG…", secret: true },
      { key: "app_secret", label: "App Secret", placeholder: "Secreto de la aplicación de Meta", secret: true },
      { key: "verify_token", label: "Verify Token manual (opcional)", placeholder: "Se autogenera si lo dejas vacío", secret: true, required: false },
    ],
  },
  {
    provider: "instagram", name: "Instagram", icon: Instagram,
    description: "Recibe leads firmados de la cuenta profesional con atribución aislada por empresa.",
    fields: [
      { key: "ig_user_id", label: "IG User ID", placeholder: "Ej. 17841456321098765" },
      { key: "page_id", label: "Página vinculada", placeholder: "ID numérico de la página de Facebook" },
      { key: "access_token", label: "Access Token", placeholder: "EAAG…", secret: true },
      { key: "app_secret", label: "App Secret", placeholder: "Secreto de la aplicación de Meta", secret: true },
      { key: "verify_token", label: "Verify Token manual (opcional)", placeholder: "Se autogenera si lo dejas vacío", secret: true, required: false },
    ],
  },
  {
    provider: "tiktok_ads", name: "TikTok Ads", icon: Music2,
    description: "Recibe leads firmados de TikTok y conserva su atribución dentro de esta empresa.",
    fields: [
      { key: "advertiser_id", label: "Advertiser ID", placeholder: "Ej. 7123456789012345678" },
      { key: "access_token", label: "Access Token", placeholder: "tltk…", secret: true },
      { key: "webhook_secret", label: "Webhook Access Secret", placeholder: "Secreto para validar X-TikTok-Signature", secret: true },
    ],
  },
  {
    provider: "twilio", name: "Twilio (SMS y voz)", icon: Phone,
    description: "Recibe SMS y eventos validados con el Auth Token exclusivo de esta empresa.",
    fields: [
      { key: "account_sid", label: "Account SID", placeholder: "Ej. AC1a2b3c4d5e6f7g8h9i0j1k2l3" },
      { key: "auth_token", label: "Auth Token", placeholder: "Se guarda cifrado en el servidor", secret: true },
    ],
  },
  {
    provider: "telnyx", name: "Telnyx (SMS y voz)", icon: PhoneCall,
    description: "Recibe mensajes con validación Ed25519 y Messaging Profile propio por empresa.",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "KEY018…", secret: true },
      { key: "messaging_profile_id", label: "Messaging Profile ID", placeholder: "Ej. 4001789a-bc2d-4f3e-8a11-9c5e6f7a8b9d" },
      { key: "public_key", label: "Public Key Ed25519", placeholder: "Clave pública Base64 de Telnyx", secret: true },
    ],
  },
];

export function maskSecret(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 4) return "••••••••";
  return `${trimmed.slice(0, 4)}${"•".repeat(Math.max(4, Math.min(12, trimmed.length - 4)))}`;
}
