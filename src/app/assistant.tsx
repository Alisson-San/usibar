"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authFetch } from "@/lib/browser-auth";
import { CopyContext, type TextStyle } from "./copy";

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
