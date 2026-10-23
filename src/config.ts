import "dotenv/config";
import path from "node:path";

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${name} debe ser un número (recibido: ${raw})`);
  return n;
}

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

function effort(): Effort {
  const raw = process.env.BOT_EFFORT ?? "low";
  if (!(EFFORTS as readonly string[]).includes(raw)) {
    throw new Error(`BOT_EFFORT debe ser uno de ${EFFORTS.join(", ")}`);
  }
  return raw as Effort;
}

export const config = {
  port: num("PORT", 3000),
  companyName: process.env.COMPANY_NAME ?? "Senda Consultora",
  botName: process.env.BOT_NAME ?? "Senda",
  model: process.env.BOT_MODEL ?? "claude-opus-5-5",
  effort: effort(),
  // Si el modelo declina una consulta por sus filtros de seguridad, la API la reintenta
  // automáticamente con otro modelo. Poner ENABLE_FALLBACKS=false para desactivarlo.
  enableFallbacks: process.env.ENABLE_FALLBACKS !== "false",
  knowledgeDir: path.resolve(process.env.KNOWLEDGE_DIR ?? "knowledge"),
  dataDir: path.resolve(process.env.DATA_DIR ?? "data"),
  leadWebhookUrl: process.env.LEAD_WEBHOOK_URL ?? "",
  leadWebhookSecret: process.env.LEAD_WEBHOOK_SECRET ?? "",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  maxMessageChars: num("MAX_MESSAGE_CHARS", 2000),
  maxUserTurns: num("MAX_USER_TURNS", 40),
  rateLimitPerWindow: num("RATE_LIMIT_MESSAGES", 20),
  rateLimitWindowMs: num("RATE_LIMIT_WINDOW_MINUTES", 10) * 60_000,
};
