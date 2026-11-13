---

### ARCHIVO 4: `context/04-reglas-seguridad-iso-velocidad.md`

```markdown
# 04. REGLAS DE SEGURIDAD (ISO/IEC 27001 + OWASP), PRIVACIDAD Y VELOCIDAD DE CARGA

## 1. CUMPLIMIENTO ESTRICTO ISO/IEC 27001 (A.8.28 SECURE CODING) Y OWASP
1. **Cero Credenciales Públicas (ISO 27001 A.8.12):**
   - Prohibido exponer tokens de WhatsApp Cloud API, Meta App Secret, claves de OpenAI/Claude/Gemini/Grok o `SUPABASE_SERVICE_ROLE_KEY` en variables `NEXT_PUBLIC_` o en el código cliente.
   - En la vista `/bots-ia` e `/integraciones`, los inputs de API Keys deben ser de tipo `password`, enviarse por Server Action / Route Handler seguro, cifrarse con **AES-256-GCM** y jamás devolverse en texto plano al navegador.
2. **Validación Estricta de Frontera con Zod (Prevención de Inyecciones y XSS):**
   - Todo formulario, filtro de URL, archivo CSV importado y payload de Webhook debe validarse con esquemas **Zod** antes de procesarse.
   - El contenido de los mensajes de chat y notas internas debe renderizarse escapado de forma nativa en React (prohibido usar `dangerouslySetInnerHTML`).
3. **Control de Acceso Basado en Roles (RBAC) y Visibilidad de Agentes:**
   - Rol `owner` y `admin`: acceso total a todos los módulos de la agencia.
   - Rol `agent`: si su flag `can_view_all_contacts` es `false`, solo puede visualizar y operar sobre los contactos, oportunidades y conversaciones donde `assigned_member_id` coincida con su ID.
4. **Cabeceras de Seguridad HTTP (`next.config.ts`):**
   - Incluir obligatoriamente `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` y `Strict-Transport-Security`.

## 2. PRIVACIDAD Y PROTECCIÓN DE DATOS (ISO/IEC 27701 & LEY 1581 HABEAS DATA COLOMBIA)
1. **Respeto Automático de Opt-Out ("No recibir más mensajes"):**
   - Las plantillas de portabilidad incluyen la cláusula: *"Si no quieres recibir más mensajes, responde No"*. Cuando el contacto responde `"No"`, el flujo mueve la oportunidad a `Perdido` y marca `opt_out_marketing = true`, impidiendo que el contacto vuelva a ser inscrito en difusiones masivas.
2. **Aislamiento Estricto entre Cuentas (Multi-Tenant Isolation):**
   - Cada cuenta ve única y exclusivamente sus propios contactos, oportunidades, plantillas y conversaciones.

## 3. PARÁMETROS DE INTEGRIDAD DE VELOCIDAD Y RENDIMIENTO EN NEXT.JS
1. **React Server Components (RSC) por Defecto:**
   - Las páginas (`page.tsx`) y layouts (`layout.tsx`) deben ser Server Components. Solo los subcomponentes que usan hooks de estado o eventos del navegador llevan `"use client"`.
2. **Paginación y Virtualización para +25,000 Contactos:**
   - La tabla de `/contactos` nunca debe renderizar más de 50 filas por página en el DOM.
   - La bandeja de `/conversaciones` debe soportar miles de hilos sin degradar el scroll ni bloquear el hilo principal.
3. **Filtros Sincronizados en URL con Debounce:**
   - Los buscadores de contactos y conversaciones deben aplicar un `debounce` de `300ms` y sincronizar los filtros activos en los `searchParams` de la URL.
4. **Actualización Instantánea (Optimistic UI):**
   - El envío de mensajes en el chat, el cambio de tipificación, la activación de la estrella de seguimiento y el arrastre de tarjetas en el Kanban de `/oportunidades` deben reflejarse en pantalla en `< 16ms` (1 frame) antes de que termine la persistencia.

## 4. AUDITORÍA QA POR CADA ENTREGA
Cada vez que se construya un módulo, Kimi 3 Pro debe verificar:
- **Regla de Ventana de 24 Horas de WhatsApp:** Si `NOW() - last_inbound_at > 24 horas`, el input de texto libre debe bloquearse visual y funcionalmente, obligando a seleccionar una plantilla aprobada.
- **Reparto Round Robin sin Agentes Activos:** Si entran leads y ningún agente tiene `is_active = true`, el contacto se guarda sin asignar (`assigned_member_id = null`) y se marca con alerta roja `Sin responder` en el Dashboard.