import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { chat } from "./agent.js";
import { getOrCreateSession, isValidSessionId, saveSession } from "./store.js";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

// CORS: permite que el widget funcione embebido en el sitio de la consultora.
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && (config.allowedOrigins.includes("*") || config.allowedOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  }
  if (req.method === "OPTIONS") return void res.sendStatus(204);
  next();
});

app.use(express.static(path.resolve("public")));

// Límite simple de mensajes por IP para evitar abusos (cada mensaje tiene costo).
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < config.rateLimitWindowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > config.rateLimitPerWindow;
}

const busy = new Set<string>();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req: Request, res: Response) => {
  const { sessionId, message, pageUrl, channel } = req.body ?? {};
  if (typeof sessionId !== "string" || !isValidSessionId(sessionId)) {
    return void res.status(400).json({ error: "sessionId inválido" });
  }
  if (typeof message !== "string" || !message.trim()) {
    return void res.status(400).json({ error: "Mensaje vacío" });
  }
  if (message.length > config.maxMessageChars) {
    return void res.status(400).json({ error: `El mensaje supera los ${config.maxMessageChars} caracteres` });
  }
  if (rateLimited(req.ip ?? "unknown")) {
    return void res.status(429).json({ error: "Demasiados mensajes. Probá de nuevo en unos minutos." });
  }
  if (busy.has(sessionId)) {
    return void res.status(409).json({ error: "Esperá a que termine la respuesta anterior." });
  }

  const session = getOrCreateSession(
    sessionId,
    typeof pageUrl === "string" ? pageUrl.slice(0, 500) : null,
    channel === "voz" ? "voz" : "texto",
  );
  if (session.userTurns >= config.maxUserTurns) {
    return void res.status(429).json({
      error: "Llegamos al límite de esta conversación. Dejanos tus datos o escribinos por nuestros canales de contacto.",
    });
  }

  busy.add(sessionId);
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const historyLength = session.messages.length;
  const turnsBefore = session.userTurns;
  try {
    for await (const ev of chat(session, message.trim())) {
      send(ev.type, ev);
    }
  } catch (err) {
    // Si la llamada falló, se deshace el turno para que el historial quede consistente.
    session.messages.length = historyLength;
    session.userTurns = turnsBefore;
    saveSession(session);
    if (err instanceof Anthropic.RateLimitError) {
      console.error("[chat] rate limit de la API");
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[chat] error de API ${err.status}:`, err.message);
    } else {
      console.error("[chat] error:", err);
    }
    send("error", { message: "Tuvimos un problema técnico. ¿Podés intentar de nuevo en un momento?" });
  } finally {
    busy.delete(sessionId);
    res.end();
  }
});

app.listen(config.port, () => {
  console.log(`${config.botName} (${config.companyName}) escuchando en http://localhost:${config.port}`);
  console.log(`Modelo: ${config.model} · effort: ${config.effort} · webhook: ${config.leadWebhookUrl ? "configurado" : "NO configurado"}`);
});
