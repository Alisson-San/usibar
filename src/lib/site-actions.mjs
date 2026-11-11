// Everything the chat assistant can do on the site, as data. The model proposes calls to the
// functions below; the editor shows them as cards and, when the admin applies one, runs it
// through the same commit path as a manual edit (server validation, undo in the edit bar).
// Pure module: shared by the API route (to accept the model's calls) and the browser (to apply them).

export const BUILTIN_TYPES = ["solutions", "process", "catalog", "origin", "sectors", "quote"];
export const TEMPLATE_TYPES = ["blocks", "text-image", "stats", "gallery", "cta", "testimonial"];

// ---- Shared vocabulary: icons, free blocks, the opening notice --------------------------------
// Line icons drawn in the site's style (src/app/icons.tsx), usable in blocks and in the notice.
export const ICON_NAMES = ["info", "alerta", "calendario", "ferias", "relogio", "feriado", "telefone", "whatsapp", "email", "local", "caminhao", "engrenagem", "ferramenta", "fabrica", "escudo", "check", "estrela", "raio", "pessoas", "documento"];
// Blocks of a free section, WordPress style: each kind with its fields and limits.
export const BLOCK_SPEC = {
  label: { text: 80 },
  heading: { text: 200, size: ["lg", "md"] },
  text: { text: 2000 },
  button: { text: 60, link: "link", style: ["solid", "ghost"] },
  image: { url: "image", caption: 200 },
  features: { items: "features" },
  callout: { icon: "icon", title: 120, text: 600 },
  quote: { text: 1200, author: 120 },
  stats: { items: "stats" },
  divider: {},
};
export const BLOCK_KINDS = Object.keys(BLOCK_SPEC);
export const BLOCK_NAMES = { label: "Rótulo", heading: "Título", text: "Parágrafo", button: "Botão", image: "Foto", features: "Destaques com ícone", callout: "Chamada com ícone", quote: "Citação", stats: "Números", divider: "Divisória" };
const okText = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const okOpt = (v, max) => v === undefined || (typeof v === "string" && v.length <= max);
export const validLink = (v) => v === "#orcamento" || v === "#pecas" || v === "whatsapp" || (typeof v === "string" && v.length <= 300 && /^https:\/\/[^\s"'<>]+$/.test(v));
/** @param {any} b @param {(v: any) => boolean} image */
export function validBlock(b, image) {
  const spec = b && BLOCK_SPEC[b.kind];
  if (!spec || typeof b.id !== "string" || !/^[a-z0-9]{1,16}$/.test(b.id)) return false;
  for (const [k, v] of Object.entries(b)) {
    if (k === "id" || k === "kind") continue;
    const rule = spec[k];
    if (!rule) return false;
    if (Array.isArray(rule) ? !rule.includes(v) : rule === "image" ? !image(v) : rule === "link" ? !validLink(v) : rule === "icon" ? !ICON_NAMES.includes(v) : false) return false;
    if (rule === "features" && !(Array.isArray(v) && v.length >= 1 && v.length <= 6 && v.every((it) => it && ICON_NAMES.includes(it.icon) && okText(it.title, 80) && okOpt(it.text, 300) && Object.keys(it).every((x) => ["icon", "title", "text"].includes(x)))))
      return false;
    if (rule === "stats" && !(Array.isArray(v) && v.length >= 1 && v.length <= 6 && v.every((it) => it && okText(it.value, 40) && okText(it.label, 200) && Object.keys(it).length === 2))) return false;
    if (typeof rule === "number" && !okOpt(v, rule)) return false;
  }
  // The fields a block cannot do without.
  if (["label", "heading", "text", "quote"].includes(b.kind) && !okText(b.text, spec.text)) return false;
  if (b.kind === "button" && !(okText(b.text, 60) && validLink(b.link))) return false;
  if (b.kind === "image" && !image(b.url)) return false;
  if (["features", "stats"].includes(b.kind) && !b.items) return false;
  if (b.kind === "callout" && !(okText(b.title, 120) && ICON_NAMES.includes(b.icon))) return false;
  return true;
}
export function validBlocks(list, image) {
  if (!Array.isArray(list) || list.length > 40) return false;
  return new Set(list.map((b) => b?.id)).size === list.length && list.every((b) => validBlock(b, image));
}
// Opening notice (e.g. collective holidays): shown between two dates, once per version per visitor.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function validNotice(n) {
  return (
    !!n &&
    typeof n === "object" &&
    Object.keys(n).every((k) => ["enabled", "icon", "title", "text", "start", "end", "button", "version"].includes(k)) &&
    typeof n.enabled === "boolean" &&
    ICON_NAMES.includes(n.icon) &&
    okText(n.title, 120) &&
    okText(n.text, 1000) &&
    DAY.test(n.start) &&
    DAY.test(n.end) &&
    n.start <= n.end &&
    okOpt(n.button, 40) &&
    typeof n.version === "string" &&
    /^[a-z0-9-]{1,40}$/i.test(n.version)
  );
}
/** True when the notice should be shown on `today` (YYYY-MM-DD, the visitor's local date). */
export const noticeActive = (n, today) => !!n?.enabled && today >= n.start && today <= n.end;
// Texts and buttons of the fixed sections the admin removed (they come back with "Recolocar").
export const validHidden = (h) => Array.isArray(h) && h.length <= 200 && h.every((k) => typeof k === "string" && /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(k));
/* Internal product code (not shown on the site; kept for references and the assistant):
   the next free one in the pattern of the category, USB-CH-01 for cylinders, USB-BH-01 for blocks. */
export function nextCode(category, codes) {
  const prefix = category === "blocos" ? "USB-BH-" : "USB-CH-";
  const upper = codes.map((c) => String(c).trim().toUpperCase());
  let n = 1 + Math.max(0, ...upper.map((c) => (c.startsWith(prefix) ? parseInt(c.slice(prefix.length), 10) || 0 : 0)));
  while (upper.includes(prefix + String(n).padStart(2, "0"))) n++;
  return prefix + String(n).padStart(2, "0");
}
// Fields allowed in each template section and their limits; anything else is refused.
export const TEMPLATE_FIELDS = {
  blocks: { nav: 40, blocks: "blocks" },
  "text-image": { nav: 40, eyebrow: 80, title: 160, accent: 160, text: 1500, cta: 60, side: 5, imageUrl: "image" },
  stats: { nav: 40, eyebrow: 80, title: 160, items: "items" },
  gallery: { nav: 40, eyebrow: 80, title: 160, images: "images" },
  cta: { nav: 40, title: 160, text: 600, button: 60 },
  testimonial: { nav: 40, quote: 1200, author: 120, role: 160 },
};
// Company facts the assistant may change, with their limits (see validData).
export const COMPANY_FIELDS = {
  name: ["Nome da empresa", 200],
  Tagline: ["Slogan", 300],
  motto: ["Lema (topo do site)", 200],
  headline: ["Mensagem institucional", 600],
  subheadline: ["Subtítulo do topo", 600],
  phoneDisplay: ["Telefone visível", 40],
  whatsapp: ["WhatsApp (só números, com DDI)", 15],
  email: ["E-mail", 200],
  instagram: ["Instagram (usuário)", 100],
  address: ["Endereço", 200],
  city: ["Cidade / UF", 100],
  zip: ["CEP", 9],
  experienceYears: ["Anos de experiência", 10],
  aboutParagraph1: ["Apresentação — parágrafo 1", 2000],
  aboutParagraph2: ["Apresentação — parágrafo 2", 2000],
  aboutParagraph3: ["Apresentação — parágrafo 3", 2000],
};
export const SOCIALS = ["instagram", "facebook", "linkedin", "youtube", "tiktok", "x", "site"];
export const PRODUCT_CATEGORIES = ["cilindros", "blocos"];

const STR = "STRING";
const s = (description, extra = {}) => ({ type: STR, description, ...extra });
// Gemini refuses an OBJECT schema without properties, so a function without arguments has none.
const obj = (properties, required = []) => ({ type: "OBJECT", properties, ...(required.length ? { required } : {}) });
const SECTION = s("O id da seção, exatamente como aparece em SEÇÕES.");
const IMAGE = s("O id de uma foto anexada nesta conversa (ex.: foto-1).");
const BLOCK_PROPS = {
  kind: s("Tipo do bloco: label (rótulo), heading (título), text (parágrafo), button (botão), image (foto), features (destaques com ícone), callout (chamada com ícone), quote (citação), stats (números), divider (divisória).", { enum: BLOCK_KINDS }),
  text: s("Texto do rótulo, título, parágrafo, botão, chamada ou citação."),
  title: s("Título da chamada com ícone."),
  author: s("Autor da citação."),
  size: s("Tamanho do título.", { enum: ["lg", "md"] }),
  link: s("Destino do botão: #orcamento, #pecas, whatsapp ou um link https://."),
  style: s("Estilo do botão.", { enum: ["solid", "ghost"] }),
  icon: s("Ícone da chamada.", { enum: ICON_NAMES }),
  image: IMAGE,
  caption: s("Legenda da foto."),
  items: {
    type: "ARRAY",
    description: "Itens de destaques (icon, title, text) ou de números (value, label), até 6.",
    items: obj({ icon: s("Ícone.", { enum: ICON_NAMES }), title: s("Título"), text: s("Texto"), value: s("Número"), label: s("Legenda") }),
  },
};
const TEMPLATE_PROPS = {
  nav: s("Nome curto da seção no menu (até 40 caracteres)."),
  eyebrow: s("Rótulo pequeno acima do título."),
  title: s("Título."),
  accent: s("Complemento do título, em destaque (texto com foto)."),
  text: s("Parágrafo (texto com foto, chamada)."),
  cta: s("Texto do botão (texto com foto)."),
  button: s("Texto do botão do WhatsApp (chamada)."),
  quote: s("Texto do depoimento."),
  author: s("Autor do depoimento."),
  role: s("Empresa e cargo do autor."),
  side: s("Lado da foto (texto com foto).", { enum: ["left", "right"] }),
  image: IMAGE,
  items: {
    type: "ARRAY",
    description: "Números da seção “Números” (até 6); substitui a lista atual.",
    items: obj({ value: s("O número, ex.: 20+"), label: s("A legenda") }, ["value", "label"]),
  },
  photos: {
    type: "ARRAY",
    description: "Fotos da galeria (só ao inserir uma galeria nova).",
    items: obj({ image: IMAGE, caption: s("Legenda") }, ["image"]),
  },
  blocks: {
    type: "ARRAY",
    description: "Blocos de uma seção livre (type blocks), na ordem, só ao inserir. Monte algo criativo combinando os tipos.",
    items: obj(BLOCK_PROPS, ["kind"]),
  },
};
const PRODUCT_PROPS = {
  title: s("Nome da peça."),
  code: s("Código interno (opcional; não aparece no site). Sem ele, o próximo do padrão é gerado (USB-CH-05 para cilindros, USB-BH-05 para blocos)."),
  category: s("Categoria.", { enum: PRODUCT_CATEGORIES }),
  specs: s("Linha curta de características, separadas por •."),
  description: s("Descrição curta, sem inventar medidas ou números."),
  featured: { type: "BOOLEAN", description: "Destacar no catálogo." },
  image: IMAGE,
  remove_background: { type: "BOOLEAN", description: "Recortar o fundo da foto (bom para fotos de peça com fundo poluído)." },
};

/** Function declarations for Gemini (OpenAPI-style schema). */
export const CHAT_TOOLS = [
  {
    name: "set_text",
    description: "Troca um texto do site. Use a chave exata da lista TEXTOS e escreva o texto completo novo.",
    parameters: obj({ key: s("Chave do texto (ex.: hero.title.1)."), text: s("Texto novo completo, texto puro.") }, ["key", "text"]),
  },
  {
    name: "style_text",
    description: "Muda a cor e/ou o tamanho de um texto da lista TEXTOS, ou volta ao padrão.",
    parameters: obj(
      {
        key: s("Chave do texto."),
        color: s("Cor #rrggbb. Cores da marca: laranja #fa4804, terracota #bf4f29, grafite #292c27, areia #f7f2e9."),
        size: { type: "NUMBER", description: "Tamanho em relação ao padrão, de 0.6 a 2.4 (1 = padrão)." },
        reset: { type: "BOOLEAN", description: "true para voltar cor e tamanho ao padrão." },
      },
      ["key"],
    ),
  },
  {
    name: "move_section",
    description: "Muda a posição de uma seção na página.",
    parameters: obj({ section: SECTION, position: { type: "INTEGER", description: "Nova posição, contando de 1 na lista SEÇÕES." } }, ["section", "position"]),
  },
  {
    name: "set_section_visibility",
    description: "Mostra ou oculta uma seção para os visitantes (ela continua salva).",
    parameters: obj({ section: SECTION, visible: { type: "BOOLEAN", description: "true mostra, false oculta." } }, ["section", "visible"]),
  },
  {
    name: "remove_section",
    description: "Tira uma seção da página. Seções fixas podem ser recolocadas depois; seções de modelo são excluídas.",
    parameters: obj({ section: SECTION }, ["section"]),
  },
  {
    name: "add_section",
    description:
      "Insere uma seção. Modelos: blocks (seção livre, montada com blocos: rótulo, título, parágrafo, botão, foto, destaques com ícone, chamada com ícone, citação, números, divisória — use para criar algo novo), text-image (texto com foto), stats (números), gallery (galeria), cta (chamada para contato), testimonial (depoimento). Também recoloca uma seção fixa removida (solutions, process, catalog, origin, sectors, quote). Campos omitidos usam o texto padrão do modelo.",
    parameters: obj(
      {
        type: s("Tipo da seção.", { enum: [...TEMPLATE_TYPES, ...BUILTIN_TYPES] }),
        position: { type: "INTEGER", description: "Posição na página, contando de 1. Omitida: no fim." },
        visible: { type: "BOOLEAN", description: "true para já publicar; por padrão a seção nova entra oculta." },
        ...TEMPLATE_PROPS,
      },
      ["type"],
    ),
  },
  {
    name: "update_section",
    description: "Altera os campos de uma seção de modelo (não fixa). Envie só os campos que mudam.",
    parameters: obj({ section: SECTION, ...TEMPLATE_PROPS }, ["section"]),
  },
  {
    name: "rename_section",
    description: "Muda o nome da seção no menu e no índice lateral.",
    parameters: obj({ section: SECTION, name: s("Nome novo, até 40 caracteres.") }, ["section", "name"]),
  },
  {
    name: "add_photo",
    description: "Acrescenta uma foto anexada a uma seção de galeria existente.",
    parameters: obj({ section: SECTION, image: IMAGE, caption: s("Legenda da foto.") }, ["section", "image"]),
  },
  {
    name: "set_image",
    description: "Troca uma foto do site por uma foto anexada. Os alvos possíveis estão em FOTOS.",
    parameters: obj(
      { target: s("Alvo exatamente como em FOTOS (ex.: hero, product:cil-1)."), image: IMAGE, remove_background: PRODUCT_PROPS.remove_background },
      ["target", "image"],
    ),
  },
  {
    name: "add_product",
    description: "Cadastra uma peça nova no catálogo, com uma foto anexada.",
    parameters: obj(PRODUCT_PROPS, ["title", "category", "image"]),
  },
  {
    name: "update_product",
    description: "Altera uma peça do catálogo. Envie só os campos que mudam.",
    parameters: obj({ product: s("O id da peça, como em PEÇAS."), ...PRODUCT_PROPS }, ["product"]),
  },
  {
    name: "remove_product",
    description: "Exclui uma peça do catálogo.",
    parameters: obj({ product: s("O id da peça, como em PEÇAS.") }, ["product"]),
  },
  {
    name: "update_company",
    description: "Altera dados da empresa e de contato. Envie só os campos que mudam.",
    parameters: obj(Object.fromEntries(Object.entries(COMPANY_FIELDS).map(([k, [label]]) => [k, s(label)]))),
  },
  {
    name: "set_social",
    description: "Define o link de uma rede social (com https://). Link vazio remove a rede.",
    parameters: obj({ network: s("Rede.", { enum: SOCIALS }), url: s("Link completo com https://, ou vazio para remover.") }, ["network", "url"]),
  },
  {
    name: "add_block",
    description: "Insere um bloco numa seção livre (type blocks) existente.",
    parameters: obj({ section: SECTION, position: { type: "INTEGER", description: "Posição do bloco, contando de 1. Omitida: no fim." }, ...BLOCK_PROPS }, ["section", "kind"]),
  },
  {
    name: "update_block",
    description: "Altera um bloco de uma seção livre. Envie só os campos que mudam.",
    parameters: obj({ section: SECTION, block: s("O id do bloco, como em SEÇÕES."), ...BLOCK_PROPS }, ["section", "block"]),
  },
  {
    name: "remove_block",
    description: "Remove um bloco de uma seção livre.",
    parameters: obj({ section: SECTION, block: s("O id do bloco.") }, ["section", "block"]),
  },
  {
    name: "move_block",
    description: "Muda a posição de um bloco dentro da seção livre.",
    parameters: obj({ section: SECTION, block: s("O id do bloco."), position: { type: "INTEGER", description: "Nova posição, contando de 1." } }, ["section", "block", "position"]),
  },
  {
    name: "set_element_visibility",
    description: "Remove (oculta) ou recoloca um texto ou botão das seções fixas. Os elementos possíveis estão em ELEMENTOS.",
    parameters: obj({ key: s("Chave do elemento, como em ELEMENTOS."), visible: { type: "BOOLEAN", description: "false remove, true recoloca." } }, ["key", "visible"]),
  },
  {
    name: "set_notice",
    description: "Configura o aviso que aparece ao abrir o site (ex.: férias coletivas, feriado, horário especial), mostrado entre duas datas, uma vez para cada visitante.",
    parameters: obj(
      {
        enabled: { type: "BOOLEAN", description: "Ligar ou desligar o aviso." },
        icon: s("Ícone.", { enum: ICON_NAMES }),
        title: s("Título curto."),
        text: s("Mensagem: período, retorno do atendimento e como falar com a empresa."),
        start: s("Primeiro dia em que aparece (AAAA-MM-DD)."),
        end: s("Último dia em que aparece (AAAA-MM-DD)."),
        button: s("Texto do botão de fechar (opcional)."),
      },
      ["enabled"],
    ),
  },
  {
    name: "review_texts",
    description: "Revisa todos os textos da página de uma vez e traz sugestões de correção.",
  },
  {
    name: "show_on_site",
    description: "Rola o site até uma seção ou um texto, para o administrador ver.",
    parameters: obj({ section: SECTION, key: s("Chave de um texto.") }),
  },
];
const TOOL_NAMES = new Set(CHAT_TOOLS.map((t) => t.name));
// Actions the editor runs as soon as they arrive: they only look, never change.
export const AUTO_ACTIONS = new Set(["review_texts", "show_on_site"]);

const str = (v, max) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
const clip = (v, max) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : null);
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Turns the model's function calls into actions the editor can show, dropping anything that
 * does not match the site as it is (unknown sections, products, texts or attachments).
 * @param {{ name: string, args?: any }[]} calls
 * @param {{ sections: any[], products: any[], images: any[], attachments: any[] }} site
 * @param {{ key: string }[]} texts
 */
export function acceptActions(calls, site, texts) {
  const sections = new Map(site.sections.map((b) => [b.id, b]));
  const products = new Map(site.products.map((p) => [p.id, p]));
  const keys = new Set(texts.map((t) => t.key));
  const targets = new Set(site.images.map((i) => i.target));
  const files = new Set(site.attachments.map((a) => a.id));
  const image = (v) => (typeof v === "string" && files.has(v) ? v : null);
  const actions = [];
  let dropped = 0;
  for (const call of Array.isArray(calls) ? calls : []) {
    const args = call?.args && typeof call.args === "object" ? call.args : {};
    const out = TOOL_NAMES.has(call?.name) ? accept(call.name, args) : null;
    if (out) actions.push({ name: call.name, args: out });
    else dropped++;
    if (actions.length >= 25) break;
  }
  return { actions, dropped };

  function templateArgs(type, a, creating) {
    const spec = TEMPLATE_FIELDS[type];
    if (!spec) return {};
    const data = {};
    for (const [k, rule] of Object.entries(spec)) {
      if (typeof rule === "number" && k !== "side") {
        const v = clip(a[k], rule);
        if (v) data[k] = v;
      }
    }
    if (spec.side && (a.side === "left" || a.side === "right")) data.side = a.side;
    if (spec.imageUrl && image(a.image)) data.image = a.image;
    if (spec.items && Array.isArray(a.items)) {
      const items = a.items
        .map((it) => it && { value: clip(it.value, 40), label: clip(it.label, 200) })
        .filter((it) => it?.value && it.label)
        .slice(0, 6);
      if (items.length) data.items = items;
    }
    if (spec.images && creating && Array.isArray(a.photos)) {
      const photos = a.photos
        .map((p) => p && image(p.image) && { image: p.image, caption: clip(p.caption, 200) ?? "" })
        .filter(Boolean)
        .slice(0, 12);
      if (photos.length) data.photos = photos;
    }
    return data;
  }

  function blockArgs(a, creating) {
    const kind = creating ? a.kind : a._kind;
    const spec = BLOCK_SPEC[kind];
    if (!spec) return null;
    const out = creating ? { kind } : {};
    for (const [k, rule] of Object.entries(spec)) {
      if (typeof rule === "number") {
        const v = clip(a[k], rule);
        if (v) out[k] = v;
      } else if (Array.isArray(rule) && rule.includes(a[k])) out[k] = a[k];
      else if (rule === "link" && validLink(typeof a.link === "string" ? a.link.trim() : "")) out.link = a.link.trim();
      else if (rule === "icon" && ICON_NAMES.includes(a.icon)) out.icon = a.icon;
      else if (rule === "image" && image(a.image)) out.image = a.image;
      else if ((rule === "features" || rule === "stats") && Array.isArray(a.items)) {
        const items = a.items
          .map((it) =>
            rule === "features"
              ? it && ICON_NAMES.includes(it.icon) && clip(it.title, 80) && { icon: it.icon, title: clip(it.title, 80), ...(clip(it.text, 300) ? { text: clip(it.text, 300) } : {}) }
              : it && clip(it.value, 40) && clip(it.label, 200) && { value: clip(it.value, 40), label: clip(it.label, 200) },
          )
          .filter(Boolean)
          .slice(0, 6);
        if (items.length) out.items = items;
      }
    }
    if (!creating) return Object.keys(out).length ? out : null;
    // Defaults that make a new block valid on its own.
    if (["label", "heading", "text", "quote"].includes(kind) && !out.text) return null;
    if (kind === "button") Object.assign(out, { text: out.text ?? "Solicitar orçamento", link: out.link ?? "#orcamento" });
    if (kind === "image" && !out.image) return null;
    if (kind === "callout") Object.assign(out, { icon: out.icon ?? "info", title: out.title ?? out.text ?? "Aviso" });
    if ((kind === "features" || kind === "stats") && !out.items) return null;
    return out;
  }
  function blocksOf(id) {
    return sections.get(id)?.blocks ?? [];
  }

  function productArgs(a) {
    const out = {};
    for (const k of ["title", "code", "specs", "description"]) {
      const v = clip(a[k], k === "code" ? 40 : k === "title" ? 160 : 1500);
      if (v) out[k] = v;
    }
    if (PRODUCT_CATEGORIES.includes(a.category)) out.category = a.category;
    if (typeof a.featured === "boolean") out.featured = a.featured;
    if (image(a.image)) out.image = a.image;
    if (a.remove_background === true) out.remove_background = true;
    return out;
  }

  function accept(name, a) {
    switch (name) {
      case "set_text": {
        const text = str(a.text, 4000);
        return keys.has(a.key) && text ? { key: a.key, text: text.replace(/\s+/g, " ") } : null;
      }
      case "style_text": {
        if (!keys.has(a.key)) return null;
        if (a.reset === true) return { key: a.key, reset: true };
        const out = { key: a.key };
        if (typeof a.color === "string" && HEX.test(a.color)) out.color = a.color.toLowerCase();
        if (typeof a.size === "number" && Number.isFinite(a.size)) out.size = Math.round(Math.min(2.4, Math.max(0.6, a.size)) * 10) / 10;
        return out.color || out.size ? out : null;
      }
      case "move_section": {
        const position = Math.round(Number(a.position));
        return sections.has(a.section) && position >= 1 ? { section: a.section, position: Math.min(position, site.sections.length) } : null;
      }
      case "set_section_visibility":
        return sections.has(a.section) && typeof a.visible === "boolean" ? { section: a.section, visible: a.visible } : null;
      case "remove_section":
        return sections.has(a.section) ? { section: a.section } : null;
      case "add_section": {
        if (BUILTIN_TYPES.includes(a.type)) {
          if (sections.has(a.type)) return null; // already on the page
        } else if (!TEMPLATE_TYPES.includes(a.type)) return null;
        const out = { type: a.type, ...templateArgs(a.type, a, true) };
        if (a.type === "blocks") {
          const list = (Array.isArray(a.blocks) ? a.blocks : []).map((b) => b && blockArgs(b, true)).filter(Boolean).slice(0, 40);
          if (list.length) out.blocks = list;
        }
        const position = Math.round(Number(a.position));
        if (position >= 1) out.position = Math.min(position, site.sections.length + 1);
        if (a.visible === true) out.visible = true;
        return out;
      }
      case "update_section": {
        const b = sections.get(a.section);
        if (!b || !TEMPLATE_FIELDS[b.type]) return null;
        const data = templateArgs(b.type, a, false);
        return Object.keys(data).length ? { section: a.section, ...data } : null;
      }
      case "rename_section": {
        const name = clip(a.name, 40);
        return sections.has(a.section) && name ? { section: a.section, name } : null;
      }
      case "add_photo": {
        const b = sections.get(a.section);
        return b?.type === "gallery" && image(a.image) ? { section: a.section, image: a.image, caption: clip(a.caption, 200) ?? "" } : null;
      }
      case "set_image":
        return targets.has(a.target) && image(a.image)
          ? { target: a.target, image: a.image, ...(a.remove_background === true ? { remove_background: true } : {}) }
          : null;
      case "add_product": {
        const p = productArgs(a);
        if (!(p.title && p.category && p.image)) return null;
        if (p.code && site.products.some((x) => x.code === p.code)) return null;
        return p;
      }
      case "update_product": {
        if (!products.has(a.product)) return null;
        const p = productArgs(a);
        if (p.code && site.products.some((x) => x.code === p.code && x.id !== a.product)) return null;
        return Object.keys(p).length ? { product: a.product, ...p } : null;
      }
      case "remove_product":
        return products.has(a.product) ? { product: a.product } : null;
      case "update_company": {
        const out = {};
        for (const [k, [, max]] of Object.entries(COMPANY_FIELDS)) {
          const v = clip(k === "whatsapp" && typeof a[k] === "string" ? a[k].replace(/\D/g, "") : a[k], max);
          if (v) out[k] = v;
        }
        if (out.whatsapp && !/^\d{10,15}$/.test(out.whatsapp)) delete out.whatsapp;
        if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) delete out.email;
        if (out.zip && !/^\d{5}-?\d{3}$/.test(out.zip)) delete out.zip;
        return Object.keys(out).length ? out : null;
      }
      case "set_social": {
        if (!SOCIALS.includes(a.network)) return null;
        const url = typeof a.url === "string" ? a.url.trim() : "";
        if (url && !(url.length <= 300 && /^https:\/\/[^\s"'<>]+$/.test(url))) return null;
        return { network: a.network, url };
      }
      case "add_block": {
        if (sections.get(a.section)?.type !== "blocks") return null;
        const b = blockArgs(a, true);
        if (!b) return null;
        const position = Math.round(Number(a.position));
        return { section: a.section, ...(position >= 1 ? { position } : {}), ...b };
      }
      case "update_block": {
        const blk = blocksOf(a.section).find((x) => x.id === a.block);
        if (!blk) return null;
        const b = blockArgs({ ...a, _kind: blk.kind }, false);
        return b ? { section: a.section, block: a.block, ...b } : null;
      }
      case "remove_block":
        return blocksOf(a.section).some((x) => x.id === a.block) ? { section: a.section, block: a.block } : null;
      case "move_block": {
        const position = Math.round(Number(a.position));
        return blocksOf(a.section).some((x) => x.id === a.block) && position >= 1 ? { section: a.section, block: a.block, position } : null;
      }
      case "set_element_visibility":
        return (site.removables ?? []).some((r) => r.key === a.key) && typeof a.visible === "boolean" ? { key: a.key, visible: a.visible } : null;
      case "set_notice": {
        if (typeof a.enabled !== "boolean") return null;
        const out = { enabled: a.enabled };
        if (ICON_NAMES.includes(a.icon)) out.icon = a.icon;
        for (const [k, max] of [["title", 120], ["text", 1000], ["button", 40]]) {
          const v = clip(a[k], max);
          if (v) out[k] = v;
        }
        for (const k of ["start", "end"]) if (typeof a[k] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a[k])) out[k] = a[k];
        if (out.start && out.end && out.start > out.end) return null;
        return out;
      }
      case "review_texts":
        return {};
      case "show_on_site":
        if (sections.has(a.section)) return { section: a.section };
        if (keys.has(a.key)) return { key: a.key };
        return null;
      default:
        return null;
    }
  }
}

const quoted = (t, max = 60) => `“${t.length > max ? t.slice(0, max - 1) + "…" : t}”`;
const fieldList = (obj, labels) =>
  Object.keys(obj)
    .map((k) => labels[k] ?? k)
    .join(", ");
const TEMPLATE_LABELS = { nav: "nome no menu", eyebrow: "rótulo", title: "título", accent: "destaque", text: "texto", cta: "botão", button: "botão", quote: "depoimento", author: "autor", role: "cargo", side: "lado da foto", image: "foto", items: "números", photos: "fotos" };
const PRODUCT_LABELS = { title: "nome", code: "código", category: "categoria", specs: "características", description: "descrição", featured: "destaque", image: "foto", remove_background: "recorte do fundo" };
const NETWORK_LABELS = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok", x: "X", site: "Site" };
export const TYPE_NAMES = {
  solutions: "Soluções",
  process: "Processo",
  catalog: "Catálogo",
  origin: "Empresa",
  sectors: "Segmentos",
  quote: "Orçamento",
  blocks: "Seção livre",
  "text-image": "Texto com foto",
  stats: "Números",
  gallery: "Galeria de fotos",
  cta: "Chamada para contato",
  testimonial: "Depoimento",
};

/** One line, in Portuguese, saying what an action will do. */
export function describeAction({ name, args: a }, site, texts) {
  const blockLabel = (x) => {
    const b = site.sections.find((y) => y.id === x.section)?.blocks?.find((y) => y.id === x.block);
    return b ? ` (${BLOCK_NAMES[b.kind]}${b.text ? `: ${quoted(b.text, 30)}` : ""})` : "";
  };
  const section = (id) => quoted(site.sections.find((b) => b.id === id)?.name ?? id, 40);
  const text = (key) => quoted(texts.find((t) => t.key === key)?.label ?? key, 50);
  const product = (id) => quoted(site.products.find((p) => p.id === id)?.title ?? id, 50);
  const target = (t) => site.images.find((i) => i.target === t)?.label ?? t;
  switch (name) {
    case "set_text":
      return `Trocar o texto ${text(a.key)}`;
    case "style_text":
      return a.reset
        ? `Voltar ${text(a.key)} à cor e ao tamanho padrão`
        : `Mudar ${text(a.key)}: ${[a.color && `cor ${a.color}`, a.size && `tamanho ${String(a.size).replace(".", ",")}×`].filter(Boolean).join(", ")}`;
    case "move_section":
      return `Mover a seção ${section(a.section)} para a posição ${a.position}`;
    case "set_section_visibility":
      return `${a.visible ? "Mostrar" : "Ocultar"} a seção ${section(a.section)}`;
    case "remove_section": {
      const b = site.sections.find((x) => x.id === a.section);
      return `${b && BUILTIN_TYPES.includes(b.type) ? "Remover" : "Excluir"} a seção ${section(a.section)}`;
    }
    case "add_section":
      return `Inserir a seção ${quoted(a.nav ?? TYPE_NAMES[a.type], 40)}${a.position ? ` na posição ${a.position}` : " no fim"}${a.visible ? "" : " (oculta até você mostrar)"}`;
    case "update_section":
      return `Atualizar a seção ${section(a.section)}: ${fieldList(omit(a, "section"), TEMPLATE_LABELS)}`;
    case "rename_section":
      return `Renomear a seção ${section(a.section)} para ${quoted(a.name, 40)}`;
    case "add_photo":
      return `Adicionar ${a.image} à galeria ${section(a.section)}`;
    case "set_image":
      return `Trocar ${target(a.target)} por ${a.image}${a.remove_background ? " (com recorte do fundo)" : ""}`;
    case "add_product":
      return `Cadastrar a peça ${quoted(a.title, 50)} (${a.category}) com ${a.image}${a.remove_background ? ", recortando o fundo" : ""}`;
    case "update_product":
      return `Atualizar a peça ${product(a.product)}: ${fieldList(omit(a, "product"), PRODUCT_LABELS)}`;
    case "remove_product":
      return `Excluir a peça ${product(a.product)}`;
    case "update_company":
      return `Atualizar dados da empresa: ${fieldList(a, Object.fromEntries(Object.entries(COMPANY_FIELDS).map(([k, [l]]) => [k, l.toLowerCase()])))}`;
    case "set_social":
      return a.url ? `${NETWORK_LABELS[a.network]}: ${a.url}` : `Remover o ${NETWORK_LABELS[a.network]}`;
    case "add_block":
      return `Inserir o bloco ${BLOCK_NAMES[a.kind]} na seção ${section(a.section)}${a.position ? ` (posição ${a.position})` : ""}${a.text ? `: ${quoted(a.text, 40)}` : ""}`;
    case "update_block":
      return `Alterar um bloco da seção ${section(a.section)}${a.text ? `: ${quoted(a.text, 40)}` : ""}`;
    case "remove_block":
      return `Remover um bloco da seção ${section(a.section)}${blockLabel(a)}`;
    case "move_block":
      return `Mover um bloco da seção ${section(a.section)} para a posição ${a.position}${blockLabel(a)}`;
    case "set_element_visibility": {
      const r = (site.removables ?? []).find((x) => x.key === a.key);
      return `${a.visible ? "Recolocar" : "Remover"} ${quoted(r?.label ?? a.key, 50)}`;
    }
    case "set_notice":
      return a.enabled
        ? `Aviso ao abrir o site${a.title ? `: ${quoted(a.title, 40)}` : ""}${a.start && a.end ? `, de ${br(a.start)} a ${br(a.end)}` : ""}`
        : "Desligar o aviso ao abrir o site";
    case "review_texts":
      return "Revisar todos os textos da página";
    case "show_on_site":
      return `Mostrar ${a.section ? `a seção ${section(a.section)}` : text(a.key)} no site`;
    default:
      return name;
  }
}
const br = (d) => d.split("-").reverse().join("/");
const omit = (o, k) => Object.fromEntries(Object.entries(o).filter(([x]) => x !== k));

/**
 * Applies one action to the content, purely. Text changes (set_text) and the review are run by
 * the editor itself; photos must already be uploaded: `ctx.url(attachmentId)` gives their URL.
 * @param {any} c current content
 * @param {{ name: string, args: any }} action
 * @param {{ url: (id: string, removeBg?: boolean) => string | undefined, templateData: (type: string) => Record<string, unknown>, newId: () => string, sectionName: (b: any) => string }} ctx
 * @returns {{ content: any, label: string }}
 */
export function applyAction(c, { name, args: a }, ctx) {
  const fail = (m) => {
    throw Error(m);
  };
  const photo = (id, removeBg) => ctx.url(id, removeBg) ?? fail(`A foto ${id} ainda não foi enviada.`);
  const findSection = (id) => c.layout.find((b) => b.id === id) ?? fail("Essa seção não existe mais.");
  const findProduct = (id) => c.products.find((p) => p.id === id) ?? fail("Essa peça não existe mais.");
  const name_ = (b) => `“${ctx.sectionName(b)}”`;
  const layout = (l) => ({ ...c, layout: l });
  const templateData = (type, a, base) => {
    const d = { ...base };
    for (const [k, v] of Object.entries(a)) {
      if (k === "image") d.imageUrl = photo(v);
      else if (k === "photos") d.images = v.map((p) => ({ url: photo(p.image), caption: p.caption || "Legenda da foto" }));
      else if (k === "blocks") d.blocks = v.map(({ image, ...b }) => ({ id: ctx.newId(), ...b, ...(image ? { url: photo(image) } : {}) }));
      else if (TEMPLATE_FIELDS[type][k]) d[k] = v;
    }
    return d;
  };
  switch (name) {
    case "style_text": {
      const styles = { ...c.styles };
      if (a.reset) delete styles[a.key];
      else styles[a.key] = { ...styles[a.key], ...(a.color ? { color: a.color } : {}), ...(a.size ? { size: a.size } : {}) };
      return { content: { ...c, styles }, label: a.reset ? "Estilo do texto restaurado" : "Estilo do texto alterado" };
    }
    case "move_section": {
      const b = findSection(a.section);
      const rest = c.layout.filter((x) => x.id !== b.id);
      const at = Math.max(0, Math.min(rest.length, a.position - 1));
      return { content: layout([...rest.slice(0, at), b, ...rest.slice(at)]), label: `Seção ${name_(b)} movida` };
    }
    case "set_section_visibility": {
      const b = findSection(a.section);
      return {
        content: layout(c.layout.map((x) => (x.id === b.id ? withHidden(x, !a.visible) : x))),
        label: `Seção ${name_(b)} ${a.visible ? "publicada" : "ocultada"}`,
      };
    }
    case "remove_section": {
      const b = findSection(a.section);
      return { content: layout(c.layout.filter((x) => x.id !== b.id)), label: `Seção ${name_(b)} removida` };
    }
    case "add_section": {
      let b;
      if (BUILTIN_TYPES.includes(a.type)) {
        if (c.layout.some((x) => x.type === a.type)) fail("Essa seção já está na página.");
        b = { id: a.type, type: a.type };
      } else {
        const { type, position, visible, ...fields } = a;
        b = { id: ctx.newId(), type, data: templateData(type, fields, ctx.templateData(type)) };
      }
      if (!a.visible) b.hidden = true;
      const at = a.position ? Math.max(0, Math.min(c.layout.length, a.position - 1)) : c.layout.length;
      return { content: layout([...c.layout.slice(0, at), b, ...c.layout.slice(at)]), label: `Seção ${name_(b)} inserida` };
    }
    case "update_section": {
      const b = findSection(a.section);
      if (!TEMPLATE_FIELDS[b.type]) fail("Essa seção é fixa: mude os textos dela pelos textos da página.");
      const { section, ...fields } = a;
      const next = { ...b, data: templateData(b.type, fields, b.data ?? {}) };
      return { content: layout(c.layout.map((x) => (x.id === b.id ? next : x))), label: `Seção ${name_(b)} atualizada` };
    }
    case "rename_section": {
      const b = findSection(a.section);
      const content = BUILTIN_TYPES.includes(b.type)
        ? { ...c, copy: { ...c.copy, [`nav.${b.type}`]: a.name } }
        : layout(c.layout.map((x) => (x.id === b.id ? { ...x, data: { ...x.data, nav: a.name } } : x)));
      return { content, label: `Seção ${name_(b)} renomeada` };
    }
    case "add_photo": {
      const b = findSection(a.section);
      if (b.type !== "gallery") fail("Essa seção não é uma galeria.");
      const images = [...(b.data?.images ?? [])];
      if (images.length >= 12) fail("A galeria já tem 12 fotos.");
      images.push({ url: photo(a.image), caption: a.caption || "Legenda da foto" });
      return { content: layout(c.layout.map((x) => (x.id === b.id ? { ...x, data: { ...x.data, images } } : x))), label: `Foto adicionada à galeria ${name_(b)}` };
    }
    case "set_image": {
      const url = photo(a.image, a.remove_background);
      const [kind, id] = a.target.split(":");
      if (kind === "hero") return { content: { ...c, company: { ...c.company, heroImageUrl: url } }, label: "Foto do topo trocada" };
      if (kind === "company") return { content: { ...c, company: { ...c.company, benchImageUrl: url } }, label: "Foto da empresa trocada" };
      if (kind === "service") {
        if (!c.services.some((x) => x.id === id)) fail("Essa solução não existe mais.");
        return { content: { ...c, services: c.services.map((x) => (x.id === id ? { ...x, imageUrl: url } : x)) }, label: "Foto da solução trocada" };
      }
      if (kind === "product") {
        const p = findProduct(id);
        return { content: { ...c, products: c.products.map((x) => (x.id === id ? { ...x, imageUrl: url } : x)) }, label: `Foto da peça “${p.title}” trocada` };
      }
      if (kind === "section") {
        const b = findSection(id);
        if (b.type !== "text-image") fail("Essa seção não tem foto para trocar.");
        return { content: layout(c.layout.map((x) => (x.id === b.id ? { ...x, data: { ...x.data, imageUrl: url } } : x))), label: `Foto da seção ${name_(b)} trocada` };
      }
      return fail("Não sei trocar essa foto.");
    }
    case "add_product": {
      if (a.code && c.products.some((p) => p.code === a.code)) fail(`Já existe uma peça com o código ${a.code}.`);
      const p = {
        id: ctx.newId(),
        code: a.code || nextCode(a.category, c.products.map((x) => x.code)),
        title: a.title,
        category: a.category,
        featured: a.featured ?? false,
        specs: a.specs ?? "Usinagem CNC • Sob medida",
        description: a.description ?? "Componente fabricado sob medida pela Usibar Usinagens Especiais.",
        imageUrl: photo(a.image, a.remove_background),
      };
      return { content: { ...c, products: [p, ...c.products] }, label: `Peça “${p.title}” cadastrada` };
    }
    case "update_product": {
      const p = findProduct(a.product);
      if (a.code && c.products.some((x) => x.code === a.code && x.id !== p.id)) fail(`Já existe uma peça com o código ${a.code}.`);
      const next = { ...p };
      for (const k of ["title", "code", "category", "specs", "description", "featured"]) if (k in a) next[k] = a[k];
      if (a.image) next.imageUrl = photo(a.image, a.remove_background);
      return { content: { ...c, products: c.products.map((x) => (x.id === p.id ? next : x)) }, label: `Peça “${next.title}” atualizada` };
    }
    case "remove_product": {
      const p = findProduct(a.product);
      return { content: { ...c, products: c.products.filter((x) => x.id !== p.id) }, label: `Peça “${p.title}” excluída` };
    }
    case "update_company":
      return { content: { ...c, company: { ...c.company, ...a } }, label: "Dados da empresa alterados" };
    case "add_block":
    case "update_block":
    case "remove_block":
    case "move_block": {
      const b = findSection(a.section);
      if (b.type !== "blocks") fail("Essa seção não é uma seção livre.");
      const list = [...(b.data?.blocks ?? [])];
      const at = list.findIndex((x) => x.id === a.block);
      if (name !== "add_block" && at < 0) fail("Esse bloco não existe mais.");
      const { section, block, position, image, ...fields } = a;
      const withImage = (x) => (image ? { ...x, url: photo(image) } : x);
      if (name === "add_block") {
        const nb = withImage({ id: ctx.newId(), ...fields });
        const i = position ? Math.max(0, Math.min(list.length, position - 1)) : list.length;
        list.splice(i, 0, nb);
      } else if (name === "update_block") list[at] = withImage({ ...list[at], ...fields });
      else if (name === "remove_block") list.splice(at, 1);
      else {
        const [x] = list.splice(at, 1);
        list.splice(Math.max(0, Math.min(list.length, position - 1)), 0, x);
      }
      const labels = { add_block: "Bloco inserido", update_block: "Bloco alterado", remove_block: "Bloco removido", move_block: "Bloco movido" };
      return { content: layout(c.layout.map((x) => (x.id === b.id ? { ...x, data: { ...x.data, blocks: list } } : x))), label: `${labels[name]} em ${name_(b)}` };
    }
    case "set_element_visibility": {
      const hidden = (c.hidden ?? []).filter((k) => k !== a.key);
      return { content: { ...c, hidden: a.visible ? hidden : [...hidden, a.key] }, label: a.visible ? "Elemento recolocado" : "Elemento removido" };
    }
    case "set_notice": {
      const today = new Date().toISOString().slice(0, 10);
      const base = c.notice ?? { enabled: false, icon: "ferias", title: "Férias coletivas", text: "Estaremos em férias coletivas. Retornamos o atendimento em breve.", start: today, end: today };
      const next = { ...base, ...a, version: ctx.newId() };
      if (next.start > next.end) fail("A data final do aviso é anterior à inicial.");
      return { content: { ...c, notice: next }, label: a.enabled ? "Aviso de abertura configurado" : "Aviso de abertura desligado" };
    }
    case "set_social": {
      const current = Array.isArray(c.company.socials)
        ? c.company.socials
        : c.company.instagram
          ? [{ id: "instagram", network: "instagram", url: `https://instagram.com/${c.company.instagram}` }]
          : [];
      const others = current.filter((x) => x.network !== a.network);
      const socials = a.url ? [...current.map((x) => (x.network === a.network ? { ...x, url: a.url } : x)), ...(others.length === current.length ? [{ id: ctx.newId(), network: a.network, url: a.url }] : [])] : others;
      return { content: { ...c, company: { ...c.company, socials } }, label: `${NETWORK_LABELS[a.network]} ${a.url ? "atualizado" : "removido"}` };
    }
    default:
      return fail("Essa ação não muda o conteúdo.");
  }
}
const withHidden = (b, hidden) => {
  const { hidden: _, ...rest } = b;
  return hidden ? { ...rest, hidden: true } : rest;
};
