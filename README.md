# Bot conversacional — Senda Consultora

Asistente **por voz** con IA (Claude) para el sitio web de Senda Consultora. Conversa con los visitantes,
los asesora sobre los servicios de la consultora (marketing, estrategia comercial, finanzas,
IA y otros), registra cada consulta y envía los leads calificados al equipo por webhook.

```
Sitio web ──(widget.js)──► Servidor Node (/api/chat) ──► API de Claude
                                   │
                                   ├─ data/conversaciones/*.json   (todas las consultas)
                                   ├─ data/leads.jsonl             (todos los leads)
                                   └─ LEAD_WEBHOOK_URL ──► Google Sheets / Zapier / Make / CRM
```

## Puesta en marcha

```bash
npm install
cp .env.example .env     # completar ANTHROPIC_API_KEY y, si querés, LEAD_WEBHOOK_URL
npm run dev              # http://localhost:3000 abre una página demo con el chat
```

Producción: `npm run build && npm start` (sirve en cualquier hosting con Node 20+: Render,
Railway, Fly.io, un VPS…). La carpeta `data/` tiene que estar en un disco persistente.

## Nutrir al bot con información

Todo lo que el bot sabe de la consultora está en `knowledge/`, en archivos Markdown:

| Archivo | Contenido |
|---|---|
| `00-empresa.md` | Quiénes somos, proceso de trabajo, contacto, casos de éxito |
| `10-marketing.md` | Investigación y análisis, growth marketing, paid media |
| `20-comercial.md` | Estrategia comercial |
| `30-finanzas.md` | Servicios de finanzas |
| `40-inteligencia-artificial.md` | Servicios de IA |
| `50-otros-servicios.md` | Resto de los servicios |
| `90-preguntas-frecuentes.md` | Precios, plazos, modalidad, etc. |

- Reemplazá los `TODO` con información real. Lo que figure como `TODO` o no esté escrito, el
  bot **no lo inventa**: responde que lo confirma el equipo.
- Podés agregar más archivos `.md` (se leen en orden alfabético).
- Después de editar, reiniciá el servidor.

El tono, los objetivos y las reglas de la conversación están en `src/prompt.ts`.

## Leads al equipo (webhook)

Cuando la persona quiere avanzar y dejó nombre + email o teléfono, el bot llama a la
herramienta `registrar_lead`. El servidor:

1. Guarda el lead en `data/leads.jsonl`.
2. Hace un `POST` JSON a `LEAD_WEBHOOK_URL` con este formato:

```json
{
  "evento": "lead.nuevo",            // o "lead.actualizado" si suma datos después
  "empresa": "Senda Consultora",
  "secret": "…",                      // = LEAD_WEBHOOK_SECRET (también va en el header x-webhook-secret)
  "lead": {
    "id": "lead_…", "nombre": "Ana Pérez", "email": "ana@…", "telefono": null,
    "empresa": "Panadería Ana", "rubro": "gastronomía, 2 locales",
    "servicios_interes": ["paid_media", "growth_marketing"],
    "necesidad": "Resumen para el comercial…", "presupuesto": "USD 500/mes",
    "urgencia": "inmediata", "canal_preferido": "whatsapp", "calificacion": "caliente",
    "notas": null, "sessionId": "s_…", "paginaOrigen": "https://…",
    "creadoEn": "…", "actualizadoEn": "…"
  },
  "transcripcion": "Visitante: …\n\nAsistente: …"
}
```

**Google Sheets** (lo más simple para empezar): seguí las instrucciones de
`docs/google-sheets-apps-script.gs`. Arma una planilla con una fila por lead y, opcionalmente,
manda un email al equipo con cada lead nuevo.

Con **Zapier / Make / n8n** usá un trigger "Webhook" y pegá su URL en `LEAD_WEBHOOK_URL`; desde
ahí lo podés mandar a HubSpot, Pipedrive, Slack, etc.

## Cómo funciona la voz

El widget es una "llamada" manos libres dentro de la web: la persona toca **Hablá con
nosotros**, el asistente la saluda en voz alta y a partir de ahí conversan por turnos. El bot
escucha, responde con voz (empieza a hablar apenas tiene la primera oración) y vuelve a escuchar.

- Usa el reconocimiento y la síntesis de voz **del navegador**: sin costo extra. Funciona en
  Chrome, Edge y Safari (computadora y celular). En Firefox no hay reconocimiento de voz, así
  que ofrece escribir.
- La transcripción de lo que se dice queda en pantalla como subtítulos.
- Tocar la esfera mientras el bot habla lo interrumpe y vuelve a escuchar. Después de 3
  silencios seguidos se pausa para no dejar el micrófono abierto.
- Botón **Prefiero escribir** para quien no quiera o no pueda hablar.
- En modo voz el bot usa reglas propias (`src/prompt.ts`): respuestas de 1 a 3 oraciones,
  sin listas ni emojis, prefiere pedir teléfono/WhatsApp y repite los datos de contacto para
  confirmarlos antes de registrar el lead.
- **Requiere HTTPS** en el sitio (el navegador no habilita el micrófono en http, salvo en localhost).
- La calidad de la voz depende del dispositivo (en Chrome suele usar las voces de Google). Si
  más adelante se quiere una voz más natural, se puede cambiar por un servicio pago como
  ElevenLabs sin tocar el resto.

## Insertar el widget en el sitio web

Antes de `</body>`:

```html
<script src="https://TU-SERVIDOR/widget.js" defer
        data-title="Senda Consultora"
        data-color="#0f766e"></script>
```

Y agregá el dominio del sitio a `ALLOWED_ORIGINS` en `.env`. Otros atributos opcionales:
`data-subtitle`, `data-greeting` (el saludo hablado), `data-lang` (idioma de la voz, por defecto
`es-AR`; ej. `es-ES`, `es-MX`), `data-api` (si el servidor está en otra URL que el script).
Funciona en WordPress, Webflow, Wix, Tiendanube, etc. (cualquier lugar donde se pueda pegar un script).

## Detalles técnicos

- **Modelo**: `claude-opus-5-5` con `effort: low` (respuestas rápidas). Configurable con
  `BOT_MODEL` / `BOT_EFFORT`.
- **Costos**: el prompt de sistema con la base de conocimiento se cachea (prompt caching), así
  que cada mensaje solo paga completo lo nuevo de la conversación.
- **Fallbacks**: si el modelo declina una consulta por sus filtros de seguridad, la API la
  reintenta automáticamente con otro modelo (`ENABLE_FALLBACKS=false` para desactivarlo).
- **Anti-abuso**: límite de mensajes por IP, largo máximo por mensaje y cantidad máxima de
  turnos por conversación (ver `.env.example`).
- Las respuestas llegan en streaming (Server-Sent Events), como en ChatGPT/Claude.

## Estructura

```
src/
  server.ts     API HTTP (/api/chat en streaming), CORS, límites
  agent.ts      Conversación con Claude + ejecución de herramientas
  prompt.ts     Personalidad, objetivos y reglas del asistente
  tools.ts      Herramienta registrar_lead (esquema del lead)
  store.ts      Sesiones, conversaciones y leads en disco
  webhook.ts    Envío de leads al webhook (con reintentos)
  knowledge.ts  Carga de la base de conocimiento
  config.ts     Variables de entorno
public/
  widget.js     Widget de voz embebible (sin dependencias)
  index.html    Página demo
knowledge/      Base de conocimiento (Markdown)
docs/           Script de Google Sheets
```

## Próximos pasos posibles

- WhatsApp (misma lógica, otro canal de entrada).
- Panel interno para ver conversaciones y leads.
- Agenda automática de reuniones (Google Calendar / Calendly).
- Conexión directa con el CRM.
