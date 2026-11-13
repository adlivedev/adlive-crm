import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { ingestWhatsAppPayload, whatsappPayloadSchema } from "@/shared/services/whatsappWebhookService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_000_000;

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function validMetaSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  return safeEqual(signature, expected);
}

export async function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) return NextResponse.json({ error: "Webhook no configurado." }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || !token || !challenge || !safeEqual(token, verifyToken)) {
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
  if (!validMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
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
    const result = await ingestWhatsAppPayload(parsed.data);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("WhatsApp webhook ingestion failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "No se pudo procesar el mensaje." }, { status: 500 });
  }
}
