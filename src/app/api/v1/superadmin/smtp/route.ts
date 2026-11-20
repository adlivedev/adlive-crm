import { NextResponse } from "next/server";
import { z } from "zod";

import { encryptVaultText } from "@/shared/lib/crypto/vaultCipher";
import { sendWorkspaceEmail } from "@/shared/lib/mail/smtpMailer";
import { authErrorStatus, requirePlatformSuperadmin } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";

const SMTP_AAD = "platform:smtp";
const PUBLIC_COLUMNS = "id,host,port,secure,username,from_name,from_email,is_active,updated_at";

const smtpSchema = z.object({
  action: z.enum(["save", "testEmail"]).default("save"),
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().min(1).max(255),
  password: z.string().max(512).optional(),
  from_name: z.string().trim().min(2).max(150),
  from_email: z.string().trim().toLowerCase().email().max(255),
  is_active: z.boolean().default(true),
  test_email: z.string().trim().toLowerCase().email().max(255).optional(),
});

interface SmtpSettingsRow {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  encrypted_password: string | null;
  from_name: string;
  from_email: string;
  is_active: boolean;
  updated_at: string;
}

function publicSettings(settings: SmtpSettingsRow) {
  return {
    id: settings.id,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    username: settings.username,
    from_name: settings.from_name,
    from_email: settings.from_email,
    is_active: settings.is_active,
    updated_at: settings.updated_at,
    has_password: Boolean(settings.encrypted_password),
  };
}

export async function GET() {
  try {
    await requirePlatformSuperadmin();
    const admin = createAdminClient();
    const { data, error } = await admin.from("platform_smtp_settings")
      .select(`${PUBLIC_COLUMNS},encrypted_password`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "No se pudo cargar la configuración SMTP." }, { status: 500 });
    return NextResponse.json(
      { settings: data ? publicSettings(data as SmtpSettingsRow) : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo cargar la configuración SMTP." : "No autorizado." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requirePlatformSuperadmin();
    const parsed = smtpSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Revisa los campos SMTP y el puerto.", issues: parsed.error.flatten() }, { status: 400 });
    }
    const input = parsed.data;
    const admin = createAdminClient();
    const existingResult = await admin.from("platform_smtp_settings")
      .select("id,encrypted_password")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingResult.error) return NextResponse.json({ error: "No se pudo leer la configuración anterior." }, { status: 500 });

    const encryptedPassword = input.password
      ? encryptVaultText(input.password, SMTP_AAD)
      : existingResult.data?.encrypted_password ?? null;
    if (!encryptedPassword) {
      return NextResponse.json({ error: "Ingresa la contraseña SMTP para guardar la configuración." }, { status: 400 });
    }

    const values = {
      host: input.host,
      port: input.port,
      secure: input.secure,
      username: input.username,
      encrypted_password: encryptedPassword,
      from_name: input.from_name,
      from_email: input.from_email,
      is_active: input.is_active,
    };
    const query = existingResult.data?.id
      ? admin.from("platform_smtp_settings").update(values).eq("id", existingResult.data.id)
      : admin.from("platform_smtp_settings").insert(values);
    const { data, error } = await query.select(`${PUBLIC_COLUMNS},encrypted_password`).single();
    if (error || !data) return NextResponse.json({ error: "No se pudo guardar la configuración SMTP." }, { status: 500 });
    const settings = data as SmtpSettingsRow;

    if (input.action === "testEmail") {
      const recipient = input.test_email ?? user.email?.toLowerCase();
      if (!recipient) return NextResponse.json({ error: "Indica un correo de destino para la prueba." }, { status: 400 });
      const tenantResult = await admin.from("tenants").select("id").eq("slug", "adlive").maybeSingle();
      if (tenantResult.error || !tenantResult.data) {
        return NextResponse.json({ error: "La configuración se guardó, pero no se encontró el workspace ADlive para la prueba." }, { status: 500 });
      }
      try {
        await sendWorkspaceEmail({
          tenantId: tenantResult.data.id,
          to: recipient,
          subject: "Prueba de SMTP global · ADlive",
          html: "<p>La configuración SMTP global se guardó y este correo confirma una conexión de envío real.</p><p>Puedes usar este remitente para invitaciones y comunicaciones marca blanca.</p>",
          text: "La configuración SMTP global se guardó y este correo confirma una conexión de envío real.",
        });
      } catch {
        return NextResponse.json({ error: "La configuración se guardó, pero el envío de prueba falló. Revisa host, puerto, cifrado y credenciales." }, { status: 502 });
      }
    }

    return NextResponse.json({
      settings: publicSettings(settings),
      tested: input.action === "testEmail",
      message: input.action === "testEmail" ? "Configuración guardada y correo de prueba enviado." : "Configuración SMTP guardada.",
    });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo procesar la configuración SMTP." : "No autorizado." }, { status });
  }
}
