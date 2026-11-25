"use client";

/**
 * Campana de notificaciones del workspace: contador de no leídas, popover con
 * navegación directa al destino, suscripción Realtime y sonido sutil
 * (Web Audio API) con opción de silenciar.
 */

import { Bell, BellOff, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { createClient, isSupabaseBrowserConfigured } from "@/shared/lib/supabase/client";
import { useCrm } from "@/shared/services/crmStore";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  action_url: string;
  is_read: boolean;
  created_at: string;
}

/** Campanita sutil sintetizada (sin archivos externos). */
function playBellSound() {
  try {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.9);
    gain.connect(context.destination);
    for (const [frequency, delay] of [[880, 0], [1174.7, 0.15]] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.5);
    }
  } catch { /* sonido opcional */ }
}

export function NotificationBell() {
  const router = useRouter();
  const { activeTenant, activeMember } = useCrm();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const load = useCallback(async () => {
    if (!activeTenant || !activeMember || !isSupabaseBrowserConfigured()) return;
    const { data } = await createClient().from("notifications")
      .select("id,type,title,body,action_url,is_read,created_at")
      .eq("tenant_id", activeTenant.id)
      .or(`recipient_member_id.eq.${activeMember.id},target_role.eq.${activeMember.role}`)
      .order("created_at", { ascending: false })
      .limit(15);
    setRows((data ?? []) as NotificationRow[]);
  }, [activeTenant, activeMember]);

  useEffect(() => { void load(); }, [load]);

  /* Realtime: nueva notificación → recargar + campanita. */
  useEffect(() => {
    if (!activeTenant || !activeMember || !isSupabaseBrowserConfigured()) return;
    const channel = createClient().channel(`notifications:${activeMember.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `tenant_id=eq.${activeTenant.id}` },
        (payload) => {
          const row = payload.new as { recipient_member_id?: string | null; target_role?: string | null };
          if (row.recipient_member_id && row.recipient_member_id !== activeMember.id) return;
          if (!row.recipient_member_id && row.target_role && row.target_role !== activeMember.role) return;
          if (!mutedRef.current) playBellSound();
          void load();
        })
      .subscribe();
    return () => { void createClient().removeChannel(channel); };
  }, [activeTenant, activeMember, load]);

  const unread = rows.filter((row) => !row.is_read).length;

  const openNotification = async (row: NotificationRow) => {
    if (!row.is_read) {
      await createClient().from("notifications").update({ is_read: true }).eq("id", row.id);
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, is_read: true } : item)));
    }
    setOpen(false);
    router.push(row.action_url);
  };

  const markAllRead = async () => {
    const unreadIds = rows.filter((row) => !row.is_read).map((row) => row.id);
    if (unreadIds.length === 0) return;
    await createClient().from("notifications").update({ is_read: true }).in("id", unreadIds);
    setRows((current) => current.map((row) => ({ ...row, is_read: true })));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-adlive-text-muted transition-colors hover:bg-adlive-canvas-bg hover:text-adlive-primary"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-adlive-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-adlive-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-adlive-border px-3 py-2.5">
            <p className="text-sm font-bold text-adlive-text-main">Notificaciones</p>
            <span className="flex items-center gap-1">
              <button type="button" onClick={markAllRead} aria-label="Marcar todas como leídas" title="Marcar todas como leídas" className="cursor-pointer rounded-lg p-1.5 text-adlive-text-muted hover:text-adlive-primary">
                <CheckCheck className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                aria-pressed={muted}
                aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
                title={muted ? "Activar sonido" : "Silenciar sonido"}
                className="cursor-pointer rounded-lg p-1.5 text-adlive-text-muted hover:text-adlive-primary"
              >
                {muted ? <BellOff className="h-4 w-4" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
              </button>
            </span>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {rows.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-adlive-text-muted">No hay notificaciones todavía.</li>
            ) : (
              rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void openNotification(row)}
                    className={`flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-adlive-canvas-bg/70 ${row.is_read ? "opacity-60" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      {!row.is_read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-adlive-primary" aria-hidden /> : null}
                      <span className="truncate text-xs font-bold text-adlive-text-main">{row.title}</span>
                    </span>
                    <span className="line-clamp-2 text-[11px] text-adlive-text-muted">{row.body}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
