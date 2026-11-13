# 01. CONTEXTO DE NEGOCIO, INGENIERÍA INVERSA Y PLAN DE FASES (FRONTEND -> MCP)

## 1. PROPÓSITO DEL PROYECTO Y MODELO DE NEGOCIO
Desarrollaremos el **CRM SaaS Propio de ADLIVE SAS** utilizando exclusivamente **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Supabase** y **Vercel**.
- **Problema a resolver:** El cliente actual arrienda un CRM externo (Nexo CRM en Lovable) que presenta lentitud severa con altos volúmenes de datos (más de 24,077 contactos y 1,805 oportunidades abiertas) y carece de control sobre su infraestructura.
- **Giro de Negocio Principal:** Venta masiva de **portabilidad de tarjetas SIM, planes móviles y servicios de telecomunicaciones** (ej. campañas de planes de 50GB y llamadas ilimitadas) operada mediante equipos de agentes tipo Call Center.
- **Flujo Comercial Real:**
  1. **Captación Omnicanal:** Los leads llegan por pauta paga en Meta Ads (Facebook/Instagram), Google, TikTok Ads, formularios web con rastreo UTM, cadenas de difusión por WhatsApp o referidos voz a voz.
  2. **Entrada por WhatsApp Business Cloud API:** Cada contacto que escribe o recibe una plantilla entra al CRM guardando su origen publicitario (UTM/anuncio), etiquetas y su historial de chat (texto, audios/notas de voz, imágenes y documentos).
  3. **Automatización y Reparto Round Robin:** Los flujos automáticos envían plantillas aprobadas por Meta. Si el cliente responde positivamente (ej. "Sí"), el sistema marca seguimiento, mueve la oportunidad a "Interesado" y la asigna en reparto equitativo (*Round Robin*) a un agente humano activo. Si responde "No", mueve la oportunidad a "Perdido".
  4. **Cierre en Call Center (Sin pasarela de pago):** Los asesores atienden la bandeja de entrada, tipifican la conversación, solicitan los datos de portabilidad (cédula, operador actual, NIP, dirección de envío de SIM) y mueven la oportunidad en el tablero Kanban hasta concretar la venta.

## 2. ESTRATEGIA DE EJECUCIÓN EN DOS ETAPAS (IMPORTANTE PARA KIMI 3 PRO)
1. **ETAPA A (DISEÑO Y FRONTEND 100% FUNCIONAL EN NEXT.JS CON MOCK DATA TIPADO):**
   - Primero construiremos **toda la interfaz gráfica (UI/UX)**, todos los módulos, vistas, tablas, filtros, modales, tablero Kanban y bandeja de chat usando **Next.js App Router** y una capa de datos simulados (`src/shared/mocks/`) que respeta estrictamente los tipos de `context/02-base-de-datos-supabase.md`.
   - En esta etapa NO se requiere conexión activa a base de datos externa; toda interacción (crear contacto, mover tarjeta Kanban, enviar mensaje en chat, crear plantilla, crear nodo en workflow) debe funcionar de forma interactiva en el estado de la aplicación.
2. **ETAPA B (MIGRACIÓN Y CONEXIÓN VÍA MCP CON SUPABASE Y VERCEL):**
   - Una vez aprobado todo el diseño y flujo frontend, conectaremos **Supabase** y **Vercel** mediante **MCP (Model Context Protocol)**.
   - A través de los servidores MCP, ejecutaremos las migraciones SQL de `context/02-base-de-datos-supabase.md`, activaremos Row Level Security (RLS), conectaremos Supabase Auth/Realtime y desplegaremos en Vercel cambiando únicamente el adaptador de servicios (`src/shared/services/`) sin romper ni reescribir los componentes visuales.

## 3. REQUERIMIENTOS FUNCIONALES POR MÓDULO (12 MÓDULOS OBLIGATORIOS)

### M1. Autenticación y Multi-Tenancy (`/login`, `/register`)
- Vista unificada con pestañas conmutables `Iniciar sesión` y `Crear cuenta`.
- En `Iniciar sesión`: campos `Correo electrónico`, `Contraseña`, enlace `¿Olvidaste tu contraseña?`, botón primario `Ingresar` y botón `Continuar con Google`.
- En `Crear cuenta`: añade el campo `Nombre de la agencia` (crea un nuevo Tenant aislado) y botón `Crear cuenta gratis`.
- Nota legal inferior: *"Cada cuenta ve únicamente sus propios contactos, oportunidades y conversaciones"*.
- Selector de cuenta (`Cambiar de cuenta`) en el Sidebar y Topbar que permite a un mismo usuario alternar entre diferentes agencias/cuentas mostrando su rol (`dueño`, `admin`, `agente`).

### M2. Dashboard Ejecutivo (`/dashboard`)
- **4 Tarjetas KPI Superiores:**
  1. `Total de contactos` (Leads en tu base de datos).
  2. `Oportunidades abiertas` (En proceso de negociación).
  3. `Facturación total` (Suma de oportunidades ganadas en moneda local).
  4. `Sin responder` (Conversaciones esperando respuesta del asesor).
- **Gráfico Principal:** `Oportunidades ganadas y perdidas por mes` (barras comparativas de los últimos 6 meses: verde para Ganadas, rojo para Perdidas).
- **Resumen Lateral (`Pipeline por etapa`):** Lista de etapas abiertas (`Nuevo Lead`, `Contactado`, `Interesado`) con píldora de cantidad de leads, suma en `$` y enlace `Ver tablero kanban ->`.
- **Widget Inferior (`Conversaciones recientes`):** Lista de los últimos contactos que escribieron, mostrando nombre, previsualización del último mensaje o ícono de micrófono si es nota de voz, badge rojo `Sin responder` y tiempo relativo (`hace 56 min`, `hace 2 h`).

### M3. Contactos y Ficha 360° (`/contactos`, `/contactos/[id]`)
- **Barra de Herramientas Superior:** Botones `Campos` (configurar campos custom), `Importar` (subida CSV/Excel), `Exportar`, `Exportar reporte de respuestas`, `Columnas` (mostrar/ocultar columnas) y botón primario `+ Nuevo contacto`.
- **Barra de Filtros:** Buscador por nombre, email, empresa o teléfono; selectores de `Todas las etiquetas`, `Todas las fuentes`, `Todos los pipelines`, `Todas las etapas`; filtro de rango de fechas por `Creado` (desde/hasta) y por `Última acción / pedido` (desde/hasta).
- **Tabla de Contactos:** Selección múltiple por fila, columnas `Nombre`, `Teléfono`, `Email`, `Negocio / Empresa`, `Etiquetas` (badges), `Fuente` (ej. WhatsApp), `Creado`, `Última actividad`, `Cliente cerrado` (`No`/`Sí`) e ícono de eliminar.
- **Ficha Completa del Contacto (`/contactos/[id]` - Layout de 3 Columnas):**
  - *Columna Izquierda (Acordeones):* Tarjeta `Datos del contacto` editable (`Nombre`, `Teléfono`, `Email`, `Negocio / Empresa`, `Fuente del lead`, `Etiquetas separadas por coma`, botón `Guardar cambios`), tarjeta `Atribución` (datos UTM de origen), tarjeta `Campos personalizados` y tarjeta `Oportunidades` (con botón `Ver pipeline`).
  - *Columna Central (`Conversación`):* Enlace `Abrir en Conversaciones`, historial de burbujas de WhatsApp con hora y doble check, y **Validador de Ventana de 24 Horas de Meta**: si pasaron más de 24h desde el último mensaje del cliente, muestra alerta informativa, deshabilita el input libre (`Ventana de 24 h cerrada`) y habilita el botón `Enviar plantilla`.
  - *Columna Derecha (Gestión Comercial):* Pestañas `Notas`, `Tareas`, `Empresas`, `Documentos`, `Citas`. Incluye textarea de `Notas internas` con botón `Guardar notas` y sección de `Historial de actividad` para registrar comentarios y ver la trazabilidad cronológica.

### M4. Oportunidades - Tablero Kanban (`/oportunidades`)
- Tablero interactivo Drag & Drop dividido por columnas de etapas (`Nuevo Lead`, `Contactado`, `Interesado`, `En Validación NIP`, `Ganado`, `Perdido`).
- Cabecera de cada columna con conteo de tarjetas y sumatoria monetaria total de esa etapa.
- Tarjetas con nombre del contacto, teléfono, valor del plan ofertado, etiquetas, asesor asignado y botón rápido para abrir el chat.

### M5. Conversaciones - Bandeja Unificada Call Center (`/conversaciones`)
- **Columna Izquierda (Listado y Filtros de Tipificación):**
  - Buscador `Buscar conversación...`.
  - Filtros de estado: `Todas`, `Bot`, `Humano`, `Sin leer`, `⭐ Seguimiento`, `Sin tipificar`.
  - Píldoras de tipificación rápida: `Cliente cerrado`, `Cliente perdido`, `Ya tiene Movistar`, `No le interesa`, `Equivocado`, `POR`, `Fecha`.
  - Selector desplegable de asignación (`Asignadas y sin asignar` o por agente).
  - Lista virtualizada de chats con avatar de inicial, nombre, tiempo, estrella de seguimiento, badge rojo `nuevo`, texto/multimedia del último mensaje, badge verde `WhatsApp · conectado`, badge `Humano`/`Bot` y correo del agente asignado.
- **Columna Central (Chat Activo):**
  - Cabecera con nombre del contacto, estado `WhatsApp Conectado`, botón de WhatsApp, estrella de seguimiento, selector para cambiar la tipificación (`Seguimiento`, etc.), selector para reasignar el agente en caliente y botón eliminar.
  - Lienzo de mensajes con distinción visual clara entre mensajes salientes (plantillas/asesor) y entrantes del cliente, más barra inferior con selector de plantillas, adjuntos, respuestas rápidas e input `Escribe un mensaje...`.
- **Columna Derecha (Inspector de Contacto en Chat):**
  - Avatar, nombre, teléfono, email, chips de etiquetas con botón `+ agregar etiqueta`, sección `Info del contacto` (`Fuente`, fecha `Creado`), buscador `Buscar campos` (campos personalizados), botón inferior `Abrir ficha completa` y barra vertical derecha de íconos rápidos (Contacto, Historial, Notas, Adjuntos, Citas, Oportunidad `$`).

### M6. Automatizaciones y Constructor Visual (`/automatizaciones`, `/automatizaciones/[id]`)
- **Vista Lista:** Aviso superior de canales conectados disponibles como trigger/acción (`WhatsApp`), botón `+ Crear workflow`, y tabla con `Nombre` + descripción, `Estado` (`Published` / `Draft`), `Disparador` (`Inscripción manual`, `Contacto creado`, `Mensaje recibido en un canal`), `Inscritos`, `Activos`, `Última actualización` y botón eliminar.
- **Vista Interior del Workflow (4 Pestañas):**
  1. `Builder`: Lienzo visual interactivo con controles de zoom (`70%`, `+`, `-`, pantalla completa) y nodos conectados con botones `+`. Soporta nodo inicial (`Inscripción manual`), acción (`Enviar WhatsApp` con plantilla), ramificación múltiple según respuesta (`Si`, `No`, `Otra respuesta`, `Undelivered`, `Time Out`) y nodos de acción CRM (`Marcar en seguimiento`, `Mover a Perdido`, `Asignar a un miembro Round Robin`).
  2. `Settings`: Formulario con `Nombre del workflow`, `Descripción` y selector `¿Quién puede re-inscribirse?` (`Nadie: solo se inscribe una vez` / `Permitir re-inscripción`).
  3. `Enrollment history`: Tabla de contactos inscritos en el flujo y su estado actual.
  4. `Execution logs`: Registro detallado paso a paso de ejecuciones y errores.
- **Cabecera del Constructor:** Estado `Saved`, badge `Published`, switch `Publicar` y botón `<- Workflows`.

### M7. Plantillas de WhatsApp (`/plantillas`)
- Cabecera con botones `Sincronizar` (con Meta Cloud API) y `+ Crear plantilla`.
- Tabla con `Nombre` (más previsualización gris del texto y `Motivo: NONE`), `Categoría` (`MARKETING`, `UTILITY`), `Idioma` (`es`), `Variables` (`0`, `1`...), `Estado` (`Aprobada` en verde, `Deshabilitada` en gris, `Rechazada` en rojo) y botón eliminar.
- **Modal `Crear plantilla`:** Formulario en 2 columnas. Izquierda: `Nombre` (ej. `bienvenida_lead`), `Categoría`, `Idioma`, `Header (opcional)`, `Cuerpo del mensaje` con barra de formato (`B`, `I`, `S`, `<>`), botón `+ Agregar variable` (`{{1}}`, `{{2}}`), contador de caracteres (`0/1024`), `Footer (opcional)` (`0/60`) y `Botones (opcional)`. Derecha: recuadro de `Vista previa` en vivo estilo burbuja de WhatsApp.

### M8. Integraciones (`/integraciones`)
- Banner informativo superior explicando la configuración a nivel de plataforma (App ID y App Secret de Meta/TikTok) frente a la conexión directa de WhatsApp Business API por cuenta.
- Grid de tarjetas de conexión:
  1. `WhatsApp Business API` (Badge `Conectado`, botones `Reconectar`, `Activar llamadas`, `Desconectar`).
  2. `Facebook Lead Ads` (`Conectar Facebook`).
  3. `Instagram` (`Conectar con Meta`).
  4. `TikTok Ads` (`Conectar con TikTok`).
  5. `Twilio (SMS y voz)` y `Telnyx (SMS y voz)`.

### M9. Bots IA (`/bots-ia`)
- Cabecera con botón `Bot de ejemplo: Placita Express` y botón primario `+ Nuevo bot`.
- Banner de seguridad: *"Tus API keys se guardan en una tabla protegida del servidor: nunca se envían al navegador ni se muestran de nuevo después de guardarlas"*.
- Tarjeta destacada `IA incluida` (`Activa`) e hilera de tarjetas de `Proveedores de IA`: `OpenAI (ChatGPT)`, `Anthropic (Claude)`, `xAI (Grok)` y `Google (Gemini)` con su botón `Conectar`.
- Sección inferior `Bots por producto` para crear asistentes específicos por línea de negocio.

### M10. Equipo y Permisos de Call Center (`/equipo`)
- Cabecera con botón `+ Invitar miembro`.
- Lista de usuarios mostrando correo, fecha de ingreso (`Agregado el...`), indicador de estado (`Desconectado` / `Conectado`), badge de rol (`Admin` / `Agente`), botón toggle `Activo` (habilita/deshabilita al agente para recibir leads en el reparto automático), switch `Puede ver todos los contactos` (exclusivo para agentes) e ícono de eliminar.
- **Modal `Invitar miembro`:** Campo `Correo` y selector `Rol` (`Admin (puede administrar el equipo)` o `Agente`).

### M11. Atribución Publicitaria (`/atribucion`)
- Filtros superiores de rango de fecha (`Desde`, `Hasta`) y selector de agrupación en 3 pestañas: `Campañas`, `Conjuntos`, `Anuncios`.
- 3 Tarjetas KPI: `Leads atribuidos`, `Ganados`, `Valor ganado`.
- Tabla analítica desglosando `Campaña`, `Conjunto`, `Anuncio`, `Leads`, `Ganados`, `Conversión (%)` y `Valor ganado ($)`.

### M12. Ajustes, Campos y Script UTM (`/ajustes`)
- 3 Pestañas superiores: `Campos personalizados`, `Valores personalizados` y `Formulario web y UTM`.
- En `Formulario web y UTM`: muestra `Dirección del webhook` (con botón copiar), `Token de la cuenta` (con botones copiar y `Regenerar`) y el bloque de código `<script>` listo para copiar que captura `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `landing_url` y `referrer` en cookies por 90 días y los envía automáticamente en formularios con el atributo `data-crm-form`.