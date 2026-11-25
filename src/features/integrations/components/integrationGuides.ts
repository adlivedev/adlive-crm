import type { IntegrationProvider } from "@/shared/types/database";

export interface GuideStep { title: string; detail: string; }
export interface IntegrationGuide { intro: string; steps: GuideStep[]; }

/** Guías paso a paso por proveedor: dónde sacar cada credencial y dónde pegar la URL de webhook. */
export const INTEGRATION_GUIDES: Record<IntegrationProvider, IntegrationGuide> = {
  whatsapp_cloud_api: {
    intro: "Conecta la línea oficial de WhatsApp de esta empresa a través de Meta for Developers.",
    steps: [
      { title: "Crea la app en Meta", detail: "Entra a developers.facebook.com con la cuenta de la empresa → «Mis apps» → «Crear app» → tipo «Empresa». Añade el producto «WhatsApp»." },
      { title: "Saca el Phone Number ID y WABA ID", detail: "En WhatsApp → «Configuración de la API»: copia «ID de número de teléfono» (Phone Number ID) y el «ID de la cuenta de WhatsApp Business» (WABA ID) y pégalos aquí." },
      { title: "Genera el Access Token permanente", detail: "En «Usuarios del sistema» crea un usuario del sistema con rol Administrador y genera un token permanente (empieza por EAAG…). Nunca uses el token temporal de prueba: caduca en 24 horas." },
      { title: "Copia el App Secret", detail: "En «Configuración» → «Básica» → «Secreto de la app» pulsa «Mostrar» y copia el secreto." },
      { title: "Configura el webhook en Meta", detail: "En WhatsApp → «Configuración» pega la «URL de Webhook Individual» de arriba y el «Verify Token Individual». Meta enviará un GET de verificación; cuando responda 200, suscríbete al campo «messages»." },
    ],
  },
  facebook_lead_ads: {
    intro: "Recibe los leads de tus formularios de Facebook e Instagram directamente en el CRM.",
    steps: [
      { title: "Crea una app en Meta for Developers", detail: "developers.facebook.com → «Crear app» → tipo «Empresa», y añade los productos «Marketing API» y «Webhooks»." },
      { title: "Saca el Ad Account ID", detail: "En business.facebook.com → «Configuración de empresa» → «Cuentas publicitarias»: el ID empieza por act_." },
      { title: "Obtén el Page ID", detail: "En tu página → «Acerca de» → más información, o desde la Graph API Explorer con /me/accounts. Es el ID numérico de la página." },
      { title: "Genera el Access Token", detail: "En «Herramientas» → «Graph API Explorer» genera un token con permisos pages_manage_ads, leads_retrieval y pages_read_engagement; cámbialo a token de larga duración (60 días). Empieza por EAAG…." },
      { title: "Copia el App Secret", detail: "«Configuración» → «Básica» → «Secreto de la app»." },
      { title: "Suscríbete al webhook de leads", detail: "En la app → «Webhooks» pega la «URL de Webhook Individual» y el «Verify Token Individual», y suscríbete al objeto «lead». Facebook validará el token con un GET." },
    ],
  },
  instagram: {
    intro: "Recibe leads y mensajes de tu cuenta profesional de Instagram con atribución aislada por empresa.",
    steps: [
      { title: "Vincula Instagram con la página de Facebook", detail: "La cuenta debe ser Profesional/Creador y estar vinculada a tu página de Facebook desde la configuración de Instagram." },
      { title: "Crea la app en Meta for Developers", detail: "Añade los productos «Instagram» y «Webhooks» con permisos instagram_manage_messages e instagram_basic." },
      { title: "Saca el IG User ID", detail: "Con el token en Graph API Explorer llama /me/accounts → /{page-id}?fields=instagram_business_account. El ID numérico es tu IG User ID (17841…)." },
      { title: "Genera el Access Token", detail: "Token de larga duración con permisos de la página y de Instagram (EAAG…)." },
      { title: "Copia el App Secret y Page ID", detail: "App Secret en «Configuración» → «Básica»; Page ID en la página → «Acerca de»." },
      { title: "Suscríbete al webhook", detail: "Pega la «URL de Webhook Individual» + «Verify Token Individual» en «Webhooks» y suscríbete a instagram. Meta validará con GET antes de activar." },
    ],
  },
  tiktok_ads: {
    intro: "Recibe leads firmados de tus campañas de TikTok Ads.",
    steps: [
      { title: "Crea una app en TikTok for Developers", detail: "developers.tiktok.com → «Crear app» con permisos de Leads (Data Portability API)." },
      { title: "Saca el Advertiser ID", detail: "En Ads Manager → «Cuenta» → «Información de la cuenta»: el Advertiser ID es numérico largo (p. ej. 7123456789012345678)." },
      { title: "Genera el Access Token", detail: "En la app → «Auth» genera el token de acceso (tltk…). Tiene caducidad: renóvalo antes de que venza." },
      { title: "Copia el Webhook Access Secret", detail: "En «Eventos / Webhooks» de la app de TikTok genera el secreto para validar la cabecera X-TikTok-Signature." },
      { title: "Registra el webhook", detail: "En TikTok Ads Manager → «Eventos» → «Webhooks» registra la «URL de Webhook Individual». TikTok la verificará con un POST de prueba firmado." },
    ],
  },
  twilio: {
    intro: "Recibe SMS y llamadas validados con el Auth Token exclusivo de esta empresa.",
    steps: [
      { title: "Crea la cuenta en Twilio", detail: "twilio.com → regístrate y verifica tu empresa." },
      { title: "Saca el Account SID", detail: "En la consola principal (dashboard) copia el «ACCOUNT SID» (empieza por AC…)." },
      { title: "Copia el Auth Token", detail: "En el mismo dashboard, junto al SID, pulsa «show» en «AUTH TOKEN». Se guarda cifrado con AES-256-GCM." },
      { title: "Configura el webhook en el número", detail: "En «Phone Numbers» → tu número → «Messaging» pega la «URL de Webhook Individual» como «A MESSAGE COMES IN» webhook. Twilio valida con una firma X-Twilio-Signature que el servidor verifica con tu Auth Token." },
    ],
  },
  telnyx: {
    intro: "Recibe mensajes SMS con validación Ed25519 y tu Messaging Profile propio.",
    steps: [
      { title: "Crea la cuenta en Telnyx", detail: "telnyx.com → regístrate y completa la verificación de empresa." },
      { title: "Genera la API Key", detail: "En «Auth» → «API Keys» → «Create API Key» (empieza por KEY018…). Se guarda cifrada en el servidor." },
      { title: "Crea el Messaging Profile", detail: "En «Messaging» → «Messaging Profiles» → «Add new profile». Copia su ID (UUID, p. ej. 4001789a-…)." },
      { title: "Copia la Public Key Ed25519", detail: "En «Auth» → «Public Keys» copia la clave pública Base64 para validar la firma de los webhooks." },
      { title: "Asigna el webhook al perfil", detail: "Dentro del Messaging Profile → «Inbound» pega la «URL de Webhook Individual» como webhook entrante. Telnyx firma cada evento y el servidor lo verifica con tu clave pública." },
    ],
  },
};
