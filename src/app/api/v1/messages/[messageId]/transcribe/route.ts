import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorStatus, requireUser } from "@/shared/lib/serverAuth";
import { transcribeAudioMessage } from "@/shared/services/audioTranscriptionService";

export const runtime = "nodejs";

/** Transcripción + resumen manual de un audio (botón «Describir audio»). */
export async function POST(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  try {
    const { messageId } = await params;
    if (!z.string().uuid().safeParse(messageId).success) {
      return NextResponse.json({ error: "Identificador de mensaje no válido." }, { status: 400 });
    }
    const { supabase } = await requireUser();
    const { data: message, error } = await supabase.from("messages")
      .select("id,tenant_id,msg_type,audio_transcript").eq("id", messageId).single();
    if (error || !message) {
      return NextResponse.json({ error: "Mensaje no encontrado o sin acceso." }, { status: 404 });
    }
    if (message.msg_type !== "audio") {
      return NextResponse.json({ error: "Este mensaje no es un audio." }, { status: 400 });
    }
    if (message.audio_transcript) {
      return NextResponse.json({ ok: true, transcript: message.audio_transcript, cached: true });
    }
    const result = await transcribeAudioMessage(message.tenant_id, messageId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = authErrorStatus(error);
    return NextResponse.json(
      { error: status === 500 ? (error instanceof Error ? error.message : "No se pudo transcribir el audio.") : "No autorizado." },
      { status: status === 500 ? 502 : status },
    );
  }
}
