import "server-only";

import { NextResponse } from "next/server";

export class WebhookHttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "WebhookHttpError";
  }
}

export async function readWebhookBody(request: Request, maxBytes: number): Promise<string> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    throw new WebhookHttpError("Payload demasiado grande.", 413);
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
    throw new WebhookHttpError("Payload demasiado grande.", 413);
  }
  return rawBody;
}

export function parseWebhookJson(rawBody: string): unknown {
  try { return JSON.parse(rawBody) as unknown; }
  catch { throw new WebhookHttpError("JSON no válido.", 400); }
}

export function webhookError(error: unknown, fallback: string): NextResponse {
  if (error instanceof WebhookHttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Tenant webhook failed", error instanceof Error ? error.message : "unknown error");
  return NextResponse.json({ error: fallback }, { status: 500 });
}
