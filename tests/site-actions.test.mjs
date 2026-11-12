import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validData } from "../src/lib/security.mjs";
import { acceptActions, applyAction, CHAT_TOOLS, describeAction, TEMPLATE_FIELDS } from "../src/lib/site-actions.mjs";

const sample = JSON.parse(fs.readFileSync("data/db.json"));
const layout = ["solutions", "process", "catalog", "origin", "sectors", "quote"].map((t) => ({ id: t, type: t }));
const gallery = { id: "galeria1", type: "gallery", hidden: true, data: { nav: "Galeria", title: "Trabalhos", images: [{ url: "/assets/hero-bench.webp", caption: "Bancada" }] } };
const content = { ...sample, copy: {}, styles: {}, layout: [...layout, gallery] };
const site = {
  sections: content.layout.map((b) => ({ id: b.id, type: b.type, name: b.data?.nav ?? b.type, hidden: !!b.hidden })),
  products: content.products.map(({ id, code, title, category, featured }) => ({ id, code, title, category, featured })),
  images: [{ target: "hero", label: "a foto do topo" }, { target: `product:${content.products[0].id}`, label: "a foto da peça" }, { target: "service:cilindros", label: "a foto da solução" }, { target: "section:galeria1", label: "x" }],
  attachments: [{ id: "foto-1", name: "peca.jpg" }],
};
const texts = [{ key: "hero.title.1", label: "Topo — título", text: "Componentes hidráulicos" }];
let n = 0;
const ctx = {
  url: (id, removeBg) => (id === "foto-1" ? (removeBg ? "/uploads/foto-1-recorte.webp" : "/uploads/foto-1.webp") : undefined),
  templateData: (type) => ({ nav: "Nova", ...(type === "text-image" ? { imageUrl: "/assets/hero-bench.webp", side: "right" } : {}), ...(type === "gallery" ? { images: [] } : {}) }),
  newId: () => `novo${++n}`,
  sectionName: (b) => b.data?.nav ?? b.type,
};
const accept = (name, args) => acceptActions([{ name, args }], site, texts).actions[0];
const run = (name, args) => applyAction(content, accept(name, args), ctx);

test("every tool has a Portuguese description and an object schema", () => {
  for (const t of CHAT_TOOLS) {
    assert.match(t.description, /[a-zà-ú]/);
    if (!t.parameters) continue; // functions without arguments
    assert.equal(t.parameters.type, "OBJECT");
    assert.ok(Object.keys(t.parameters.properties).length > 0, `${t.name} has properties`);
    for (const r of t.parameters.required ?? []) assert.ok(r in t.parameters.properties, `${t.name}.${r}`);
  }
});

test("calls that do not match the site are dropped", () => {
  const { actions, dropped } = acceptActions(
    [
      { name: "remove_section", args: { section: "nao-existe" } },
      { name: "set_text", args: { key: "inventada", text: "x" } },
      { name: "set_image", args: { target: "hero", image: "foto-9" } },
      { name: "add_product", args: { title: "Cilindro", code: content.products[0].code, category: "cilindros", image: "foto-1" } },
      { name: "add_section", args: { type: "process" } }, // already on the page
      { name: "delete_everything", args: {} },
      { name: "remove_section", args: { section: "quote" } },
    ],
    site,
    texts,
  );
  assert.equal(dropped, 6);
  assert.deepEqual(actions, [{ name: "remove_section", args: { section: "quote" } }]);
});

test("arguments are normalized: sizes clamped, colours checked, contact fields cleaned", () => {
  assert.deepEqual(accept("style_text", { key: "hero.title.1", size: 9, color: "#FA4804" }).args, { key: "hero.title.1", color: "#fa4804", size: 2.4 });
  assert.equal(accept("style_text", { key: "hero.title.1", color: "laranja" }), undefined);
  assert.deepEqual(accept("update_company", { whatsapp: "+55 (51) 3696-9839", email: "não é email", zip: "95730000" }).args, { whatsapp: "555136969839", zip: "95730000" });
  assert.equal(accept("set_social", { network: "linkedin", url: "http://inseguro" }), undefined);
  assert.equal(accept("move_section", { section: "quote", position: 99 }).args.position, site.sections.length);
});

test("each applied action yields content the server accepts", () => {
  const pid = content.products[0].id;
  const cases = [
    ["style_text", { key: "hero.title.1", color: "#bf4f29", size: 1.3 }],
    ["move_section", { section: "sectors", position: 2 }],
    ["set_section_visibility", { section: "galeria1", visible: true }],
    ["remove_section", { section: "process" }],
    ["add_section", { type: "testimonial", position: 3, quote: "Entrega no prazo e peças impecáveis.", author: "Cliente", role: "Indústria · compras" }],
    ["add_section", { type: "text-image", image: "foto-1", title: "Nossa bancada", side: "left", visible: true }],
    ["add_section", { type: "stats", items: [{ value: "20+", label: "anos" }] }],
    ["add_section", { type: "gallery", photos: [{ image: "foto-1", caption: "Peça nova" }] }],
    ["update_section", { section: "galeria1", title: "Trabalhos recentes" }],
    ["rename_section", { section: "catalog", name: "Peças" }],
    ["rename_section", { section: "galeria1", name: "Fotos" }],
    ["add_photo", { section: "galeria1", image: "foto-1", caption: "Mais uma" }],
    ["set_image", { target: "hero", image: "foto-1" }],
    ["set_image", { target: `product:${pid}`, image: "foto-1", remove_background: true }],
    ["set_image", { target: "service:cilindros", image: "foto-1" }],
    ["add_product", { title: "Cilindro telescópico", code: "USB-CH-09", category: "cilindros", image: "foto-1", remove_background: true }],
    ["update_product", { product: pid, title: "Cilindro com válvula integrada", featured: false }],
    ["remove_product", { product: pid }],
    ["update_company", { phoneDisplay: "(51) 3696-9839", whatsapp: "555136969839" }],
    ["set_social", { network: "linkedin", url: "https://linkedin.com/company/usibar" }],
    ["set_social", { network: "instagram", url: "" }],
  ];
  for (const [name, args] of cases) {
    const action = accept(name, args);
    assert.ok(action, `${name} accepted`);
    const { content: next, label } = applyAction(content, action, ctx);
    assert.ok(label, `${name} label`);
    assert.equal(validData(next), true, `${name} keeps the content valid`);
    assert.ok(describeAction(action, site, texts).length > 5);
  }
});

test("actions change exactly what they say", () => {
  const moved = run("move_section", { section: "quote", position: 1 }).content.layout.map((b) => b.id);
  assert.deepEqual(moved.slice(0, 2), ["quote", "solutions"]);
  const added = run("add_section", { type: "cta", title: "Fale conosco", position: 2 }).content.layout[1];
  assert.equal(added.type, "cta");
  assert.equal(added.hidden, true);
  assert.equal(added.data.title, "Fale conosco");
  const product = run("add_product", { title: "Bloco", code: "USB-BH-09", category: "blocos", image: "foto-1", remove_background: true }).content.products[0];
  assert.equal(product.imageUrl, "/uploads/foto-1-recorte.webp");
  assert.equal(run("rename_section", { section: "catalog", name: "Peças" }).content.copy["nav.catalog"], "Peças");
  const shown = run("set_section_visibility", { section: "galeria1", visible: true }).content.layout.find((b) => b.id === "galeria1");
  assert.equal("hidden" in shown, false);
  const socials = run("set_social", { network: "linkedin", url: "https://linkedin.com/company/usibar" }).content.company.socials;
  assert.equal(socials.filter((s) => s.network === "linkedin").length, 1);
});

test("template fields offered to the model are the ones the server allows", () => {
  const offered = Object.keys(CHAT_TOOLS.find((t) => t.name === "update_section").parameters.properties);
  for (const spec of Object.values(TEMPLATE_FIELDS))
    for (const k of Object.keys(spec)) assert.ok(offered.includes(k === "imageUrl" ? "image" : k === "images" ? "photos" : k), k);
});

// ---- Free blocks, removable elements, opening notice ----------------------------------------
import { noticeActive, validBlocks, validNotice } from "../src/lib/site-actions.mjs";
const img = (v) => typeof v === "string" && v.startsWith("/assets/");

test("blocks: each kind validated with its own fields", () => {
  const ok = [
    { id: "a1", kind: "label", text: "NOVIDADE" },
    { id: "a2", kind: "heading", text: "Linha nova", size: "lg" },
    { id: "a3", kind: "text", text: "Parágrafo." },
    { id: "a4", kind: "button", text: "Fale conosco", link: "whatsapp", style: "ghost" },
    { id: "a5", kind: "image", url: "/assets/hero-bench.webp", caption: "Bancada" },
    { id: "a6", kind: "features", items: [{ icon: "engrenagem", title: "Precisão", text: "CNC" }] },
    { id: "a7", kind: "callout", icon: "ferias", title: "Férias", text: "Voltamos dia 6." },
    { id: "a8", kind: "quote", text: "Ótimo.", author: "Cliente" },
    { id: "a9", kind: "stats", items: [{ value: "20+", label: "anos" }] },
    { id: "b1", kind: "divider" },
  ];
  assert.equal(validBlocks(ok, img), true);
  for (const bad of [
    { id: "x", kind: "script", text: "x" },
    { id: "x", kind: "button", text: "Ir", link: "javascript:alert(1)" },
    { id: "x", kind: "image", url: "https://evil/x.png" },
    { id: "x", kind: "callout", icon: "caveira", title: "x" },
    { id: "x", kind: "heading", text: "x", onclick: "y" },
    { id: "X Y", kind: "divider" },
  ])
    assert.equal(validBlocks([bad], img), false, JSON.stringify(bad));
  assert.equal(validBlocks([ok[0], ok[0]], img), false, "duplicate ids");
});

test("notice: dates, icon and version checked; shown only inside its period", () => {
  const n = { enabled: true, icon: "ferias", title: "Férias coletivas", text: "De 22/12 a 05/01.", start: "2026-12-20", end: "2027-01-05", version: "v1" };
  assert.equal(validNotice(n), true);
  assert.equal(validNotice({ ...n, end: "2026-12-01" }), false);
  assert.equal(validNotice({ ...n, icon: "x" }), false);
  assert.equal(validNotice({ ...n, extra: 1 }), false);
  assert.equal(noticeActive(n, "2026-12-19"), false);
  assert.equal(noticeActive(n, "2026-12-20"), true);
  assert.equal(noticeActive(n, "2027-01-05"), true);
  assert.equal(noticeActive({ ...n, enabled: false }, "2026-12-25"), false);
  assert.equal(validData({ ...content, notice: n }), true);
  assert.equal(validData({ ...content, notice: { ...n, text: "" } }), false);
});

test("assistant: free section with blocks, block edits, elements and notice stay valid", () => {
  const free = { id: "livre1", type: "blocks", data: { nav: "Nova", blocks: [{ id: "h1", kind: "heading", text: "Olá" }, { id: "t1", kind: "text", text: "Texto" }] } };
  const c2 = { ...content, layout: [...content.layout, free] };
  const site2 = { ...site, sections: [...site.sections, { id: "livre1", type: "blocks", name: "Nova", hidden: false, blocks: [{ id: "h1", kind: "heading", text: "Olá" }, { id: "t1", kind: "text", text: "Texto" }] }], removables: [{ key: "hero.cta.2", label: "Topo — botão secundário", hidden: false }] };
  const go = (c, name, args) => {
    const act = acceptActions([{ name, args }], site2, texts).actions[0];
    assert.ok(act, `${name} accepted`);
    const r = applyAction(c, act, ctx);
    assert.equal(validData(r.content), true, `${name} valid`);
    assert.ok(describeAction(act, site2, texts).length > 5);
    return r.content;
  };
  const created = go(content, "add_section", { type: "blocks", visible: true, blocks: [{ kind: "heading", text: "Linha agrícola" }, { kind: "features", items: [{ icon: "engrenagem", title: "Robustez" }] }, { kind: "button", text: "Pedir orçamento" }, { kind: "image", image: "foto-1" }] });
  const sec = created.layout.at(-1);
  assert.deepEqual(sec.data.blocks.map((b) => b.kind), ["heading", "features", "button", "image"]);
  assert.equal(sec.data.blocks[2].link, "#orcamento");
  let c = go(c2, "add_block", { section: "livre1", kind: "callout", icon: "ferias", title: "Férias", position: 1 });
  assert.equal(c.layout.at(-1).data.blocks[0].kind, "callout");
  c = go(c2, "update_block", { section: "livre1", block: "t1", text: "Novo texto" });
  assert.equal(c.layout.at(-1).data.blocks[1].text, "Novo texto");
  c = go(c2, "move_block", { section: "livre1", block: "t1", position: 1 });
  assert.equal(c.layout.at(-1).data.blocks[0].id, "t1");
  c = go(c2, "remove_block", { section: "livre1", block: "h1" });
  assert.equal(c.layout.at(-1).data.blocks.length, 1);
  c = go(content, "set_element_visibility", { key: "hero.cta.2", visible: false });
  assert.deepEqual(c.hidden, ["hero.cta.2"]);
  c = go(c, "set_element_visibility", { key: "hero.cta.2", visible: true });
  assert.deepEqual(c.hidden, []);
  c = go(content, "set_notice", { enabled: true, icon: "ferias", title: "Férias coletivas", text: "Retornamos em 05/01.", start: "2026-12-22", end: "2027-01-05" });
  assert.equal(c.notice.end, "2027-01-05");
  assert.equal(acceptActions([{ name: "set_notice", args: { enabled: true, start: "2027-01-05", end: "2026-12-22" } }], site2, texts).actions.length, 0);
  assert.equal(acceptActions([{ name: "set_element_visibility", args: { key: "inventado", visible: false } }], site2, texts).actions.length, 0);
});

test("assistant autonomy: multi-task batch, photo-less cadastros, structured CRUD and responsive text layout", () => {
  const fullSite = {
    ...site,
    services: content.services.map(({ id, title, lead, copy, category }) => ({ id, title, lead, copy, category })),
    sectors: content.sectors.map(({ id, name, code }) => ({ id, name, code })),
    pillars: content.pillars.map(({ id, title, desc }) => ({ id, title, desc })),
    process: content.process,
  };
  const calls = [
    { name: "add_product", args: { title: "Cilindro de dupla ação agrícola", category: "cilindros", featured: true } },
    { name: "add_product", args: { title: "Bloco manifold especial 6 vias", category: "blocos", asset_image: "/assets/bloco-manifold-longo.webp" } },
    { name: "add_service", args: { title: "Usinagem CNC seriada", lead: "Peças técnicas sob desenho", copy: "Produção seriada conforme projeto.", category: "all" } },
    { name: "update_service", args: { service: content.services[0].id, lead: "Simples e dupla ação sob medida" } },
    { name: "add_sector", args: { name: "Mineração pesada", icon_type: "industrial" } },
    { name: "update_sector", args: { sector: content.sectors[0].id, name: "Implementos agrícolas" } },
    { name: "add_pillar", args: { title: "Rastreabilidade", desc: "Controle dimensional em todas as etapas." } },
    { name: "update_pillar", args: { pillar: content.pillars[0].id, desc: "Projetos dedicados à sua aplicação." } },
    { name: "update_process_step", args: { step: 2, title: "Usinagem CNC de precisão." } },
    { name: "set_text", args: { key: "hero.title.1", text: "CILINDROS ESPECIAIS" } },
    { name: "set_text", args: { key: "company.motto", text: "Força, precisão e desempenho sob medida." } },
    { name: "style_text", args: { key: "hero.title.1", width: 88, align: "right", x: 100, y: 0 } },
  ];
  const { actions, dropped } = acceptActions(calls, fullSite, texts);
  assert.equal(dropped, 0);
  assert.equal(actions.length, calls.length);

  let cur = content;
  for (const action of actions) {
    assert.ok(describeAction(action, fullSite, texts).length > 5);
    cur = applyAction(cur, action, ctx).content;
    assert.equal(validData(cur), true, `${action.name} keeps content valid`);
  }

  assert.equal(cur.products.length, content.products.length + 2);
  assert.notEqual(cur.products[0].code, cur.products[1].code);
  assert.equal(cur.products[0].imageUrl, "/assets/bloco-manifold-longo.webp");
  assert.equal(cur.services.length, content.services.length + 1);
  assert.equal(cur.sectors.at(-1).name, "Mineração pesada");
  assert.equal(cur.pillars.at(-1).title, "Rastreabilidade");
  assert.equal(cur.process[1].title, "Usinagem CNC de precisão.");
  assert.equal(cur.copy["hero.title.1"], "CILINDROS ESPECIAIS");
  assert.equal(cur.company.motto, "Força, precisão e desempenho sob medida.");
  assert.deepEqual(cur.styles["hero.title.1"], { width: 88, align: "right", x: 100, y: 0 });

  // Resetting position keeps width/align intact
  const resetPos = acceptActions([{ name: "style_text", args: { key: "hero.title.1", reset_position: true } }], fullSite, texts).actions[0];
  cur = applyAction(cur, resetPos, ctx).content;
  assert.deepEqual(cur.styles["hero.title.1"], { width: 88, align: "right" });
  assert.equal(validData(cur), true);
});

import { validateAiRequest } from "../src/lib/ai-rules.mjs";

test("expanded removables, decoupled origin/service keys, zero-item lists and optional product fields stay valid", () => {
  const removables = [
    { key: "origin.caption", label: "Empresa — legenda da foto", hidden: false },
    { key: "origin.city", label: "Empresa — cidade na foto", hidden: false },
    { key: "origin.num", label: "Empresa — numeração", hidden: false },
    { key: "origin.eyebrow", label: "Empresa — rótulo", hidden: false },
    { key: "origin.p3", label: "Apresentação — parágrafo 3", hidden: false },
    { key: "origin.years", label: "Empresa — anos de experiência", hidden: false },
    { key: "service.cilindros.cta", label: "Solução 1 — botão orçar", hidden: false },
    ...Array.from({ length: 240 }, (_, i) => ({ key: `extra.item.${i}`, label: `Campo ${i}`, hidden: i % 2 === 0 })),
  ];
  const manyTexts = Array.from({ length: 230 }, (_, i) => ({ key: `copy.k.${i}`, label: `Texto ${i}`, text: "Curto" }));
  const chatCheck = validateAiRequest({
    action: "chat",
    messages: [{ role: "user", text: "remova Barão da legenda da foto da empresa" }],
    site: {
      ...site,
      company: { phoneDisplay: content.company.phoneDisplay, whatsapp: content.company.whatsapp },
      removables,
      pillars: content.pillars.map(({ id, title, desc }) => ({ id, title, desc })),
      services: content.services.map(({ id, title, lead, copy, category }) => ({ id, title, lead, copy, category })),
    },
    texts: manyTexts,
  });
  assert.equal(chatCheck.ok, true);

  // Hiding origin.city independently of origin.caption + 240 other keys stays valid
  const hiddenKeys = removables.filter((r) => r.hidden || r.key === "origin.city").map((r) => r.key);
  assert.equal(
    validData({
      ...content,
      hidden: hiddenKeys,
      copy: { "origin.caption": "Usibar", "origin.city": "Barão/RS", "service.cilindros.cta": "Cotar cilindros" },
      products: [{ ...content.products[0], specs: "", description: "" }],
    }),
    true,
  );

  // Removing every pillar and service down to zero is accepted by both AI actions and server validation
  const siteWithAll = {
    ...site,
    pillars: content.pillars.map(({ id, title, desc }) => ({ id, title, desc })),
    services: content.services.map(({ id, title, lead, copy, category }) => ({ id, title, lead, copy, category })),
  };
  const rmCalls = [
    ...content.pillars.map((p) => ({ name: "remove_pillar", args: { pillar: p.id } })),
    ...content.services.map((s) => ({ name: "remove_service", args: { service: s.id } })),
  ];
  const { actions, dropped } = acceptActions(rmCalls, siteWithAll, texts);
  assert.equal(dropped, 0);
  let next = content;
  for (const act of actions) next = applyAction(next, act, ctx).content;
  assert.equal(next.pillars.length, 0);
  assert.equal(next.services.length, 0);
  assert.equal(validData(next), true);
});
