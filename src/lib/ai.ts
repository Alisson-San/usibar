import {
  FIELD_ACTIONS,
  GEMINI_DEFAULT_MODEL,
  REVIEW_SCHEMA,
  REWRITE_SCHEMA,
  acceptReview,
  acceptRewrite,
  chatSystemPrompt,
  geminiChatRequest,
  geminiError,
  geminiRequest,
  readGemini,
  readGeminiChat,
  siteState,
  systemPrompt,
} from "./ai-rules.mjs";
import { networkProblem } from "./net.mjs";
import { acceptActions } from "./site-actions.mjs";

// Server-only. The Google Gemini key is read from GEMINI_API_KEY (or GOOGLE_API_KEY) when the
// route runs, so the site works, with the assistant switched off, until the key is configured.
export const MODEL = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
const apiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
export const aiConfigured = () => Boolean(apiKey());
// Overridable only to point tests at a local stand-in for the API.
const BASE = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");

async function generate(request: object) {
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
  } catch (e) {
    const problem = networkProblem(e, "o Gemini");
    throw Object.assign(Error(problem?.message ?? "Não foi possível falar com o Gemini agora."), {
      status: problem?.kind === "timeout" ? 504 : 502,
      cause: e,
    });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { status, error } = geminiError(res.status, body, MODEL);
    throw Object.assign(Error(error), { status, detail: body?.error?.message });
  }
  return body;
}

const ask = async (schema: object, facts: string, prompt: string, maxTokens: number) =>
  readGemini(await generate(geminiRequest({ system: systemPrompt(facts), prompt, schema, maxTokens })));

export async function rewriteField(
  req: { action: keyof typeof FIELD_ACTIONS; text: string; label: string; instruction: string },
  facts: string,
) {
  const prompt = [
    `Campo do site: ${req.label}`,
    `Tarefa: ${FIELD_ACTIONS[req.action]}`,
    req.instruction && `Instrução do administrador: ${req.instruction}`,
    "Texto atual:",
    req.text,
  ]
    .filter(Boolean)
    .join("\n\n");
  const out = acceptRewrite(await ask(REWRITE_SCHEMA, facts, prompt, 8192), req.text);
  if (!out) throw Object.assign(Error("A IA não devolveu um texto utilizável."), { status: 502 });
  return out;
}

export async function reviewPage(fields: { key: string; label: string; text: string }[], facts: string) {
  const list = fields.map((f) => `[${f.key}] (${f.label})\n${f.text}`).join("\n\n");
  const prompt = [
    "Revise os textos do site abaixo como um curador editorial. Aponte erros de português, repetições, frases vagas ou longas demais, inconsistências entre seções e chamadas pouco claras.",
    "Proponha mudanças só onde houver ganho real; deixe de fora os textos que já estão bons. Use a chave exata entre colchetes.",
    "Textos:",
    list,
  ].join("\n\n");
  return acceptReview(await ask(REVIEW_SCHEMA, facts, prompt, 32768), fields);
}

type ChatMessage = { role: "user" | "assistant"; text?: string; images?: { mimeType: string; data: string }[] };
type Site = {
  sections: unknown[];
  products: unknown[];
  services?: unknown[];
  sectors?: unknown[];
  pillars?: unknown[];
  process?: unknown[];
  styles?: Record<string, unknown>;
  removables?: unknown[];
  notice?: unknown;
  images: unknown[];
  attachments: unknown[];
  company: Record<string, string>;
  socials?: unknown[];
};
type Text = { key: string; label: string; text: string };

// One turn of the editing chat: the reply plus the actions proposed, already checked against the site.
export async function chatTurn(req: { messages: ChatMessage[]; site: Site; texts: Text[] }, facts: string) {
  const system = chatSystemPrompt(facts, siteState(req.site, req.texts));
  const { text, calls } = readGeminiChat(await generate(geminiChatRequest({ system, messages: req.messages })));
  const { actions, dropped } = acceptActions(calls, req.site as Parameters<typeof acceptActions>[1], req.texts);
  return { reply: text, actions, dropped };
}

export function aiError(e: unknown): { status: number; error: string } {
  const status = (e as { status?: number }).status;
  if (status) return { status, error: (e as Error).message };
  return { status: 500, error: "Falha inesperada na IA." };
}
