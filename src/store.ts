import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import type { LeadInput } from "./tools.js";
import type { Channel } from "./prompt.js";

export interface Lead extends LeadInput {
  id: string;
  sessionId: string;
  creadoEn: string;
  actualizadoEn: string;
  paginaOrigen: string | null;
}

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  pageUrl: string | null;
  /** Canal fijado al iniciar la conversación (define qué prompt de sistema se usa). */
  channel: Channel;
  userTurns: number;
  /** Historial completo tal como se envía a la API (solo se agrega, nunca se edita). */
  messages: Anthropic.Beta.BetaMessageParam[];
  leadId: string | null;
}

const convDir = path.join(config.dataDir, "conversaciones");
const leadsFile = path.join(config.dataDir, "leads.jsonl");
fs.mkdirSync(convDir, { recursive: true });

const sessions = new Map<string, Session>();

const SESSION_ID = /^[a-zA-Z0-9_-]{8,64}$/;
export const isValidSessionId = (id: string) => SESSION_ID.test(id);

export function getOrCreateSession(id: string, pageUrl: string | null, channel: Channel): Session {
  const cached = sessions.get(id);
  if (cached) return cached;
  const file = path.join(convDir, `${id}.json`);
  if (fs.existsSync(file)) {
    const loaded = JSON.parse(fs.readFileSync(file, "utf8")) as Session;
    loaded.channel ??= "texto";
    sessions.set(id, loaded);
    return loaded;
  }
  const now = new Date().toISOString();
  const session: Session = {
    id,
    createdAt: now,
    updatedAt: now,
    pageUrl,
    channel,
    userTurns: 0,
    messages: [],
    leadId: null,
  };
  sessions.set(id, session);
  return session;
}

export function saveSession(session: Session): void {
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(convDir, `${session.id}.json`), JSON.stringify(session, null, 2));
}

/** Transcripción legible (solo texto) para enviar al equipo junto con el lead. */
export function transcript(session: Session): string {
  const lines: string[] = [];
  for (const m of session.messages) {
    const parts = typeof m.content === "string" ? [{ type: "text", text: m.content }] : (m.content ?? []);
    const text = parts
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) lines.push(`${m.role === "user" ? "Visitante" : "Asistente"}: ${text}`);
  }
  return lines.join("\n\n");
}

export function upsertLead(session: Session, input: LeadInput): { lead: Lead; isNew: boolean } {
  const now = new Date().toISOString();
  const isNew = session.leadId === null;
  const lead: Lead = {
    ...input,
    id: session.leadId ?? `lead_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    sessionId: session.id,
    creadoEn: isNew ? now : findLeadCreatedAt(session.leadId!) ?? now,
    actualizadoEn: now,
    paginaOrigen: session.pageUrl,
  };
  session.leadId = lead.id;
  fs.appendFileSync(leadsFile, JSON.stringify(lead) + "\n");
  return { lead, isNew };
}

function findLeadCreatedAt(leadId: string): string | null {
  if (!fs.existsSync(leadsFile)) return null;
  for (const line of fs.readFileSync(leadsFile, "utf8").split("\n")) {
    if (!line) continue;
    const l = JSON.parse(line) as Lead;
    if (l.id === leadId) return l.creadoEn;
  }
  return null;
}
