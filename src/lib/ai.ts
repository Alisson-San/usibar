import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { FIELD_ACTIONS, acceptReview, acceptRewrite, systemPrompt } from "./ai-rules.mjs";

// Server-only. The key is read from ANTHROPIC_API_KEY when the route runs, so the site works
// (with the assistant switched off) until the key is configured.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

const Rewrite = z.object({
  text: z.string().describe("O texto proposto, pronto para publicar."),
  note: z.string().describe("Uma frase curta explicando o que mudou."),
});
const Review = z.object({
  summary: z.string().describe("Avaliação geral da página em até três frases."),
  suggestions: z
    .array(
      z.object({
        key: z.string().describe("A chave exata do texto revisado."),
        issue: z.string().describe("O problema encontrado, em uma frase."),
        suggestion: z.string().describe("O texto completo proposto para substituir o original."),
      }),
    )
    .describe("Somente os textos que realmente precisam mudar."),
});

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ timeout: 90_000, maxRetries: 1 }));

async function ask<T extends z.ZodType>(schema: T, facts: string, prompt: string, maxTokens: number) {
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    // A safety decline is retried on Anthropic's recommended model instead of failing the edit.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    system: systemPrompt(facts),
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw Object.assign(Error("A IA não pôde atender este pedido."), { status: 422 });
  if (response.stop_reason === "max_tokens" || !response.parsed_output)
    throw Object.assign(Error("A resposta da IA veio incompleta. Tente de novo."), { status: 502 });
  return response.parsed_output as z.infer<T>;
}

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
  const out = acceptRewrite(await ask(Rewrite, facts, prompt, 4000), req.text);
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
  return acceptReview(await ask(Review, facts, prompt, 16000), fields);
}

export function aiError(e: unknown): { status: number; error: string } {
  if (e instanceof Anthropic.AuthenticationError) return { status: 503, error: "A chave da IA (ANTHROPIC_API_KEY) foi recusada." };
  if (e instanceof Anthropic.RateLimitError) return { status: 429, error: "A IA está com muitas solicitações agora. Tente em instantes." };
  if (e instanceof Anthropic.APIConnectionError) return { status: 502, error: "Não foi possível falar com a IA agora." };
  if (e instanceof Anthropic.APIError) return { status: 502, error: `A IA respondeu com erro (${e.status}).` };
  const status = (e as { status?: number }).status;
  if (status) return { status, error: (e as Error).message };
  return { status: 500, error: "Falha inesperada na IA." };
}
