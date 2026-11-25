import { describe, expect, it } from "vitest";

import { resolveNotificationTargets, type NotificationMember } from "@/shared/lib/notificationTargets";
import { sanitizeHtmlBlock } from "@/shared/lib/sanitizeHtml";

const team: NotificationMember[] = [
  { id: "m-owner", role: "owner", is_active: true },
  { id: "m-admin", role: "admin", is_active: true },
  { id: "m-admin2", role: "admin", is_active: false },
  { id: "m-agent", role: "agent", is_active: true },
];

describe("notificaciones por rol (Fase 2)", () => {
  it("destinatario explícito: solo ese miembro activo", () => {
    expect(resolveNotificationTargets(team, { recipientMemberId: "m-agent" })).toEqual(["m-agent"]);
  });

  it("destinatario inactivo: no notifica a nadie", () => {
    expect(resolveNotificationTargets(team, { recipientMemberId: "m-admin2" })).toEqual([]);
  });

  it("rol admin: dueño y admins activos (los admins inactivos quedan fuera)", () => {
    expect(resolveNotificationTargets(team, { targetRole: "admin" })).toEqual(["m-owner", "m-admin"]);
  });

  it("rol owner: solo el dueño", () => {
    expect(resolveNotificationTargets(team, { targetRole: "owner" })).toEqual(["m-owner"]);
  });

  it("rol agent: solo agentes activos", () => {
    expect(resolveNotificationTargets(team, { targetRole: "agent" })).toEqual(["m-agent"]);
  });

  it("sin destinatario ni rol: nadie", () => {
    expect(resolveNotificationTargets(team, {})).toEqual([]);
  });
});

describe("sanitizeHtmlBlock — bloques HTML del constructor de formularios", () => {
  it("permite HTML básico de texto", () => {
    expect(sanitizeHtmlBlock("<h3>Título</h3><p>Texto <strong>negrita</strong></p>")).toBe("<h3>Título</h3><p>Texto <strong>negrita</strong></p>");
  });

  it("elimina <script> y su contenido", () => {
    expect(sanitizeHtmlBlock('<p>ok</p><script>alert("xss")</script>')).not.toContain("script");
    expect(sanitizeHtmlBlock('<p>ok</p><script>alert("xss")</script>')).not.toContain("alert");
  });

  it("elimina iframes y objetos embebidos", () => {
    expect(sanitizeHtmlBlock('<iframe src="https://evil.com"></iframe><p>ok</p>')).not.toContain("iframe");
    expect(sanitizeHtmlBlock('<object data="x.swf"></object>')).not.toContain("object");
  });

  it("elimina manejadores de eventos on*", () => {
    expect(sanitizeHtmlBlock('<p onclick="steal()">ok</p>')).not.toContain("onclick");
    expect(sanitizeHtmlBlock('<img src="x" onerror="bad()">')).not.toContain("onerror");
  });

  it("neutraliza href javascript:", () => {
    expect(sanitizeHtmlBlock('<a href="javascript:alert(1)">click</a>')).not.toContain("javascript:");
  });
});
