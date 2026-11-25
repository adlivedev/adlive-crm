import { NextResponse } from "next/server";
import { z } from "zod";

import { downloadMetaMedia } from "@/shared/lib/metaWhatsAppClient";
import { authErrorStatus, requireUser } from "@/shared/lib/serverAuth";
import { createAdminClient } from "@/shared/lib/supabase/admin";

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
      .select("id,tenant_id,media_id,media_mime_type,media_deleted_at").eq("id", messageId).single();
    if (error || !message) {
      return NextResponse.json({ error: "Mensaje no encontrado o sin acceso." }, { status: 404 });
    }
    if (message.media_deleted_at) {
      return NextResponse.json({ error: "Archivo eliminado por moderación." }, { status: 410 });
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

/** Extrae la ruta dentro del bucket a partir de una URL pública de Supabase Storage. */
function bucketPathFromUrl(mediaUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const index = mediaUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(mediaUrl.slice(index + marker.length));
}

/**
 * Moderación: elimina físicamente el archivo del bucket (si vive en nuestro
 * Storage) y marca el mensaje como eliminado. Solo owner/admin del tenant o
 * superadmin. La vista del chat muestra «Archivo eliminado por moderación».
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  try {
    const { messageId } = await params;
    if (!z.string().uuid().safeParse(messageId).success) {
      return NextResponse.json({ error: "Identificador de mensaje no válido." }, { status: 400 });
    }
    const { supabase, user } = await requireUser();
    const { data: message, error } = await supabase.from("messages")
      .select("id,tenant_id,media_url,media_deleted_at").eq("id", messageId).single();
    if (error || !message) {
      return NextResponse.json({ error: "Mensaje no encontrado o sin acceso." }, { status: 404 });
    }
    if (message.media_deleted_at) {
      return NextResponse.json({ ok: true, alreadyDeleted: true });
    }

    const { data: member } = await supabase.from("tenant_members")
      .select("id,role").eq("tenant_id", message.tenant_id).eq("user_id", user.id).eq("is_active", true).single();
    const isAdmin = member?.role === "owner" || member?.role === "admin";
    const { data: platformAdmin } = await supabase.rpc("is_platform_superadmin");
    if (!isAdmin && !platformAdmin) {
      return NextResponse.json({ error: "Solo un administrador del workspace puede eliminar archivos." }, { status: 403 });
    }

    const admin = createAdminClient();
    const path = message.media_url ? bucketPathFromUrl(message.media_url, "chat-media") : null;
    if (path) {
      const { error: storageError } = await admin.storage.from("chat-media").remove([path]);
      if (storageError) {
        return NextResponse.json({ error: `No se pudo eliminar del Storage: ${storageError.message}` }, { status: 502 });
      }
    }
    const { error: updateError } = await admin.from("messages")
      .update({ media_deleted_at: new Date().toISOString(), media_url: null })
      .eq("id", messageId).eq("tenant_id", message.tenant_id);
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ ok: true, removedFromStorage: Boolean(path) });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json(
      { error: status === 500 ? "No se pudo eliminar el archivo." : "No autorizado." },
      { status: status === 500 ? 502 : status },
    );
  }
}
