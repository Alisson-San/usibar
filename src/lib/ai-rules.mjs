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
