---

### ARCHIVO 3: `context/03-reglas-diseno-adlive.md`

```markdown
# 03. SISTEMA DE DISEÑO ADLIVE Y REGLAS UI/UX PARA NEXT.JS

## 1. IDENTIDAD VISUAL Y PALETA DE COLORES (ADLIVE BRAND)
Toda la interfaz debe construirse con la identidad visual de **ADlive**: tecnológica, limpia, con acentos en **Violeta Eléctrico**, **Cian Digital**, **Lima Ácido** y barra lateral en **Negro Obsidiana Profundo** sobre un lienzo **Gris Alabastro**.

### Variables CSS y Tokens de Tailwind (`src/app/globals.css`)
```css
:root {
  /* Marca Principal ADlive */
  --adlive-primary: #5B00FF;          /* Violeta Eléctrico: Botones primarios, ítem activo del Sidebar, burbujas salientes */
  --adlive-primary-hover: #4800CC;    /* Hover de botones primarios */
  --adlive-primary-light: #F2EBFF;    /* Fondos suaves de filas/chats seleccionados y píldoras activas */

  /* Acentos Secundarios ADlive */
  --adlive-cyan: #29C5F6;             /* Cian Digital: Degradados de marca, badges de IA, enlaces e íconos informativos */
  --adlive-cyan-light: #E6F8FE;       /* Fondo suave para alertas informativas (ej. banner de Integraciones/Bots IA) */
  --adlive-lime: #E6FF00;             /* Lima Ácido Neón: Acento de alto contraste, estrellas de seguimiento y destacados */

  /* Superficies y Estructura */
  --adlive-sidebar-bg: #0A0A12;       /* Negro Obsidiana Profundo: Sidebar lateral izquierdo fijo (260px) */
  --adlive-sidebar-card: #141424;     /* Superficie del selector de cuenta en el Sidebar */
  --adlive-canvas-bg: #ECEEF2;        /* Gris Alabastro Frío: Fondo general detrás de las tarjetas */
  --adlive-card-bg: #FFFFFF;          /* Blanco Puro: Tarjetas KPI, tablas, paneles de chat y modales */
  --adlive-border: #E2E5EC;           /* Bordes sutiles de 1px en tablas, inputs y divisores */

  /* Tipografía (Contraste WCAG 2.2 AA) */
  --adlive-text-main: #0F111A;        /* Títulos, nombres de contactos y cifras KPI */
  --adlive-text-muted: #5E6478;       /* Subtítulos, etiquetas secundarias, fechas y placeholders */
  --adlive-text-inverse: #FFFFFF;     /* Texto sobre botones violetas y barra lateral oscura */

  /* Colores Semánticos Operativos */
  --adlive-success: #10B981;          /* Verde Esmeralda: WhatsApp conectado, Oportunidades Ganadas, Plantilla Aprobada */
  --adlive-warning: #F59E0B;          /* Ámbar: En seguimiento, alerta de ventana de 24 horas */
  --adlive-danger: #EF4444;           /* Rojo Coral: Badge "Sin responder", badge "nuevo", Oportunidades Perdidas */
}

2. REGLAS DE MAQUETACIÓN Y COMPONENTES EN NEXT.JS
Tipografía Optimizada (next/font/google):

Fuente UI principal: Plus Jakarta Sans o Inter (pesos 400, 500, 600, 700).

Fuente Monoespaciada: JetBrains Mono para teléfonos (573207949885), tokens de webhook, etiquetas de lotes (06112026v4) y cifras monetarias (tabular-nums).

Estructura del Layout Principal (src/app/(dashboard)/layout.tsx):

Sidebar Izquierdo Fijo (w-64, fondo #0A0A12): Logo superior con ícono en degradado #5B00FF -> #29C5F6 y texto ADlive CRM. Debajo, selector desplegable de cuenta (Movistar Juancho / ADMIN), seguido de los 11 enlaces de navegación con íconos Lucide (Dashboard, Contactos, Oportunidades, Conversaciones, Automatizaciones, Plantillas, Integraciones, Bots IA, Equipo, Atribución, Ajustes). El ítem activo lleva fondo var(--adlive-primary) (#5B00FF) y bordes redondeados rounded-xl. Pie de sidebar con texto sutil: "Conecta WhatsApp, Meta Ads y TikTok Ads desde Integraciones".

Topbar Superior (h-16, fondo #FFFFFF, border-b): A la izquierda muestra el título de la vista actual y su subtítulo descriptivo. A la derecha muestra los botones de acción contextuales de la vista, el selector rápido de cuenta (Cambiar de cuenta), el correo del usuario logueado y el botón de cerrar sesión.

Burbujas de Chat en Conversaciones y Ficha 360°:

Mensajes Salientes (Outbound / Plantillas enviadas por el CRM): Fondo Violeta Eléctrico #5B00FF (o versión lectura suave #4800CC) con texto blanco #FFFFFF, bordes rounded-2xl rounded-tr-sm, hora y doble check a la derecha.

Mensajes Entrantes (Inbound del Cliente): Fondo blanco #FFFFFF con borde 1px solid #E2E5EC, texto #0F111A y bordes rounded-2xl rounded-tl-sm.

Cero Saltos de Diseño (CLS = 0) y Estados Completos:

Toda vista debe implementar sus estados loading (Skeletons), empty (estado vacío amigable cuando un filtro no arroja datos), error y hover/focus-visible.

Todo elemento interactivo debe usar etiquetas semánticas (<button type="button">, <Link>, <dialog>) con cursor-pointer y transiciones suaves de 150ms.