# 05. REGLAS INQUEBRANTABLES DE INGENIERÍA PARA KIMI 3 PRO Y ARQUITECTURA DE CÓDIGO

## 1. REGLA SAGRADA: PROHIBIDO BORRAR CÓDIGO O USAR PLACEHOLDERS
1. **Lectura Previa Obligatoria:** Antes de modificar cualquier archivo del proyecto, debes leer su contenido completo para entender qué funciones, estados, props e importaciones existen.
2. **Cero Placeholders o Código Cortado:** Está **TERMINANTEMENTE PROHIBIDO** usar comentarios como `// ... resto del código`, `/* mantener código existente */` o truncar funciones. Si modificas un archivo, debes escribir el código íntegro y funcional de principio a fin.
3. **Preservación de Lógica Existente:** Nunca borres funciones, componentes, filtros, columnas o estilos ya creados en iteraciones previas a menos que el usuario lo pida de forma explícita.

## 2. OBLIGACIÓN DE ACTUALIZAR `context/CONTEXT_LOG.md` EN CADA OUTPUT
En **CADA respuesta (output)** donde crees, edites o elimines código, estás **OBLIGADO** a actualizar el archivo `context/CONTEXT_LOG.md` y además incluir al final de tu respuesta en el chat un bloque de resumen con este formato exacto:

```markdown
### 📋 REGISTRO DE CAMBIOS (CONTEXT_LOG)
- **Iteración / Tarea:** [Nombre de la tarea ejecutada]
- **Resumen de lo realizado:** [Explicación concisa de 2 líneas]
- **Archivos Creados:**
  - `src/.../archivo.tsx`: [Qué hace este archivo]
- **Archivos Modificados:**
  - `src/.../archivo.ts`: [Qué se cambió exactamente y qué módulo/vista se vio afectado]
- **Código o Archivos Eliminados (Si aplica):**
  - [Archivo y bloque eliminado]: [Justificación técnica de por qué se eliminó y su impacto]
- **Verificación de Salud:** [Tipado TS sin `any`, diseño ADlive aplicado, reglas de preservación cumplidas]

3. ARQUITECTURA DEL PROYECTO (CLEAN FEATURE-BASED ARCHITECTURE)
Para garantizar escalabilidad empresarial y preparar la transición limpia entre Etapa A (Mock Frontend) y Etapa B (Supabase + Vercel vía MCP), el código se estructura en 3 capas estrictas:

src/app/ (Capa de Enrutamiento y Vistas Next.js): Solo contiene page.tsx, layout.tsx, loading.tsx y route.ts. Cero lógica compleja de negocio aquí; las páginas solo invocan vistas de src/features/.

src/features/[modulo]/ (Capa de Dominio Modular): Cada módulo (contacts, inbox-conversations, opportunities-kanban, workflows, whatsapp-templates, integrations, ai-bots, team, attribution, settings) contiene sus propios components/, hooks/ y schemas/.

src/shared/services/ (Capa Adaptadora de Datos para Migración MCP):

Todos los componentes leen y mutan datos llamando únicamente a funciones dentro de src/shared/services/ (ej. contactsService.getContacts(), inboxService.sendMessage()).

En la Etapa A, estos servicios leen y actualizan el estado en memoria de src/shared/mocks/.

En la Etapa B (cuando conectemos Supabase vía MCP), solo cambiaremos el interior de src/shared/services/ para que consulte Supabase real, logrando que ningún componente de la UI tenga que reescribirse.

4. PARÁMETROS DE CÓDIGO SALUDABLE
Cero any: Todo componente, prop, hook y servicio debe estar tipado con las interfaces de src/shared/types/database.ts.

Modularidad (< 250 líneas por archivo): Si una vista como Conversaciones o Ficha de Contacto es grande, divídela en subcomponentes claros (ConversationList.tsx, ChatWindow.tsx, ContactInspector.tsx) dentro de la carpeta components/ de esa feature.

Reutilización Nativa: Usa componentes base compartidos en src/shared/components/ui/ (Button, Badge, Modal, Input, Select, Tabs, Switch) para mantener consistencia absoluta en todo el CRM.