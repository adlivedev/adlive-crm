import { NextResponse } from "next/server";
import { z } from "zod";

import { checkServerRateLimit, clientIp } from "@/shared/lib/rateLimit";
import {
  ingestTenantWebLead,
  InvalidPublicWebhookTokenError,
  tenantLeadWebPayloadSchema,
} from "@/shared/services/leadWebhookService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256_000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
  "Vary": "Origin",
};

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

type RouteContext = { params: Promise<{ tenantId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const tenantId = z.string().uuid().safeParse((await context.params).tenantId);
  if (!tenantId.success) return json({ error: "Workspace inválido." }, 400);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "Payload demasiado grande." }, 413);

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return json({ error: "Payload demasiado grande." }, 413);
  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return json({ error: "JSON no válido." }, 400);
  }

  const parsed = tenantLeadWebPayloadSchema.safeParse(input);
  if (!parsed.success) return json({ error: "Payload no válido.", fields: parsed.error.flatten().fieldErrors }, 400);

  /* QA-NEW-004: máx. 10 envíos por minuto por IP + workspace. */
  const retryAfter = await checkServerRateLimit(`leadweb:${clientIp(request)}:${tenantId.data}`, 10, 60);
  if (retryAfter !== null) {
    return NextResponse.json({ error: "Demasiados envíos. Inténtalo de nuevo en un minuto." }, { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(retryAfter) } });
  }

  try {
    const result = await ingestTenantWebLead(tenantId.data, parsed.data);
    return json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof InvalidPublicWebhookTokenError) return json({ error: "Token no válido." }, 401);
    console.error("Tenant lead web ingestion failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "No se pudo procesar el lead." }, 500);
  }
}
