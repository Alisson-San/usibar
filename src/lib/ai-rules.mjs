import { BLOCK_KINDS, BLOCK_NAMES, BUILTIN_TYPES, CHAT_TOOLS, COMPANY_FIELDS, ICON_NAMES, SOCIALS, TEMPLATE_TYPES, TYPE_NAMES } from "./site-actions.mjs";

// Rules for the AI copy assistant that do not depend on the model client: what a request may
// contain, and what of the model's answer may reach the editor. The assistant only proposes;
// the admin decides and nothing is published without a click.

export const FIELD_ACTIONS = {
  improve: "Reescreva o texto deixando-o mais claro, profissional e convincente, mantendo o sentido.",
  shorten: "Reescreva o texto mais curto e direto, sem perder a informação essencial.",
  fix: "Corrija ortografia, acentuação, concordância e pontuação. Não mude o estilo nem o conteúdo além do necessário.",
  technical: "Reescreva com um tom mais técnico e preciso, adequado a engenheiros e compradores industriais.",
  commercial: "Reescreva com um tom mais comercial e próximo, que convide o cliente a pedir orçamento.",
  custom: "Siga a instrução do administrador.",
};

const LIMITS = { text: 4000, label: 120, instruction: 500, fields: 200, total: 40000 };
const str = (v, max) => typeof v === "string" && v.length <= max;
const keyOk = (k) => typeof k === "string" && /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(k);

/** @returns {{ ok: true, value: any } | { ok: false, error: string }} */
export function validateAiRequest(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "Solicitação inválida." };
  if (body.action === "chat") return validateChatRequest(body);
  if (body.action === "review") {
    const fields = body.fields;
    if (!Array.isArray(fields) || fields.length === 0 || fields.length > LIMITS.fields)
      return { ok: false, error: "Envie entre 1 e 200 textos para revisar." };
    let total = 0;
    for (const f of fields) {
      if (!f || !keyOk(f.key) || !str(f.label, LIMITS.label) || !str(f.text, LIMITS.text))
        return { ok: false, error: "Algum texto enviado para revisão é inválido." };
      total += f.text.length;
    }
    if (total > LIMITS.total) return { ok: false, error: "Textos demais para uma revisão. Revise por partes." };
    const keys = new Set(fields.map((f) => f.key));
    if (keys.size !== fields.length) return { ok: false, error: "Textos repetidos na revisão." };
    return { ok: true, value: { action: "review", fields } };
  }
  if (!Object.hasOwn(FIELD_ACTIONS, body.action)) return { ok: false, error: "Ação de IA desconhecida." };
  if (!str(body.text, LIMITS.text) || !body.text.trim()) return { ok: false, error: "Texto vazio ou longo demais." };
  if (!str(body.label ?? "", LIMITS.label)) return { ok: false, error: "Rótulo inválido." };
  if (body.action === "custom" && !(str(body.instruction, LIMITS.instruction) && body.instruction.trim()))
    return { ok: false, error: "Escreva o que a IA deve fazer." };
  return {
    ok: true,
    value: {
      action: body.action,
      text: body.text,
      label: body.label ?? "Texto",
      instruction: body.action === "custom" ? body.instruction.trim() : "",
    },
  };
}

// Plain text only: the site renders text, so stray markdown or quotes would show up literally.
export const clean = (s) =>
  String(s)
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*["“”']+|["“”']+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** @returns {{ text: string, note: string } | null} */
export function acceptRewrite(out, original) {
  if (!out || typeof out.text !== "string") return null;
  const text = clean(out.text).slice(0, LIMITS.text);
  if (!text) return null;
  return { text, note: clean(out.note ?? "").slice(0, 300), unchanged: text === clean(original) };
}

/** Keeps only suggestions for fields that were sent, that actually change the text. */
export function acceptReview(out, fields) {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const seen = new Set();
  const suggestions = [];
  for (const s of Array.isArray(out?.suggestions) ? out.suggestions : []) {
    const field = s && byKey.get(s.key);
    if (!field || seen.has(s.key)) continue;
    const suggestion = clean(s.suggestion ?? "").slice(0, LIMITS.text);
    if (!suggestion || suggestion === clean(field.text)) continue;
    seen.add(s.key);
    suggestions.push({ key: s.key, issue: clean(s.issue ?? "").slice(0, 300), suggestion });
    if (suggestions.length >= 40) break;
  }
  return { summary: clean(out?.summary ?? "").slice(0, 600), suggestions };
}

// Small in-memory brake per server instance; enough to stop accidental loops.
export function rateLimiter(max = 20, windowMs = 60000, now = () => Date.now()) {
  let start = now(),
    count = 0;
  return () => {
    if (now() - start > windowMs) {
      start = now();
      count = 0;
    }
    return ++count <= max;
  };
}

export function systemPrompt(facts) {
  return [
    "Você é o curador de conteúdo do site institucional da Usibar Usinagens Especiais, fabricante de cilindros hidráulicos, blocos hidráulicos (manifolds) e peças usinadas em CNC sob medida.",
    "Seu trabalho é propor textos para o administrador do site, que decide se aplica ou não.",
    "Regras:",
    "- Escreva em português do Brasil, com tom profissional, técnico e claro, voltado a compradores industriais.",
    "- Use apenas os fatos abaixo e o próprio texto. Não invente números, prazos, certificações, normas, clientes, garantias, prêmios ou capacidades.",
    "- Preserve nomes próprios, códigos de peça, unidades e marcas exatamente como estão.",
    "- Respeite o papel do campo: rótulos e títulos curtos continuam curtos; parágrafos continuam parágrafos.",
    "- Texto puro: sem markdown, sem emojis, sem aspas ao redor.",
    "Fatos da empresa:",
    facts,
  ].join("\n");
}

export function companyFacts(content) {
  const c = content?.company ?? {};
  const lines = [
    `Nome: ${c.name ?? "Usibar Usinagens Especiais"}`,
    c.motto && `Lema: ${c.motto}`,
    c.city && `Sede: ${c.city}${c.address ? `, ${c.address}` : ""}`,
    c.experienceYears && `Experiência: ${c.experienceYears} anos`,
    Array.isArray(content?.services) && `Soluções: ${content.services.map((s) => s.title).join("; ")}`,
    Array.isArray(content?.sectors) && `Segmentos atendidos: ${content.sectors.map((s) => s.name).join("; ")}`,
    Array.isArray(content?.products) && `Peças no catálogo: ${content.products.map((p) => p.title).slice(0, 20).join("; ")}`,
  ];
  return lines.filter(Boolean).join("\n");
}

// ---- Google Gemini (REST generateContent) ---------------------------------------------
export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";

// JSON shapes the model must answer with (OpenAPI-style schema used by responseSchema).
export const REWRITE_SCHEMA = {
  type: "OBJECT",
  properties: {
    text: { type: "STRING", description: "O texto proposto, pronto para publicar." },
    note: { type: "STRING", description: "Uma frase curta explicando o que mudou." },
  },
  required: ["text", "note"],
};
export const REVIEW_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING", description: "Avaliação geral da página em até três frases." },
    suggestions: {
      type: "ARRAY",
      description: "Somente os textos que realmente precisam mudar.",
      items: {
        type: "OBJECT",
        properties: {
          key: { type: "STRING", description: "A chave exata do texto revisado." },
          issue: { type: "STRING", description: "O problema encontrado, em uma frase." },
          suggestion: { type: "STRING", description: "O texto completo proposto para substituir o original." },
        },
        required: ["key", "issue", "suggestion"],
      },
    },
  },
  required: ["summary", "suggestions"],
};

export function geminiRequest({ system, prompt, schema, maxTokens }) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      maxOutputTokens: maxTokens,
      temperature: 0.4,
    },
  };
}

const fail = (message, status) => Object.assign(Error(message), { status });

/** Reads a generateContent response into the parsed JSON answer, or throws a user-facing error. */
export function readGemini(data) {
  const block = data?.promptFeedback?.blockReason;
  const candidate = data?.candidates?.[0];
  if (!candidate) throw fail(block ? "A IA não pôde atender este pedido." : "A IA não devolveu resposta.", block ? 422 : 502);
  const reason = candidate.finishReason;
  if (["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"].includes(reason))
    throw fail("A IA não pôde atender este pedido.", 422);
  const text = (candidate.content?.parts ?? [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  if (!text) throw fail(reason === "MAX_TOKENS" ? "A resposta da IA veio incompleta. Tente de novo." : "A IA não devolveu texto.", 502);
  try {
    return JSON.parse(text);
  } catch {
    throw fail("A resposta da IA veio incompleta. Tente de novo.", 502);
  }
}

/** Translates an HTTP error from the Gemini API into a message for the editor. */
export function geminiError(status, body, model) {
  const msg = String(body?.error?.message ?? "");
  if (/api key/i.test(msg) || status === 401 || status === 403) return { status: 503, error: "A chave do Gemini (GEMINI_API_KEY) foi recusada. Confira a chave no Google AI Studio." };
  if (status === 404) return { status: 503, error: `O modelo “${model}” não foi encontrado. Ajuste GEMINI_MODEL.` };
  if (status === 429) return { status: 429, error: "A cota do Gemini acabou ou há muitos pedidos agora. Tente em instantes." };
  return { status: 502, error: `O Gemini respondeu com erro (${status}).` };
}

// ---- Chat: the admin asks in plain words; the model answers and proposes site actions ----------

// Photos are resized in the browser (about 100–250 KB each in base64); 8 fit well under Vercel's 4.5 MB body limit.
const CHAT = { messages: 40, text: 6000, images: 8, image: 900_000, sections: 30, products: 200, targets: 80, attachments: 12 };
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const shortStr = (v, max) => typeof v === "string" && v.length <= max;

/** @returns {{ ok: true, value: any } | { ok: false, error: string }} */
export function validateChatRequest(body) {
  const bad = (error) => ({ ok: false, error });
  const { messages, site, texts } = body;
  if (!Array.isArray(messages) || !messages.length || messages.length > CHAT.messages) return bad("Conversa vazia ou longa demais. Comece uma conversa nova.");
  let images = 0;
  for (const m of messages) {
    if (!m || !["user", "assistant"].includes(m.role) || !shortStr(m.text ?? "", CHAT.text)) return bad("Alguma mensagem da conversa é inválida.");
    for (const img of m.images ?? []) {
      images++;
      if (!img || !IMAGE_TYPES.includes(img.mimeType) || !shortStr(img.data, CHAT.image) || !/^[A-Za-z0-9+/]+=*$/.test(img.data))
        return bad("Alguma foto da conversa é inválida.");
    }
    if (!(m.text ?? "").trim() && !(m.images ?? []).length) return bad("Mensagem vazia.");
  }
  if (images > CHAT.images) return bad("Fotos demais na conversa. Comece uma conversa nova.");
  if (messages[messages.length - 1].role !== "user") return bad("A última mensagem deve ser sua.");
  if (!site || typeof site !== "object") return bad("Estado do site ausente.");
  const list = (v, max, check) => Array.isArray(v) && v.length <= max && v.every((x) => x && check(x));
  const types = [...BUILTIN_TYPES, ...TEMPLATE_TYPES];
  const ok =
    list(
      site.sections,
      CHAT.sections,
      (b) =>
        shortStr(b.id, 40) &&
        types.includes(b.type) &&
        shortStr(b.name, 80) &&
        typeof b.hidden === "boolean" &&
        list(b.blocks ?? [], 40, (x) => shortStr(x.id, 16) && BLOCK_KINDS.includes(x.kind) && shortStr(x.text ?? "", 200)),
    ) &&
    list(site.removables ?? [], 200, (r) => shortStr(r.key, 80) && shortStr(r.label, 120) && typeof r.hidden === "boolean") &&
    (site.notice === undefined || (typeof site.notice === "object" && JSON.stringify(site.notice).length <= 2000)) &&
    list(site.products, CHAT.products, (p) => shortStr(p.id, 80) && shortStr(p.code, 40) && shortStr(p.title, 200) && shortStr(p.category, 20) && typeof p.featured === "boolean") &&
    list(site.images, CHAT.targets, (i) => shortStr(i.target, 120) && shortStr(i.label, 120)) &&
    list(site.attachments, CHAT.attachments, (a) => /^foto-\d{1,2}$/.test(a.id) && shortStr(a.name, 120)) &&
    list(site.socials ?? [], 10, (x) => SOCIALS.includes(x.network) && shortStr(x.url, 300)) &&
    site.company &&
    typeof site.company === "object" &&
    Object.entries(site.company).every(([k, v]) => k in COMPANY_FIELDS && shortStr(v, 4000));
  if (!ok) return bad("O estado do site enviado é inválido.");
  const review = validateAiRequest({ action: "review", fields: texts });
  if (!review.ok) return review;
  return { ok: true, value: { action: "chat", messages: messages.slice(-30), site, texts } };
}

// The site as the model sees it: ids it may use in calls, and the current texts.
export function siteState(site, texts) {
  const lines = ["SEÇÕES (na ordem da página):"];
  site.sections.forEach((b, i) => {
    const kind = BUILTIN_TYPES.includes(b.type) ? "fixa" : `modelo ${TYPE_NAMES[b.type]}`;
    lines.push(`${i + 1}. [${b.id}] ${b.name} (${kind}${b.hidden ? ", oculta" : ""})`);
    (b.blocks ?? []).forEach((x, j) => lines.push(`   bloco ${j + 1}. [${x.id}] ${BLOCK_NAMES[x.kind]}${x.text ? `: ${x.text}` : ""}`));
  });
  const missing = BUILTIN_TYPES.filter((t) => !site.sections.some((b) => b.type === t));
  if (missing.length) lines.push(`Seções fixas fora da página (podem ser recolocadas com add_section): ${missing.join(", ")}`);
  lines.push("", "PEÇAS DO CATÁLOGO:");
  for (const p of site.products) lines.push(`[${p.id}] ${p.code} · ${p.title} · ${p.category}${p.featured ? " · destaque" : ""}`);
  lines.push("", "EMPRESA E CONTATO:");
  for (const [k, v] of Object.entries(site.company)) lines.push(`${k} (${COMPANY_FIELDS[k][0]}): ${v}`);
  if (site.socials?.length) lines.push(`Redes: ${site.socials.map((x) => `${x.network} ${x.url}`).join("; ")}`);
  if (site.removables?.length) {
    lines.push("", "ELEMENTOS DAS SEÇÕES FIXAS QUE PODEM SER REMOVIDOS OU RECOLOCADOS:");
    for (const r of site.removables) lines.push(`[${r.key}] ${r.label}${r.hidden ? " (removido)" : ""}`);
  }
  const n = site.notice;
  lines.push("", `AVISO AO ABRIR O SITE: ${n ? `${n.enabled ? "ligado" : "desligado"} — “${n.title}” de ${n.start} a ${n.end}: ${n.text}` : "nenhum configurado"}`);
  lines.push(`Data de hoje: ${new Date().toISOString().slice(0, 10)}. Ícones disponíveis: ${ICON_NAMES.join(", ")}.`);
  lines.push("", "FOTOS QUE PODEM SER TROCADAS (alvo — onde fica):");
  for (const i of site.images) lines.push(`${i.target} — ${i.label}`);
  lines.push("", "FOTOS ANEXADAS NESTA CONVERSA:");
  lines.push(site.attachments.length ? site.attachments.map((a) => `${a.id} (${a.name})`).join("; ") : "nenhuma");
  lines.push("", "TEXTOS (chave — onde fica: texto atual):");
  for (const t of texts) lines.push(`[${t.key}] ${t.label}: ${t.text}`);
  return lines.join("\n");
}

export function chatSystemPrompt(facts, state) {
  return [
    "Você é o assistente de edição do site institucional da Usibar Usinagens Especiais, fabricante de cilindros hidráulicos, blocos hidráulicos (manifolds) e peças usinadas em CNC sob medida.",
    "Você conversa com o administrador do site e o ajuda a editar tudo o que é possível: textos, cor e tamanho dos textos, seções (inserir, mover, ocultar, remover, renomear), fotos, peças do catálogo, dados de contato e redes sociais.",
    "Como agir:",
    "- Para mudar o site, chame as funções. Cada chamada vira uma ação que o administrador confirma com um clique; nada muda sem ele, e tudo pode ser desfeito. Junto das chamadas, escreva uma frase curta dizendo o que preparou.",
    "- Use só ids de seção, ids de peça, chaves de texto, alvos de foto e fotos anexadas que aparecem no ESTADO DO SITE. Nunca invente ids nem chaves.",
    "- Se o pedido for ambíguo (qual seção, qual peça, qual foto, qual texto), pergunte antes, em uma frase, sem chamar funções.",
    "- Foto anexada sem instrução: descreva em uma frase o que vê e ofereça opções (cadastrar como peça nova, trocar a foto do topo ou de uma peça, usar numa seção ou galeria).",
    "- Ao cadastrar uma peça pela foto: nome e descrição curtos a partir do que se vê; não invente medidas, pressões, materiais, normas ou aplicações. Sem código informado, proponha o próximo no padrão dos códigos existentes. Se o fundo da foto for poluído, use remove_background.",
    "- Para revisar todos os textos de uma vez, chame review_texts. Para mostrar algo, chame show_on_site.",
    "- Para criar algo novo, insira uma seção livre (add_section com type blocks) combinando blocos; mantenha o tom sóbrio e industrial do site. Textos e botões das seções fixas podem ser removidos ou recolocados com set_element_visibility.",
    "- Avisos como férias coletivas ou feriados: use set_notice com período, data de retorno e contato (WhatsApp/e-mail) no texto; datas no formato AAAA-MM-DD.",
    "- Você não altera senhas nem administradores, não muda o desenho do site além de cor e tamanho dos textos e não publica nada fora do site. Diga isso com gentileza quando pedirem.",
    "- Se o administrador perguntar o que você sabe fazer, dê exemplos práticos de pedidos.",
    "Textos:",
    "- Português do Brasil, tom profissional, técnico e claro, para compradores industriais.",
    "- Use apenas os fatos abaixo e o próprio site. Não invente números, prazos, certificações, normas, clientes, garantias ou capacidades.",
    "- Preserve nomes próprios, códigos de peça e unidades. Rótulos e títulos curtos continuam curtos.",
    "- Suas respostas: curtas e diretas, texto puro sem markdown; listas simples com “- ” quando ajudar.",
    "Fatos da empresa:",
    facts,
    "",
    "ESTADO DO SITE AGORA:",
    state,
  ].join("\n");
}

export function geminiChatRequest({ system, messages, maxTokens = 8192 }) {
  const contents = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    if (!contents.length && role === "model") continue; // the conversation must start with the admin
    const parts = [];
    if ((m.text ?? "").trim()) parts.push({ text: m.text });
    for (const img of m.images ?? []) parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    const last = contents[contents.length - 1];
    if (last?.role === role) last.parts.push(...parts);
    else contents.push({ role, parts });
  }
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    tools: [{ functionDeclarations: CHAT_TOOLS }],
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
  };
}

// Chat replies keep their line breaks; markdown emphasis would show up literally.
const cleanReply = (s) =>
  String(s)
    .replace(/\*\*|__|`/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 4000);

/** Reads a chat turn: the reply text and the function calls the model made. */
export function readGeminiChat(data) {
  const block = data?.promptFeedback?.blockReason;
  const candidate = data?.candidates?.[0];
  if (!candidate) throw fail(block ? "A IA não pôde atender este pedido." : "A IA não devolveu resposta.", block ? 422 : 502);
  const reason = candidate.finishReason;
  if (["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"].includes(reason)) throw fail("A IA não pôde atender este pedido.", 422);
  if (["MALFORMED_FUNCTION_CALL", "UNEXPECTED_TOOL_CALL"].includes(reason)) throw fail("A IA montou uma ação inválida. Tente pedir de outro jeito.", 502);
  const parts = candidate.content?.parts ?? [];
  const text = cleanReply(
    parts
      .filter((p) => typeof p.text === "string" && !p.thought)
      .map((p) => p.text)
      .join(""),
  );
  const calls = parts.filter((p) => p.functionCall?.name).map((p) => ({ name: p.functionCall.name, args: p.functionCall.args ?? {} }));
  if (!text && !calls.length) throw fail(reason === "MAX_TOKENS" ? "A resposta da IA veio incompleta. Tente de novo." : "A IA não devolveu resposta.", 502);
  return { text, calls };
}
