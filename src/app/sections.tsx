"use client";
import { useMemo, useState } from "react";
import type { Company, Part } from "./editing";
import type { Step } from "./ProcessSection";

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
export type Content = {
  company: Company;
  products: Part[];
  sectors: Sector[];
  process: Step[];
  services: Service[];
  pillars: Pillar[];
};
// Renders a field as plain text, or as an inline editor while editing.
export type Ed = (value: string, label: string, apply: (c: Content, v: string) => Content) => React.ReactNode;

export function Arrow({ down = false }: { down?: boolean }) {
  return <span aria-hidden="true">{down ? "↓" : "↗"}</span>;
}

/* Hero: the part is presented like an inspection sheet, with callouts drawn on it. */
const callouts = [
  { n: "01", label: "OLHAL DE FIXAÇÃO USINADO", at: [112, 212], path: "M112 212 L82 296 H-6", text: [-6, 314], anchor: "start" },
  { n: "02", label: "CABEÇOTE USINADO", at: [252, 140], path: "M252 140 L214 46 H118", text: [118, 36], anchor: "start" },
  { n: "03", label: "TIRANTES DE FECHAMENTO", at: [352, 120], path: "M352 120 L392 26 H540", text: [540, 16], anchor: "end" },
] as const;

export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="-40 -40 620 420" role="img" aria-label="Cilindro hidráulico Usibar com olhal de fixação, cabeçote usinado e tirantes">
      <g className="hero-target" fill="none" stroke="var(--line)">
        <circle cx="262" cy="176" r="196" />
        <circle cx="262" cy="176" r="150" strokeDasharray="3 7" />
        <path d="M262 -32v32M262 352v32M44 176h32M448 176h32" />
      </g>
      <g className="hero-part">
        <image href="/assets/cilindro-olhal.webp" x="0" y="0" width="512" height="342" />
      </g>
      <g className="hero-callouts" fontFamily="var(--font-mono), monospace" fontSize="11" letterSpacing="1">
        {callouts.map((c) => (
          <g key={c.n} className="hc">
            <path className="hc-line" d={c.path} pathLength={1} fill="none" stroke="var(--ink)" strokeWidth=".9" />
            <circle className="hc-ring" cx={c.at[0]} cy={c.at[1]} r="9" fill="none" stroke="var(--orange)" />
            <circle className="hc-dot" cx={c.at[0]} cy={c.at[1]} r="3.5" fill="var(--orange)" />
            <text className="hc-label" x={c.text[0]} y={c.text[1]} textAnchor={c.anchor} fill="var(--ink)">
              <tspan fill="var(--orange)">{c.n}</tspan> {c.label}
            </text>
          </g>
        ))}
        <g className="hc" stroke="var(--muted)" fill="none" strokeWidth=".8">
          <path className="hc-line" d="M58 340H452" pathLength={1} />
          <path className="hc-label" d="M58 332v16M452 332v16" />
          <text className="hc-label" x="255" y="364" textAnchor="middle" fill="var(--muted)" stroke="none">
            DIMENSÕES, CURSO E FIXAÇÕES CONFORME PROJETO
          </text>
        </g>
      </g>
    </svg>
  );
}

export function ProofBar({ company, ed }: { company: Company; ed: Ed }) {
  const items = [
    {
      value: ed(company.experienceYears, "Anos de experiência", (c, v) => ({ ...c, company: { ...c.company, experienceYears: v } })),
      label: "anos de experiência em soluções hidráulicas",
    },
    { value: ed(company.city, "Cidade / UF", (c, v) => ({ ...c, company: { ...c.company, city: v } })), label: "nossa sede, no Rio Grande do Sul" },
    { value: "Sob projeto", label: "cada peça segue as especificações da sua aplicação" },
    { value: "CNC", label: "usinagem de alta precisão com controle de qualidade" },
  ];
  return (
    <ul className="proof-bar" aria-label="A Usibar em números e fatos">
      {items.map((it, i) => (
        <li key={i}>
          <strong>{it.value}</strong>
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

const values = ["Segurança", "Confiabilidade", "Eficiência", "Desempenho"];

export function Solutions({
  services,
  products,
  ed,
  onBrowse,
  onQuote,
}: {
  services: Service[];
  products: Part[];
  ed: Ed;
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
        <span className="eyebrow">01 — SOLUÇÕES</span>
        <h2 id="solutions-title">
          Soluções hidráulicas
          <br />
          <em>que movimentam resultados.</em>
        </h2>
        <p>
          Componentes e sistemas projetados para garantir{" "}
          {values.map((v, i) => (
            <span key={v}>
              <strong>{v.toLowerCase()}</strong>
              {i < values.length - 2 ? ", " : i === values.length - 2 ? " e " : "."}
            </span>
          ))}
        </p>
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
              </div>
              <h3>{ed(s.title, `Solução ${i + 1} — título`, setService(s.id, "title"))}</h3>
              <p className="solution-lead">{ed(s.lead, `Solução ${i + 1} — destaque`, setService(s.id, "lead"))}</p>
              <p>{ed(s.copy, `Solução ${i + 1} — texto`, setService(s.id, "copy"))}</p>
              <div className="solution-actions">
                {count > 0 && (
                  <button onClick={() => onBrowse(s.category)}>
                    Ver {count} modelos <Arrow down />
                  </button>
                )}
                <button onClick={() => onQuote(s.title)}>
                  Orçar {s.title.toLowerCase()} <Arrow />
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
          <h3>{ed(p.title, `Pilar ${i + 1} — título`, set(p.id, "title"))}</h3>
          <p>{ed(p.desc, `Pilar ${i + 1} — texto`, set(p.id, "desc"))}</p>
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
};

export function SectorIcon({ id }: { id: string }) {
  return (
    <svg className="sector-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
      {icons[id] ?? icons.especiais}
    </svg>
  );
}

/* Guided quote: builds a clear message the client sends by WhatsApp or e-mail. Nothing is stored. */
export type Quote = {
  type: string;
  sector: string;
  qty: string;
  drawing: string;
  name: string;
  details: string;
  refs: string[];
};
export const emptyQuote: Quote = { type: "", sector: "", qty: "", drawing: "", name: "", details: "", refs: [] };

function Choice({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <div>
        {options.map((o) => (
          <button type="button" key={o} aria-pressed={value === o} className={value === o ? "on" : ""} onClick={() => onChange(value === o ? "" : o)}>
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function quoteMessage(q: Quote) {
  const lines = ["Olá, equipe Usibar! Gostaria de solicitar um orçamento."];
  if (q.name.trim()) lines.push(`Nome / empresa: ${q.name.trim()}`);
  if (q.type) lines.push(`Produto: ${q.type}`);
  if (q.refs.length) lines.push(`Modelos de referência: ${q.refs.join(", ")}`);
  if (q.sector) lines.push(`Aplicação: ${q.sector}`);
  if (q.qty) lines.push(`Quantidade: ${q.qty}`);
  if (q.drawing) lines.push(`Desenho técnico: ${q.drawing}`);
  if (q.details.trim()) lines.push(`Detalhes: ${q.details.trim()}`);
  return lines.join("\n");
}

export function QuoteBuilder({
  company,
  sectors,
  services,
  quote,
  setQuote,
}: {
  company: Company;
  sectors: Sector[];
  services: Service[];
  quote: Quote;
  setQuote: (q: Quote) => void;
}) {
  const [sent, setSent] = useState(false);
  const message = useMemo(() => quoteMessage(quote), [quote]);
  const set = <K extends keyof Quote>(k: K, v: Quote[K]) => setQuote({ ...quote, [k]: v });
  const ready = !!quote.type || quote.refs.length > 0;
  const wa = `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(message)}`;
  const mail = `mailto:${company.email}?subject=${encodeURIComponent("Solicitação de orçamento — " + (quote.type || "Usibar"))}&body=${encodeURIComponent(message)}`;
  return (
    <section className="quote" id="orcamento" aria-labelledby="quote-title">
      <div className="quote-head">
        <span className="eyebrow">06 — ORÇAMENTO</span>
        <h2 id="quote-title">
          Solicite um orçamento
          <br />
          <em>em menos de um minuto.</em>
        </h2>
        <ol className="quote-steps">
          <li>
            <b>1</b>Conte o que você precisa
          </li>
          <li>
            <b>2</b>Envie pelo WhatsApp ou e-mail, com o desenho se tiver
          </li>
          <li>
            <b>3</b>A Usibar avalia a aplicação e retorna com a proposta
          </li>
        </ol>
      </div>
      <form className="quote-form" onSubmit={(e) => e.preventDefault()}>
        <Choice
          legend="O que você precisa?"
          options={[...services.map((s) => s.title), "Outro componente"]}
          value={quote.type}
          onChange={(v) => set("type", v)}
        />
        {quote.refs.length > 0 && (
          <fieldset className="choice">
            <legend>Modelos de referência do catálogo</legend>
            <div>
              {quote.refs.map((r) => (
                <button type="button" key={r} className="on ref" onClick={() => set("refs", quote.refs.filter((x) => x !== r))} aria-label={`Remover ${r}`}>
                  {r} ×
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <Choice legend="Em qual aplicação?" options={[...sectors.map((s) => s.name), "Outra"]} value={quote.sector} onChange={(v) => set("sector", v)} />
        <Choice legend="Quantidade aproximada" options={["1 a 5 peças", "6 a 20 peças", "21 a 100 peças", "Mais de 100 peças"]} value={quote.qty} onChange={(v) => set("qty", v)} />
        <Choice
          legend="Você tem desenho técnico?"
          options={["Sim, vou enviar junto", "Não, preciso de apoio no projeto"]}
          value={quote.drawing}
          onChange={(v) => set("drawing", v)}
        />
        <div className="quote-fields">
          <label>
            <span>Nome e empresa (opcional)</span>
            <input value={quote.name} maxLength={120} autoComplete="organization" onChange={(e) => set("name", e.target.value)} />
          </label>
          <label>
            <span>Detalhes da aplicação (opcional)</span>
            <textarea
              rows={3}
              maxLength={800}
              value={quote.details}
              placeholder="Ex.: pressão de trabalho, curso, diâmetro, tipo de fixação, prazo…"
              onChange={(e) => set("details", e.target.value)}
            />
          </label>
        </div>
      </form>
      <aside className="quote-preview" aria-live="polite">
        <span className="tiny-mono">PRÉVIA DA SUA MENSAGEM</span>
        <pre>{message}</pre>
        <div className="quote-send">
          <a
            className={"send-wa" + (ready ? "" : " muted")}
            href={wa}
            target="_blank"
            rel="noreferrer"
            onClick={() => setSent(true)}
          >
            Enviar pelo WhatsApp <Arrow />
          </a>
          <a className="send-mail" href={mail} onClick={() => setSent(true)}>
            Enviar por e-mail <Arrow />
          </a>
        </div>
        <p className="quote-note">
          {sent
            ? "Mensagem aberta no aplicativo. Se tiver o desenho, anexe-o na conversa."
            : ready
              ? "Revise a mensagem e escolha por onde enviar."
              : "Escolha ao menos o tipo de produto para uma resposta mais rápida."}
        </p>
        <dl className="quote-contacts">
          <div>
            <dt>Telefone / WhatsApp</dt>
            <dd>
              <a href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noreferrer">
                {company.phoneDisplay}
              </a>
            </dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>
              <a href={`mailto:${company.email}`}>{company.email}</a>
            </dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}

export function SiteFooter({ company, logged, onEdit }: { company: Company; logged: boolean; onEdit: () => void }) {
  const nav = [
    ["#solucoes", "Soluções"],
    ["#processo", "Processo"],
    ["#pecas", "Catálogo"],
    ["#origem", "Empresa"],
    ["#orcamento", "Orçamento"],
  ];
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <img src="/assets/logo-usibar-light.webp" alt="Usibar — Tecnologia em hidráulica" />
        <p>{company.motto ?? company.Tagline}</p>
      </div>
      <nav aria-label="Rodapé">
        <span className="tiny-mono">NAVEGAÇÃO</span>
        {nav.map(([href, label]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      <div>
        <span className="tiny-mono">CONTATO</span>
        <a href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noreferrer">
          WhatsApp {company.phoneDisplay}
        </a>
        <a href={`mailto:${company.email}`}>{company.email}</a>
        <a href={`https://instagram.com/${company.instagram}`} target="_blank" rel="noreferrer">
          @{company.instagram}
        </a>
      </div>
      <div>
        <span className="tiny-mono">SEDE</span>
        <a href={`https://www.google.com/maps/search/${encodeURIComponent(company.name + " " + company.city)}`} target="_blank" rel="noreferrer">
          {company.city} ↗
        </a>
        <span>Rio Grande do Sul — Brasil</span>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {company.name}
        </span>
        <span>CILINDROS · BLOCOS HIDRÁULICOS · USINAGEM CNC</span>
        {logged ? <button onClick={onEdit}>Editar site ↗</button> : <a href="/admin">Área administrativa ↗</a>}
      </div>
    </footer>
  );
}
