import { validStyles } from "./security.mjs";
import {
  ASSET_IMAGES,
  BLOCK_KINDS,
  BLOCK_NAMES,
  BUILTIN_TYPES,
  CHAT_TOOLS,
  COMPANY_FIELDS,
  ICON_NAMES,
  SERVICE_CATEGORIES,
  SOCIALS,
  TEMPLATE_TYPES,
  TYPE_NAMES,
} from "./site-actions.mjs";

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
    list(
      site.products,
      CHAT.products,
      (p) =>
        shortStr(p.id, 80) &&
        shortStr(p.code, 40) &&
        shortStr(p.title, 200) &&
        shortStr(p.category, 20) &&
        typeof p.featured === "boolean" &&
        shortStr(p.specs ?? "", 300) &&
        shortStr(p.description ?? "", 1200),
    ) &&
    list(
      site.services ?? [],
      10,
      (s) =>
        shortStr(s.id, 80) &&
        shortStr(s.title, 200) &&
        shortStr(s.lead ?? "", 300) &&
        shortStr(s.copy ?? "", 1200) &&
        SERVICE_CATEGORIES.includes(s.category),
    ) &&
    list(site.sectors ?? [], 20, (s) => shortStr(s.id, 80) && shortStr(s.name, 120) && shortStr(s.code ?? "", 40)) &&
    list(site.pillars ?? [], 8, (p) => shortStr(p.id, 80) && shortStr(p.title, 120) && shortStr(p.desc ?? "", 400)) &&
    list(site.process ?? [], 3, (p) => shortStr(p.label, 80) && shortStr(p.title, 200) && shortStr(p.copy ?? "", 600)) &&
    (site.styles === undefined || validStyles(site.styles)) &&
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
  for (const p of site.products)
    lines.push(`[${p.id}] ${p.code} · ${p.title} · ${p.category}${p.featured ? " · destaque" : ""}${p.specs ? ` · ${p.specs}` : ""}`);
  if (site.services?.length) {
    lines.push("", "SOLUÇÕES DA SEÇÃO 1 (add_service / update_service / remove_service):");
    for (const s of site.services) lines.push(`[${s.id}] ${s.title} (${s.category})${s.lead ? ` — ${s.lead}` : ""}`);
  }
  if (site.sectors?.length) {
    lines.push("", "SEGMENTOS ATENDIDOS (add_sector / update_sector / remove_sector):");
    for (const s of site.sectors) lines.push(`[${s.id}] ${s.code ? `${s.code} · ` : ""}${s.name}`);
  }
  if (site.pillars?.length) {
    lines.push("", "PILARES DA EMPRESA (add_pillar / update_pillar / remove_pillar):");
    for (const p of site.pillars) lines.push(`[${p.id}] ${p.title}${p.desc ? `: ${p.desc}` : ""}`);
  }
  if (site.process?.length) {
    lines.push("", "ETAPAS DO PROCESSO (update_process_step com step 1 a 3):");
    site.process.forEach((p, i) => lines.push(`etapa ${i + 1}. ${p.label} — ${p.title}${p.copy ? `: ${p.copy}` : ""}`));
  }
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
  lines.push(`Fotos recortadas do acervo interno (asset_image quando não houver foto anexada): ${ASSET_IMAGES.join(", ")}.`);
  lines.push("", "FOTOS QUE PODEM SER TROCADAS (alvo — onde fica):");
  for (const i of site.images) lines.push(`${i.target} — ${i.label}`);
  lines.push("", "FOTOS ANEXADAS NESTA CONVERSA:");
  lines.push(site.attachments.length ? site.attachments.map((a) => `${a.id} (${a.name})`).join("; ") : "nenhuma");
  const styledEntries = Object.entries(site.styles ?? {});
  if (styledEntries.length) {
    lines.push("", "ESTILOS, LARGURAS E POSIÇÕES ATUAIS DOS TEXTOS:");
    for (const [k, st] of styledEntries) lines.push(`[${k}] ${JSON.stringify(st)}`);
  }
  lines.push("", "TEXTOS (chave — onde fica: texto atual):");
  for (const t of texts) lines.push(`[${t.key}] ${t.label}: ${t.text}`);
  return lines.join("\n");
}

export function chatSystemPrompt(facts, state) {
  return [
    "Você é o assistente autônomo de edição do site institucional da Usibar Usinagens Especiais, fabricante de cilindros hidráulicos, blocos hidráulicos (manifolds) e peças usinadas em CNC sob medida.",
    "Você conversa com o administrador do site e tem ampla autonomia para realizar edições completas e múltiplas tarefas em uma única resposta: textos, cor, tamanho, largura esticada na tela, alinhamento e posição responsiva nos cantos, seções (inserir, publicar, mover, ocultar, remover, renomear), blocos de seções livres, cartões de Soluções (seção 1), Segmentos atendidos, Pilares da empresa, Etapas do processo, peças do catálogo (com ou sem foto anexada), aviso de abertura, dados de contato e redes sociais.",
    "Autonomia e múltiplas tarefas:",
    "- Seja proativo e resolutivo: quando o administrador pedir várias mudanças de uma vez (por exemplo, cadastrar 3 peças novas, criar e publicar uma seção completa com blocos, atualizar textos e contatos, ou ajustar textos + largura + posição nos cantos), decomponha o pedido e emita TODAS as chamadas de função necessárias no mesmo turno, na ordem lógica, sem pedir confirmações intermediárias desnecessárias.",
    "- Tudo o que você executa pode ser desfeito com um clique em “Desfazer”, então prefira agir com autonomia quando a intenção estiver clara. Junto das chamadas, resuma de forma objetiva o que realizou.",
    "- Use só ids de seção, ids de peça/solução/segmento/pilar, chaves de texto, alvos de foto e fotos anexadas que aparecem no ESTADO DO SITE. Nunca invente ids nem chaves.",
    "- Pergunte antes (em uma frase curta, sem chamar funções) apenas quando houver ambiguidade real que impeça saber qual item alterar.",
    "- Cadastro de peças (add_product): funciona COM foto anexada (image: foto-N) ou SEM foto anexada (usando asset_image do acervo interno ou deixando o sistema atribuir a foto padrão recortada da categoria). Sem código informado, gere códigos sequenciais no padrão existente (ex.: USB-CH-05 para cilindros, USB-BH-05 para blocos) sem repetir códigos já usados. Quando houver foto anexada sobre fundo branco/mesa/oficina, ative remove_background: true.",
    "- Layout, largura e posição responsiva dos textos (style_text): além de color (#rrggbb) e size (0.6 a 2.4), você pode esticar blocos de texto na tela com width (10 a 100, porcentagem da largura da seção, evitando quebras de linha precoces), alinhar com align (left, center, right) e posicionar responsivamente em qualquer ponto ou canto da seção com x (0 = bem no canto esquerdo, 50 = centro, 100 = bem no canto direito) e y (0 = topo, 50 = meio, 100 = base), ou voltar ao fluxo original com reset_position: true.",
    "- Foto anexada sem instrução: descreva em uma frase o que vê e ofereça opções práticas (cadastrar como peça recortando o fundo, trocar foto do topo/solução/peça, ou criar galeria).",
    "- Ao criar uma seção nova pedida pelo administrador, use add_section (prefira type blocks para seções ricas sob medida e defina visible: true quando o administrador pedir para criar/colocar no site). Textos e botões das seções fixas podem ser ocultados/recolocados com set_element_visibility.",
    "- Soluções da seção 1, Segmentos, Pilares e Processo: use add_service/update_service/remove_service, add_sector/update_sector/remove_sector, add_pillar/update_pillar/remove_pillar e update_process_step para gerenciar esses itens diretamente.",
    "- Avisos como férias coletivas ou feriados: use set_notice com período, data de retorno e contato (WhatsApp/e-mail) no texto; datas no formato AAAA-MM-DD.",
    "- Para revisar todos os textos da página, chame review_texts. Para rolar até um item e destacá-lo, chame show_on_site.",
    "- Você não altera senhas nem contas de administradores e não publica nada fora do site. Explique com gentileza se pedirem.",
    "Textos:",
    "- Português do Brasil, tom profissional, técnico e claro, para compradores industriais.",
    "- Use apenas os fatos abaixo, o que o administrador informou e o próprio site. Não invente números, prazos, certificações, normas, clientes, garantias ou capacidades.",
    "- Preserve nomes próprios, códigos de peça e unidades. Rótulos e títulos curtos continuam curtos.",
    "- Suas respostas: curtas e diretas, texto puro sem markdown; listas simples com “- ” quando ajudar.",
    "Fatos da empresa:",
    facts,
    "",
    "ESTADO DO SITE AGORA:",
    state,
  ].join("\n");
}

export function geminiChatRequest({ system, messages, maxTokens = 16384 }) {
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
