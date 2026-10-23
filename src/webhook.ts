import { config } from "./config.js";
import type { Lead } from "./store.js";

export interface LeadEvent {
  evento: "lead.nuevo" | "lead.actualizado";
  empresa: string;
  lead: Lead;
  transcripcion: string;
}

/**
 * Envía el lead a LEAD_WEBHOOK_URL (Google Sheets vía Apps Script, Make, Zapier, n8n, CRM...).
 * Reintenta hasta 3 veces. Devuelve true si se entregó; el lead igual queda guardado en
 * data/leads.jsonl aunque el webhook falle.
 */
export async function sendLeadWebhook(event: LeadEvent): Promise<boolean> {
  if (!config.leadWebhookUrl) {
    console.warn("[webhook] LEAD_WEBHOOK_URL no configurado: el lead solo quedó en data/leads.jsonl");
    return false;
  }
  const body = JSON.stringify({ ...event, secret: config.leadWebhookSecret || undefined });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(config.leadWebhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.leadWebhookSecret ? { "x-webhook-secret": config.leadWebhookSecret } : {}),
        },
        body,
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return true;
      console.error(`[webhook] intento ${attempt}: HTTP ${res.status}`);
    } catch (err) {
      console.error(`[webhook] intento ${attempt}:`, (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  return false;
}
