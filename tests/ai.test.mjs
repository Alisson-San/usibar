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

// ---- Chat -------------------------------------------------------------------------------------
import { chatSystemPrompt, geminiChatRequest, readGeminiChat, siteState, validateChatRequest } from "../src/lib/ai-rules.mjs";

const chatSite = {
  sections: [{ id: "solutions", type: "solutions", name: "Soluções", hidden: false }, { id: "abc123", type: "testimonial", name: "Depoimento", hidden: true }],
  products: [{ id: "cil-1", code: "USB-CH-01", title: "Cilindro", category: "cilindros", featured: true }],
  company: { phoneDisplay: "(51) 3696-9839", whatsapp: "555136969839" },
  socials: [{ network: "instagram", url: "https://instagram.com/usibar" }],
  images: [{ target: "hero", label: "a foto do topo" }],
  attachments: [{ id: "foto-1", name: "peca.jpg" }],
};
const chatTexts = [{ key: "hero.title.1", label: "Topo — título", text: "Componentes hidráulicos" }];
const chatBody = (messages, extra = {}) => ({ action: "chat", messages, site: chatSite, texts: chatTexts, ...extra });

test("chat requests: conversation, photos and site state are checked", () => {
  const photo = { mimeType: "image/jpeg", data: "QUJD" };
  assert.equal(validateAiRequest(chatBody([{ role: "user", text: "Cadastre esta peça", images: [photo] }])).ok, true);
  assert.equal(validateAiRequest(chatBody([{ role: "user", text: "", images: [photo] }])).ok, true);
  assert.equal(validateAiRequest(chatBody([{ role: "user", text: "oi" }, { role: "assistant", text: "Olá" }])).ok, false, "last must be the admin");
  assert.equal(validateAiRequest(chatBody([{ role: "user", text: "x", images: [{ mimeType: "image/svg+xml", data: "QUJD" }] }])).ok, false);
  assert.equal(validateAiRequest(chatBody([{ role: "user", text: "x", images: [{ mimeType: "image/png", data: "<script>" }] }])).ok, false);
  assert.equal(validateAiRequest(chatBody([{ role: "user", text: "x" }], { site: { ...chatSite, company: { senha: "x" } } })).ok, false);
  assert.equal(validateAiRequest(chatBody([{ role: "system", text: "x" }])).ok, false);
  const long = Array.from({ length: 41 }, () => ({ role: "user", text: "x" }));
  assert.equal(validateAiRequest(chatBody(long)).ok, false);
});

test("the model sees the ids it may use, and the rules", () => {
  const state = siteState(chatSite, chatTexts);
  for (const s of ["1. [solutions] Soluções (fixa)", "[abc123] Depoimento (modelo Depoimento, oculta)", "[cil-1] USB-CH-01", "hero — a foto do topo", "foto-1 (peca.jpg)", "[hero.title.1] Topo — título: Componentes hidráulicos", "recolocadas com add_section): process"])
    assert.ok(state.includes(s), s);
  const prompt = chatSystemPrompt("Nome: Usibar", state);
  assert.match(prompt, /Nunca invente ids/);
  assert.match(prompt, /Não invente números/);
});

test("chat request carries tools, merges turns and sends photos inline", () => {
  const req = geminiChatRequest({
    system: "S",
    messages: [
      { role: "assistant", text: "Olá! Como posso ajudar?" },
      { role: "user", text: "Use esta foto", images: [{ mimeType: "image/webp", data: "QUJD" }] },
      { role: "user", text: "no topo" },
    ],
  });
  assert.equal(req.contents.length, 1, "leading assistant turn skipped, user turns merged");
  assert.deepEqual(req.contents[0].parts[1], { inlineData: { mimeType: "image/webp", data: "QUJD" } });
  assert.ok(req.tools[0].functionDeclarations.some((f) => f.name === "move_section"));
  assert.equal(req.toolConfig.functionCallingConfig.mode, "AUTO");
  assert.equal(req.generationConfig.responseSchema, undefined, "tools and JSON mode do not mix");
});

test("chat responses: text and function calls, thoughts skipped, bad calls reported", () => {
  const out = readGeminiChat({
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [
            { text: "pensando…", thought: true },
            { text: "Preparei **duas** alterações:\n* mover\n* ocultar" },
            { functionCall: { name: "move_section", args: { section: "solutions", position: 2 } }, thoughtSignature: "abc" },
            { functionCall: { name: "review_texts" } },
          ],
        },
      },
    ],
  });
  assert.equal(out.text, "Preparei duas alterações:\n- mover\n- ocultar");
  assert.deepEqual(out.calls, [
    { name: "move_section", args: { section: "solutions", position: 2 } },
    { name: "review_texts", args: {} },
  ]);
  assert.throws(() => readGeminiChat({ candidates: [{ finishReason: "MALFORMED_FUNCTION_CALL", content: { parts: [] } }] }), /ação inválida/);
  assert.throws(() => readGeminiChat({ candidates: [{ finishReason: "STOP", content: { parts: [] } }] }), /não devolveu/);
});

test("a conversation carries up to eight photos", () => {
  const photo = { mimeType: "image/jpeg", data: "QUJD" };
  const withPhotos = (n) => chatBody([{ role: "user", text: "Galeria", images: Array.from({ length: n }, () => photo) }]);
  assert.equal(validateAiRequest(withPhotos(8)).ok, true);
  assert.equal(validateAiRequest(withPhotos(9)).ok, false);
});

test("chat accepts enriched structured sections and custom text box coordinates", () => {
  const richSite = {
    ...chatSite,
    services: [{ id: "cilindros", title: "Cilindros hidráulicos", lead: "Sob medida", copy: "Simples e dupla ação.", category: "cilindros" }],
    sectors: [{ id: "agricola", name: "Agrícola", code: "SEC-01" }],
    pillars: [{ id: "p1", title: "Sob medida", desc: "Conforme desenho." }],
    process: [
      { label: "O desenho", title: "Projeto.", copy: "Etapa 1." },
      { label: "A usinagem", title: "CNC.", copy: "Etapa 2." },
      { label: "O movimento", title: "Teste.", copy: "Etapa 3." },
    ],
    styles: { "hero.title.1": { width: 90, x: 0, y: 100 } },
  };
  assert.equal(validateAiRequest(chatBody([{ role: "user", text: "Cadastre 2 cilindros" }], { site: richSite })).ok, true);
  const state = siteState(richSite, chatTexts);
  assert.match(state, /SOLUÇÕES DA SEÇÃO 1/);
  assert.match(state, /SEGMENTOS ATENDIDOS/);
  assert.match(state, /PILARES DA EMPRESA/);
  assert.match(state, /ETAPAS DO PROCESSO/);
  assert.match(state, /"width":90/);
});
