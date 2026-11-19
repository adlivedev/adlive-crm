import { NextResponse } from "next/server";
import { z } from "zod";

import { downloadMetaMedia } from "@/shared/lib/metaWhatsAppClient";
import { authErrorStatus, requireUser } from "@/shared/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrega multimedia entrante de WhatsApp (audios, imágenes, videos, documentos).
 * El acceso se valida con la sesión del usuario y las políticas RLS de messages;
 * el token de Meta nunca sale del servidor.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  try {
    const { messageId } = await params;
    if (!z.string().uuid().safeParse(messageId).success) {
      return NextResponse.json({ error: "Identificador de mensaje no válido." }, { status: 400 });
    }
    const { supabase } = await requireUser();
    const { data: message, error } = await supabase.from("messages")
      .select("id,tenant_id,media_id,media_mime_type").eq("id", messageId).single();
    if (error || !message) {
      return NextResponse.json({ error: "Mensaje no encontrado o sin acceso." }, { status: 404 });
    }
    if (!message.media_id) {
      return NextResponse.json({ error: "Este mensaje no tiene multimedia disponible." }, { status: 404 });
    }

    const upstream = await downloadMetaMedia(message.tenant_id, message.media_id);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Meta no pudo entregar el archivo." }, { status: 502 });
    }
    const contentType = message.media_mime_type ?? upstream.headers.get("content-type") ?? "application/octet-stream";
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json(
      { error: status === 500 ? "No se pudo descargar el archivo." : "No autorizado." },
      { status: status === 500 ? 502 : status },
    );
  }
}
