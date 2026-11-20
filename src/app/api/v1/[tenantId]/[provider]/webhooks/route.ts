import { NextResponse } from "next/server";
import { z } from "zod";

import { handleProviderPost } from "@/shared/services/providerWebhookService";
import { getTenantIntegration, WEBHOOK_VAULT_PROVIDERS, webhookProviderSchema } from "@/shared/services/tenantIntegrationService";
import { webhookError, WebhookHttpError } from "@/shared/services/webhookHttp";
import { handleWhatsAppPost, verifyWhatsAppChallenge } from "@/shared/services/whatsappTenantWebhookHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tenantId: string; provider: string }> };

async function resolve(context: RouteContext) {
  const { tenantId: rawTenantId, provider: rawProvider } = await context.params;
  const tenantId = z.string().uuid().safeParse(rawTenantId);
  const provider = webhookProviderSchema.safeParse(rawProvider);
  if (!tenantId.success || !provider.success) throw new WebhookHttpError("Webhook no encontrado.", 404);
  const integration = await getTenantIntegration(tenantId.data, WEBHOOK_VAULT_PROVIDERS[provider.data]);
  if (!integration) throw new WebhookHttpError("Integración no conectada para este workspace.", 404);
  return { integration, provider: provider.data };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { integration, provider } = await resolve(context);
    if (!["whatsapp", "facebook-leads", "instagram"].includes(provider)) {
      return NextResponse.json({ error: "Método no permitido para este proveedor." }, { status: 405 });
    }
    return await verifyWhatsAppChallenge(request, integration);
  } catch (error) {
    return webhookError(error, "No se pudo verificar el webhook.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { integration, provider } = await resolve(context);
    if (provider === "whatsapp") return await handleWhatsAppPost(request, integration);
    return await handleProviderPost(request, integration, provider);
  } catch (error) {
    return webhookError(error, "No se pudo procesar el webhook del proveedor.");
  }
}
