"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authFetch } from "@/lib/browser-auth";
import { CopyContext, type Field, type TextStyle } from "./copy";
import { useModal } from "./editing";

// Brand colours first; the picker covers anything else.
const SWATCHES: [string, string][] = [
  ["#292c27", "Grafite"],
  ["#bf4f29", "Laranja"],
  ["#fa4804", "Laranja da logo"],
  ["#686b60", "Cinza"],
  ["#f7f2e9", "Areia (fundos escuros)"],
  ["#ffffff", "Branco"],
];
const SIZE = { min: 0.6, max: 2.4, step: 0.1 };
const ACTIONS: [string, string][] = [
  ["improve", "Melhorar"],
  ["shorten", "Encurtar"],
  ["fix", "Corrigir português"],
  ["technical", "Mais técnico"],
  ["commercial", "Mais comercial"],
];

export type AiStatus = { configured: boolean; model?: string } | null;

export async function askAi<T>(body: Record<string, unknown>): Promise<T> {
  const res = await authFetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(data.error || "A IA não respondeu.");
  return data as T;
}

const round = (n: number) => Math.round(n * 10) / 10;

/* Floating toolbar for the text being edited: colour, size and AI rewrites. */
export function TextToolbar({ ai }: { ai: AiStatus }) {
  const { active, activate, styles, setStyle } = useContext(CopyContext);
  const bar = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);
  const [panel, setPanel] = useState<"none" | "ai">("none");
  const [busy, setBusy] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<{ text: string; note: string; action: string } | null>(null);
  const [error, setError] = useState("");

  // Follows the field while the page scrolls; closes on a click anywhere else.
  useEffect(() => {
    if (!active) return;
    setPanel("none");
    setProposal(null);
    setError("");
    let frame = 0;
    const place = () => {
      const r = active.el.getBoundingClientRect();
      const h = bar.current?.offsetHeight ?? 52;
      const w = bar.current?.offsetWidth ?? 420;
      const below = r.top < h + 90;
      setPos({
        top: below ? r.bottom + 10 : r.top - h - 10,
        left: Math.max(12, Math.min(innerWidth - w - 12, r.left)),
        below,
      });
      frame = requestAnimationFrame(place);
    };
    place();
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (bar.current?.contains(t) || active.el.contains(t)) return;
      if ((t as HTMLElement).closest?.(".editable")) return; // another field takes over on focus
      activate(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !active.el.matches(":focus") && activate(null);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", esc);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", esc);
    };
  }, [active, activate]);

  if (!active || !pos) return null;
  const style: TextStyle = styles[active.key] ?? {};
  const size = style.size ?? 1;
  const apply = (next: TextStyle) => {
    const clean: TextStyle = {};
    if (next.color) clean.color = next.color;
    if (next.size && Math.abs(next.size - 1) > 0.001) clean.size = round(next.size);
    setStyle(active.key, clean.color || clean.size ? clean : null, active.label);
  };
  async function run(action: string) {
    setBusy(true);
    setError("");
    setProposal(null);
    try {
      const out = await askAi<{ text: string; note: string; unchanged: boolean }>({
        action,
        text: active!.el.textContent || active!.get(),
        label: active!.label,
        instruction: action === "custom" ? instruction : undefined,
      });
      setProposal({ text: out.text, note: out.unchanged ? "A IA não viu nada a mudar neste texto." : out.note, action });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      ref={bar}
      className={"text-toolbar" + (pos.below ? " below" : "")}
      style={{ top: pos.top, left: pos.left }}
      role="toolbar"
      aria-label={`Formatação de “${active.label}”`}
      // Keep the caret in the text while clicking buttons; inputs still take focus.
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest("input, textarea")) e.preventDefault();
      }}
    >
      <div className="tt-row">
        <span className="tt-label tiny-mono">{active.label}</span>
        <div className="tt-group" role="group" aria-label="Cor do texto">
          <button className={"tt-swatch reset" + (!style.color ? " on" : "")} title="Cor padrão" aria-label="Cor padrão" onClick={() => apply({ ...style, color: undefined })} />
          {SWATCHES.map(([c, name]) => (
            <button
              key={c}
              className={"tt-swatch" + (style.color === c ? " on" : "")}
              style={{ background: c }}
              title={name}
              aria-label={name}
              aria-pressed={style.color === c}
              onClick={() => apply({ ...style, color: c })}
            />
          ))}
          <label className="tt-swatch custom" title="Outra cor">
            <input type="color" value={style.color ?? "#292c27"} aria-label="Outra cor" onChange={(e) => apply({ ...style, color: e.target.value })} />
          </label>
        </div>
        <div className="tt-group" role="group" aria-label="Tamanho do texto">
          <button disabled={size <= SIZE.min} onClick={() => apply({ ...style, size: Math.max(SIZE.min, size - SIZE.step) })} aria-label="Diminuir">
            A−
          </button>
          <span className="tt-size" aria-live="polite">
            {Math.round(size * 100)}%
          </span>
          <button disabled={size >= SIZE.max} onClick={() => apply({ ...style, size: Math.min(SIZE.max, size + SIZE.step) })} aria-label="Aumentar">
            A+
          </button>
        </div>
        {(style.color || style.size) && (
          <button className="tt-reset" onClick={() => apply({})}>
            Restaurar
          </button>
        )}
        <button className={"tt-ai" + (panel === "ai" ? " on" : "")} aria-expanded={panel === "ai"} onClick={() => setPanel(panel === "ai" ? "none" : "ai")}>
          ✦ IA
        </button>
      </div>
      {panel === "ai" && (
        <div className="tt-panel">
          {!ai?.configured ? (
            <p className="tt-note">
              A IA ainda não está configurada. Defina <code>GEMINI_API_KEY</code> nas variáveis de ambiente do servidor e recarregue.
            </p>
          ) : (
            <>
              <div className="tt-actions">
                {ACTIONS.map(([a, l]) => (
                  <button key={a} disabled={busy} onClick={() => run(a)}>
                    {l}
                  </button>
                ))}
              </div>
              <form
                className="tt-custom"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (instruction.trim()) void run("custom");
                }}
              >
                <input value={instruction} maxLength={500} placeholder="Ou peça algo: “cite os segmentos atendidos”…" onChange={(e) => setInstruction(e.target.value)} />
                <button disabled={busy || !instruction.trim()}>Pedir</button>
              </form>
              {busy && <p className="tt-note">A IA está escrevendo…</p>}
              {error && <p className="tt-note error">{error}</p>}
              {proposal && (
                <div className="tt-proposal">
                  <span className="tiny-mono">Proposta</span>
                  <textarea value={proposal.text} rows={Math.min(6, Math.ceil(proposal.text.length / 60) + 1)} onChange={(e) => setProposal({ ...proposal, text: e.target.value })} />
                  {proposal.note && <small>{proposal.note}</small>}
                  <div className="tt-actions">
                    <button
                      className="primary"
                      onClick={() => {
                        active.commit(proposal.text.trim());
                        setProposal(null);
                        setPanel("none");
                      }}
                    >
                      Aplicar
                    </button>
                    <button disabled={busy} onClick={() => run(proposal.action || "improve")}>
                      Outra versão
                    </button>
                    <button onClick={() => setProposal(null)}>Descartar</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

type Suggestion = { key: string; issue: string; suggestion: string; state?: "applied" | "ignored" };

/* Whole-page curation: the AI reads every editable text and proposes changes, one by one. */
export function CurationPanel({ ai, lenis, onClose }: { ai: AiStatus; lenis: { stop(): void; start(): void } | null; onClose: () => void }) {
  const { fields } = useContext(CopyContext);
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ summary: string; suggestions: Suggestion[] } | null>(null);
  useModal(true, ref, () => !busy && onClose(), lenis);
  const all = [...fields.current.values()];
  const texts = all
    .map((f) => ({ key: f.key, label: f.label.slice(0, 120), text: (f.el.textContent || f.get()).trim() }))
    .filter((f) => f.text.length > 1)
    .slice(0, 200);
  const find = (key: string): Field | undefined => fields.current.get(key);
  const mark = (key: string, state: Suggestion["state"]) =>
    setResult((r) => r && { ...r, suggestions: r.suggestions.map((s) => (s.key === key ? { ...s, state } : s)) });

  async function analyse() {
    setBusy(true);
    setError("");
    try {
      setResult(await askAi({ action: "review", fields: texts }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pending = result?.suggestions.filter((s) => !s.state) ?? [];

  return (
    <div className="part-overlay" data-lenis-prevent onClick={() => !busy && onClose()}>
      <div ref={ref} className="part-dialog curation" role="dialog" aria-modal="true" aria-label="Curadoria com IA" onClick={(e) => e.stopPropagation()}>
        <div className="part-dialog-top tiny-mono">
          <span>✦ CURADORIA COM IA</span>
          <button onClick={onClose} disabled={busy}>
            FECHAR ×
          </button>
        </div>
        {!ai?.configured ? (
          <div className="curation-intro">
            <h2>A IA ainda não está configurada.</h2>
            <p>
              Defina <code>GEMINI_API_KEY</code> nas variáveis de ambiente do servidor (na Vercel: Settings → Environment Variables) e publique de novo. A edição
              continua funcionando normalmente sem ela.
            </p>
          </div>
        ) : !result ? (
          <div className="curation-intro">
            <h2>Revisar os textos da página</h2>
            <p>
              A IA lê os {texts.length} textos editáveis visíveis e aponta erros de português, repetições, frases vagas e chamadas pouco claras. Nada é publicado
              sem você clicar em “Aplicar”, e tudo pode ser desfeito.
            </p>
            {error && <p className="editor-msg">{error}</p>}
            <button className="solid-link" disabled={busy || !texts.length} onClick={analyse}>
              {busy ? "Analisando… (pode levar até um minuto)" : "Analisar agora ↗"}
            </button>
          </div>
        ) : (
          <div className="curation-results">
            {result.summary && <p className="curation-summary">{result.summary}</p>}
            {result.suggestions.length === 0 ? (
              <p>Nenhuma mudança necessária. Os textos estão consistentes.</p>
            ) : (
              <>
                <div className="curation-bar">
                  <span>
                    {pending.length} de {result.suggestions.length} sugestões pendentes
                  </span>
                  {pending.length > 1 && (
                    <button
                      onClick={() =>
                        pending.forEach((s) => {
                          find(s.key)?.commit(s.suggestion);
                          mark(s.key, "applied");
                        })
                      }
                    >
                      Aplicar todas
                    </button>
                  )}
                  <button onClick={analyse} disabled={busy}>
                    {busy ? "Analisando…" : "Analisar de novo"}
                  </button>
                </div>
                <ol className="curation-list">
                  {result.suggestions.map((s) => {
                    const f = find(s.key);
                    return (
                      <li key={s.key} className={s.state ?? ""}>
                        <span className="tiny-mono">{f?.label ?? s.key}</span>
                        {s.issue && <p className="curation-issue">{s.issue}</p>}
                        <p className="curation-before">{f ? f.el.textContent || f.get() : ""}</p>
                        <p className="curation-after">{s.suggestion}</p>
                        <div className="tt-actions">
                          {s.state ? (
                            <em>{s.state === "applied" ? "Aplicada ✓" : "Ignorada"}</em>
                          ) : (
                            <>
                              <button
                                className="primary"
                                disabled={!f}
                                onClick={() => {
                                  f?.commit(s.suggestion);
                                  mark(s.key, "applied");
                                }}
                              >
                                Aplicar
                              </button>
                              <button onClick={() => mark(s.key, "ignored")}>Ignorar</button>
                            </>
                          )}
                          {f && (
                            <button
                              onClick={() => {
                                onClose();
                                setTimeout(() => {
                                  f.el.scrollIntoView({ block: "center", behavior: "smooth" });
                                  f.el.classList.add("flash");
                                  setTimeout(() => f.el.classList.remove("flash"), 2200);
                                }, 80);
                              }}
                            >
                              Ver no site
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            {error && <p className="editor-msg">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
