# CATÁLOGO MAESTRO DE HABILIDADES DE INGENIERÍA DE SOFTWARE (ADLIVE)

> **INSTRUCCIÓN PERMANENTE PARA KIMI 3 PRO:** Estas 12 habilidades son directrices activas y permanentes de programación durante todo el proyecto ADLIVE CRM. Deben aplicarse de forma transversal en cada tarea de código, arquitectura, diseño, seguridad y QA.

---

## SKILL 1: `preserve-existing-code` (Preservación Absoluta de Código)

- **Regla Central:** Mantén el 100% del código, estructura y lógica existente al modificar, depurar o expandir archivos en cualquier lenguaje.
- **Pasos Obligatorios:**
  1. Respeta nombres de variables, firmas de funciones, clases, comentarios e importaciones existentes a menos que se pida explícitamente cambiarlos.
  2. Realiza modificaciones quirúrgicas solo en las líneas necesarias.
  3. **Cero Placeholders:** Devuelve siempre el bloque de código completo y listo para producción. Prohibido truncar código con `// ... resto del código`, `/* código existente */` o `# ... sin cambios`.
  4. Al final del archivo entregado, resume brevemente qué líneas o funciones se agregaron o modificaron.

## SKILL 2: `candid-viability-advisor` (Asesor Directo de Viabilidad Técnica)

- **Regla Central:** Evalúa cada requerimiento, arquitectura o flujo con honestidad técnica directa antes de programar.
- **Pasos Obligatorios:**
  1. Indica desde el inicio si un enfoque es **Viable**, **Parcialmente Viable (con condiciones)** o **No Recomendado**.
  2. Verifica límites reales de producción: timeouts serverless en Vercel, límites de rate en APIs (Meta Cloud API), cuellos de botella en tablas grandes (+50,000 filas) y riesgos de seguridad.
  3. Desglosa **Viabilidad**, **Pros (Ventajas)** y **Contras y Riesgos** concretos, proponiendo siempre la alternativa técnica más sólida.

## SKILL 3: `iso-code-server-security` (Seguridad ISO/IEC 27001 & OWASP)

- **Regla Central:** Aplica controles estrictos ISO/IEC 27001 (A.8.12 / A.8.28 Secure Coding) y OWASP en todo código y configuración.
- **Pasos Obligatorios:**
  1. **Cero Credenciales Públicas:** Jamás hardcodees API keys, secretos JWT o tokens privados en el código fuente ni en variables expuestas al navegador (`NEXT_PUBLIC_`). Usa siempre variables de entorno de servidor (`process.env`) y cifra llaves de clientes en base de datos con AES-256-GCM.
  2. **Validación y Parámetros:** Valida todo input externo con esquemas estrictos (`Zod`) y consultas parametrizadas.
  3. **Control de Acceso (Least Privilege):** Verifica sesión, `tenant_id` y rol del usuario en cada ruta privada o mutación.
  4. **Endurecimiento HTTP:** Configura CORS estricto y cabeceras `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Strict-Transport-Security`.

## SKILL 4: `code-reuse-and-optimization` (Reutilización y Optimización de Código)

- **Regla Central:** Evita reinventar la rueda reutilizando utilidades existentes del proyecto, APIs nativas del framework y métodos estándar del lenguaje.
- **Pasos Obligatorios:**
  1. Antes de crear una función nueva, revisa en orden: (a) componentes/utilidades ya creados en `src/shared/`, (b) utilidades nativas de Next.js/React, (c) librería estándar del lenguaje (`Intl`, `URLSearchParams`, `crypto`).
  2. Elimina bucles redundantes, consultas N+1 y re-renderizados innecesarios. Prioriza filtrado e indexación a nivel de motor de base de datos o paginación por cursores.

## SKILL 5: `ux-ui-accessibility-seo` (Diseño UX/UI, Accesibilidad WCAG 2.2 AA y SEO)

- **Regla Central:** Garantiza validez conceptual UX, consistencia visual UI, accesibilidad universal e interactividad total en cada pantalla.
- **Pasos Obligatorios:**
  1. **Heurísticas UX:** Escala tipográfica clara, espaciado de 4px/8px, área clicable mínima de 40x40px y estados explícitos en cada componente (`default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `empty`, `error`).
  2. **Affordance e Interactividad:** Todo elemento interactivo debe responder al clic (`cursor: pointer`, transiciones suaves). Prohibido usar `<div onClick>`; usa siempre `<button type="button">` para acciones y `<Link>`/`<a>` para rutas.
  3. **Accesibilidad y Core Web Vitals:** Contraste mínimo 4.5:1, navegación por teclado con `:focus-visible`, cierre de modales con `Escape`, atributos ARIA y prevención de saltos visuales (`CLS = 0`) mediante `Skeletons`.

## SKILL 6: `backend-software-architecture` (Arquitectura Escalable de Backend)

- **Regla Central:** Diseña sistemas modulares, desacoplados, tolerantes a fallos y preparados para alto tráfico.
- **Pasos Obligatorios:**
  1. **Separación de Capas (Clean/Hexagonal):** Aísla la lógica de dominio (`src/features/`) de las rutas HTTP (`src/app/`) y del adaptador de persistencia (`src/shared/services/`).
  2. **Idempotencia y Concurrencia:** Usa claves de idempotencia (`wa_message_id`, `Idempotency-Key`) en webhooks y transacciones atómicas para el reparto *Round Robin* de agentes.
  3. **Procesamiento Asíncrono:** Desacopla envíos masivos de WhatsApp e importaciones CSV pesadas mediante colas con *Exponential Backoff*.

## SKILL 7: `system-reverse-engineering` (Ingeniería Inversa Clean-Room)

- **Regla Central:** Deconstruye aplicaciones existentes mapeando actores, flujos de usuario, árbol atómico de componentes, esquema entidad-relación, contratos de API y máquinas de estado finitas para construir una réplica superior y modular.

## SKILL 8: `app-replication-blueprint` (Blueprint y Auditoría de Replicación)

- **Regla Central:** Documenta y ejecuta el mapa del sitio, tokens de diseño (`DESIGN.md`), matriz de estados locales/globales, catálogo de eventos (`onClick`, `onSubmit`, `debounce`, actualizaciones optimistas) y mejoras de velocidad sobre el sistema original.

## SKILL 9: `qa-testing-engineering` (Ingeniería QA, Pruebas y Rendimiento)

- **Regla Central:** Valida cada entrega con mentalidad de QA independiente: análisis estático (SOLID, DRY, 0 `any`), pruebas de camino feliz y casos borde (valores nulos, ventana de 24h expirada, 0 agentes activos), pruebas de aislamiento Multi-Tenant (IDOR) y pruebas de estrés.

## SKILL 10: `ai-neuro-robotics-engineering` (Arquitectura IA y Protocolo MCP)

- **Regla Central:** Implementa integraciones limpias bajo el estándar **MCP (Model Context Protocol)** (Resources, Tools y Prompts sobre JSON-RPC) y orquestadores de agentes LLM multi-proveedor (`OpenAI`, `Claude`, `Gemini`, `Grok`) con manejo seguro de contexto y baja latencia.

## SKILL 11: `fullstack-wp-python-security` (Seguridad Full-Stack en Servicios Auxiliares)

- **Regla Central:** En cualquier microservicio, webhook externo o integración en Python/PHP/Node, aplica consultas parametrizadas, sanitización temprana de entradas, escapado de salidas y manejo limpio de excepciones sin exponer trazas del servidor.

## SKILL 12: `google-analytics-reporting` (Analítica de Atribución y Conversión)

- **Regla Central:** Estructura métricas de adquisición, atribución UTM (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`), embudos de conversión y retorno de inversión publicitaria con precisión matemática.

---

## ESTADO DE ACTIVACIÓN

- **Fecha de activación:** 2026-11-12
- **Estado:** ✅ Las 12 habilidades están **ACTIVAS** y vigentes como directrices permanentes para todo el ciclo de desarrollo del proyecto ADLIVE CRM.
- **Ámbito:** Frontend (Next.js), Backend (Supabase/Serverless), Seguridad, QA, Arquitectura, UX/UI, Analítica e Integraciones IA/MCP.
