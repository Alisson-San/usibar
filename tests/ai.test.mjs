import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptReview, acceptRewrite, clean, companyFacts, rateLimiter, validateAiRequest } from "../src/lib/ai-rules.mjs";

test("field request needs a known action and text", () => {
  assert.equal(validateAiRequest({ action: "improve", text: "Olá", label: "Título" }).ok, true);
  assert.equal(validateAiRequest({ action: "delete-site", text: "x" }).ok, false);
  assert.equal(validateAiRequest({ action: "improve", text: "   " }).ok, false);
  assert.equal(validateAiRequest({ action: "improve", text: "x".repeat(4001) }).ok, false);
});
test("custom action needs an instruction", () => {
  assert.equal(validateAiRequest({ action: "custom", text: "Olá" }).ok, false);
  assert.equal(validateAiRequest({ action: "custom", text: "Olá", instruction: "mais curto" }).ok, true);
});
test("review checks keys, sizes and duplicates", () => {
  const f = (key, text = "a") => ({ key, label: "L", text });
  assert.equal(validateAiRequest({ action: "review", fields: [f("hero.title.1")] }).ok, true);
  assert.equal(validateAiRequest({ action: "review", fields: [] }).ok, false);
  assert.equal(validateAiRequest({ action: "review", fields: [f("<x>")] }).ok, false);
  assert.equal(validateAiRequest({ action: "review", fields: [f("a"), f("a")] }).ok, false);
  assert.equal(validateAiRequest({ action: "review", fields: Array.from({ length: 11 }, (_, i) => f("k" + i, "x".repeat(3999))) }).ok, false);
});
test("answers are cleaned to plain text", () => {
  assert.equal(clean('  "**Cilindros**  sob   medida" '), "Cilindros sob medida");
  assert.deepEqual(acceptRewrite({ text: "Novo", note: "ok" }, "Velho"), { text: "Novo", note: "ok", unchanged: false });
  assert.equal(acceptRewrite({ text: "" }, "x"), null);
  assert.equal(acceptRewrite({}, "x"), null);
});
test("review keeps only real changes to fields that were sent", () => {
  const fields = [
    { key: "a", label: "A", text: "Texto A" },
    { key: "b", label: "B", text: "Texto B" },
  ];
  const out = acceptReview(
    {
      summary: "Boa página.",
      suggestions: [
        { key: "a", issue: "vago", suggestion: "Texto A melhor" },
        { key: "a", issue: "repetido", suggestion: "Outra" },
        { key: "b", issue: "igual", suggestion: "Texto B" },
        { key: "zzz", issue: "inventado", suggestion: "x" },
      ],
    },
    fields,
  );
  assert.deepEqual(out.suggestions, [{ key: "a", issue: "vago", suggestion: "Texto A melhor" }]);
  assert.equal(out.summary, "Boa página.");
});
test("rate limiter resets after the window", () => {
  let t = 0;
  const allow = rateLimiter(2, 1000, () => t);
  assert.equal(allow(), true);
  assert.equal(allow(), true);
  assert.equal(allow(), false);
  t = 1500;
  assert.equal(allow(), true);
});
test("facts come from the saved content", () => {
  const facts = companyFacts({ company: { name: "Usibar", city: "Barão/RS", experienceYears: "20+" }, services: [{ title: "Cilindros" }] });
  assert.match(facts, /Usibar/);
  assert.match(facts, /Barão\/RS/);
  assert.match(facts, /Cilindros/);
});
import { geminiError, geminiRequest, readGemini, REWRITE_SCHEMA } from "../src/lib/ai-rules.mjs";

test("Gemini request asks for JSON with the fixed schema", () => {
  const body = geminiRequest({ system: "S", prompt: "P", schema: REWRITE_SCHEMA, maxTokens: 100 });
  assert.equal(body.systemInstruction.parts[0].text, "S");
  assert.equal(body.contents[0].parts[0].text, "P");
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(body.generationConfig.responseSchema.required, ["text", "note"]);
});
test("Gemini answer is parsed, skipping thoughts and code fences", () => {
  const data = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "pensando", thought: true }, { text: '```json\n{"text":"Novo","note":"ok"}\n```' }] } }] };
  assert.deepEqual(readGemini(data), { text: "Novo", note: "ok" });
});
test("Gemini blocks and truncations become clear errors", () => {
  assert.throws(() => readGemini({ promptFeedback: { blockReason: "SAFETY" } }), /não pôde atender/);
  assert.throws(() => readGemini({ candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }), /não pôde atender/);
  assert.throws(() => readGemini({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"text":"Nov' }] } }] }), /incompleta/);
});
test("Gemini HTTP errors explain what to fix", () => {
  assert.match(geminiError(400, { error: { message: "API key not valid. Please pass a valid API key." } }, "m").error, /GEMINI_API_KEY/);
  assert.match(geminiError(404, {}, "gemini-x").error, /GEMINI_MODEL/);
  assert.equal(geminiError(429, {}, "m").status, 429);
});
