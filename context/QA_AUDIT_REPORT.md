# Auditoría QA de Producción — ADlive CRM

- **Fecha:** 2026-11-23
- **Alcance:** https://adlive-crm.vercel.app (producción), workspaces ADlive y CIERTO
- **Roles ejercidos:** Superadmin de plataforma, Dueño de CIERTO, usuario caótico (inputs hostiles, doble clic, recargas, rutas rotas), sin sesión
- **Método:** navegación real en navegador integrado + captura de red + verificación SQL directa + revisión cruzada del código (`src/`)
- **Regla de datos:** todo artefacto de prueba se creó con prefijo `[QA-TEST]` y fue **eliminado** (verificado: 0 residuos en `contacts`, `workflows`, `ai_bots`, `tenant_members`, `auth.users`). No se escriben contraseñas en este documento.
- **Limitación honesta:** la emulación de viewport del navegador integrado se verificó vía `matchMedia` (media queries responden a 360px), pero `innerWidth` reportado por CDP no es fiable; la matriz responsive se complementa con evidencia de código (clases Tailwind, breakpoints) y captura real a 360px.

---

## 1. Puntajes por área (0–100)

| Área | Puntaje | Comentario |
|---|---|---|
| Autenticación y aislamiento de login | 92 | Todos los rechazos y redirecciones correctos; mensajes claros y anti-enumeración |
| Aislamiento multi-tenant (datos y branding) | 90 | Sin cruces de datos ni marca; la única fuga "adlive" es el propio dominio de plataforma |
| Funcionalidad core | 55 | **Constructor de workflows inutilizable (P0)**; bots sin borrado; creación de bot sin proveedor |
| Feedback / UX | 60 | Falso éxito en invitaciones, anuncios obsoletos entre workspaces, mezcla de idiomas |
| Responsive | 78 | Layout móvil correcto con menú hamburguesa; tablas exigen scroll horizontal en móvil |
| Seguridad (XSS, RBAC, secretos) | 88 | XSS escapado, RBAC aplicado, tokens solo para owner/admin; observaciones menores |

---

## 2. Tabla de hallazgos

| ID | Sev. | Ruta / Vista | Rol | Hallazgo | Causa raíz (archivo:línea) | Solución propuesta |
|---|---|---|---|---|---|---|
| QA-001 | **P0** | `/automatizaciones/[id]` → Builder | Superadmin | Un workflow recién creado queda en "Lienzo vacío" y **no existe botón +** para agregar el primer paso: el builder es un callejón sin salida. Round Robin y mensaje de bienvenida son inalcanzables. Confirmado en DB: `canvas_definition = {"nodes":[],"edges":[]}` | `src/features/workflows/components/BuilderTab.tsx:152-160` (rama vacía sin acción) + `src/shared/services/crmStore.tsx:919` (insert con canvas vacío) + `crmActions.ts:671-680` (`addWorkflowActionNode` exige `sourceNodeId` existente) | Sembrar nodo trigger al crear el workflow y/o renderizar un botón "+" real en el estado vacío que invoque la creación del primer nodo |
| QA-002 | **P1** | `/equipo` → Invitar miembro | Superadmin | Al fallar la invitación (HTTP 403) la UI muestra igualmente **"Invitación enviada a … con rol Agente."** junto al toast "No autorizado.". Mensajes contradictorios; el usuario cree que invitó y no se creó nada (verificado en DB) | `src/features/team/components/TeamView.tsx:181-184`: `inviteMember()` se llama fire-and-forget y `setAnnouncement(...)` se ejecuta siempre, sin esperar resultado | Hacer `onInvite` async, anunciar éxito solo si la mutación resuelve OK; propagar error al modal |
| QA-003 | **P1** | `/api/v1/team/invite` | Superadmin | El superadmin **sin membresía** en un workspace cliente no puede invitar miembros (403). La seguridad es correcta, pero la plataforma no ofrece vía para gestionar el equipo del cliente | `src/app/api/v1/team/invite/route.ts:21` usa `requireTenantAdmin` sin override de superadmin | Decisión de producto: o override de superadmin auditado, u ocultar/deshabilitar el botón "Invitar miembro" cuando el llamador no es admin del tenant (con tooltip explicativo) |
| QA-004 | **P2** | `/bots-ia` | Superadmin | **No hay forma de eliminar un bot** desde la UI (solo activar/desactivar). El bot de prueba tuvo que borrarse por SQL | Tarjeta de bot en `BotsView` solo expone switch (sin acción delete en `crmStore`/`BotsView`) | Agregar acción "Eliminar bot" con confirmación |
| QA-005 | **P2** | `/bots-ia` → Nuevo bot | Superadmin | Se puede crear un bot con un proveedor **sin API key configurada** (los 4 proveedores estaban "Sin configurar"); el bot fallará en runtime sin aviso | `NewBotModal.tsx`: selector de proveedor sin validación de configuración | Bloquear o advertir al elegir proveedor sin key; sugerir configurar primero |
| QA-006 | **P2** | `/equipo` | Superadmin | El anuncio "Invitación enviada…" **persiste al cambiar de workspace** (aparece en ADlive tras fallar en CIERTO) | `TeamView.tsx`: `announcement` local no se limpia al cambiar `activeTenantId` | Resetear anuncios/estados efímeros al cambiar de tenant |
| QA-007 | **P3** | `/automatizaciones/[id]` | Todos | Mezcla de idiomas: pestañas "Builder", "Settings", "Enrollment history", "Execution logs", estados "Draft"/"Saved" en una UI en español | Textos hardcodeados en inglés en las vistas de workflow | Unificar a español |
| QA-008 | **P3** | `/dashboard` | Todos | Gráfico "Oportunidades ganadas y perdidas" escala el eje Y hasta 700 con todos los datos en 0 | Escala fija/máximo por defecto del componente de chart sin datos | Escala adaptativa u ocultar eje cuando no hay datos |
| QA-009 | **P3** | `/contactos` (móvil 360px) | Todos | La tabla fuerza `min-w-[1080px]`: en móvil exige scroll horizontal dentro del contenedor (la página en sí no se desborda; menú hamburguesa OK) | `overflow-x-auto` + `min-w-[1080px]` en la tabla | Vista de tarjetas apiladas en `<md` o selección de columnas prioritaria en móvil |
| QA-010 | **P3** | URLs públicas `/l/{slug}/*`, `/embed/*`, guía de instalación | Clientes | La marca blanca se rompe en el dominio: `adlive-crm.vercel.app` aparece en URLs de landing, embed y ejemplos de la guía del cliente | Dominio único de plataforma | Dominio personalizado/neutro (p. ej. `app.{dominio-cliente}` o dominio genérico) |
| QA-011 | **P3** | CIERTO `/contactos` y `/conversaciones` | Producción | Datos de prueba dentro del workspace real del cliente: contacto "DAVID MARULANDA" (empresa "Adlive", email `@adlive.com.co`, etiqueta `06222221`) y conversación con el mensaje de prueba de Meta "Welcome! This is a test message from the WhatsApp Business Platform…" | Pruebas de integración hechas sobre el workspace productivo del cliente | Política: probar solo en workspace sandbox; limpiar esos datos con el dueño |
| QA-012 | Info | `/ajustes` → Landings y Guía | Owner/Admin | El token individual del webhook se muestra completo en la guía. Verificado el gating: `includeWebhookToken=1` solo para roles owner/admin (`crmStore.tsx:470`); un `agent` no lo recibe | Diseño intencional | Aceptable; opcional: enmascarar parcialmente y exigir clic para revelar |

---

## 3. Diagnóstico de los 4 problemas reportados por el usuario

### 3.1 "CIERTO muestra 5 contactos"
**No reproducido / refutado.** La tabla `contacts` de CIERTO contiene exactamente **3 filas** (Diego Linares, DAVID MARULANDA, Emanuel Guevara) y la UI muestra "3 resultados de 3 contactos de CIERTO" tanto en "Todos los usuarios" como en "Ver como usuario → emanueel031@gmail.com" (el dueño ve todo por su rol). No hay fugas desde ADlive. Hipótesis del origen del reporte: conteo visual previo a la limpieza de datos de prueba o confusión con el contador de otra vista.

### 3.2 "Contaminación de ADlive al configurar/crear workspace"
**No reproducido.** El modal **Editar empresa** de CIERTO muestra exactamente los datos de CIERTO (nombre, propietario emanueel, logo y paleta `#6B07E9…`). La lista de workspaces muestra contadores coherentes (ADlive 1 usuario/1 contacto; CIERTO 1 usuario/3 contactos). Las pestañas de Ajustes se filtran bien por rol (ver 3.4). La única aparición de "adlive" en la experiencia del cliente es el **dominio de plataforma** (QA-010). No se creó ningún workspace real en esta auditoría (habría creado tenant y usuario auth reales); la inspección fue de UI + código.

### 3.3 "Invitación de equipo"
**Confirmado y es el hallazgo más engañoso.** Como superadmin dentro de CIERTO (sin membresía), `POST /api/v1/team/invite` responde **403 {"error":"No autorizado."}** — comportamiento de seguridad correcto (QA-003) — pero la pantalla anuncia **"Invitación enviada…"** (QA-002) y el anuncio falso **sobrevive al cambiar de workspace** (QA-006). Verificado en DB: no se creó ninguna fila. El flujo positivo sí funciona: la misma invitación en ADlive (donde el llamador es owner) respondió **201** y creó la membresía `agent` (luego eliminada en la limpieza).

### 3.4 "Emanueel no debería recuperar contraseña en la URL genérica ni ver selectores"
**Comportamiento actual correcto (ya corregido en iteraciones 12C/12D), verificado en vivo:**
- Login de emanueel en `/login` genérico → **"Acceso denegado: debes iniciar sesión desde el enlace exclusivo de tu empresa."**
- Login en `/login?workspace=adlive` (ajeno) → mismo rechazo.
- Login en `/login?workspace=inexistente` → **"El espacio de trabajo no existe o no está disponible."**
- Login en `/login?workspace=cierto` → **éxito**, y el header muestra solo "Ver como usuario" y su correo: **no hay selector "Cambiar de workspace"** para él.
- Recuperación: la ruta `forgot-password` (`src/app/api/v1/auth/forgot-password/route.ts:54-61` + `workspaceAccess.ts:26`) exige membresía activa del workspace indicado (o ser superadmin); sin `workspace` no genera correo alguno aunque el mensaje genérico diga lo contrario (anti-enumeración intencional — esto puede haber dado la falsa impresión de que "dejó recuperar"). `/recuperar-contrasena?workspace=cierto` conserva workspace y marca "Cierto" tras recarga.
- `/superadmin` como emanueel → redirige a `/dashboard`. Sin sesión, `/dashboard`, `/superadmin`, `/contactos` → redirección limpia a `/login?next=…` sin flash de contenido.

---

## 4. Matriz responsive

| Viewport | Resultado | Evidencia |
|---|---|---|
| 360 × 800 (móvil) | ✅ Sin desborde de página; menú hamburguesa; toolbar y filtros apilados; tabla con scroll horizontal interno (QA-009) | Captura real + `matchMedia('(max-width:768px)')=true` + medición de elementos (tabla 1176px dentro de contenedor `overflow-x-auto`) |
| 390 × 844 (móvil) | ✅ Mismo comportamiento (misma familia de breakpoints `<md`) | Media query + clases Tailwind |
| 768 × 1024 (tablet) | ✅ Breakpoint `md` colapsa sidebar a hamburguesa; grids fluidos | Revisión de clases (`md:`/`lg:`) en layout y vistas |
| 1280 × 720 (laptop) | ✅ Sidebar fija, contenido sin desborde | Verificación en vivo previa (viewport 1440×900) y clases |
| 1440 × 900 (desktop) | ✅ Diseño de referencia de la auditoría; sin desbordes | Verificación directa en toda la sesión |

Nota: la lectura `innerWidth` del navegador integrado no reflejó el override CDP, pero las media queries sí respondieron y la captura a 360px confirma el layout móvil. No se detectaron errores 4xx/5xx espontáneos en la captura de red durante el recorrido (solo el 403 esperado de la invitación).

---

## 5. "Cosas sin propósito" o deudas de producto

1. **Pestañas "Enrollment history" y "Execution logs"** del builder: inaccesibles en la práctica mientras QA-001 impida construir workflows (quedarán vacías para siempre en workflows nuevos).
2. **Toggle "Publicar"** de un workflow que no puede tener pasos: publica un flujo vacío sin advertencia.
3. **Switch de bot** sin acción de borrado complementaria (QA-004).
4. **Selector de proveedor** en Nuevo bot sin relación con el estado de configuración de API keys (QA-005).
5. **Anuncio de invitación** que sobrevive al contexto (QA-006): texto sin propósito que además miente.
6. **Escala fija del gráfico del dashboard** sin datos (QA-008).
7. **Datos de prueba** en el workspace productivo de CIERTO (QA-011): mensaje de prueba de Meta visible para el cliente en su bandeja.

---

## 6. Plan de corrección (máximo 3 sprints)

### Sprint 1 — Crítico funcional y de confianza (P0–P1)
1. **QA-001:** sembrar el nodo trigger al crear el workflow (`crmStore.tsx:919`) y/o añadir botón "+" real en el estado vacío de `BuilderTab.tsx`; test: crear workflow → agregar 2 pasos (plantilla + Round Robin) → publicar.
2. **QA-002:** `TeamView.tsx` — `onInvite` async; anuncio solo tras éxito; error visible dentro del modal.
3. **QA-003:** decisión de producto y una de: override superadmin auditado **o** ocultar/deshabilitar "Invitar miembro" para no-admins con explicación.
4. **QA-006:** limpiar anuncios efímeros al cambiar `activeTenantId`.

### Sprint 2 — Consistencia de módulos (P2)
5. **QA-004:** acción "Eliminar bot" con confirmación.
6. **QA-005:** validar proveedor configurado antes de crear bot (bloqueo o advertencia + enlace a configurar).
7. **QA-012:** enmascarado parcial del token con revelado explícito (opcional, bajo costo).

### Sprint 3 — Pulido y marca blanca (P3)
8. **QA-007:** unificar idioma español en vistas de workflow.
9. **QA-008:** escala adaptativa del gráfico del dashboard.
10. **QA-009:** vista móvil de contactos en tarjetas o columnas prioritarias.
11. **QA-010:** estrategia de dominio neutro/personalizado para marca blanca.
12. **QA-011:** limpiar con el cliente los datos de prueba de CIERTO y fijar política de sandbox para pruebas de integración.

---

## Anexo — Verificación de limpieza (ejecutada al cierre)

```
qa_contacts=0, qa_workflows=0, qa_bots=0, qa_users=0, cierto_members=1 (solo el dueño)
```

Cambios de esta auditoría: **ninguno en código de aplicación** (solo documentación). No se tocó producción salvo los artefactos `[QA-TEST]` ya eliminados.

---

## 7. Re-verificación Post-Correcciones

**Fecha:** 2026-11-24 · **Despliegues:** Sprint 2 (`fd31706`, dpl_4Arn5NWHr95WMyRveZju9FJTg4N2, READY) y Sprint 3 (`ddb0506`, dpl_Aqm2HecQeuQTw7z2THC1GM9Nkgqe, READY) en `https://adlive-crm.vercel.app`.

### 7.1 Flujo 3 — Landing pública + formulario embebido + lead con UTM ✅ PASÓ

- `GET /l/cierto/captacion-hero?utm_source=meta_ads&utm_campaign=plan50gb` → **200**.
- `GET /embed/cierto/form?theme=dark` → **200**; script embebido `GET /api/v1/embed/cierto/form.js` → **200**.
- `POST /api/v1/55cc06d8-…/webhooks/lead-web` con token válido y `utm_source=meta_ads`, `utm_campaign=plan50gb` → **200** `{ok:true, out_contact_id, out_opportunity_id}`.
- Verificación SQL: contacto `[QA-TEST] Lead E2E` creado con `lead_source=meta_ads`, `utm_source=meta_ads`, `utm_campaign=plan50gb` y oportunidad creada en etapa **Interesado** del pipeline principal.
- Limpieza ejecutada: oportunidad, actividad y contacto eliminados; re-verificación SQL = 0 residuos.

### 7.2 Flujo 1 — Workflow crear → publicar → eliminar ✅ PASÓ

Ejecutado en producción con sesión de owner de CIERTO (navegador real, `/automatizaciones`):

- Workflow `[QA-TEST] E2E Flujo1` creado desde cero (sin plantilla), disparador «Inscripción manual» sembrado.
- Paso agregado y publicado; verificación SQL: **2 nodos / 1 arista** persistidos en `qa_workflows` (`status=Published`), lo que confirma QA-001 (los nodos reales se guardan).
- Eliminado desde la lista con confirmación en dos pasos → anuncio en UI y `qa_workflows_left=0` en SQL.

### 7.3 Flujo 2 — Invitar agente `[QA-TEST]` y verificar sus 5 módulos ✅ PASÓ (tras corrección QA-013)

- Hallazgo durante la prueba (**QA-013**): la invitación de equipo usaba `inviteUserByEmail` (SMTP nativo de Supabase), que **fallaba en producción** (límite del plan compartido). El modal mantenía el error visible sin cerrarse (QA-002/006 correcto), pero la invitación no se completaba. **Corregido** en `f4badaf`: el enlace se genera con `admin.generateLink` y se entrega por el **SMTP de plataforma** (mismo mecanismo probado de «recuperar contraseña»), con reversión del usuario si el correo o la membresía fallan. Tests actualizados: **182/182 en verde**.
- Con el fix desplegado, el superadmin (vía selector «Cambiar de workspace» del topbar) invitó a `qa-test-e2e-agent@example.com` con rol **Agente** en CIERTO: anuncio «Invitación enviada… con rol Agente», usuario GoTrue creado (`invited_at` presente) y membresía `role=agent, is_active=true` verificadas en SQL.
- Login del agente en `/login?workspace=cierto` ✅. El sidebar muestra **exactamente 5 módulos**: Dashboard, Contactos, Oportunidades, Conversaciones, Plantillas (con insignia «AGENTE»); no aparecen Automatizaciones, Integraciones, Bots IA, Equipo, Atribución ni Ajustes.
- `/ajustes` → redirige a `/dashboard` ✅. `/equipo` → redirige a `/dashboard` ✅.
- Nota operativa: el usuario invitado queda con `email_confirmed_at` nulo hasta que **acepta el magiclink del correo**; en la prueba se confirmó por SQL (equivalente a aceptar la invitación). En uso real el flujo completo es: invitar → abrir correo → aceptar y definir contraseña → entrar.
- Limpieza: membresía y usuario auth eliminados; `qa_users=0, qa_members=0`.

### 7.4 Flujo 4 — Validación de proveedor sin API key y mini-chat de prueba ✅ VERIFICADO (con hallazgo de dato del cliente)

Ejecutado en `/bots-ia` con sesión de owner de CIERTO:

- **Validación de proveedor (QA-005) ✅**: con proveedor OpenAI (sin key) el formulario muestra badge «Sin API Key», alerta y botón «Crear bot» deshabilitado; al seleccionar Gemini (key guardada `AQ.A••••••••`) la alerta desaparece y el botón se habilita.
- **Creación y entrenamiento ✅**: bot `[QA-TEST] Bot Bloqueado` creado con proveedor Gemini; SQL confirma `system_prompt` compilado (1112 chars: objetivo + información del negocio con precios + regla de handoff + tono) sin alterar la columna existente.
- **Mini-chat «Probar» ⚠️ parcial**: el endpoint autenticado `POST /api/v1/ai-bots/test` ejecuta la llamada al proveedor con la llave cifrada del vault (descifrado AES-256-GCM verificado vía el mismo vault que WhatsApp), pero Google **rechaza la API key del workspace CIERTO** (error 400/403 del proveedor, verificado en 2 intentos con mensajes distintos). La UI maneja el fallo correctamente con «No se pudo probar el bot. Verifica que el proveedor tenga una API Key válida.» Causa raíz: llave del cliente inválida/revocada/restringida — **acción del cliente: reemplazar la API key de Gemini** en `/bots-ia`. Se recomienda además un botón «Probar conexión» por proveedor y log del error real en servidor (observabilidad).
- **Eliminar (QA-004) ✅**: botón «Eliminar» con confirmación en dos pasos → anuncio «Bot «[QA-TEST] Bot Bloqueado» eliminado» y `qa_bots_left=0` en SQL.
- (Botón «Editar» presente en tarjeta; la edición quedó cubierta por pruebas unitarias del Sprint 2.)

### 7.5 Hallazgo nuevo — QA-013: invitaciones de equipo por SMTP nativo de Supabase ✅ CORREGIDO

Detalle en 7.3. Corrección desplegada en `f4badaf` y verificada en producción con la invitación real del agente de prueba.

### 7.6 Residuos `[QA-TEST]`

Verificación SQL posterior a los 4 flujos: `contacts=0, workflows=0, ai_bots=0, tenant_members(vía auth.users qa-test)=0, opportunities=0`.
