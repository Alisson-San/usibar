"use client";
import { useContext, useRef, useState } from "react";
import { Icon, IconPicker } from "./icons";
import { CopyContext, Editable, ImageSwap } from "./copy";
import { useModal } from "./editing";

// The page between the hero and the footer is an ordered list of sections. Built-in sections
// keep their own content (catalog, process…); new sections come from templates and carry
// their texts and photos in `data`.
export const BUILTINS = ["solutions", "process", "catalog", "origin", "sectors", "quote"] as const;
export type BuiltinType = (typeof BUILTINS)[number];
export const TEMPLATES = ["blocks", "text-image", "stats", "gallery", "cta", "testimonial"] as const;
export type TemplateType = (typeof TEMPLATES)[number];
export type Block = { id: string; type: BuiltinType | TemplateType; hidden?: boolean; data?: Record<string, unknown> };

export const defaultLayout = (): Block[] => BUILTINS.map((type) => ({ id: type, type }));
export const isBuiltin = (t: string): t is BuiltinType => (BUILTINS as readonly string[]).includes(t);

export const BUILTIN_INFO: Record<BuiltinType, { dom: string; nav: string; hint: string }> = {
  solutions: { dom: "solucoes", nav: "Soluções", hint: "Cilindros, blocos e usinagem de precisão" },
  process: { dom: "processo", nav: "Processo", hint: "Do desenho técnico à peça em movimento" },
  catalog: { dom: "pecas", nav: "Catálogo", hint: "Modelos que já produzimos" },
  origin: { dom: "origem", nav: "Empresa", hint: "Quem somos e nossos pilares" },
  sectors: { dom: "segmentos", nav: "Segmentos", hint: "Onde nossos componentes trabalham" },
  quote: { dom: "orcamento", nav: "Orçamento", hint: "Seu pedido em quatro respostas" },
};

type Item = { value: string; label: string };
type Photo = { url: string; caption: string };
export const TEMPLATE_INFO: Record<TemplateType, { name: string; about: string; data: () => Record<string, unknown> }> = {
  blocks: {
    name: "Seção livre (blocos)",
    about: "Monte do seu jeito: títulos, textos, botões, fotos, destaques com ícone, chamadas, citações e números.",
    data: () => ({
      nav: "Nova seção",
      blocks: [newBlock("label"), newBlock("heading", { size: "lg" }), newBlock("text"), newBlock("button")],
    }),
  },
  "text-image": {
    name: "Texto com foto",
    about: "Um título, um parágrafo e uma foto ao lado, com botão de orçamento.",
    data: () => ({
      nav: "Destaque",
      eyebrow: "DESTAQUE",
      title: "Título da seção",
      accent: "complemento em destaque.",
      text: "Escreva aqui o texto desta seção.",
      imageUrl: "/assets/hero-bench.webp",
      side: "right",
      cta: "Solicitar orçamento",
    }),
  },
  stats: {
    name: "Números",
    about: "Até seis números grandes com legenda, para fatos da empresa.",
    data: () => ({
      nav: "Números",
      eyebrow: "EM NÚMEROS",
      title: "A Usibar em números",
      items: [
        { value: "20+", label: "anos de experiência em hidráulica" },
        { value: "6", label: "segmentos atendidos" },
        { value: "3", label: "linhas de solução: cilindros, blocos e usinagem" },
      ],
    }),
  },
  gallery: {
    name: "Galeria de fotos",
    about: "Até doze fotos com legenda, em grade.",
    data: () => ({
      nav: "Galeria",
      eyebrow: "GALERIA",
      title: "Trabalhos recentes",
      images: [
        { url: "/assets/hero-bench.webp", caption: "Cilindros na bancada" },
        { url: "/assets/bloco-manifold-longo.webp", caption: "Bloco manifold" },
        { url: "/assets/cilindro-valvula.webp", caption: "Cilindro com válvula" },
      ],
    }),
  },
  cta: {
    name: "Chamada para contato",
    about: "Uma faixa forte com título, texto e botão do WhatsApp.",
    data: () => ({
      nav: "Contato",
      title: "Tem um projeto em mente?",
      text: "Envie o desenho ou as especificações e receba a proposta da Usibar.",
      button: "Falar no WhatsApp",
    }),
  },
  testimonial: {
    name: "Depoimento",
    about: "Uma citação em destaque, com nome e empresa.",
    data: () => ({
      nav: "Depoimento",
      quote: "Escreva aqui o depoimento de um cliente.",
      author: "Nome do cliente",
      role: "Empresa · cargo",
    }),
  },
};

export const blockDom = (b: Block) => (isBuiltin(b.type) ? BUILTIN_INFO[b.type].dom : `secao-${b.id}`);

type Update = (id: string, change: (data: Record<string, unknown>) => Record<string, unknown>, label: string) => void;

// Text of a template section, editable in place; style key follows the section, not its position.
function BText({ block, field, label, update, className }: { block: Block; field: string; label: string; update: Update; className?: string }) {
  const { editing } = useContext(CopyContext);
  const value = String(block.data?.[field] ?? "");
  if (!value && !editing) return null;
  return (
    <Editable
      value={value || "—"}
      editing={editing}
      label={label}
      className={className}
      styleKey={`block.${block.id}.${field}`}
      onCommit={(v) => update(block.id, (d) => ({ ...d, [field]: v }), label)}
    />
  );
}

export function TemplateSection({ block, num, update, whatsapp }: { block: Block; num: string; update: Update; whatsapp: (text: string) => string }) {
  const { editing } = useContext(CopyContext);
  const d = block.data ?? {};
  const p = { block, update };
  const eyebrow = (
    <span className="eyebrow">
      {num} — <BText {...p} field="eyebrow" label="Rótulo da seção" />
    </span>
  );
  const dom = blockDom(block);
  switch (block.type) {
    case "text-image":
      return (
        <section id={dom} className={"tpl tpl-text-image" + (d.side === "left" ? " flip" : "")}>
          <div className="tpl-copy reveal">
            {eyebrow}
            <h2>
              <BText {...p} field="title" label="Título" />
              <br />
              <em>
                <BText {...p} field="accent" label="Título (destaque)" />
              </em>
            </h2>
            <p>
              <BText {...p} field="text" label="Texto" />
            </p>
            <a className="btn-solid" href="#orcamento">
              <BText {...p} field="cta" label="Botão" /> <span aria-hidden="true">↗</span>
            </a>
          </div>
          <figure className="tpl-figure">
            <img src={String(d.imageUrl ?? "")} alt="" loading="lazy" />
            <span className="image-bracket tl" />
            <span className="image-bracket br" />
            <ImageSwap label="foto" onChange={(url) => update(block.id, (x) => ({ ...x, imageUrl: url }), "Foto da seção")} />
            {editing && (
              <button className="tpl-flip" onClick={() => update(block.id, (x) => ({ ...x, side: x.side === "left" ? "right" : "left" }), "Lado da foto")}>
                ⇆ Foto do outro lado
              </button>
            )}
          </figure>
        </section>
      );
    case "stats": {
      const items = (d.items as Item[]) ?? [];
      const setItem = (i: number, key: keyof Item) => (v: string) =>
        update(block.id, (x) => ({ ...x, items: (x.items as Item[]).map((it, j) => (j === i ? { ...it, [key]: v } : it)) }), "Número");
      return (
        <section id={dom} className="tpl tpl-stats">
          <div className="tpl-head reveal">
            {eyebrow}
            <h2>
              <BText {...p} field="title" label="Título" />
            </h2>
          </div>
          <ul className="tpl-stat-list">
            {items.map((it, i) => (
              <li key={i}>
                <strong>
                  <Editable value={it.value} editing={editing} label={`Número ${i + 1}`} styleKey={`block.${block.id}.items.${i}.value`} onCommit={setItem(i, "value")} />
                </strong>
                <span>
                  <Editable value={it.label} editing={editing} label={`Legenda ${i + 1}`} styleKey={`block.${block.id}.items.${i}.label`} onCommit={setItem(i, "label")} />
                </span>
                {editing && items.length > 1 && (
                  <button className="tpl-remove" aria-label={`Remover número ${i + 1}`} onClick={() => update(block.id, (x) => ({ ...x, items: (x.items as Item[]).filter((_, j) => j !== i) }), "Número removido")}>
                    ×
                  </button>
                )}
              </li>
            ))}
            {editing && items.length < 6 && (
              <li className="tpl-add-item">
                <button onClick={() => update(block.id, (x) => ({ ...x, items: [...((x.items as Item[]) ?? []), { value: "00", label: "Descreva este número" }] }), "Número adicionado")}>
                  + Adicionar número
                </button>
              </li>
            )}
          </ul>
        </section>
      );
    }
    case "gallery": {
      const images = (d.images as Photo[]) ?? [];
      const setImages = (change: (list: Photo[]) => Photo[], label: string) => update(block.id, (x) => ({ ...x, images: change((x.images as Photo[]) ?? []) }), label);
      return (
        <section id={dom} className="tpl tpl-gallery">
          <div className="tpl-head reveal">
            {eyebrow}
            <h2>
              <BText {...p} field="title" label="Título" />
            </h2>
          </div>
          <ul className="tpl-photos">
            {images.map((ph, i) => (
              <li key={i}>
                <figure>
                  <img src={ph.url} alt={ph.caption} loading="lazy" />
                  <ImageSwap label="foto" onChange={(url) => setImages((l) => l.map((x, j) => (j === i ? { ...x, url } : x)), "Foto trocada")} />
                  {editing && images.length > 1 && (
                    <button className="tpl-remove" aria-label={`Remover foto ${i + 1}`} onClick={() => setImages((l) => l.filter((_, j) => j !== i), "Foto removida")}>
                      ×
                    </button>
                  )}
                </figure>
                <figcaption>
                  <Editable
                    value={ph.caption}
                    editing={editing}
                    label={`Legenda da foto ${i + 1}`}
                    styleKey={`block.${block.id}.images.${i}.caption`}
                    onCommit={(v) => setImages((l) => l.map((x, j) => (j === i ? { ...x, caption: v } : x)), "Legenda")}
                  />
                </figcaption>
              </li>
            ))}
            {editing && images.length < 12 && (
              <li className="tpl-add-photo">
                <ImageAdd onAdd={(url) => setImages((l) => [...l, { url, caption: "Legenda da foto" }], "Foto adicionada")} />
              </li>
            )}
          </ul>
        </section>
      );
    }
    case "cta":
      return (
        <section id={dom} className="tpl tpl-cta" data-tone="dark">
          <h2 className="reveal">
            <BText {...p} field="title" label="Título" />
          </h2>
          <p>
            <BText {...p} field="text" label="Texto" />
          </p>
          <a className="btn-solid light" href={whatsapp(String(d.title ?? "Olá, Usibar!"))} target="_blank" rel="noreferrer">
            <BText {...p} field="button" label="Botão" /> <span aria-hidden="true">↗</span>
          </a>
        </section>
      );
    case "blocks":
      return <FreeSection block={block} num={num} update={update} whatsapp={whatsapp} />;
    case "testimonial":
      return (
        <section id={dom} className="tpl tpl-testimonial">
          <span className="tpl-quote-mark" aria-hidden="true">
            “
          </span>
          <blockquote className="reveal">
            <p>
              <BText {...p} field="quote" label="Depoimento" />
            </p>
            <footer>
              <strong>
                <BText {...p} field="author" label="Autor" />
              </strong>
              <span>
                <BText {...p} field="role" label="Empresa e cargo" />
              </span>
            </footer>
          </blockquote>
        </section>
      );
    default:
      return null;
  }
}

// ---- Free section: a column of blocks, WordPress style ------------------------------------------
type UBlock = { id: string; kind: string; text?: string; title?: string; author?: string; size?: string; link?: string; style?: string; icon?: string; url?: string; caption?: string; items?: { icon?: string; title?: string; text?: string; value?: string; label?: string }[] };
const KIND_INFO: Record<string, [string, string]> = {
  label: ["Rótulo", "documento"],
  heading: ["Título", "estrela"],
  text: ["Parágrafo", "documento"],
  button: ["Botão", "raio"],
  image: ["Foto", "fabrica"],
  features: ["Destaques com ícone", "engrenagem"],
  callout: ["Chamada com ícone", "alerta"],
  quote: ["Citação", "pessoas"],
  stats: ["Números", "check"],
  divider: ["Divisória", "ferramenta"],
};
const blockId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);
export function newBlock(kind: string, extra: Partial<UBlock> = {}): UBlock {
  const base: Record<string, Partial<UBlock>> = {
    label: { text: "NOVIDADE" },
    heading: { text: "Título da seção", size: "md" },
    text: { text: "Escreva aqui o texto deste bloco." },
    button: { text: "Solicitar orçamento", link: "#orcamento", style: "solid" },
    image: { url: "/assets/hero-bench.webp", caption: "Legenda da foto" },
    features: {
      items: [
        { icon: "engrenagem", title: "Precisão", text: "Usinagem CNC conforme o projeto." },
        { icon: "escudo", title: "Confiabilidade", text: "Componentes testados para a aplicação." },
        { icon: "caminhao", title: "Entrega", text: "Prazo combinado com o cliente." },
      ],
    },
    callout: { icon: "info", title: "Atenção", text: "Escreva aqui a mensagem em destaque." },
    quote: { text: "Escreva aqui o depoimento.", author: "Nome do cliente" },
    stats: { items: [{ value: "20+", label: "anos de experiência" }, { value: "6", label: "segmentos atendidos" }] },
    divider: {},
  };
  return { id: blockId(), kind, ...base[kind], ...extra };
}
const LINKS: [string, string][] = [
  ["#orcamento", "Orçamento"],
  ["#pecas", "Catálogo"],
  ["whatsapp", "WhatsApp"],
];

function FreeSection({ block, num, update, whatsapp }: { block: Block; num: string; update: Update; whatsapp: (text: string) => string }) {
  const { editing } = useContext(CopyContext);
  const [menuAt, setMenuAt] = useState<number | null>(null);
  const [iconFor, setIconFor] = useState<string | null>(null);
  const blocks = (block.data?.blocks as UBlock[]) ?? [];
  const set = (change: (l: UBlock[]) => UBlock[], label: string) => update(block.id, (d) => ({ ...d, blocks: change((d.blocks as UBlock[]) ?? []) }), label);
  const patch = (id: string, p: Partial<UBlock>, label: string) => set((l) => l.map((b) => (b.id === id ? { ...b, ...p } : b)), label);
  const field = (b: UBlock, key: "text" | "title" | "author" | "caption", label: string, className?: string) => {
    const value = String(b[key] ?? "");
    if (!value && !editing) return null;
    return (
      <Editable value={value || "—"} editing={editing} label={label} className={className} styleKey={`block.${block.id}.${b.id}.${key}`} onCommit={(v) => patch(b.id, { [key]: v }, label)} />
    );
  };
  const item = (b: UBlock, i: number, key: "title" | "text" | "value" | "label", label: string) => (
    <Editable
      value={String(b.items?.[i]?.[key] ?? "") || "—"}
      editing={editing}
      label={label}
      styleKey={`block.${block.id}.${b.id}.items.${i}.${key}`}
      onCommit={(v) => patch(b.id, { items: b.items!.map((x, j) => (j === i ? { ...x, [key]: v } : x)) }, label)}
    />
  );
  const href = (link = "#orcamento") => (link === "whatsapp" ? whatsapp("Olá, Usibar!") : link);
  const render = (b: UBlock) => {
    switch (b.kind) {
      case "label":
        return <span className="eyebrow">{field(b, "text", "Rótulo")}</span>;
      case "heading":
        return b.size === "lg" ? <h2 className="ub-h lg">{field(b, "text", "Título")}</h2> : <h3 className="ub-h">{field(b, "text", "Título")}</h3>;
      case "text":
        return <p className="ub-text">{field(b, "text", "Parágrafo")}</p>;
      case "button":
        return (
          <a className={b.style === "ghost" ? "btn-ghost" : "btn-solid"} href={href(b.link)} {...(b.link?.startsWith("http") || b.link === "whatsapp" ? { target: "_blank", rel: "noreferrer" } : {})} onClick={(e) => editing && e.preventDefault()}>
            {field(b, "text", "Botão")} <span aria-hidden="true">↗</span>
          </a>
        );
      case "image":
        return (
          <figure className="ub-figure">
            <img src={b.url} alt={b.caption ?? ""} loading="lazy" />
            <span className="image-bracket tl" />
            <span className="image-bracket br" />
            <ImageSwap label="foto" onChange={(url) => patch(b.id, { url }, "Foto do bloco")} />
            {(b.caption || editing) && <figcaption>{field(b, "caption", "Legenda da foto")}</figcaption>}
          </figure>
        );
      case "features":
        return (
          <ul className="ub-features">
            {(b.items ?? []).map((it, i) => (
              <li key={i}>
                <button type="button" className="ub-icon" disabled={!editing} onClick={() => setIconFor(iconFor === `${b.id}:${i}` ? null : `${b.id}:${i}`)} aria-label="Trocar ícone">
                  <Icon name={it.icon ?? "info"} />
                </button>
                {editing && iconFor === `${b.id}:${i}` && (
                  <IconPicker
                    value={it.icon}
                    onPick={(icon) => {
                      setIconFor(null);
                      patch(b.id, { items: b.items!.map((x, j) => (j === i ? { ...x, icon } : x)) }, "Ícone");
                    }}
                  />
                )}
                <strong>{item(b, i, "title", `Destaque ${i + 1} — título`)}</strong>
                <span>{item(b, i, "text", `Destaque ${i + 1} — texto`)}</span>
                {editing && (b.items?.length ?? 0) > 1 && (
                  <button type="button" className="tpl-remove" aria-label={`Remover destaque ${i + 1}`} onClick={() => patch(b.id, { items: b.items!.filter((_, j) => j !== i) }, "Destaque removido")}>
                    ×
                  </button>
                )}
              </li>
            ))}
            {editing && (b.items?.length ?? 0) < 6 && (
              <li className="ub-add-item">
                <button type="button" onClick={() => patch(b.id, { items: [...(b.items ?? []), { icon: "check", title: "Novo destaque", text: "Descreva." }] }, "Destaque adicionado")}>
                  + Destaque
                </button>
              </li>
            )}
          </ul>
        );
      case "callout":
        return (
          <div className="ub-callout">
            <button type="button" className="ub-icon" disabled={!editing} onClick={() => setIconFor(iconFor === b.id ? null : b.id)} aria-label="Trocar ícone">
              <Icon name={b.icon ?? "info"} />
            </button>
            {editing && iconFor === b.id && (
              <IconPicker
                value={b.icon}
                onPick={(icon) => {
                  setIconFor(null);
                  patch(b.id, { icon }, "Ícone");
                }}
              />
            )}
            <div>
              <strong>{field(b, "title", "Chamada — título")}</strong>
              <p>{field(b, "text", "Chamada — texto")}</p>
            </div>
          </div>
        );
      case "quote":
        return (
          <blockquote className="ub-quote">
            <p>{field(b, "text", "Citação")}</p>
            <footer>{field(b, "author", "Autor da citação")}</footer>
          </blockquote>
        );
      case "stats":
        return (
          <ul className="tpl-stat-list ub-stats">
            {(b.items ?? []).map((it, i) => (
              <li key={i}>
                <strong>{item(b, i, "value", `Número ${i + 1}`)}</strong>
                <span>{item(b, i, "label", `Legenda ${i + 1}`)}</span>
                {editing && (b.items?.length ?? 0) > 1 && (
                  <button type="button" className="tpl-remove" aria-label={`Remover número ${i + 1}`} onClick={() => patch(b.id, { items: b.items!.filter((_, j) => j !== i) }, "Número removido")}>
                    ×
                  </button>
                )}
              </li>
            ))}
            {editing && (b.items?.length ?? 0) < 6 && (
              <li className="tpl-add-item">
                <button type="button" onClick={() => patch(b.id, { items: [...(b.items ?? []), { value: "00", label: "Descreva este número" }] }, "Número adicionado")}>
                  + Número
                </button>
              </li>
            )}
          </ul>
        );
      case "divider":
        return <hr className="ub-divider" />;
      default:
        return null;
    }
  };
  const inserter = (at: number) =>
    editing && (
      <div className="ub-insert">
        <button type="button" onClick={() => setMenuAt(menuAt === at ? null : at)} aria-expanded={menuAt === at}>
          + Bloco
        </button>
        {menuAt === at && (
          <div className="ub-menu" role="menu">
            {Object.entries(KIND_INFO).map(([kind, [name, icon]]) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuAt(null);
                  set((l) => [...l.slice(0, at), newBlock(kind), ...l.slice(at)], `Bloco “${name}” inserido`);
                }}
              >
                <Icon name={icon} /> {name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  return (
    <section id={blockDom(block)} className="tpl tpl-blocks">
      <div className="ub-flow">
        {editing && <span className="eyebrow ub-num">{num} — seção livre</span>}
        {inserter(0)}
        {blocks.map((b, i) => (
          <div key={b.id} className={`ub ub-k-${b.kind}`}>
            {editing && (
              <div className="ub-bar" role="group" aria-label={`Bloco ${i + 1}: ${KIND_INFO[b.kind]?.[0]}`}>
                <b>{KIND_INFO[b.kind]?.[0]}</b>
                {b.kind === "heading" && (
                  <button type="button" onClick={() => patch(b.id, { size: b.size === "lg" ? "md" : "lg" }, "Tamanho do título")}>
                    {b.size === "lg" ? "Menor" : "Maior"}
                  </button>
                )}
                {b.kind === "button" && (
                  <>
                    <select value={LINKS.some(([v]) => v === b.link) ? b.link : "url"} aria-label="Destino do botão" onChange={(e) => {
                      const v = e.target.value === "url" ? prompt("Link completo (https://…)", b.link?.startsWith("http") ? b.link : "https://") : e.target.value;
                      if (v && (v.startsWith("#") || v === "whatsapp" || /^https:\/\/[^\s"'<>]+$/.test(v))) patch(b.id, { link: v }, "Destino do botão");
                    }}>
                      {LINKS.map(([v, l]) => (
                        <option key={v} value={v}>
                          → {l}
                        </option>
                      ))}
                      <option value="url">→ Outro link…</option>
                    </select>
                    <button type="button" onClick={() => patch(b.id, { style: b.style === "ghost" ? "solid" : "ghost" }, "Estilo do botão")}>
                      {b.style === "ghost" ? "Cheio" : "Contorno"}
                    </button>
                  </>
                )}
                <button type="button" disabled={i === 0} aria-label="Subir bloco" onClick={() => set((l) => { const n = [...l]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; }, "Bloco movido")}>
                  ↑
                </button>
                <button type="button" disabled={i === blocks.length - 1} aria-label="Descer bloco" onClick={() => set((l) => { const n = [...l]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; }, "Bloco movido")}>
                  ↓
                </button>
                <button type="button" className="danger" disabled={blocks.length === 1} aria-label="Remover bloco" onClick={() => set((l) => l.filter((x) => x.id !== b.id), `Bloco “${KIND_INFO[b.kind]?.[0]}” removido`)}>
                  ×
                </button>
              </div>
            )}
            {render(b)}
            {inserter(i + 1)}
          </div>
        ))}
      </div>
    </section>
  );
}

function ImageAdd({ onAdd }: { onAdd: (url: string) => void }) {
  const { upload } = useContext(CopyContext);
  return (
    <label className="tpl-add-photo-btn">
      + Adicionar foto
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const url = await upload(file);
          if (url) onAdd(url);
        }}
      />
    </label>
  );
}

/* Edit-mode chrome around each section: order, visibility, removal and insertion. */
export function BlockBar({
  block,
  num,
  name,
  first,
  last,
  onMove,
  onToggle,
  onRemove,
  onRename,
}: {
  block: Block;
  num: string;
  name: string;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onToggle: () => void;
  onRemove: () => void;
  onRename?: (v: string) => void;
}) {
  return (
    <div className="block-bar" role="group" aria-label={`Seção ${num}: ${name}`}>
      <b>{num}</b>
      {onRename ? <Editable value={name} editing label="Nome da seção no menu" onCommit={onRename} /> : <span>{name}</span>}
      {block.hidden && <em>Oculta para visitantes</em>}
      <button onClick={() => onMove(-1)} disabled={first} aria-label="Subir seção">
        ↑
      </button>
      <button onClick={() => onMove(1)} disabled={last} aria-label="Descer seção">
        ↓
      </button>
      <button onClick={onToggle}>{block.hidden ? "Mostrar" : "Ocultar"}</button>
      <button className="danger" onClick={onRemove}>
        {isBuiltin(block.type) ? "Remover" : "Excluir"}
      </button>
    </div>
  );
}

export function SectionPicker({
  missing,
  lenis,
  onPick,
  onClose,
}: {
  missing: BuiltinType[];
  lenis: { stop(): void; start(): void } | null;
  onPick: (b: Block) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(true, ref, onClose, lenis);
  const id = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return (
    <div className="part-overlay" data-lenis-prevent onClick={onClose}>
      <div ref={ref} className="part-dialog section-picker" role="dialog" aria-modal="true" aria-label="Inserir seção" onClick={(e) => e.stopPropagation()}>
        <div className="part-dialog-top tiny-mono">
          <span>INSERIR SEÇÃO</span>
          <button onClick={onClose}>FECHAR ×</button>
        </div>
        <p className="picker-note">A seção nova entra oculta para visitantes. Edite os textos e as fotos e clique em “Mostrar” quando estiver pronta.</p>
        <ul className="picker-grid">
          {TEMPLATES.map((t) => (
            <li key={t}>
              <button onClick={() => onPick({ id: id(), type: t, hidden: true, data: TEMPLATE_INFO[t].data() })}>
                <span className={`picker-thumb thumb-${t}`} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <strong>{TEMPLATE_INFO[t].name}</strong>
                <small>{TEMPLATE_INFO[t].about}</small>
              </button>
            </li>
          ))}
        </ul>
        {missing.length > 0 && (
          <>
            <span className="tiny-mono picker-sub">SEÇÕES REMOVIDAS — RECOLOCAR NA PÁGINA</span>
            <ul className="picker-grid small">
              {missing.map((t) => (
                <li key={t}>
                  <button onClick={() => onPick({ id: t, type: t })}>
                    <strong>{BUILTIN_INFO[t].nav}</strong>
                    <small>{BUILTIN_INFO[t].hint}</small>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
