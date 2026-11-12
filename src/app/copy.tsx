"use client";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

export type TextAlign = "left" | "center" | "right";
export type TextStyle = {
  color?: string;
  size?: number;
  width?: number;
  align?: TextAlign;
  x?: number;
  y?: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));

export function cleanTextStyle(s?: TextStyle | null): TextStyle | null {
  if (!s) return null;
  const out: TextStyle = {};
  if (s.color && /^#[0-9a-f]{6}$/i.test(s.color)) out.color = s.color.toLowerCase();
  if (typeof s.size === "number" && Number.isFinite(s.size) && Math.abs(s.size - 1) > 0.001) out.size = clamp(0.5, 3, r1(s.size));
  if (typeof s.width === "number" && Number.isFinite(s.width)) out.width = clamp(10, 100, r1(s.width));
  if (s.align === "left" || s.align === "center" || s.align === "right") out.align = s.align;
  if (typeof s.x === "number" && Number.isFinite(s.x)) out.x = clamp(0, 100, r2(s.x));
  if (typeof s.y === "number" && Number.isFinite(s.y)) out.y = clamp(0, 100, r2(s.y));
  return Object.keys(out).length ? out : null;
}

// A text on the page that the admin can change: the floating toolbar and the AI curation
// panel read and apply texts through these entries, wherever the text lives in the content.
export type Field = {
  key: string;
  label: string;
  el: HTMLElement;
  get: () => string;
  commit: (value: string) => void;
  styled: boolean;
  remove?: () => void;
};

export const RemovableContext = createContext<(() => void) | null>(null);

export type PhotoEditorOpts = {
  label?: string;
  cutout?: boolean;
  onSave: (url: string) => void;
};

// Every fixed text of the page has a key and a default written in the code. The admin's
// version (content.copy[key]) wins when present, so new texts never need a data migration.
type CopyCtx = {
  copy: Record<string, string>;
  styles: Record<string, TextStyle>;
  editing: boolean;
  setText: (key: string, value: string, label: string) => void;
  setStyle: (key: string, style: TextStyle | null, label: string) => void;
  upload: (file: File, removeBg?: boolean) => Promise<string | null>;
  openPhotoEditor: (source: File | string, opts: PhotoEditorOpts) => void;
  fields: React.RefObject<Map<string, Field>>;
  // Texts and buttons of the fixed sections that can be taken out (and put back).
  hidden: string[];
  setHidden: (key: string, label: string, hide: boolean) => void;
  removables: React.RefObject<Map<string, string>>;
  active: Field | null;
  activate: (field: Field | null) => void;
};
export const CopyContext = createContext<CopyCtx>({
  copy: {},
  styles: {},
  editing: false,
  setText: () => {},
  setStyle: () => {},
  upload: async () => null,
  openPhotoEditor: () => {},
  fields: { current: new Map() },
  hidden: [],
  setHidden: () => {},
  removables: { current: new Map() },
  active: null,
  activate: () => {},
});

export const styleOf = (s?: TextStyle): React.CSSProperties | undefined =>
  s && (s.color || s.size || s.align)
    ? {
        color: s.color,
        fontSize: s.size ? `${s.size}em` : undefined,
        textAlign: s.align,
      }
    : undefined;

// Layout-only coordinates of `el` inside `host`, immune to CSS `translate`/`transform` animations.
function naturalBoxInHost(el: HTMLElement, host: HTMLElement) {
  let x = 0,
    y = 0,
    cur: HTMLElement | null = el;
  while (cur && cur !== host) {
    x += cur.offsetLeft - cur.scrollLeft;
    y += cur.offsetTop - cur.scrollTop;
    const parent = cur.offsetParent as HTMLElement | null;
    if (parent && parent !== host) {
      x += parent.clientLeft;
      y += parent.clientTop;
    }
    cur = parent;
  }
  if (cur === host) return { left: x + host.clientLeft, top: y + host.clientTop };
  let hx = 0,
    hy = 0,
    h: HTMLElement | null = host;
  while (h) {
    hx += h.offsetLeft - h.scrollLeft;
    hy += h.offsetTop - h.scrollTop;
    const hp = h.offsetParent as HTMLElement | null;
    if (hp) {
      hx += hp.clientLeft;
      hy += hp.clientTop;
    }
    h = hp;
  }
  return { left: x - hx, top: y - hy };
}

// Inline text field: plain text while viewing, contentEditable with stretch & responsive
// placement handles while editing. The DOM text is managed imperatively so React never fights the caret.
export function Editable({
  value,
  editing,
  label,
  onCommit,
  onRemove,
  className,
  styleKey,
  children,
}: {
  value: string;
  editing: boolean;
  label: string;
  onCommit: (v: string) => void;
  onRemove?: () => void;
  className?: string;
  styleKey?: string;
  children?: React.ReactNode;
}) {
  const { styles, setStyle, fields, active, activate } = useContext(CopyContext);
  const removable = useContext(RemovableContext);
  const removeFn = onRemove ?? removable ?? undefined;
  const boxRef = useRef<HTMLSpanElement>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const latest = useRef({ value, onCommit, label, removeFn });
  latest.current = { value, onCommit, label, removeFn };

  const [live, setLive] = useState<TextStyle | null>(null);
  const [hud, setHud] = useState("");
  const [dragging, setDragging] = useState(false);
  const [handles, setHandles] = useState<{ resize: boolean; move: boolean }>({ resize: false, move: false });

  const savedStyle = styleKey ? styles[styleKey] : undefined;
  const eff = live ?? savedStyle;
  const hasBox = Boolean(eff && (eff.width !== undefined || eff.align !== undefined || eff.x !== undefined || eff.y !== undefined));
  const style = styleOf(eff);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== value) el.textContent = value;
  }, [value, editing]);

  useEffect(() => {
    if (!editing || !styleKey || !boxRef.current) {
      setHandles({ resize: false, move: false });
      return;
    }
    const el = boxRef.current;
    const inChrome = Boolean(el.closest("foreignObject, .block-bar, .site-header, .wa-float"));
    const inInteractive = Boolean(el.parentElement?.closest("a, button"));
    setHandles({ resize: !inChrome, move: !inChrome && !inInteractive });
  }, [editing, styleKey]);

  // Responsively compute width and anchor-ratio (x, y) translation on every resolution/resize.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    if (!hasBox || !eff) {
      box.style.width = "";
      box.style.maxWidth = "";
      box.style.translate = "";
      box.style.position = "";
      box.style.zIndex = "";
      box.style.textAlign = "";
      return;
    }
    const host = box.closest<HTMLElement>("section, footer");
    if (!host) return;

    const sync = () => {
      const sw = host.clientWidth;
      const sh = host.clientHeight;
      if (!sw) return;
      const pad = sw < 600 ? 8 : 10;

      if (eff.width !== undefined) {
        const maxW = Math.max(80, sw - pad * 2);
        const pxW = Math.min(maxW, Math.round((sw * eff.width) / 100));
        box.style.width = `${pxW}px`;
        box.style.maxWidth = "none";
      } else {
        box.style.width = "";
        box.style.maxWidth = "100%";
      }
      box.style.textAlign = eff.align ?? "";

      if (eff.x !== undefined || eff.y !== undefined || eff.width !== undefined) {
        const bw = box.offsetWidth;
        const bh = box.offsetHeight;
        const nat = naturalBoxInHost(box, host);
        const availW = Math.max(0, sw - pad * 2 - bw);
        const availH = Math.max(0, sh - pad * 2 - bh);
        let dx = 0;
        if (eff.x !== undefined) {
          dx = r1(pad + (eff.x / 100) * availW - nat.left);
        } else if (eff.width !== undefined) {
          if (nat.left + bw > sw - pad) dx = r1(sw - pad - (nat.left + bw));
          if (nat.left + dx < pad) dx = r1(pad - nat.left);
        }
        const dy = eff.y !== undefined ? r1(pad + (eff.y / 100) * availH - nat.top) : 0;
        if (dx !== 0 || dy !== 0 || eff.x !== undefined || eff.y !== undefined) {
          box.style.translate = `${dx}px ${dy}px`;
          box.style.position = "relative";
          box.style.zIndex = eff.x !== undefined || eff.y !== undefined ? "15" : "5";
        } else {
          box.style.translate = "";
          box.style.position = "";
          box.style.zIndex = "";
        }
      } else {
        box.style.translate = "";
        box.style.position = "";
        box.style.zIndex = "";
      }
    };

    sync();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(host);
    ro?.observe(box);
    window.addEventListener("resize", sync);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [hasBox, eff?.width, eff?.align, eff?.x, eff?.y, value, editing]);

  const entry = (): Field | null =>
    ref.current && styleKey
      ? {
          key: styleKey,
          label: latest.current.label,
          el: ref.current,
          styled: true,
          get: () => latest.current.value,
          commit: (v) => {
            if (ref.current) ref.current.textContent = v;
            if (v !== latest.current.value) latest.current.onCommit(v);
          },
          remove: latest.current.removeFn
            ? () => {
                activate(null);
                latest.current.removeFn?.();
              }
            : undefined,
        }
      : null;

  useEffect(() => {
    const e = editing ? entry() : null;
    if (!e) return;
    const map = fields.current;
    map.set(e.key, e);
    return () => {
      if (map.get(e.key)?.el === e.el) map.delete(e.key);
    };
    // The entry reads the latest value through a ref; re-register only when identity changes.
  }, [editing, styleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const startResize = (side: "w" | "e") => (e: React.PointerEvent) => {
    if (!styleKey || !boxRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    activate(entry());
    const box = boxRef.current;
    const host = box.closest<HTMLElement>("section, footer");
    if (!host) return;
    const sw = host.clientWidth;
    if (!sw) return;
    const pad = sw < 600 ? 8 : 10;
    const hostRect = host.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const startW = boxRect.width;
    const startLeft = boxRect.left - hostRect.left;
    const startRight = startLeft + startW;
    const startX = e.clientX;
    const base: TextStyle = { ...(styles[styleKey] ?? {}) };
    let nextLive: TextStyle | null = null;
    setDragging(true);

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const minW = Math.min(Math.max(72, sw * 0.1), sw - pad * 2);
      const maxW = Math.max(minW, sw - pad * 2);
      if (side === "e") {
        const newW = clamp(minW, maxW, startW + delta);
        const wPct = clamp(10, 100, r1((newW / sw) * 100));
        const next: TextStyle = { ...base, width: wPct };
        if (base.x !== undefined) {
          const availW = Math.max(1, sw - pad * 2 - newW);
          next.x = clamp(0, 100, r2(((startLeft - pad) / availW) * 100));
        }
        nextLive = next;
        setLive(next);
        setHud(`Largura ${Math.round(wPct)}%`);
      } else {
        const newW = clamp(minW, maxW, startW - delta);
        const wPct = clamp(10, 100, r1((newW / sw) * 100));
        const newLeft = clamp(pad, Math.max(pad, sw - pad - newW), startRight - newW);
        const availW = Math.max(1, sw - pad * 2 - newW);
        const next: TextStyle = { ...base, width: wPct, x: clamp(0, 100, r2(((newLeft - pad) / availW) * 100)) };
        nextLive = next;
        setLive(next);
        setHud(`Largura ${Math.round(wPct)}%`);
      }
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      setDragging(false);
      setHud("");
      setLive(null);
      if (nextLive) setStyle(styleKey, cleanTextStyle(nextLive), latest.current.label);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

  const startMove = (e: React.PointerEvent) => {
    if (!styleKey || !boxRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    activate(entry());
    const box = boxRef.current;
    const host = box.closest<HTMLElement>("section, footer");
    if (!host) return;
    const sw = host.clientWidth;
    const sh = host.clientHeight;
    if (!sw || !sh) return;
    const pad = sw < 600 ? 8 : 10;
    const hostRect = host.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const bw = boxRect.width;
    const bh = boxRect.height;
    const startRelL = boxRect.left - hostRect.left;
    const startRelT = boxRect.top - hostRect.top;
    const startX = e.clientX;
    const startY = e.clientY;
    const base: TextStyle = { ...(styles[styleKey] ?? {}) };
    let moved = false;
    let nextLive: TextStyle | null = null;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      setDragging(true);
      const availW = Math.max(1, sw - pad * 2 - bw);
      const availH = Math.max(1, sh - pad * 2 - bh);
      const clampedL = clamp(pad, pad + availW, startRelL + dx);
      const clampedT = clamp(pad, pad + availH, startRelT + dy);
      let nx = clamp(0, 100, r2(((clampedL - pad) / availW) * 100));
      let ny = clamp(0, 100, r2(((clampedT - pad) / availH) * 100));
      if (!ev.shiftKey) {
        if (nx <= 2) nx = 0;
        else if (nx >= 98) nx = 100;
        else if (Math.abs(nx - 50) <= 1.8) nx = 50;
        if (ny <= 2) ny = 0;
        else if (ny >= 98) ny = 100;
        else if (Math.abs(ny - 50) <= 1.8) ny = 50;
      }
      const next: TextStyle = { ...base, x: nx, y: ny };
      nextLive = next;
      setLive(next);
      const atCorner = (nx === 0 || nx === 100) && (ny === 0 || ny === 100);
      setHud(atCorner ? `Canto (${nx}% · ${ny}%)` : `Posição ${Math.round(nx)}% · ${Math.round(ny)}%`);
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      setDragging(false);
      setHud("");
      setLive(null);
      if (moved && nextLive) setStyle(styleKey, cleanTextStyle(nextLive), latest.current.label);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

  if (!editing) {
    if (!hasBox)
      return (
        <span className={className} style={style}>
          {children ?? value}
        </span>
      );
    return (
      <span
        ref={boxRef}
        className={(className ? className + " " : "") + "editable-box is-boxed"}
        data-custom-box=""
        data-stretched={eff?.width !== undefined ? "" : undefined}
        style={style}
      >
        {children ?? value}
      </span>
    );
  }

  const isActive = Boolean(styleKey && active?.key === styleKey);
  return (
    <span
      ref={boxRef}
      className={
        "editable-box" +
        (hasBox ? " is-boxed" : "") +
        (dragging ? " is-dragging" : "") +
        (isActive ? " is-active" : "")
      }
      data-custom-box={hasBox ? "" : undefined}
      data-stretched={eff?.width !== undefined ? "" : undefined}
    >
      <span
        ref={ref}
        className={(className ? className + " " : "") + "editable"}
        style={style}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        data-label={label}
        data-key={styleKey}
        spellCheck
        onFocus={() => activate(entry())}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.currentTarget.textContent = value;
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          const text = (e.currentTarget.textContent || "").replace(/\s+/g, " ").trim();
          if (!text) {
            if (latest.current.removeFn) {
              activate(null);
              latest.current.removeFn();
            } else {
              e.currentTarget.textContent = value;
            }
          } else if (text.length > 4000) {
            e.currentTarget.textContent = value;
          } else if (text !== value) {
            onCommit(text);
          }
        }}
      />
      {handles.resize && (
        <>
          <i className="ed-handle ed-w" title="Arraste para esticar pela esquerda" onPointerDown={startResize("w")} />
          <i className="ed-handle ed-e" title="Arraste para esticar ou ajustar a largura" onPointerDown={startResize("e")} />
        </>
      )}
      {handles.move && (
        <button
          type="button"
          className="ed-move"
          tabIndex={-1}
          aria-label={`Mover “${label}”`}
          title="Arraste para reposicionar na tela (duplo clique volta ao lugar original)"
          onPointerDown={startMove}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (styleKey && savedStyle && (savedStyle.x !== undefined || savedStyle.y !== undefined)) {
              setStyle(styleKey, cleanTextStyle({ ...savedStyle, x: undefined, y: undefined }), label);
            }
          }}
        >
          ✥
        </button>
      )}
      {hud && <em className="ed-hud">{hud}</em>}
    </span>
  );
}

export function T({ k, d, label }: { k: string; d: string; label?: string }) {
  const { copy, editing, setText } = useContext(CopyContext);
  const name = label ?? "Texto";
  return <Editable value={copy[k] ?? d} editing={editing} label={name} styleKey={k} onCommit={(v) => setText(k, v, name)} />;
}

// Plain string version, for places that cannot hold an editor (attributes, split words).
export function useText() {
  const { copy } = useContext(CopyContext);
  return (k: string, d: string) => copy[k] ?? d;
}

export function useHidden() {
  return useContext(CopyContext).hidden;
}

export function useEditing() {
  return useContext(CopyContext).editing;
}

export function useTextStyle(key: string) {
  return styleOf(useContext(CopyContext).styles[key]);
}

// "Ajustar / Trocar foto" controls laid over any picture while editing. The parent must be positioned.
export function ImageSwap({
  src,
  label,
  onChange,
  cutout = false,
}: {
  src?: string;
  label: string;
  onChange: (url: string) => void;
  cutout?: boolean;
}) {
  const { editing, openPhotoEditor } = useContext(CopyContext);
  if (!editing) return null;
  return (
    <span className="image-swap-group">
      {src && (
        <button
          type="button"
          className="image-swap image-edit-btn"
          title={`Redimensionar, nivelar ângulo e ajustar ${label}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openPhotoEditor(src, { label, cutout, onSave: onChange });
          }}
        >
          Ajustar
        </button>
      )}
      <label className="image-swap">
        Trocar {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            openPhotoEditor(file, { label, cutout, onSave: onChange });
          }}
        />
      </label>
    </span>
  );
}

/* A text or button the admin may remove from a fixed section. Visitors simply don't see it;
   while editing it shows a "×" and, once removed, a slim "↺ Recolocar" placeholder. */
export function Removable({
  k,
  label,
  children,
  block = false,
  className,
}: {
  k: string;
  label: string;
  children: React.ReactNode;
  block?: boolean;
  className?: string;
}) {
  const { editing, hidden, setHidden, removables, activate } = useContext(CopyContext);
  useEffect(() => {
    const map = removables.current;
    map.set(k, label);
    return () => {
      map.delete(k);
    };
  }, [k, label, removables]);
  const off = hidden.includes(k);
  const Tag = block ? "div" : "span";
  const cls = (base: string) => (className ? `${base} ${className}` : base);
  if (!editing) return off ? null : <>{children}</>;
  if (off)
    return (
      <Tag className={cls("removed-slot")}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setHidden(k, label, false);
          }}
        >
          ↺ Recolocar “{label}”
        </button>
      </Tag>
    );
  const hide = () => setHidden(k, label, true);
  return (
    <RemovableContext.Provider value={hide}>
      <Tag className={cls("removable")}>
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
            hide();
          }}
        >
          ×
        </button>
      </Tag>
    </RemovableContext.Provider>
  );
}

export function SectionEyebrow({
  num,
  numKey,
  eyebrowKey,
  defaultLabel,
  sectionLabel,
  id,
  className = "eyebrow",
}: {
  num: string;
  numKey: string;
  eyebrowKey: string;
  defaultLabel: string;
  sectionLabel: string;
  id?: string;
  className?: string;
}) {
  const { editing, hidden } = useContext(CopyContext);
  const numOff = hidden.includes(numKey);
  const labelOff = hidden.includes(eyebrowKey);
  if (!editing && numOff && labelOff) return null;
  return (
    <span className={className} id={id}>
      <Removable k={numKey} label={`${sectionLabel} — numeração`}>
        <T k={numKey} d={num} label={`${sectionLabel} — numeração`} />
      </Removable>
      {!numOff && !labelOff && " — "}
      <Removable k={eyebrowKey} label={`${sectionLabel} — rótulo`}>
        <T k={eyebrowKey} d={defaultLabel} label={`${sectionLabel} — rótulo`} />
      </Removable>
    </span>
  );
}

export function SectionHeading({
  id,
  k1,
  d1,
  l1,
  k2,
  d2,
  l2,
}: {
  id?: string;
  k1: string;
  d1: string;
  l1: string;
  k2: string;
  d2: string;
  l2: string;
}) {
  const { editing, hidden } = useContext(CopyContext);
  const off1 = hidden.includes(k1);
  const off2 = hidden.includes(k2);
  if (!editing && off1 && off2) return null;
  return (
    <h2 id={id}>
      <Removable k={k1} label={l1}>
        <T k={k1} d={d1} label={l1} />
      </Removable>
      {!off1 && !off2 && <br />}
      {(editing || !off2) && (
        <em>
          <Removable k={k2} label={l2}>
            <T k={k2} d={d2} label={l2} />
          </Removable>
        </em>
      )}
    </h2>
  );
}
