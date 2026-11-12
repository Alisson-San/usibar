"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Company, Part } from "./editing";
import type { Step } from "./ProcessSection";
import { ImageSwap, Removable, T, useEditing, useHidden, useText, type TextStyle } from "./copy";
import type { Block } from "./blocks";
import { LogoFull } from "./logo";

export type Sector = { id: string; name: string; code: string };
export type Service = {
  id: string;
  category: "cilindros" | "blocos" | "all";
  title: string;
  lead: string;
  copy: string;
  imageUrl: string;
};
export type Pillar = { id: string; title: string; desc: string };
export type Social = { id: string; network: string; url: string };
export type Content = {
  company: Company;
  products: Part[];
  sectors: Sector[];
  process: Step[];
  services: Service[];
  pillars: Pillar[];
  copy: Record<string, string>;
  styles: Record<string, TextStyle>;
  layout: Block[];
  hidden: string[];
  notice?: Notice;
};
export type Notice = { enabled: boolean; icon: string; title: string; text: string; start: string; end: string; button?: string; version: string };
// Renders a field as plain text, or as an inline editor while editing.
export type Ed = (value: string, label: string, apply: (c: Content, v: string) => Content, key?: string) => React.ReactNode;
type Apply = (change: (c: Content) => Content, label: string) => void;

export const HERO_IMAGE = "/assets/cilindro-olhal.webp";
export const mapsUrl = (c: Company) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.address ?? ""}, ${c.city}, ${c.zip ?? ""}, Brasil`)}`;
export const socialsOf = (c: Company): Social[] =>
  Array.isArray(c.socials)
    ? (c.socials as unknown as Social[])
    : c.instagram
      ? [{ id: "instagram", network: "instagram", url: `https://instagram.com/${c.instagram}` }]
      : [];

export function Arrow({ down = false }: { down?: boolean }) {
  return <span aria-hidden="true">{down ? "↓" : "↗"}</span>;
}

/* Brand and contact glyphs, drawn on a 24-unit grid in the site's line style. */
const glyphs: Record<string, React.ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5a.5.5 0 0 1 .5-.5Z" />,
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10v7M8 7v.01M12 17v-4a2.5 2.5 0 0 1 5 0v4M12 10v7" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10 9 5 3-5 3z" fill="currentColor" />
    </>
  ),
  tiktok: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.6 2.4 4.4 5 4.6" />,
  x: <path d="M4 4l16 16M20 4 4 20" />,
  site: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M4 20l1.3-4A8.5 8.5 0 1 1 8.4 19z" />
      <path d="M9 8.5c0 3.6 2.9 6.5 6.5 6.5l1-1.7-2-1-1 1a4 4 0 0 1-2.8-2.8l1-1-1-2z" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6 8.5 7 8.5-7" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
};
export const NETWORK_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X (Twitter)",
  site: "Site",
};
export function Glyph({ name, className = "glyph" }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {glyphs[name] ?? glyphs.site}
    </svg>
  );
}
export function SocialLinks({ company, className = "social-links" }: { company: Company; className?: string }) {
  return (
    <ul className={className}>
      {socialsOf(company).map((s) => (
        <li key={s.id}>
          <a href={s.url} target="_blank" rel="noreferrer" aria-label={NETWORK_LABEL[s.network] ?? s.network} title={NETWORK_LABEL[s.network]}>
            <Glyph name={s.network} />
          </a>
        </li>
      ))}
      <li>
        <a href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp">
          <Glyph name="whatsapp" />
        </a>
      </li>
    </ul>
  );
}

/* Hero: the part is presented like an inspection sheet, with callouts drawn on it.
   Callouts point at the default photo, so a replaced photo is shown clean. */
const callouts = [
  { n: "01", k: "hero.callout.1", d: "OLHAL DE FIXAÇÃO USINADO", at: [112, 212], path: "M112 212 L82 296 H-6", text: [-6, 314], anchor: "start" },
  { n: "02", k: "hero.callout.2", d: "CABEÇOTE USINADO", at: [252, 140], path: "M252 140 L214 46 H118", text: [118, 36], anchor: "start" },
  { n: "03", k: "hero.callout.3", d: "TIRANTES DE FECHAMENTO", at: [352, 120], path: "M352 120 L392 26 H540", text: [540, 16], anchor: "end" },
] as const;

function SvgLabel({ k, d, x, y, anchor, prefix, fill }: { k: string; d: string; x: number; y: number; anchor: "start" | "middle" | "end"; prefix?: string; fill: string }) {
  const editing = useEditing();
  const t = useText();
  if (editing) {
    const w = 300;
    const left = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
    return (
      <foreignObject x={left} y={y - 15} width={w} height="22">
        <div className={"svg-edit " + anchor}>
          {prefix && <b>{prefix}</b>}
          <T k={k} d={d} label="Legenda da foto" />
        </div>
      </foreignObject>
    );
  }
  return (
    <text className="hc-label" x={x} y={y} textAnchor={anchor} fill={fill} stroke="none">
      {prefix && <tspan fill="var(--orange)">{prefix} </tspan>}
      {t(k, d)}
    </text>
  );
}

export function HeroArt({ src }: { src: string }) {
  const annotated = src === HERO_IMAGE;
  return (
    <svg className="hero-art" viewBox="-40 -40 620 420" role="img" aria-label="Componente hidráulico Usibar">
      <g className="hero-target" fill="none" stroke="var(--line)">
        <circle cx="262" cy="176" r="196" />
        <circle cx="262" cy="176" r="150" strokeDasharray="3 7" />
        <path d="M262 -32v32M262 352v32M44 176h32M448 176h32" />
      </g>
      <g className="hero-part">
        <image href={src} x="0" y="0" width="512" height="342" preserveAspectRatio="xMidYMid meet" />
      </g>
      <g className="hero-callouts" fontFamily="var(--font-mono), monospace" fontSize="11" letterSpacing="1">
        {annotated &&
          callouts.map((c) => (
            <g key={c.n} className="hc">
              <path className="hc-line" d={c.path} pathLength={1} fill="none" stroke="var(--ink)" strokeWidth=".9" />
              <circle className="hc-ring" cx={c.at[0]} cy={c.at[1]} r="9" fill="none" stroke="var(--orange)" />
              <circle className="hc-dot" cx={c.at[0]} cy={c.at[1]} r="3.5" fill="var(--orange)" />
              <SvgLabel k={c.k} d={c.d} x={c.text[0]} y={c.text[1]} anchor={c.anchor} prefix={c.n} fill="var(--ink)" />
            </g>
          ))}
        <g className="hc" stroke="var(--muted)" fill="none" strokeWidth=".8">
          <path className="hc-line" d="M58 340H452" pathLength={1} />
          <path className="hc-label" d="M58 332v16M452 332v16" />
          <SvgLabel k="hero.dimension" d="DIMENSÕES, CURSO E FIXAÇÕES CONFORME PROJETO" x={255} y={364} anchor="middle" fill="var(--muted)" />
        </g>
      </g>
    </svg>
  );
}

export function ProofBar({ company }: { company: Company }) {
  // Every number and caption is its own text: the years and the city start from the company
  // data and, once edited here, no longer change the "Empresa" section or the contact details.
  const items: [string, string][] = [
    [company.experienceYears ?? "", "anos de experiência em soluções hidráulicas"],
    [company.city ?? "", "nossa sede, no Rio Grande do Sul"],
    ["Sob projeto", "cada peça segue as especificações da sua aplicação"],
    ["CNC", "usinagem de alta precisão com controle de qualidade"],
  ];
  const editing = useEditing();
  const hidden = useHidden();
  return (
    <ul className="proof-bar" aria-label="A Usibar em números e fatos">
      {items.map(([value, caption], i) => {
        const vk = `proof.${i + 1}.value`,
          ck = `proof.${i + 1}`;
        if (!editing && hidden.includes(vk) && hidden.includes(ck)) return null;
        return (
          <li key={i}>
            <strong>
              <Removable k={vk} label={`Faixa de fatos ${i + 1} — destaque`}>
                <T k={vk} d={value} label={`Faixa de fatos ${i + 1} — destaque`} />
              </Removable>
            </strong>
            <span>
              <Removable k={ck} label={`Faixa de fatos ${i + 1}`}>
                <T k={ck} d={caption} label={`Faixa de fatos ${i + 1}`} />
              </Removable>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Solutions({
  num,
  services,
  products,
  ed,
  apply,
  onBrowse,
  onQuote,
}: {
  num: string;
  services: Service[];
  products: Part[];
  ed: Ed;
  apply: Apply;
  onBrowse: (category: string) => void;
  onQuote: (type: string) => void;
}) {
  const setService = (id: string, key: keyof Service) => (c: Content, v: string) => ({
    ...c,
    services: c.services.map((s) => (s.id === id ? { ...s, [key]: v } : s)),
  });
  return (
    <section className="solutions" id="solucoes" aria-labelledby="solutions-title">
      <div className="section-intro reveal">
        <span className="eyebrow">
          {num} — <T k="solutions.eyebrow" d="SOLUÇÕES" label="Soluções — rótulo" />
        </span>
        <h2 id="solutions-title">
          <T k="solutions.title.1" d="Soluções hidráulicas" label="Soluções — título" />
          <br />
          <em>
            <T k="solutions.title.2" d="que movimentam resultados." label="Soluções — título (destaque)" />
          </em>
        </h2>
        <Removable k="solutions.intro" label="Soluções — introdução" block>
          <p>
            <T
              k="solutions.intro"
              d="Componentes e sistemas projetados para garantir segurança, confiabilidade, eficiência e elevado desempenho operacional."
              label="Soluções — introdução"
            />
          </p>
        </Removable>
      </div>
      <div className="solution-grid">
        {services.map((s, i) => {
          const count = s.category === "all" ? 0 : products.filter((p) => p.category === s.category).length;
          return (
            <article className="solution-card" key={s.id}>
              <div className="solution-figure">
                <span className="solution-no">{String(i + 1).padStart(2, "0")}</span>
                <img src={s.imageUrl} alt="" loading="lazy" />
                <i className="dim dim-x" aria-hidden="true" />
                <i className="dim dim-y" aria-hidden="true" />
                <ImageSwap
                  src={s.imageUrl}
                  label="foto"
                  cutout
                  onChange={(url) =>
                    apply((c) => ({ ...c, services: c.services.map((x) => (x.id === s.id ? { ...x, imageUrl: url } : x)) }), `Foto de “${s.title}” trocada`)
                  }
                />
              </div>
              <h3>{ed(s.title, `Solução ${i + 1} — título`, setService(s.id, "title"), `service.${s.id}.title`)}</h3>
              <p className="solution-lead">{ed(s.lead, `Solução ${i + 1} — destaque`, setService(s.id, "lead"), `service.${s.id}.lead`)}</p>
              <p>{ed(s.copy, `Solução ${i + 1} — texto`, setService(s.id, "copy"), `service.${s.id}.copy`)}</p>
              <div className="solution-actions">
                {count > 0 && (
                  <button onClick={() => onBrowse(s.category)}>
                    <T k="solutions.browse" d="Ver modelos" label="Botão ver modelos" /> ({count}) <Arrow down />
                  </button>
                )}
                <button onClick={() => onQuote(s.title)}>
                  <T k="solutions.quote" d="Orçar" label="Botão orçar" /> {s.title.toLowerCase()} <Arrow />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function Pillars({ pillars, ed }: { pillars: Pillar[]; ed: Ed }) {
  const set = (id: string, key: keyof Pillar) => (c: Content, v: string) => ({
    ...c,
    pillars: c.pillars.map((p) => (p.id === id ? { ...p, [key]: v } : p)),
  });
  return (
    <ul className="pillars" aria-label="Nossos pilares">
      {pillars.map((p, i) => (
        <li key={p.id} className="reveal">
          <span className="tiny-mono">{String(i + 1).padStart(2, "0")}</span>
          <h3>{ed(p.title, `Pilar ${i + 1} — título`, set(p.id, "title"), `pillar.${p.id}.title`)}</h3>
          <p>{ed(p.desc, `Pilar ${i + 1} — texto`, set(p.id, "desc"), `pillar.${p.id}.desc`)}</p>
        </li>
      ))}
    </ul>
  );
}

/* Line icons for each segment, drawn on a 48-unit grid. */
const icons: Record<string, React.ReactNode> = {
  agricola: (
    <>
      <circle cx="15" cy="32" r="9" />
      <circle cx="15" cy="32" r="3" />
      <circle cx="38" cy="35" r="5" />
      <path d="M6 30V18h14l5 9h15v8M10 18V9h9v9M33 27V15" />
    </>
  ),
  industrial: (
    <>
      <path d="M5 42V22l10 6v-6l10 6v-6l10 6V8h7v34z" />
      <path d="M11 34h4M21 34h4M31 34h4M3 42h42" />
    </>
  ),
  transporte: (
    <>
      <path d="M3 12h25v22H3zM28 19h9l7 8v7H28" />
      <circle cx="11" cy="36" r="4" />
      <circle cx="36" cy="36" r="4" />
    </>
  ),
  construcao: (
    <>
      <path d="M4 34h22v-8H8zM10 26l3-8h9v8" />
      <path d="M22 22l10-12 8 6-6 10" />
      <path d="M34 26l6 6h-8z" />
      <rect x="4" y="36" width="24" height="6" rx="3" />
    </>
  ),
  elevadores: (
    <>
      <rect x="10" y="4" width="28" height="40" />
      <path d="M24 4v40M17 19l3-4 3 4M31 29l-3 4-3-4" />
    </>
  ),
  especiais: (
    <>
      <circle cx="24" cy="24" r="7" />
      <path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M10.6 37.4l4.2-4.2M33.2 14.8l4.2-4.2" />
      <circle cx="24" cy="24" r="14" strokeDasharray="3 4" />
    </>
  ),
  qty: (
    <>
      <rect x="6" y="20" width="14" height="22" />
      <rect x="20" y="12" width="14" height="30" />
      <rect x="34" y="26" width="8" height="16" />
    </>
  ),
  drawing: (
    <>
      <path d="M10 4h20l8 8v32H10z" />
      <path d="M30 4v8h8M16 22h16M16 29h16M16 36h9" />
    </>
  ),
  help: (
    <>
      <path d="M8 40l4-12L32 8l8 8-20 20z" />
      <path d="M28 12l8 8M12 28l8 8" />
    </>
  ),
};

export function SectorIcon({ id }: { id: string }) {
  return (
    <svg className="sector-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
      {icons[id] ?? icons.especiais}
    </svg>
  );
}

/* Guided quote, one question at a time. It builds the message the client sends by
   WhatsApp or e-mail; nothing is stored. */
export type Quote = {
  type: string;
  sector: string;
  qty: string;
  drawing: string;
  name: string;
  details: string;
  // Catalog parts the visitor picked as reference (part ids; shown and sent by name).
  refs: string[];
};
export const emptyQuote: Quote = { type: "", sector: "", qty: "", drawing: "", name: "", details: "", refs: [] };

export function quoteMessage(q: Quote, refNames: string[] = q.refs) {
  const lines = ["Olá, equipe Usibar! Gostaria de solicitar um orçamento."];
  if (q.name.trim()) lines.push(`Nome / empresa: ${q.name.trim()}`);
  if (q.type) lines.push(`Produto: ${q.type}`);
  if (q.refs.length) lines.push(`Modelos de referência: ${refNames.join(", ")}`);
  if (q.sector) lines.push(`Aplicação: ${q.sector}`);
  if (q.qty) lines.push(`Quantidade: ${q.qty}`);
  if (q.drawing) lines.push(`Desenho técnico: ${q.drawing}`);
  if (q.details.trim()) lines.push(`Detalhes: ${q.details.trim()}`);
  return lines.join("\n");
}

type Option = { value: string; hint?: string; icon?: React.ReactNode };

export function QuoteBuilder({
  num,
  company,
  sectors,
  services,
  products,
  quote,
  setQuote,
}: {
  num: string;
  company: Company;
  sectors: Sector[];
  services: Service[];
  products: Part[];
  quote: Quote;
  setQuote: (q: Quote) => void;
}) {
  const t = useText();
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const refs = useMemo(
    () => quote.refs.flatMap((id) => products.filter((p) => p.id === id).map((p) => ({ id, name: p.title }))),
    [quote.refs, products],
  );
  const message = useMemo(() => quoteMessage(quote, refs.map((r) => r.name)), [quote, refs]);
  // Arriving with a product already chosen (from Soluções or the catalog) skips the first question.
  const startedWith = useRef(quote.type);
  useEffect(() => {
    if (quote.type && quote.type !== startedWith.current && step === 0) setStep(1);
    startedWith.current = quote.type;
  }, [quote.type, step]);

  const steps: { key: keyof Quote; title: string; options: Option[] }[] = [
    {
      key: "type",
      title: t("quote.q1", "O que você precisa?"),
      options: [
        ...services.map((s) => ({ value: s.title, hint: s.lead, icon: <img src={s.imageUrl} alt="" /> })),
        { value: t("quote.q1.other", "Outro componente"), hint: t("quote.q1.other.hint", "Peça especial sob desenho"), icon: <SectorIcon id="especiais" /> },
      ],
    },
    {
      key: "sector",
      title: t("quote.q2", "Para qual aplicação?"),
      options: [...sectors.map((s) => ({ value: s.name, icon: <SectorIcon id={s.id} /> })), { value: t("quote.q2.other", "Outra aplicação"), icon: <SectorIcon id="help" /> }],
    },
    {
      key: "qty",
      title: t("quote.q3", "Quantas peças, aproximadamente?"),
      options: ["1 a 5 peças", "6 a 20 peças", "21 a 100 peças", "Mais de 100 peças"].map((v, i) => ({ value: t(`quote.q3.${i + 1}`, v), icon: <SectorIcon id="qty" /> })),
    },
    {
      key: "drawing",
      title: t("quote.q4", "Você já tem o desenho técnico?"),
      options: [
        { value: t("quote.q4.yes", "Sim, vou enviar junto"), hint: t("quote.q4.yes.hint", "Anexe na conversa depois de enviar"), icon: <SectorIcon id="drawing" /> },
        { value: t("quote.q4.no", "Não, preciso de apoio no projeto"), hint: t("quote.q4.no.hint", "Desenvolvemos conforme a aplicação"), icon: <SectorIcon id="help" /> },
      ],
    },
  ];
  const last = steps.length;
  const go = (i: number) => {
    setStep(i);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("button, input, textarea")?.focus({ preventScroll: true }));
  };
  const choose = (key: keyof Quote, value: string) => {
    setQuote({ ...quote, [key]: value });
    setTimeout(() => go(Math.min(step + 1, last)), 220);
  };
  const wa = `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(message)}`;
  const mail = `mailto:${company.email}?subject=${encodeURIComponent("Solicitação de orçamento — " + (quote.type || "Usibar"))}&body=${encodeURIComponent(message)}`;
  const labels = [t("quote.s1", "Produto"), t("quote.s2", "Aplicação"), t("quote.s3", "Quantidade"), t("quote.s4", "Desenho"), t("quote.s5", "Enviar")];
  const current = steps[step];

  return (
    <section className="quote" id="orcamento" data-tone="dark" aria-labelledby="quote-title">
      <div className="quote-head">
        <span className="eyebrow">
          {num} — <T k="quote.eyebrow" d="ORÇAMENTO" label="Orçamento — rótulo" />
        </span>
        <h2 id="quote-title">
          <T k="quote.title.1" d="Seu orçamento" label="Orçamento — título" />
          <br />
          <em>
            <T k="quote.title.2" d="em quatro respostas." label="Orçamento — título (destaque)" />
          </em>
        </h2>
        <Removable k="quote.intro" label="Orçamento — introdução" block>
          <p>
            <T
              k="quote.intro"
              d="Responda com um toque e envie a mensagem pronta pelo WhatsApp ou por e-mail. A equipe avalia a aplicação e retorna com a proposta."
              label="Orçamento — introdução"
            />
          </p>
        </Removable>
      </div>

      <div className="quote-body">
        <div className="wizard" data-tone="light">
          <ol className="wizard-progress" aria-label="Etapas do orçamento">
            {labels.map((l, i) => {
              const done = i < last ? !!quote[steps[i].key] : false;
              return (
                <li key={i} className={(i === step ? "now " : "") + (done ? "done" : "")}>
                  <button onClick={() => go(i)} aria-current={i === step ? "step" : undefined}>
                    <b>{done && i !== step ? "✓" : i + 1}</b>
                    <span>{l}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="wizard-panel" ref={panel} key={step} aria-live="polite">
            {current ? (
              <>
                <h3>
                  <span className="tiny-mono">
                    {step + 1} / {last}
                  </span>
                  {current.title}
                </h3>
                {step === 0 && refs.length > 0 && (
                  <p className="wizard-refs">
                    <T k="quote.refs" d="Do catálogo:" label="Orçamento — modelos de referência" />{" "}
                    {refs.map((r) => (
                      <button key={r.id} onClick={() => setQuote({ ...quote, refs: quote.refs.filter((x) => x !== r.id) })} aria-label={`Remover ${r.name}`}>
                        {r.name} ×
                      </button>
                    ))}
                  </p>
                )}
                <div className={"wizard-options" + (current.options.length > 4 ? " many" : "")}>
                  {current.options.map((o) => (
                    <button
                      key={o.value}
                      className={"wizard-option" + (quote[current.key] === o.value ? " on" : "")}
                      aria-pressed={quote[current.key] === o.value}
                      onClick={() => choose(current.key, o.value)}
                    >
                      <span className="wo-icon">{o.icon}</span>
                      <span className="wo-text">
                        <strong>{o.value}</strong>
                        {o.hint && <small>{o.hint}</small>}
                      </span>
                      <span className="wo-check" aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <div className="wizard-nav">
                  {step > 0 && (
                    <button onClick={() => go(step - 1)}>
                      ← <T k="quote.back" d="Voltar" label="Orçamento — voltar" />
                    </button>
                  )}
                  <button className="skip" onClick={() => go(step + 1)}>
                    <T k="quote.skip" d="Pular esta pergunta" label="Orçamento — pular" /> →
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>
                  <span className="tiny-mono">
                    {last} / {last}
                  </span>
                  <T k="quote.review" d="Confira e envie" label="Orçamento — revisão" />
                </h3>
                <dl className="wizard-summary">
                  {steps.map((s, i) => (
                    <div key={s.key}>
                      <dt>{labels[i]}</dt>
                      <dd>{(quote[s.key] as string) || <em>—</em>}</dd>
                      <button onClick={() => go(i)}>
                        <T k="quote.change" d="alterar" label="Orçamento — alterar" />
                      </button>
                    </div>
                  ))}
                </dl>
                <div className="quote-fields">
                  <label>
                    <span>
                      <T k="quote.name" d="Seu nome e empresa (opcional)" label="Orçamento — campo nome" />
                    </span>
                    <input value={quote.name} maxLength={120} autoComplete="organization" onChange={(e) => setQuote({ ...quote, name: e.target.value })} />
                  </label>
                  <label>
                    <span>
                      <T k="quote.details" d="Detalhes da aplicação (opcional)" label="Orçamento — campo detalhes" />
                    </span>
                    <textarea
                      rows={3}
                      maxLength={800}
                      value={quote.details}
                      placeholder={t("quote.details.ph", "Pressão de trabalho, curso, diâmetro, fixação, prazo…")}
                      onChange={(e) => setQuote({ ...quote, details: e.target.value })}
                    />
                  </label>
                </div>
                <div className="quote-send">
                  <a className="send-wa" href={wa} target="_blank" rel="noreferrer" onClick={() => setSent(true)}>
                    <Glyph name="whatsapp" />
                    <T k="quote.send.wa" d="Enviar pelo WhatsApp" label="Orçamento — botão WhatsApp" />
                    <Arrow />
                  </a>
                  <a className="send-mail" href={mail} onClick={() => setSent(true)}>
                    <Glyph name="mail" />
                    <T k="quote.send.mail" d="Enviar por e-mail" label="Orçamento — botão e-mail" />
                    <Arrow />
                  </a>
                </div>
                <details className="quote-preview">
                  <summary>
                    <T k="quote.preview" d="Ver a mensagem que será enviada" label="Orçamento — prévia" />
                  </summary>
                  <pre>{message}</pre>
                </details>
                {sent && (
                  <p className="quote-note" role="status">
                    <T k="quote.sent" d="Mensagem aberta no aplicativo. Se tiver o desenho, anexe-o na conversa." label="Orçamento — após enviar" />
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <ContactCard company={company} />
      </div>
    </section>
  );
}

export function ContactCard({ company }: { company: Company }) {
  return (
    <aside className="contact-card" aria-labelledby="contact-title">
      <span className="tiny-mono" id="contact-title">
        <T k="contact.title" d="PREFERE FALAR DIRETO?" label="Contato — título" />
      </span>
      <ul className="contact-list">
        <li>
          <a href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noreferrer">
            <Glyph name="whatsapp" />
            <span>
              <small>WhatsApp</small>
              {company.phoneDisplay}
            </span>
          </a>
        </li>
        <li>
          <a href={`tel:+${company.whatsapp}`}>
            <Glyph name="phone" />
            <span>
              <small>
                <T k="contact.phone" d="Telefone" label="Contato — telefone" />
              </small>
              {company.phoneDisplay}
            </span>
          </a>
        </li>
        <li>
          <a href={`mailto:${company.email}`}>
            <Glyph name="mail" />
            <span>
              <small>E-mail</small>
              {company.email}
            </span>
          </a>
        </li>
        <li>
          <a href={mapsUrl(company)} target="_blank" rel="noreferrer">
            <Glyph name="pin" />
            <span>
              <small>
                <T k="contact.address" d="Endereço · como chegar" label="Contato — endereço" />
              </small>
              {company.address}
              <br />
              {company.city} · CEP {company.zip}
            </span>
          </a>
        </li>
      </ul>
      <SocialLinks company={company} />
    </aside>
  );
}

export function SiteFooter({ company, logged, onEdit, nav }: { company: Company; logged: boolean; onEdit: () => void; nav: [string, string][] }) {
  return (
    <footer className="site-footer" data-tone="dark">
      <div className="footer-brand">
        <span className="footer-logo" data-tone="light">
          <LogoFull />
        </span>
        <Removable k="footer.motto" label="Rodapé — lema" block>
          <p>
            <T k="footer.motto" d={company.motto ?? company.Tagline ?? ""} label="Rodapé — lema" />
          </p>
        </Removable>
        <SocialLinks company={company} />
      </div>
      <nav aria-label="Rodapé">
        <span className="tiny-mono">
          <T k="footer.nav" d="NAVEGAÇÃO" label="Rodapé — navegação" />
        </span>
        {nav.map(([href, label]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      <div>
        <span className="tiny-mono">
          <T k="footer.contact" d="CONTATO" label="Rodapé — contato" />
        </span>
        <a href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noreferrer" className="with-glyph">
          <Glyph name="whatsapp" /> {company.phoneDisplay}
        </a>
        <a href={`mailto:${company.email}`} className="with-glyph">
          <Glyph name="mail" /> {company.email}
        </a>
      </div>
      <div>
        <span className="tiny-mono">
          <T k="footer.address" d="ENDEREÇO" label="Rodapé — endereço" />
        </span>
        <a href={mapsUrl(company)} target="_blank" rel="noreferrer" className="with-glyph">
          <Glyph name="pin" />
          <span>
            {company.address}
            <br />
            {company.city} · CEP {company.zip}
          </span>
        </a>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {company.name}
        </span>
        <span>
          <T k="footer.tagline" d="CILINDROS · BLOCOS HIDRÁULICOS · USINAGEM CNC" label="Rodapé — linha" />
        </span>
        {logged ? <button onClick={onEdit}>Editar site ↗</button> : <a href="/admin">Área administrativa ↗</a>}
        <a className="footer-credit" href="https://nodenhub.com.br" target="_blank" rel="noopener">
          Desenvolvido por Noden
        </a>
      </div>
    </footer>
  );
}
