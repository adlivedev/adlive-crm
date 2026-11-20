import "server-only";

import { createTransport } from "nodemailer";

import { resolveTenantBranding } from "@/shared/lib/branding";
import { decryptVaultText } from "@/shared/lib/crypto/vaultCipher";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { TenantBranding } from "@/shared/types/database";

const SMTP_AAD = "platform:smtp";

interface PlatformSmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  encrypted_password: string | null;
  from_name: string;
  from_email: string;
}

interface SendWorkspaceEmailInput {
  tenantId: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}

function brandedHtml(branding: TenantBranding, content: string): string {
  const brandName = escapeHtml(branding.brand_name);
  const color = /^#[0-9a-f]{6}$/i.test(branding.primary_color) ? branding.primary_color : "#4F46E5";
  const logo = branding.logo_url?.startsWith("https://")
    ? `<img src="${escapeHtml(branding.logo_url)}" alt="${brandName}" width="180" style="display:block;max-width:180px;max-height:64px;object-fit:contain;margin:0 auto 20px;" />`
    : "";

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;color:#18181B;">
    <div style="display:none;max-height:0;overflow:hidden;">Mensaje de ${brandName}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F4F6;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">
          <tr><td style="height:5px;background:${color};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="padding:32px;text-align:center;">${logo}<h1 style="margin:0;color:${color};font-size:22px;line-height:1.3;">${brandName}</h1></td></tr>
          <tr><td style="padding:0 32px 32px;font-size:15px;line-height:1.65;text-align:left;">${content}</td></tr>
          <tr><td style="padding:20px 32px;background:#F9FAFB;color:#6B7280;font-size:12px;text-align:center;">Este correo fue enviado desde el workspace ${brandName}.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Envía correo marca blanca; nunca expone la configuración o clave al cliente. */
export async function sendWorkspaceEmail(input: SendWorkspaceEmailInput): Promise<void> {
  const admin = createAdminClient();
  const [smtpResult, tenantResult] = await Promise.all([
    admin.from("platform_smtp_settings")
      .select("host,port,secure,username,encrypted_password,from_name,from_email")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("tenants").select("name,branding").eq("id", input.tenantId).maybeSingle(),
  ]);

  if (smtpResult.error || !smtpResult.data) throw new Error("SMTP global no configurado o inactivo.");
  if (tenantResult.error || !tenantResult.data) throw new Error("Workspace de marca no encontrado.");
  const settings = smtpResult.data as PlatformSmtpSettings;
  if (!settings.encrypted_password) throw new Error("SMTP global sin contraseña configurada.");

  const password = decryptVaultText(settings.encrypted_password, SMTP_AAD);
  const transporter = createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.username, pass: password },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    tls: { minVersion: "TLSv1.2" },
  });
  const branding = resolveTenantBranding(tenantResult.data);

  await transporter.sendMail({
    from: { name: settings.from_name, address: settings.from_email },
    to: input.to,
    replyTo: input.replyTo,
    subject: input.subject,
    html: brandedHtml(branding, input.html),
    text: input.text ?? input.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
  });
}
