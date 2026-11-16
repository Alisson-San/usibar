"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authFetch } from "@/lib/browser-auth";
import { cleanTextStyle, CopyContext, type TextAlign, type TextStyle } from "./copy";

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

/* Floating toolbar for the text being edited: colour, size, responsive width/position and AI rewrites. */
export function TextToolbar({ ai }: { ai: AiStatus }) {
  const { active, activate, styles, setStyle } = useContext(CopyContext);
  const bar = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);
  const [panel, setPanel] = useState<"none" | "layout" | "ai">("none");
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
      const w = bar.current?.offsetWidth ?? 480;
      const below = r.top < h + 90;
      setPos({
        top: below ? Math.min(innerHeight - h - 12, r.bottom + 12) : Math.max(12, r.top - h - 12),
        left: Math.max(12, Math.min(innerWidth - w - 12, r.left)),
        below,
      });
      frame = requestAnimationFrame(place);
    };
    place();
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (bar.current?.contains(t) || active.el.contains(t)) return;
      if ((t as HTMLElement).closest?.(".editable, .editable-box")) return; // handles or another field
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
  const hasAny = Boolean(style.color || style.size || style.width !== undefined || style.align || style.x !== undefined || style.y !== undefined);
  const hasBox = Boolean(style.width !== undefined || style.align || style.x !== undefined || style.y !== undefined);
  const inInteractive = Boolean(active.el.parentElement?.closest("a, button"));
  const apply = (next: TextStyle) => {
    const cleaned = cleanTextStyle({ ...next, size: next.size ? round(next.size) : undefined });
    setStyle(active.key, cleaned, active.label);
  };
  const setAlign = (align?: TextAlign) => apply({ ...style, align: style.align === align ? undefined : align });

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
        <button
          className={"tt-layout" + (panel === "layout" || hasBox ? " on" : "")}
          aria-expanded={panel === "layout"}
          title="Esticar largura, alinhar ou reposicionar responsivamente"
          onClick={() => setPanel(panel === "layout" ? "none" : "layout")}
        >
          ⇔ Espaço{style.width ? ` ${Math.round(style.width)}%` : ""}
        </button>
        {hasAny && (
          <button className="tt-reset" onClick={() => apply({})}>
            Restaurar
          </button>
        )}
        {active.remove && (
          <button
            className="tt-remove"
            title={`Remover “${active.label}” da página (você poderá recolocar depois)`}
            onClick={() => active.remove?.()}
          >
            × Excluir
          </button>
        )}
        <button className={"tt-ai" + (panel === "ai" ? " on" : "")} aria-expanded={panel === "ai"} onClick={() => setPanel(panel === "ai" ? "none" : "ai")}>
          ✦ IA
        </button>
      </div>
      {panel === "layout" && (
        <div className="tt-panel tt-layout-panel">
          <div className="tt-layout-row">
            <span className="tiny-mono">Largura na seção</span>
            <input
              type="range"
              min={15}
              max={100}
              step={1}
              value={Math.round(style.width ?? 50)}
              aria-label="Largura do bloco na seção"
              onChange={(e) => apply({ ...style, width: Number(e.target.value) })}
            />
            <span className="tt-size">{style.width !== undefined ? `${Math.round(style.width)}%` : "Auto"}</span>
            {style.width !== undefined && (
              <button onClick={() => apply({ ...style, width: undefined })} title="Voltar à largura automática">
                Auto
              </button>
            )}
          </div>
          <div className="tt-layout-row">
            <span className="tiny-mono">Alinhamento</span>
            <div className="tt-actions">
              {([
                ["left", "Esquerda"],
                ["center", "Centro"],
                ["right", "Direita"],
              ] as const).map(([al, lbl]) => (
                <button key={al} className={style.align === al ? "primary" : ""} aria-pressed={style.align === al} onClick={() => setAlign(al)}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {!inInteractive && (
            <div className="tt-layout-row">
              <span className="tiny-mono">Posição responsiva</span>
              <div className="tt-actions">
                <button onClick={() => apply({ ...style, x: 0 })} className={style.x === 0 ? "primary" : ""} title="Encostar bem ao canto esquerdo em qualquer tela">
                  ⇤ Canto esq.
                </button>
                <button onClick={() => apply({ ...style, x: 50 })} className={style.x === 50 ? "primary" : ""} title="Centralizar horizontalmente">
                  ↔ Centro
                </button>
                <button onClick={() => apply({ ...style, x: 100 })} className={style.x === 100 ? "primary" : ""} title="Encostar bem ao canto direito em qualquer tela">
                  Canto dir. ⇥
                </button>
                <button onClick={() => apply({ ...style, y: 0 })} className={style.y === 0 ? "primary" : ""} title="Fixar no topo da seção">
                  ⤒ Topo
                </button>
                <button onClick={() => apply({ ...style, y: 100 })} className={style.y === 100 ? "primary" : ""} title="Fixar na base da seção">
                  ⤓ Base
                </button>
                {(style.x !== undefined || style.y !== undefined) && (
                  <button onClick={() => apply({ ...style, x: undefined, y: undefined })}>↺ Fluxo original</button>
                )}
              </div>
              <small>Dica: você também pode arrastar as bordas laterais do texto para esticá-lo ou o ícone ✥ para levá-lo a qualquer canto.</small>
            </div>
          )}
        </div>
      )}
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
