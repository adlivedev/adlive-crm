/**
 * MOCK — Workflows visuales (M6) e inscripciones con logs de ejecución.
 * Etapa A: los 3 flujos iniciales del sistema (difusión 28092026, prueba y
 * reparto de nuevo lead) con su lienzo de nodos y ramas condicionales.
 */

import type { Workflow, WorkflowEnrollment } from "@/shared/types/database";

export const mockWorkflows: Workflow[] = [
  {
    id: "wf-mj-28092026", tenant_id: "t-movistar-juancho",
    name: "28092026",
    description:
      "Difusión plantilla 28092026 (oferta Movistar): 'Si' marca seguimiento, mueve a Interesado y asigna round robin entre agentes. 'No' mueve a Perdido.",
    status: "Published", trigger_type: "manual_enrollment", allow_reenrollment: false,
    canvas_definition: {
      nodes: [
        { id: "n1", type: "trigger", label: "Inscripción manual", config: { origen: "Inscripción manual desde Contactos" }, position: { x: 0, y: 0 } },
        { id: "n2", type: "action", label: "Enviar WhatsApp", config: { template: "05112026", nota: "con variables" }, position: { x: 0, y: 150 } },
        { id: "n3", type: "branch", label: "Respuesta del cliente", config: { opciones: "Si,No,Otra respuesta,Undelivered,Time Out" }, position: { x: 0, y: 300 } },
        { id: "n4", type: "action", label: "Marcar en seguimiento", config: {}, position: { x: -280, y: 450 } },
        { id: "n5", type: "action", label: "Mover a Interesado", config: { stage_id: "st-mj-interesado" }, position: { x: -280, y: 600 } },
        { id: "n6", type: "action", label: "Asignar a un miembro (Round robin)", config: { modo: "round_robin" }, position: { x: -280, y: 750 } },
        { id: "n7", type: "action", label: "Mover a Perdido", config: { stage_id: "st-mj-perdido" }, position: { x: 0, y: 450 } },
        { id: "n8", type: "action", label: "Asignar a un miembro (Round robin entre 5 agentes)", config: { modo: "round_robin", agentes: "5" }, position: { x: 280, y: 450 } },
      ],
      edges: [
        { id: "e1", source_node_id: "n1", target_node_id: "n2", label: null },
        { id: "e2", source_node_id: "n2", target_node_id: "n3", label: null },
        { id: "e3", source_node_id: "n3", target_node_id: "n4", label: "Si" },
        { id: "e4", source_node_id: "n4", target_node_id: "n5", label: null },
        { id: "e5", source_node_id: "n5", target_node_id: "n6", label: null },
        { id: "e6", source_node_id: "n3", target_node_id: "n7", label: "No" },
        { id: "e7", source_node_id: "n3", target_node_id: "n8", label: "Otra respuesta" },
      ],
    },
    enrolled_count: 24327, active_count: 0,
    updated_at: "2026-11-11T18:20:00-05:00", created_at: "2026-09-28T09:00:00-05:00",
  },
  {
    id: "wf-mj-prueba", tenant_id: "t-movistar-juancho",
    name: "prueba",
    description: null,
    status: "Draft", trigger_type: "contact_created", allow_reenrollment: false,
    canvas_definition: {
      nodes: [
        { id: "n1", type: "trigger", label: "Contacto creado", config: { origen: "Se dispara al crear un contacto" }, position: { x: 0, y: 0 } },
        { id: "n2", type: "action", label: "Enviar WhatsApp", config: { template: "bienvenida_lead", nota: "con variables" }, position: { x: 0, y: 150 } },
      ],
      edges: [{ id: "e1", source_node_id: "n1", target_node_id: "n2", label: null }],
    },
    enrolled_count: 0, active_count: 0,
    updated_at: "2026-11-11T10:05:00-05:00", created_at: "2026-11-10T16:30:00-05:00",
  },
  {
    id: "wf-mj-reparto", tenant_id: "t-movistar-juancho",
    name: "Nuevo lead (reparto)",
    description:
      "El reparto, la oportunidad de nuevo lead y la estrella de seguimiento corren automáticamente (en el servidor, al llegar el primer mensaje): se envía la bienvenida y se reparte entre los agentes activos.",
    status: "Published", trigger_type: "channel_message_received", allow_reenrollment: false,
    canvas_definition: {
      nodes: [
        { id: "n1", type: "trigger", label: "Mensaje recibido en un canal", config: { canal: "WhatsApp", origen: "Se dispara al llegar el primer mensaje del lead" }, position: { x: 0, y: 0 } },
        { id: "n2", type: "action", label: "Enviar WhatsApp", config: { template: "bienvenida_lead", nota: "con variables" }, position: { x: 0, y: 150 } },
        { id: "n3", type: "action", label: "Crear oportunidad (Nuevo Lead)", config: { stage_id: "st-mj-nuevo" }, position: { x: 0, y: 300 } },
        { id: "n4", type: "action", label: "Marcar en seguimiento", config: {}, position: { x: 0, y: 450 } },
        { id: "n5", type: "action", label: "Asignar a un miembro (Round robin entre 5 agentes)", config: { modo: "round_robin", agentes: "5" }, position: { x: 0, y: 600 } },
      ],
      edges: [
        { id: "e1", source_node_id: "n1", target_node_id: "n2", label: null },
        { id: "e2", source_node_id: "n2", target_node_id: "n3", label: null },
        { id: "e3", source_node_id: "n3", target_node_id: "n4", label: null },
        { id: "e4", source_node_id: "n4", target_node_id: "n5", label: null },
      ],
    },
    enrolled_count: 2187, active_count: 43,
    updated_at: "2026-11-12T15:10:00-05:00", created_at: "2026-05-15T09:00:00-05:00",
  },
];

/** Inscripciones previas con trazabilidad paso a paso (M6, pestañas 3 y 4). */
export const mockWorkflowEnrollments: WorkflowEnrollment[] = [
  {
    id: "we-mj-001", tenant_id: "t-movistar-juancho", workflow_id: "wf-mj-28092026",
    contact_id: "c-mj-001", current_node_id: "n6", status: "completed", wait_expires_at: null,
    execution_logs: [
      { node_id: "n1", node_label: "Inscripción manual", executed_at: "2026-11-11T09:12:00-05:00", outcome: "success", detail: "Contacto inscrito manualmente desde Contactos." },
      { node_id: "n2", node_label: "Enviar WhatsApp", executed_at: "2026-11-11T09:12:04-05:00", outcome: "success", detail: "Plantilla \"05112026\" enviada por WhatsApp." },
      { node_id: "n3", node_label: "Respuesta del cliente", executed_at: "2026-11-11T11:40:00-05:00", outcome: "success", detail: "Respuesta recibida: \"Sí\"." },
      { node_id: "n4", node_label: "Marcar en seguimiento", executed_at: "2026-11-11T11:40:02-05:00", outcome: "success", detail: "Contacto marcado con ⭐ seguimiento." },
      { node_id: "n5", node_label: "Mover a Interesado", executed_at: "2026-11-11T11:40:03-05:00", outcome: "success", detail: "Oportunidad movida a la etapa «Interesado»." },
      { node_id: "n6", node_label: "Asignar a un miembro (Round robin)", executed_at: "2026-11-11T11:40:04-05:00", outcome: "success", detail: "Reparto Round Robin → sara.gomez@adlive.co." },
    ],
    enrolled_at: "2026-11-11T09:12:00-05:00", completed_at: "2026-11-11T11:40:04-05:00",
  },
  {
    id: "we-mj-002", tenant_id: "t-movistar-juancho", workflow_id: "wf-mj-28092026",
    contact_id: "c-mj-002", current_node_id: "n3", status: "waiting_reply", wait_expires_at: "2026-11-12T23:59:00-05:00",
    execution_logs: [
      { node_id: "n1", node_label: "Inscripción manual", executed_at: "2026-11-12T08:05:00-05:00", outcome: "success", detail: "Contacto inscrito manualmente desde Contactos." },
      { node_id: "n2", node_label: "Enviar WhatsApp", executed_at: "2026-11-12T08:05:03-05:00", outcome: "success", detail: "Plantilla \"05112026\" enviada por WhatsApp." },
      { node_id: "n3", node_label: "Respuesta del cliente", executed_at: "2026-11-12T08:05:04-05:00", outcome: "skipped", detail: "Esperando respuesta del contacto (Time Out: 24 h)." },
    ],
    enrolled_at: "2026-11-12T08:05:00-05:00", completed_at: null,
  },
  {
    id: "we-mj-003", tenant_id: "t-movistar-juancho", workflow_id: "wf-mj-28092026",
    contact_id: "c-mj-003", current_node_id: "n7", status: "completed", wait_expires_at: null,
    execution_logs: [
      { node_id: "n1", node_label: "Inscripción manual", executed_at: "2026-11-10T15:20:00-05:00", outcome: "success", detail: "Contacto inscrito manualmente desde Contactos." },
      { node_id: "n2", node_label: "Enviar WhatsApp", executed_at: "2026-11-10T15:20:05-05:00", outcome: "success", detail: "Plantilla \"05112026\" enviada por WhatsApp." },
      { node_id: "n3", node_label: "Respuesta del cliente", executed_at: "2026-11-10T17:02:00-05:00", outcome: "success", detail: "Respuesta recibida: \"No\"." },
      { node_id: "n7", node_label: "Mover a Perdido", executed_at: "2026-11-10T17:02:02-05:00", outcome: "success", detail: "Oportunidad movida a la etapa «Perdido»." },
    ],
    enrolled_at: "2026-11-10T15:20:00-05:00", completed_at: "2026-11-10T17:02:02-05:00",
  },
  {
    id: "we-mj-004", tenant_id: "t-movistar-juancho", workflow_id: "wf-mj-reparto",
    contact_id: "c-mj-016", current_node_id: "n5", status: "active", wait_expires_at: null,
    execution_logs: [
      { node_id: "n1", node_label: "Mensaje recibido en un canal", executed_at: "2026-11-12T14:31:00-05:00", outcome: "success", detail: "Primer mensaje recibido por WhatsApp." },
      { node_id: "n2", node_label: "Enviar WhatsApp", executed_at: "2026-11-12T14:31:03-05:00", outcome: "success", detail: "Plantilla \"bienvenida_lead\" enviada por WhatsApp." },
      { node_id: "n3", node_label: "Crear oportunidad (Nuevo Lead)", executed_at: "2026-11-12T14:31:04-05:00", outcome: "success", detail: "Oportunidad creada en la etapa «Nuevo Lead»." },
      { node_id: "n4", node_label: "Marcar en seguimiento", executed_at: "2026-11-12T14:31:05-05:00", outcome: "success", detail: "Contacto marcado con ⭐ seguimiento." },
      { node_id: "n5", node_label: "Asignar a un miembro (Round robin entre 5 agentes)", executed_at: "2026-11-12T14:31:06-05:00", outcome: "success", detail: "Reparto Round Robin → carlos.ruiz@adlive.co." },
    ],
    enrolled_at: "2026-11-12T14:31:00-05:00", completed_at: null,
  },
  {
    id: "we-mj-005", tenant_id: "t-movistar-juancho", workflow_id: "wf-mj-reparto",
    contact_id: "c-mj-017", current_node_id: "n5", status: "completed", wait_expires_at: null,
    execution_logs: [
      { node_id: "n1", node_label: "Mensaje recibido en un canal", executed_at: "2026-11-11T19:45:00-05:00", outcome: "success", detail: "Primer mensaje recibido por WhatsApp." },
      { node_id: "n2", node_label: "Enviar WhatsApp", executed_at: "2026-11-11T19:45:02-05:00", outcome: "success", detail: "Plantilla \"bienvenida_lead\" enviada por WhatsApp." },
      { node_id: "n3", node_label: "Crear oportunidad (Nuevo Lead)", executed_at: "2026-11-11T19:45:03-05:00", outcome: "success", detail: "Oportunidad creada en la etapa «Nuevo Lead»." },
      { node_id: "n4", node_label: "Marcar en seguimiento", executed_at: "2026-11-11T19:45:04-05:00", outcome: "success", detail: "Contacto marcado con ⭐ seguimiento." },
      { node_id: "n5", node_label: "Asignar a un miembro (Round robin entre 5 agentes)", executed_at: "2026-11-11T19:45:05-05:00", outcome: "success", detail: "Reparto Round Robin → matagui0807@gmail.com." },
    ],
    enrolled_at: "2026-11-11T19:45:00-05:00", completed_at: "2026-11-11T19:45:05-05:00",
  },
];
