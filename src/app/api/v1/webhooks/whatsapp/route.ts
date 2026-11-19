import { after, NextResponse } from "next/server";

import { isValidMetaSignature, safeEqualSecret } from "@/shared/lib/metaWebhookSecurity";
import { processAiBotReply } from "@/shared/services/aiBotService";
import { ingestWhatsAppPayload, whatsappPayloadSchema } from "@/shared/services/whatsappWebhookService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_000_000;

export async function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) return NextResponse.json({ error: "Webhook no configurado." }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || !token || !challenge || !safeEqualSecret(token, verifyToken)) {
    return NextResponse.json({ error: "Verificación no válida." }, { status: 403 });
  }
  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!process.env.META_APP_SECRET) {
    return NextResponse.json({ error: "Webhook no configurado." }, { status: 503 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
  }
  if (!isValidMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET)) {
    return NextResponse.json({ error: "Firma no válida." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON no válido." }, { status: 400 });
  }

  const parsed = whatsappPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload de WhatsApp no válido." }, { status: 400 });
  }

  try {
    const { insertedWaMessageIds, ...result } = await ingestWhatsAppPayload(parsed.data);
    after(async () => {
      for (const waMessageId of insertedWaMessageIds) {
        try {
          await processAiBotReply(waMessageId);
        } catch (error) {
          console.error("WhatsApp AI reply failed", error instanceof Error ? error.message : "unknown error");
        }
      }
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("WhatsApp webhook ingestion failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "No se pudo procesar el mensaje." }, { status: 500 });
  }
}
