import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { loadKnowledge } from "./knowledge.js";
import { buildSystemPrompt } from "./prompt.js";
import { LeadInput, tools } from "./tools.js";
import { saveSession, transcript, upsertLead, type Session } from "./store.js";
import { sendLeadWebhook } from "./webhook.js";

const client = new Anthropic();

// El prompt de sistema (instrucciones + base de conocimiento) es fijo durante toda la vida
// del proceso, así se cachea y cada mensaje cuesta mucho menos.
const system: Anthropic.Beta.BetaTextBlockParam[] = [
  {
    type: "text",
    text: buildSystemPrompt(loadKnowledge(config.knowledgeDir)),
    cache_control: { type: "ephemeral" },
  },
];

export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "lead"; registrado: boolean }
  | { type: "done" };

const MAX_TOOL_ROUNDS = 4;
const REFUSAL_TEXT =
  "Disculpá, no puedo ayudarte con eso. ¿Querés que te cuente sobre nuestros servicios o que alguien del equipo te contacte?";

/**
 * Agrega el mensaje del usuario a la sesión, llama al modelo en streaming y va emitiendo
 * eventos para el navegador. Ejecuta la herramienta registrar_lead cuando el modelo la pide.
 */
export async function* chat(session: Session, userText: string): AsyncGenerator<ChatEvent> {
  const historyLength = session.messages.length;
  session.messages.push({ role: "user", content: userText });
  session.userTurns++;

  let wroteText = false;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    let roundText = false;
    const stream = client.beta.messages.stream({
      model: config.model,
      max_tokens: 16000,
      system,
      tools,
      messages: session.messages,
      cache_control: { type: "ephemeral" },
      output_config: { effort: config.effort },
      ...(config.enableFallbacks
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        // Separa el texto anterior y posterior a una llamada a herramienta.
        const sep = wroteText && !roundText ? "\n\n" : "";
        roundText = wroteText = true;
        yield { type: "delta", text: sep + event.delta.text };
      }
    }
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      // Se descarta el turno completo (con el mensaje que lo causó) para que la
      // conversación pueda seguir normalmente.
      session.messages.length = historyLength;
      yield { type: "delta", text: REFUSAL_TEXT };
      break;
    }

    // Se guarda el contenido completo (incluidos bloques de razonamiento) tal cual vino.
    session.messages.push({ role: "assistant", content: message.content });

    const toolUses = message.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    if (toolUses.length === 0 || message.stop_reason === "max_tokens") break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of toolUses) {
      results.push(await runTool(session, call));
      if (call.name === "registrar_lead") {
        yield { type: "lead", registrado: results.at(-1)!.is_error !== true };
      }
    }
    session.messages.push({ role: "user", content: results });
    saveSession(session);
  }

  saveSession(session);
  yield { type: "done" };
}

async function runTool(
  session: Session,
  call: Anthropic.Beta.BetaToolUseBlock,
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  if (call.name !== "registrar_lead") {
    return { type: "tool_result", tool_use_id: call.id, is_error: true, content: "Herramienta desconocida." };
  }
  const parsed = LeadInput.safeParse(call.input);
  if (!parsed.success) {
    return {
      type: "tool_result",
      tool_use_id: call.id,
      is_error: true,
      content: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const { lead, isNew } = upsertLead(session, parsed.data);
  saveSession(session);
  // El webhook se envía en segundo plano para no demorar la respuesta al visitante.
  void sendLeadWebhook({
    evento: isNew ? "lead.nuevo" : "lead.actualizado",
    empresa: config.companyName,
    lead,
    transcripcion: transcript(session),
  }).then((ok) => console.log(`[lead] ${lead.id} ${isNew ? "nuevo" : "actualizado"} · webhook: ${ok ? "ok" : "no enviado"}`));
  return {
    type: "tool_result",
    tool_use_id: call.id,
    content: isNew
      ? "Lead registrado y enviado al equipo comercial."
      : "Lead actualizado con los nuevos datos.",
  };
}
