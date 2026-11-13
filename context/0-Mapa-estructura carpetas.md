adlive-crm/
├── context/                                     # CEREBRO DE CONTEXTO PARA KIMI 3 PRO
│   ├── 01-contexto-negocio-y-modulos.md         # Negocio SIM/Portabilidad, RFs, RNFs y plan MCP
│   ├── 02-base-de-datos-supabase.md             # Esquema SQL completo, índices, RLS y contratos
│   ├── 03-reglas-diseno-adlive.md               # Paleta ADlive, tipografía, UX Next.js y estados UI
│   ├── 04-reglas-seguridad-iso-velocidad.md     # ISO 27001, OWASP, Ley 1581, velocidad y QA
│   ├── 05-reglas-kimi-y-arquitectura-codigo.md  # Regla de NO borrar código, Clean Architecture y límites
│   └── CONTEXT_LOG.md                           # Bitácora viva que Kimi actualiza en cada respuesta
├── public/
├── src/
│   ├── app/                                     # Enrutador Next.js App Router (Vistas y Layouts)
│   │   ├── (auth)/                              # Login y Registro de Agencia
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/                         # Layout protegido con Sidebar Oscuro ADlive y Topbar
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── contactos/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx                # Ficha 360° en 3 columnas
│   │   │   ├── oportunidades/page.tsx           # Tablero Kanban Drag & Drop
│   │   │   ├── conversaciones/page.tsx          # Bandeja Call Center 3 columnas
│   │   │   ├── automatizaciones/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx                # Constructor visual de nodos + Settings + Logs
│   │   │   ├── plantillas/page.tsx              # Gestor y modal creador de plantillas Meta
│   │   │   ├── integraciones/page.tsx           # Conexión WhatsApp Cloud API, Meta, TikTok
│   │   │   ├── bots-ia/page.tsx                 # Proveedores LLM y bots por producto
│   │   │   ├── equipo/page.tsx                  # Gestión de agentes, turnos y visibilidad
│   │   │   ├── atribucion/page.tsx              # Analítica UTM por Campañas, Conjuntos y Anuncios
│   │   │   └── ajustes/page.tsx                 # Campos personalizados y generador de Script UTM
│   │   └── api/v1/webhooks/                     # Endpoints para WhatsApp y Formularios Web (Fase MCP)
│   ├── features/                                # Módulos de dominio desacoplados
│   │   ├── auth-tenant/
│   │   ├── dashboard/
│   │   ├── contacts/
│   │   ├── opportunities-kanban/
│   │   ├── inbox-conversations/
│   │   ├── workflows/
│   │   ├── whatsapp-templates/
│   │   ├── integrations/
│   │   ├── ai-bots/
│   │   ├── team/
│   │   ├── attribution/
│   │   └── settings/
│   ├── shared/
│   │   ├── components/ui/                       # Sistema de Diseño Atómico ADlive
│   │   ├── mocks/                               # Datos simulados tipados para la Fase 1 (Frontend)
│   │   ├── services/                            # Capa adaptadora (conmuta entre Mock y Supabase MCP)
│   │   ├── types/database.ts                    # Interfaces idénticas a las tablas SQL
│   │   └── lib/                                 # Utilidades, validadores Zod, criptografía AES-256
└── package.json