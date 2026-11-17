"use client";
import { useContext, useRef, useState } from "react";
import { Icon, IconPicker } from "./icons";
import { CopyContext, Editable, ImageSwap, Removable, RemovableContext, T } from "./copy";
import { useModal } from "./editing";
import { CONTACT_HINTS, CONTACT_NAMES, CONTACT_TYPES, LOGO_SIZE, MAX_FEATURES, contactHref, contactText, normalizeContact } from "@/lib/site-actions.mjs";

// The page between the hero and the footer is an ordered list of sections. Built-in sections
// keep their own content (catalog, process…); new sections come from templates and carry
// their texts and photos in `data`.
export const BUILTINS = ["solutions", "process", "catalog", "origin", "sectors", "quote"] as const;
export type BuiltinType = (typeof BUILTINS)[number];
export const TEMPLATES = ["blocks", "text-image", "stats", "gallery", "cta", "testimonial"] as const;
export type TemplateType = (typeof TEMPLATES)[number];
export type Block = { id: string; type: BuiltinType | TemplateType; hidden?: boolean; inNav?: boolean; data?: Record<string, unknown> };

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

function OptionalSlot({
  active,
  label,
  onRemove,
  onRestore,
  block = false,
  children,
}: {
  active: boolean;
  label: string;
  onRemove: () => void;
  onRestore: () => void;
  block?: boolean;
  children: React.ReactNode;
}) {
  const { editing, activate } = useContext(CopyContext);
  const Tag = block ? "div" : "span";
  if (!editing) return active ? <>{children}</> : null;
  if (!active)
    return (
      <Tag className="removed-slot">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRestore();
          }}
        >
          ↺ Recolocar “{label}”
        </button>
      </Tag>
    );
  return (
    <RemovableContext.Provider value={onRemove}>
      <Tag className="removable">
        {children}
        <button
          type="button"
          className="remove-x"
          aria-label={`Remover “${label}”`}
          title={`Remover “${label}”`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            activate(null);
            onRemove();
          }}
        >
          ×
        </button>
      </Tag>
    </RemovableContext.Provider>
  );
}

// Text of a template section, editable and removable in place; style key follows the section, not its position.
function BText({
  block,
  field,
  label,
  update,
  className,
  restore = "Texto",
  blockSlot = false,
}: {
  block: Block;
  field: string;
  label: string;
  update: Update;
  className?: string;
  restore?: string;
  blockSlot?: boolean;
}) {
  const { editing } = useContext(CopyContext);
  const value = String(block.data?.[field] ?? "");
  return (
    <OptionalSlot
      active={Boolean(value)}
      label={label}
      block={blockSlot}
      onRemove={() => update(block.id, (d) => ({ ...d, [field]: "" }), `${label} removido`)}
      onRestore={() => update(block.id, (d) => ({ ...d, [field]: restore }), `${label} recolocado`)}
    >
      <Editable
        value={value}
        editing={editing}
        label={label}
        className={className}
        styleKey={`block.${block.id}.${field}`}
        onCommit={(v) => update(block.id, (d) => ({ ...d, [field]: v }), label)}
      />
    </OptionalSlot>
  );
}

export function TemplateSection({ block, num, update, whatsapp }: { block: Block; num: string; update: Update; whatsapp: (text: string) => string }) {
  const { editing, hidden } = useContext(CopyContext);
  const d = block.data ?? {};
  const p = { block, update };
  const numKey = `block.${block.id.toLowerCase()}.num`;
  const numOff = !num || hidden.includes(numKey);
  const hasEyebrow = Boolean(d.eyebrow);
  const eyebrow =
    (editing && num) || !numOff || hasEyebrow ? (
      <span className="eyebrow">
        {num && (
          <Removable k={numKey} label="Numeração da seção">
            <T k={numKey} d={num} label="Numeração da seção" />
          </Removable>
        )}
        {!numOff && hasEyebrow && " — "}
        <BText {...p} field="eyebrow" label="Rótulo da seção" restore="DESTAQUE" />
      </span>
    ) : null;
  const dom = blockDom(block);
  switch (block.type) {
    case "text-image": {
      const hasTitle = Boolean(d.title);
      const hasAccent = Boolean(d.accent);
      const hasText = Boolean(d.text);
      const hasCta = Boolean(d.cta);
      return (
        <section id={dom} className={"tpl tpl-text-image" + (d.side === "left" ? " flip" : "")}>
          <div className="tpl-copy reveal">
            {eyebrow}
            {(editing || hasTitle || hasAccent) && (
              <h2>
                <BText {...p} field="title" label="Título" restore="Título da seção" />
                {hasTitle && hasAccent && <br />}
                {(editing || hasAccent) && (
                  <em>
                    <BText {...p} field="accent" label="Título (destaque)" restore="complemento em destaque." />
                  </em>
                )}
              </h2>
            )}
            {(editing || hasText) && (
              <p>
                <BText {...p} field="text" label="Texto" restore="Escreva aqui o texto desta seção." />
              </p>
            )}
            <OptionalSlot
              active={hasCta}
              label="Botão"
              onRemove={() => update(block.id, (x) => ({ ...x, cta: "" }), "Botão removido")}
              onRestore={() => update(block.id, (x) => ({ ...x, cta: "Solicitar orçamento" }), "Botão recolocado")}
            >
              <a className="btn-solid" href="#orcamento">
                <Editable
                  value={String(d.cta ?? "")}
                  editing={editing}
                  label="Botão"
                  styleKey={`block.${block.id}.cta`}
                  onCommit={(v) => update(block.id, (x) => ({ ...x, cta: v }), "Botão")}
                />{" "}
                <span aria-hidden="true">↗</span>
              </a>
            </OptionalSlot>
          </div>
          <figure className="tpl-figure">
            <img src={String(d.imageUrl ?? "")} alt={String(d.title ?? d.eyebrow ?? "")} loading="lazy" />
            <span className="image-bracket tl" />
            <span className="image-bracket br" />
            <ImageSwap src={String(d.imageUrl ?? "")} label="foto" onChange={(url) => update(block.id, (x) => ({ ...x, imageUrl: url }), "Foto da seção")} />
            {editing && (
              <button className="tpl-flip" onClick={() => update(block.id, (x) => ({ ...x, side: x.side === "left" ? "right" : "left" }), "Lado da foto")}>
                ⇆ Foto do outro lado
              </button>
            )}
          </figure>
        </section>
      );
    }
    case "stats": {
      const items = (d.items as Item[]) ?? [];
      const setItem = (i: number, key: keyof Item) => (v: string) =>
        update(block.id, (x) => ({ ...x, items: (x.items as Item[]).map((it, j) => (j === i ? { ...it, [key]: v } : it)) }), "Número");
      return (
        <section id={dom} className="tpl tpl-stats">
          <div className="tpl-head reveal">
            {eyebrow}
            {(editing || Boolean(d.title)) && (
              <h2>
                <BText {...p} field="title" label="Título" restore="A Usibar em números" />
              </h2>
            )}
          </div>
          <ul className="tpl-stat-list">
            {items.map((it, i) => (
              <li key={i}>
                <strong>
                  <Editable
                    value={it.value}
                    editing={editing}
                    label={`Número ${i + 1}`}
                    styleKey={`block.${block.id}.items.${i}.value`}
                    onCommit={setItem(i, "value")}
                    onRemove={items.length > 1 ? () => update(block.id, (x) => ({ ...x, items: (x.items as Item[]).filter((_, j) => j !== i) }), "Número removido") : undefined}
                  />
                </strong>
                <span>
                  <Editable
                    value={it.label}
                    editing={editing}
                    label={`Legenda ${i + 1}`}
                    styleKey={`block.${block.id}.items.${i}.label`}
                    onCommit={setItem(i, "label")}
                    onRemove={items.length > 1 ? () => update(block.id, (x) => ({ ...x, items: (x.items as Item[]).filter((_, j) => j !== i) }), "Número removido") : undefined}
                  />
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
            {(editing || Boolean(d.title)) && (
              <h2>
                <BText {...p} field="title" label="Título" restore="Trabalhos recentes" />
              </h2>
            )}
          </div>
          <ul className="tpl-photos">
            {images.map((ph, i) => (
              <li key={i}>
                <figure>
                  <img src={ph.url} alt={ph.caption} loading="lazy" />
                  <ImageSwap src={ph.url} label="foto" onChange={(url) => setImages((l) => l.map((x, j) => (j === i ? { ...x, url } : x)), "Foto trocada")} />
                  {editing && images.length > 1 && (
                    <button className="tpl-remove" aria-label={`Remover foto ${i + 1}`} onClick={() => setImages((l) => l.filter((_, j) => j !== i), "Foto removida")}>
                      ×
                    </button>
                  )}
                </figure>
                {(editing || Boolean(ph.caption)) && (
                  <figcaption>
                    <OptionalSlot
                      active={Boolean(ph.caption)}
                      label={`Legenda da foto ${i + 1}`}
                      onRemove={() => setImages((l) => l.map((x, j) => (j === i ? { ...x, caption: "" } : x)), "Legenda removida")}
                      onRestore={() => setImages((l) => l.map((x, j) => (j === i ? { ...x, caption: "Legenda da foto" } : x)), "Legenda recolocada")}
                    >
                      <Editable
                        value={ph.caption}
                        editing={editing}
                        label={`Legenda da foto ${i + 1}`}
                        styleKey={`block.${block.id}.images.${i}.caption`}
                        onCommit={(v) => setImages((l) => l.map((x, j) => (j === i ? { ...x, caption: v } : x)), "Legenda")}
                      />
                    </OptionalSlot>
                  </figcaption>
                )}
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
          {(editing || Boolean(d.title)) && (
            <h2 className="reveal">
              <BText {...p} field="title" label="Título" restore="Tem um projeto em mente?" />
            </h2>
          )}
          {(editing || Boolean(d.text)) && (
            <p>
              <BText {...p} field="text" label="Texto" restore="Envie o desenho ou as especificações e receba a proposta da Usibar." />
            </p>
          )}
          <OptionalSlot
            active={Boolean(d.button)}
            label="Botão"
            onRemove={() => update(block.id, (x) => ({ ...x, button: "" }), "Botão removido")}
            onRestore={() => update(block.id, (x) => ({ ...x, button: "Falar no WhatsApp" }), "Botão recolocado")}
          >
            <a className="btn-solid light" href={whatsapp(String(d.title ?? "Olá, Usibar!"))} target="_blank" rel="noreferrer">
              <Editable
                value={String(d.button ?? "")}
                editing={editing}
                label="Botão"
                styleKey={`block.${block.id}.button`}
                onCommit={(v) => update(block.id, (x) => ({ ...x, button: v }), "Botão")}
              />{" "}
              <span aria-hidden="true">↗</span>
            </a>
          </OptionalSlot>
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
            {(editing || Boolean(d.quote)) && (
              <p>
                <BText {...p} field="quote" label="Depoimento" restore="Escreva aqui o depoimento de um cliente." />
              </p>
            )}
            {(editing || Boolean(d.author) || Boolean(d.role)) && (
              <footer>
                {(editing || Boolean(d.author)) && (
                  <strong>
                    <BText {...p} field="author" label="Autor" restore="Nome do cliente" />
                  </strong>
                )}
                {(editing || Boolean(d.role)) && (
                  <span>
                    <BText {...p} field="role" label="Empresa e cargo" restore="Empresa · cargo" />
                  </span>
                )}
              </footer>
            )}
          </blockquote>
        </section>
      );
    default:
      return null;
  }
}

// ---- Free section: a column of blocks, WordPress style ------------------------------------------
type Contact = { type: string; value: string };
type UItem = { icon?: string; title?: string; text?: string; value?: string; label?: string; logo?: string; logoSize?: number; links?: Contact[] };
type UBlock = { id: string; kind: string; look?: string; cols?: string; head?: string; contactLook?: string; pin?: string; text?: string; title?: string; author?: string; size?: string; link?: string; style?: string; icon?: string; url?: string; caption?: string; items?: UItem[]; links?: Contact[] };
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
  contacts: ["Contatos (WhatsApp, e-mail…)", "telefone"],
  divider: ["Divisória", "ferramenta"],
};
// The look recommended for representatives, team or branches: light cards, logo above the name,
// region with a map pin and contacts as named buttons. One click in "Aparência" applies it.
const REP_LOOK = { look: "cards", cols: "3", head: "top", contactLook: "buttons", pin: "on" } as const;
// Appearance options of a "features" block, shown in its "Aparência" panel.
const LOOK_OPTIONS: { key: "look" | "cols" | "head" | "contactLook" | "pin"; label: string; options: [string | undefined, string][] }[] = [
  { key: "look", label: "Estilo", options: [[undefined, "Linhas"], ["cards", "Cartões"], ["dark", "Escuro"]] },
  { key: "cols", label: "Colunas", options: [[undefined, "Auto"], ["2", "2"], ["3", "3"], ["4", "4"]] },
  { key: "head", label: "Logo ou ícone", options: [[undefined, "Ao lado do nome"], ["top", "Acima do nome"]] },
  { key: "contactLook", label: "Contatos", options: [[undefined, "Só ícones"], ["buttons", "Botões com nome"], ["list", "Com número/e-mail"]] },
  { key: "pin", label: "Ícone de local no texto", options: [[undefined, "Não"], ["on", "Sim"]] },
];
// Ready-made starting points in the "+ Bloco" menu, besides the plain kinds.
const PRESETS: { name: string; icon: string; after: string; make: () => UBlock }[] = [
  {
    name: "Cartões de contato (representantes, equipe)",
    icon: "pessoas",
    after: "features",
    make: () =>
      newBlock("features", {
        ...REP_LOOK,
        items: [1, 2, 3].map((n) => ({ icon: "pessoas", title: `Nome ${n}`, text: "Região atendida" })),
      }),
  },
];
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
    contacts: { links: [{ type: "email", value: "contato@empresa.com.br" }], style: "list" },
    divider: {},
  };
  return { id: blockId(), kind, ...base[kind], ...extra };
}
const LINKS: [string, string][] = [
  ["#orcamento", "Orçamento"],
  ["#pecas", "Catálogo"],
  ["whatsapp", "WhatsApp"],
];

/* Contacts as small round icons (or icon + text). While editing, each one opens a little form
   to change or remove it, and "+ Contato" adds another. */
function ContactLinks({
  links,
  mode = "icons",
  max,
  onChange,
}: {
  links: Contact[];
  /** icons: round icons; buttons: icon + "WhatsApp", "E-mail"…; list: icon + the number or address. */
  mode?: "icons" | "buttons" | "list";
  max: number;
  onChange: (links: Contact[], label: string) => void;
}) {
  const { editing } = useContext(CopyContext);
  const [open, setOpen] = useState<number | null>(null); // index, or links.length for a new one
  if (!links.length && !editing) return null;
  return (
    <div className="ub-contacts-wrap">
      <ul className={`ub-contacts${mode === "list" ? " is-list" : mode === "buttons" ? " is-buttons" : ""}`}>
        {links.map((l, i) => {
          const text = contactText(l);
          const external = l.type === "whatsapp" || l.type === "site" || l.type === "instagram";
          return (
            <li key={i}>
              <a
                href={contactHref(l)}
                {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                title={`${CONTACT_NAMES[l.type as keyof typeof CONTACT_NAMES]}: ${text}${editing ? " — clique para alterar" : ""}`}
                aria-label={`${CONTACT_NAMES[l.type as keyof typeof CONTACT_NAMES]}: ${text}`}
                onClick={(e) => {
                  if (!editing) return;
                  e.preventDefault();
                  setOpen(open === i ? null : i);
                }}
              >
                <span className="ub-contact-ico">
                  <Icon name={l.type} />
                </span>
                {mode === "list" && <span className="ub-contact-text">{text}</span>}
                {mode === "buttons" && <span className="ub-contact-text">{CONTACT_NAMES[l.type as keyof typeof CONTACT_NAMES]}</span>}
              </a>
            </li>
          );
        })}
        {editing && links.length < max && (
          <li>
            <button type="button" className="ub-contact-add" onClick={() => setOpen(open === links.length ? null : links.length)}>
              + Contato
            </button>
          </li>
        )}
      </ul>
      {editing && open !== null && (
        <ContactForm
          key={open}
          initial={links[open]}
          onCancel={() => setOpen(null)}
          onSave={(c) => {
            setOpen(null);
            if (open < links.length) onChange(links.map((x, j) => (j === open ? c : x)), "Contato alterado");
            else onChange([...links, c], `${CONTACT_NAMES[c.type as keyof typeof CONTACT_NAMES]} adicionado`);
          }}
          onRemove={
            open < links.length
              ? () => {
                  setOpen(null);
                  onChange(links.filter((_, j) => j !== open), "Contato removido");
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function ContactForm({ initial, onSave, onRemove, onCancel }: { initial?: Contact; onSave: (c: Contact) => void; onRemove?: () => void; onCancel: () => void }) {
  const [type, setType] = useState(initial?.type ?? "whatsapp");
  const [value, setValue] = useState(initial ? contactText(initial) : "");
  const [error, setError] = useState("");
  const save = () => {
    const v = normalizeContact(type, value);
    if (!v) return setError(`Confira o ${CONTACT_NAMES[type as keyof typeof CONTACT_NAMES]}: ex. ${CONTACT_HINTS[type as keyof typeof CONTACT_HINTS]}`);
    onSave({ type, value: v });
  };
  return (
    <div
      className="ub-contact-form"
      role="dialog"
      aria-label={initial ? "Alterar contato" : "Novo contato"}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className="ub-contact-types" role="radiogroup" aria-label="Tipo de contato">
        {CONTACT_TYPES.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={t === type} className={t === type ? "on" : ""} onClick={() => (setType(t), setError(""))}>
            <Icon name={t} /> {CONTACT_NAMES[t as keyof typeof CONTACT_NAMES]}
          </button>
        ))}
      </div>
      <input
        autoFocus
        value={value}
        placeholder={CONTACT_HINTS[type as keyof typeof CONTACT_HINTS]}
        aria-label={CONTACT_NAMES[type as keyof typeof CONTACT_NAMES]}
        inputMode={type === "whatsapp" || type === "telefone" ? "tel" : type === "email" ? "email" : "url"}
        onChange={(e) => (setValue(e.target.value), setError(""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
      />
      {error && <p className="ub-contact-error">{error}</p>}
      <div className="ub-contact-actions">
        <button type="button" className="primary" onClick={save}>
          {initial ? "Salvar" : "Adicionar"}
        </button>
        {onRemove && (
          <button type="button" className="danger" onClick={onRemove}>
            Remover
          </button>
        )}
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* "Aparência" of a cards block: style, columns, logo position, contacts and the map pin. Each
   choice is published at once (and can be undone); "Modelo: representantes" sets them all. */
function LookPanel({ block, onSet }: { block: UBlock; onSet: (p: Partial<UBlock>, label: string) => void }) {
  const isRep = Object.entries(REP_LOOK).every(([k, v]) => block[k as keyof UBlock] === v);
  return (
    <div className="ub-look" role="group" aria-label="Aparência dos cartões">
      {LOOK_OPTIONS.map(({ key, label, options }) => (
        <div key={key} className="ub-look-row">
          <span className="tiny-mono">{label}</span>
          <div className="ub-seg" role="radiogroup" aria-label={label}>
            {options.map(([v, name]) => {
              const on = (block[key] ?? undefined) === v;
              return (
                <button key={name} type="button" role="radio" aria-checked={on} className={on ? "on" : ""} onClick={() => !on && onSet({ [key]: v }, `${label}: ${name}`)}>
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="ub-look-row">
        <span className="tiny-mono">Modelos</span>
        <div className="ub-seg">
          <button type="button" className={isRep ? "on" : ""} onClick={() => onSet({ ...REP_LOOK }, "Modelo de representantes aplicado")}>
            Representantes
          </button>
          <button type="button" onClick={() => onSet({ look: undefined, cols: undefined, head: undefined, contactLook: undefined, pin: undefined }, "Aparência padrão")}>
            Padrão (linhas)
          </button>
        </div>
      </div>
    </div>
  );
}

/* The small logo at the start of a card's name; in edit mode, add / adjust / swap / remove it. */
function LogoTools({ logo, onChange }: { logo?: string; onChange: (url: string | undefined, label: string) => void }) {
  const { openPhotoEditor } = useContext(CopyContext);
  const pick = (
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="sr-only"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) openPhotoEditor(file, { label: "logo", onSave: (url) => onChange(url, logo ? "Logo trocada" : "Logo adicionada") });
      }}
    />
  );
  if (!logo)
    return (
      <label className="ub-tool" title="Uma logo pequena no início do nome, no lugar do ícone">
        + Logo
        {pick}
      </label>
    );
  return (
    <>
      <button type="button" className="ub-tool" onClick={() => openPhotoEditor(logo, { label: "logo", onSave: (url) => onChange(url, "Logo ajustada") })}>
        Ajustar logo
      </button>
      <label className="ub-tool">
        Trocar logo
        {pick}
      </label>
      <button type="button" className="ub-tool danger" onClick={() => onChange(undefined, "Logo removida")}>
        Tirar logo
      </button>
    </>
  );
}

function FreeSection({ block, num, update, whatsapp }: { block: Block; num: string; update: Update; whatsapp: (text: string) => string }) {
  const { editing } = useContext(CopyContext);
  const [menuAt, setMenuAt] = useState<number | null>(null);
  const [iconFor, setIconFor] = useState<string | null>(null);
  const [lookFor, setLookFor] = useState<string | null>(null);
  const blocks = (block.data?.blocks as UBlock[]) ?? [];
  const set = (change: (l: UBlock[]) => UBlock[], label: string) => update(block.id, (d) => ({ ...d, blocks: change((d.blocks as UBlock[]) ?? []) }), label);
  const patch = (id: string, p: Partial<UBlock>, label: string) => set((l) => l.map((b) => (b.id === id ? { ...b, ...p } : b)), label);
  const removeBlock = (b: UBlock) => () => set((l) => l.filter((x) => x.id !== b.id), `Bloco “${KIND_INFO[b.kind]?.[0] ?? b.kind}” removido`);
  const field = (b: UBlock, key: "text" | "title" | "author" | "caption", label: string, opts?: { className?: string; optional?: string; removeWholeBlock?: boolean }) => {
    const value = String(b[key] ?? "");
    if (opts?.optional !== undefined) {
      return (
        <OptionalSlot
          active={Boolean(value)}
          label={label}
          onRemove={() => patch(b.id, { [key]: "" }, `${label} removido`)}
          onRestore={() => patch(b.id, { [key]: opts.optional }, `${label} recolocado`)}
        >
          <Editable value={value} editing={editing} label={label} className={opts?.className} styleKey={`block.${block.id}.${b.id}.${key}`} onCommit={(v) => patch(b.id, { [key]: v }, label)} />
        </OptionalSlot>
      );
    }
    if (!value && !editing) return null;
    return (
      <Editable
        value={value || "—"}
        editing={editing}
        label={label}
        className={opts?.className}
        styleKey={`block.${block.id}.${b.id}.${key}`}
        onCommit={(v) => patch(b.id, { [key]: v }, label)}
        onRemove={opts?.removeWholeBlock ? removeBlock(b) : undefined}
      />
    );
  };
  const item = (b: UBlock, i: number, key: "title" | "text" | "value" | "label", label: string, optionalRestore?: string) => {
    const val = String(b.items?.[i]?.[key] ?? "");
    if (optionalRestore !== undefined) {
      return (
        <OptionalSlot
          active={Boolean(val)}
          label={label}
          onRemove={() => patch(b.id, { items: b.items!.map((x, j) => (j === i ? { ...x, [key]: "" } : x)) }, `${label} removido`)}
          onRestore={() => patch(b.id, { items: b.items!.map((x, j) => (j === i ? { ...x, [key]: optionalRestore } : x)) }, `${label} recolocado`)}
        >
          <Editable
            value={val}
            editing={editing}
            label={label}
            styleKey={`block.${block.id}.${b.id}.items.${i}.${key}`}
            onCommit={(v) => patch(b.id, { items: b.items!.map((x, j) => (j === i ? { ...x, [key]: v } : x)) }, label)}
          />
        </OptionalSlot>
      );
    }
    return (
      <Editable
        value={val || "—"}
        editing={editing}
        label={label}
        styleKey={`block.${block.id}.${b.id}.items.${i}.${key}`}
        onCommit={(v) => patch(b.id, { items: b.items!.map((x, j) => (j === i ? { ...x, [key]: v } : x)) }, label)}
      />
    );
  };
  const href = (link = "#orcamento") => (link === "whatsapp" ? whatsapp("Olá, Usibar!") : link);
  const render = (b: UBlock) => {
    switch (b.kind) {
      case "label":
        return <span className="eyebrow">{field(b, "text", "Rótulo", { removeWholeBlock: true })}</span>;
      case "heading":
        return b.size === "lg" ? (
          <h2 className="ub-h lg">{field(b, "text", "Título", { removeWholeBlock: true })}</h2>
        ) : (
          <h3 className="ub-h">{field(b, "text", "Título", { removeWholeBlock: true })}</h3>
        );
      case "text":
        return <p className="ub-text">{field(b, "text", "Parágrafo", { removeWholeBlock: true })}</p>;
      case "button":
        return (
          <a className={b.style === "ghost" ? "btn-ghost" : "btn-solid"} href={href(b.link)} {...(b.link?.startsWith("http") || b.link === "whatsapp" ? { target: "_blank", rel: "noreferrer" } : {})} onClick={(e) => editing && e.preventDefault()}>
            {field(b, "text", "Botão", { removeWholeBlock: true })} <span aria-hidden="true">↗</span>
          </a>
        );
      case "image":
        return (
          <figure className="ub-figure">
            <img src={b.url} alt={b.caption ?? ""} loading="lazy" />
            <span className="image-bracket tl" />
            <span className="image-bracket br" />
            <ImageSwap src={b.url} label="foto" onChange={(url) => patch(b.id, { url }, "Foto do bloco")} />
            {(b.caption || editing) && <figcaption>{field(b, "caption", "Legenda da foto", { optional: "Legenda da foto" })}</figcaption>}
          </figure>
        );
      case "features": {
        const items = b.items ?? [];
        const setItem = (i: number, p: Partial<UItem>, label: string) =>
          patch(b.id, { items: items.map((x, j) => (j === i ? Object.fromEntries(Object.entries({ ...x, ...p }).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length))) : x)) }, label);
        return (
          <>
          <ul className={`ub-features ub-look-${b.look ?? "lines"} ub-cols-${b.cols ?? "auto"} ub-head-${b.head ?? "side"}`}>
            {items.map((it, i) => (
              <li key={i} data-pos-lock="">
                <div className="ub-card-head">
                  {it.logo ? (
                    <img
                      className="ub-logo"
                      src={it.logo}
                      alt={`Logo ${it.title ?? ""}`.trim()}
                      loading="lazy"
                      style={it.logoSize ? ({ "--logo-h": `${it.logoSize}px` } as React.CSSProperties) : undefined}
                    />
                  ) : (
                    <button type="button" className="ub-icon" disabled={!editing} onClick={() => setIconFor(iconFor === `${b.id}:${i}` ? null : `${b.id}:${i}`)} aria-label="Trocar ícone">
                      <Icon name={it.icon ?? "info"} />
                    </button>
                  )}
                  <strong>{item(b, i, "title", `Destaque ${i + 1} — título`)}</strong>
                </div>
                {editing && iconFor === `${b.id}:${i}` && (
                  <IconPicker
                    value={it.icon}
                    onPick={(icon) => {
                      setIconFor(null);
                      setItem(i, { icon }, "Ícone");
                    }}
                  />
                )}
                {(editing || Boolean(it.text)) && (
                  <span className={"ub-card-text" + (b.pin === "on" ? " has-pin" : "")}>
                    {b.pin === "on" && <Icon name="local" className="ico ub-pin" />}
                    {item(b, i, "text", `Destaque ${i + 1} — texto`, "Descreva.")}
                  </span>
                )}
                <ContactLinks links={it.links ?? []} mode={(b.contactLook as "icons" | "buttons" | "list") ?? "icons"} max={6} onChange={(links, label) => setItem(i, { links }, label)} />
                {editing && (
                  <div className="ub-card-tools">
                    <LogoTools logo={it.logo} onChange={(logo, label) => setItem(i, { logo, ...(logo ? {} : { logoSize: undefined }) }, label)} />
                    {it.logo && (
                      <span className="ub-logo-size" role="group" aria-label="Tamanho da logo">
                        <button type="button" className="ub-tool" disabled={(it.logoSize ?? LOGO_SIZE.base) <= LOGO_SIZE.min} aria-label="Diminuir a logo" onClick={() => setItem(i, { logoSize: Math.max(LOGO_SIZE.min, (it.logoSize ?? LOGO_SIZE.base) - LOGO_SIZE.step) }, "Tamanho da logo")}>
                          Logo −
                        </button>
                        <button type="button" className="ub-tool" disabled={(it.logoSize ?? LOGO_SIZE.base) >= LOGO_SIZE.max} aria-label="Aumentar a logo" onClick={() => setItem(i, { logoSize: Math.min(LOGO_SIZE.max, (it.logoSize ?? LOGO_SIZE.base) + LOGO_SIZE.step) }, "Tamanho da logo")}>
                          Logo +
                        </button>
                        {items.filter((x) => x.logo).length > 1 && items.some((x) => x.logo && (x.logoSize ?? LOGO_SIZE.base) !== (it.logoSize ?? LOGO_SIZE.base)) && (
                          <button
                            type="button"
                            className="ub-tool"
                            title="Deixar as logos de todos os cartões com este tamanho"
                            onClick={() => patch(b.id, { items: items.map((x) => (x.logo ? { ...x, logoSize: it.logoSize ?? LOGO_SIZE.base } : x)) }, "Tamanho das logos igualado")}
                          >
                            Igualar todas
                          </button>
                        )}
                      </span>
                    )}
                    {i > 0 && (
                      <button type="button" className="ub-tool" aria-label={`Mover destaque ${i + 1} para a esquerda`} onClick={() => patch(b.id, { items: items.map((x, j) => (j === i - 1 ? items[i] : j === i ? items[i - 1] : x)) }, "Destaque movido")}>
                        ←
                      </button>
                    )}
                    {i < items.length - 1 && (
                      <button type="button" className="ub-tool" aria-label={`Mover destaque ${i + 1} para a direita`} onClick={() => patch(b.id, { items: items.map((x, j) => (j === i + 1 ? items[i] : j === i ? items[i + 1] : x)) }, "Destaque movido")}>
                        →
                      </button>
                    )}
                    <button type="button" className="ub-tool" title="Duplicar este cartão (com logo e contatos)" disabled={items.length >= MAX_FEATURES} onClick={() => patch(b.id, { items: [...items.slice(0, i + 1), { ...it }, ...items.slice(i + 1)] }, "Destaque duplicado")}>
                      Duplicar
                    </button>
                  </div>
                )}
                {editing && items.length > 1 && (
                  <button type="button" className="tpl-remove" aria-label={`Remover destaque ${i + 1}`} onClick={() => patch(b.id, { items: items.filter((_, j) => j !== i) }, "Destaque removido")}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          {/* Outside the grid, so the cards keep the same columns while editing as for visitors. */}
          {editing && items.length < MAX_FEATURES && (
            <div className="ub-add-item">
              <button type="button" onClick={() => patch(b.id, { items: [...items, { icon: items.at(-1)?.icon ?? "check", title: "Novo destaque", text: "Descreva." }] }, "Destaque adicionado")}>
                + Destaque
              </button>
            </div>
          )}
          </>
        );
      }
      case "contacts":
        return (
          <ContactLinks
            links={b.links ?? []}
            mode={b.style === "icons" ? "icons" : "list"}
            max={8}
            onChange={(links, label) => (links.length ? patch(b.id, { links }, label) : removeBlock(b)())}
          />
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
              <strong>{field(b, "title", "Chamada — título", { removeWholeBlock: true })}</strong>
              {(editing || Boolean(b.text)) && <p>{field(b, "text", "Chamada — texto", { optional: "Escreva aqui a mensagem em destaque." })}</p>}
            </div>
          </div>
        );
      case "quote":
        return (
          <blockquote className="ub-quote">
            <p>{field(b, "text", "Citação", { removeWholeBlock: true })}</p>
            {(editing || Boolean(b.author)) && <footer>{field(b, "author", "Autor da citação", { optional: "Nome do cliente" })}</footer>}
          </blockquote>
        );
      case "stats":
        return (
          <>
          <ul className="tpl-stat-list ub-stats">
            {(b.items ?? []).map((it, i) => (
              <li key={i} data-pos-lock="">
                <strong>{item(b, i, "value", `Número ${i + 1}`)}</strong>
                <span>{item(b, i, "label", `Legenda ${i + 1}`)}</span>
                {editing && (b.items?.length ?? 0) > 1 && (
                  <button type="button" className="tpl-remove" aria-label={`Remover número ${i + 1}`} onClick={() => patch(b.id, { items: b.items!.filter((_, j) => j !== i) }, "Número removido")}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editing && (b.items?.length ?? 0) < 6 && (
            <div className="tpl-add-item ub-add-item">
              <button type="button" onClick={() => patch(b.id, { items: [...(b.items ?? []), { value: "00", label: "Descreva este número" }] }, "Número adicionado")}>
                + Número
              </button>
            </div>
          )}
          </>
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
            {Object.entries(KIND_INFO).flatMap(([kind, [name, icon]]) =>
              [{ key: kind, name, icon, make: () => newBlock(kind) }, ...PRESETS.filter((p) => p.after === kind).map((p) => ({ key: p.name, ...p }))].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuAt(null);
                    set((l) => [...l.slice(0, at), m.make(), ...l.slice(at)], `Bloco “${m.name}” inserido`);
                  }}
                >
                  <Icon name={m.icon} /> {m.name}
                </button>
              )),
            )}
          </div>
        )}
      </div>
    );
  return (
    <section id={blockDom(block)} className="tpl tpl-blocks">
      <div className="ub-flow">
        {editing && <span className="eyebrow ub-num">{num ? `${num} — seção livre` : "Seção livre"}</span>}
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
                {b.kind === "features" && (
                  <button type="button" aria-expanded={lookFor === b.id} className={lookFor === b.id ? "on" : ""} onClick={() => setLookFor(lookFor === b.id ? null : b.id)}>
                    Aparência
                  </button>
                )}
                {b.kind === "contacts" && (
                  <button type="button" onClick={() => patch(b.id, { style: b.style === "icons" ? "list" : "icons" }, "Estilo dos contatos")}>
                    {b.style === "icons" ? "Com texto" : "Só ícones"}
                  </button>
                )}
                <button type="button" disabled={i === 0} aria-label="Subir bloco" onClick={() => set((l) => { const n = [...l]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; }, "Bloco movido")}>
                  ↑
                </button>
                <button type="button" disabled={i === blocks.length - 1} aria-label="Descer bloco" onClick={() => set((l) => { const n = [...l]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; }, "Bloco movido")}>
                  ↓
                </button>
                <button type="button" className="danger" aria-label="Remover bloco" onClick={() => set((l) => l.filter((x) => x.id !== b.id), `Bloco “${KIND_INFO[b.kind]?.[0]}” removido`)}>
                  ×
                </button>
              </div>
            )}
            {editing && lookFor === b.id && b.kind === "features" && (
              <LookPanel
                block={b}
                onSet={(p, label) => set((l) => l.map((x) => (x.id === b.id ? (Object.fromEntries(Object.entries({ ...x, ...p }).filter(([, v]) => v !== undefined)) as UBlock) : x)), label)}
              />
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
  const { openPhotoEditor } = useContext(CopyContext);
  return (
    <label className="tpl-add-photo-btn">
      + Adicionar foto
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          openPhotoEditor(file, { label: "foto da galeria", onSave: onAdd });
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
    <div className="block-bar" role="group" aria-label={`Seção ${num ? num + ": " : ""}${name}`}>
      {num && <b>{num}</b>}
      {block.inNav === false && !block.hidden && <em>Fora do índice</em>}
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
