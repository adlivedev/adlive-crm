"use client";

/**
 * Sprint 2 — Panel «Probar Bot en Vivo»: mini-chat de prueba que llama al
 * endpoint autenticado POST /api/v1/ai-bots/test. No envía nada a WhatsApp ni
 * crea contactos reales; solo consulta el proveedor configurado con la llave
 * cifrada del vault y muestra la respuesta real del bot.
 */

import { Bot, SendHorizonal, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Modal } from "@/features/contacts/components/Modal";
import { Button } from "@/shared/components/ui/Button";
import { useCrm } from "@/shared/services/crmStore";
import type { AiBot } from "@/shared/types/database";

export interface TestBotModalProps {
  bot: AiBot | null;
  open: boolean;
  onClose: () => void;
}

interface TestChatMessage { role: "user" | "assistant"; content: string; id: string }

export function TestBotModal({ bot, open, onClose }: TestBotModalProps) {
  const { activeTenant } = useCrm();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<TestChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setInput("");
    setError(null);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isSending]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const testMessage = input.trim();
    if (!bot || !activeTenant || !testMessage || isSending) return;
    const userMessage: TestChatMessage = { role: "user", content: testMessage, id: `u-${Date.now()}` };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsSending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/ai-bots/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: activeTenant.id, botId: bot.id, testMessage }),
      });
      const result = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !result.reply) throw new Error(result.error ?? "No se pudo probar el bot.");
      setMessages((current) => [...current, { role: "assistant", content: result.reply ?? "", id: `a-${Date.now()}` }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo probar el bot.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Probar «${bot?.name ?? "bot"}» en vivo`} subtitle="Conversación de prueba: el bot responde con su proveedor real y su entrenamiento actual. Nada se envía a WhatsApp ni se crean contactos.">
      <div className="flex flex-col gap-4">
        <div ref={listRef} className="flex h-72 flex-col gap-3 overflow-y-auto rounded-xl border border-adlive-border bg-adlive-canvas-bg p-4" aria-live="polite" aria-label="Mensajes de la prueba del bot">
          {messages.length === 0 ? (
            <p className="m-auto text-center text-sm text-adlive-text-muted">Escribe abajo el mensaje que haría un cliente y presiona «Enviar prueba» para ver cómo responde el bot.</p>
          ) : null}
          {messages.map((message) => (
            <div key={message.id} className={`flex items-end gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-adlive-primary-light text-adlive-primary"><Bot className="h-4 w-4" aria-hidden /></span> : null}
              <p className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-6 ${message.role === "user" ? "rounded-br-sm bg-adlive-primary text-adlive-text-inverse" : "rounded-bl-sm bg-white text-adlive-text-main"}`}>
                {message.content}
              </p>
              {message.role === "user" ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-adlive-border/60 text-adlive-text-muted"><User className="h-4 w-4" aria-hidden /></span> : null}
            </div>
          ))}
          {isSending ? (
            <div className="flex items-center gap-2 text-sm text-adlive-text-muted">
              <Bot className="h-4 w-4 animate-pulse" aria-hidden /> El bot está escribiendo…
            </div>
          ) : null}
        </div>
        {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-adlive-danger">{error}</p> : null}
        <form onSubmit={(event) => void handleSend(event)} className="flex gap-2">
          <label htmlFor="bot-test-message" className="sr-only">Mensaje de prueba del cliente</label>
          <input
            id="bot-test-message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder='Ej. ¿Cuánto cuesta el plan de 300 megas?'
            maxLength={2000}
            className="h-11 flex-1 rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20"
          />
          <Button type="submit" isLoading={isSending} disabled={input.trim().length === 0}>
            <SendHorizonal className="h-4 w-4" aria-hidden /> Enviar prueba
          </Button>
        </form>
      </div>
    </Modal>
  );
}
