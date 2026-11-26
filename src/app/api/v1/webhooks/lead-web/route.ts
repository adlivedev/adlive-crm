import { NextResponse } from "next/server";

import { checkServerRateLimit, clientIp } from "@/shared/lib/rateLimit";
import {
  ingestLeadWebPayload,
  InvalidPublicWebhookTokenError,
  leadWebPayloadSchema,
} from "@/shared/services/leadWebhookService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256_000;

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const allowed = (process.env.ALLOWED_WEBHOOK_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigin(origin);
  if (!allowed) return { "Cache-Control": "no-store" };
  return {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigin(origin)) {
    return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigin(origin)) {
    return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413, headers: corsHeaders(origin) });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413, headers: corsHeaders(origin) });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON no válido." }, { status: 400, headers: corsHeaders(origin) });
  }

  const parsed = leadWebPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload no válido.", fields: parsed.error.flatten().fieldErrors },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  /* QA-NEW-004: máx. 10 envíos por minuto por IP (el workspace se resuelve
     internamente por token en esta ruta genérica). */
  const retryAfter = await checkServerRateLimit(`leadweb:${clientIp(request)}:global`, 10, 60);
  if (retryAfter !== null) {
    return NextResponse.json({ error: "Demasiados envíos. Inténtalo de nuevo en un minuto." }, { status: 429, headers: { ...corsHeaders(origin), "Retry-After": String(retryAfter) } });
  }

  try {
    const result = await ingestLeadWebPayload(parsed.data);
    return NextResponse.json({ ok: true, ...result }, { status: 200, headers: corsHeaders(origin) });
  } catch (error) {
    if (error instanceof InvalidPublicWebhookTokenError) {
      return NextResponse.json({ error: "Token no válido." }, { status: 401, headers: corsHeaders(origin) });
    }
    console.error("Lead web ingestion failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "No se pudo procesar el lead." }, { status: 500, headers: corsHeaders(origin) });
  }
}
