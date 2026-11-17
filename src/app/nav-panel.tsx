"use client";
import { useRef, useState } from "react";
import { useModal } from "./editing";
import type { Block } from "./blocks";

/* "Índice" in the edit bar: what the page index shows (header menu, cylinder, index sheet).
   Each change is published at once and can be undone, like any other edit. */
export function NavPanel({
  layout,
  numbers,
  name,
  lenis,
  onNumbers,
  onMove,
  onRename,
  onInNav,
  onClose,
}: {
  layout: Block[];
  numbers: boolean;
  name: (b: Block) => string;
  lenis: { stop(): void; start(): void } | null;
  onNumbers: (on: boolean) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onRename: (b: Block, v: string) => void;
  onInNav: (b: Block, inNav: boolean) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(true, ref, onClose, lenis);
  let n = 0;
  return (
    <div className="part-overlay" data-lenis-prevent onClick={onClose}>
      <div ref={ref} className="part-dialog nav-panel" role="dialog" aria-modal="true" aria-label="Índice da página" onClick={(e) => e.stopPropagation()}>
        <div className="part-dialog-top tiny-mono">
          <span>ÍNDICE DA PÁGINA</span>
          <button type="button" onClick={onClose}>
            FECHAR ×
          </button>
        </div>
        <p className="picker-note">
          O que aparece no menu do topo, no índice lateral e na folha de índice. A ordem é a das seções na página; as alterações são publicadas na hora e podem ser desfeitas.
        </p>
        <label className="notice-switch nav-numbers">
          <input type="checkbox" checked={numbers} onChange={(e) => onNumbers(e.target.checked)} />
          <span>
            <strong>Mostrar números</strong> (01, 02, 03…) no índice e nas seções. Contam só as seções que estão no índice, sem pular.
          </span>
        </label>
        <ol className="nav-rows">
          {layout.map((b, i) => {
            const shown = !b.hidden && b.inNav !== false;
            const num = shown ? String(++n).padStart(2, "0") : "";
            return (
              <li key={b.id} className={shown ? "" : "is-out"}>
                <span className="nav-num tiny-mono" aria-hidden="true">
                  {numbers && num ? num : shown ? "•" : "–"}
                </span>
                <NameInput value={name(b)} label={`Nome de “${name(b)}” no índice`} onCommit={(v) => onRename(b, v)} />
                {b.hidden ? (
                  <em className="tiny-mono" title="Seções ocultas não aparecem para visitantes nem no índice">
                    Seção oculta
                  </em>
                ) : (
                  <label className="nav-in">
                    <input type="checkbox" checked={b.inNav !== false} onChange={(e) => onInNav(b, e.target.checked)} /> No índice
                  </label>
                )}
                <span className="nav-move">
                  <button type="button" disabled={i === 0} aria-label={`Subir “${name(b)}”`} onClick={() => onMove(i, -1)}>
                    ↑
                  </button>
                  <button type="button" disabled={i === layout.length - 1} aria-label={`Descer “${name(b)}”`} onClick={() => onMove(i, 1)}>
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="picker-note">“Fora do índice”: a seção continua na página, só não aparece no índice. Para tirá-la da página, use “Ocultar” na própria seção.</p>
      </div>
    </div>
  );
}

function NameInput({ value, label, onCommit }: { value: string; label: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setV(value);
  }
  const commit = () => {
    const t = v.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!t) return setV(value);
    if (t !== value) onCommit(t);
  };
  return (
    <input
      className="nav-name"
      value={v}
      maxLength={40}
      aria-label={label}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          e.stopPropagation();
          setV(value);
        }
      }}
    />
  );
}
