"use client";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

export type TextStyle = { color?: string; size?: number };
// A text on the page that the admin can change: the floating toolbar and the AI curation
// panel read and apply texts through these entries, wherever the text lives in the content.
export type Field = {
  key: string;
  label: string;
  el: HTMLElement;
  get: () => string;
  commit: (value: string) => void;
  styled: boolean;
};

// Every fixed text of the page has a key and a default written in the code. The admin's
// version (content.copy[key]) wins when present, so new texts never need a data migration.
type CopyCtx = {
  copy: Record<string, string>;
  styles: Record<string, TextStyle>;
  editing: boolean;
  setText: (key: string, value: string, label: string) => void;
  setStyle: (key: string, style: TextStyle | null, label: string) => void;
  upload: (file: File) => Promise<string | null>;
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
  fields: { current: new Map() },
  hidden: [],
  setHidden: () => {},
  removables: { current: new Map() },
  active: null,
  activate: () => {},
});

export const styleOf = (s?: TextStyle): React.CSSProperties | undefined =>
  s && (s.color || s.size) ? { color: s.color, fontSize: s.size ? `${s.size}em` : undefined } : undefined;

// Inline text field: plain text while viewing, contentEditable while editing.
// The DOM text is managed imperatively so React never fights the caret.
export function Editable({
  value,
  editing,
  label,
  onCommit,
  className,
  styleKey,
}: {
  value: string;
  editing: boolean;
  label: string;
  onCommit: (v: string) => void;
  className?: string;
  styleKey?: string;
}) {
  const { styles, fields, activate } = useContext(CopyContext);
  const ref = useRef<HTMLSpanElement>(null);
  const latest = useRef({ value, onCommit, label });
  latest.current = { value, onCommit, label };
  const style = styleOf(styleKey ? styles[styleKey] : undefined);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== value) el.textContent = value;
  }, [value, editing]);
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
  if (!editing)
    return (
      <span className={className} style={style}>
        {value}
      </span>
    );
  return (
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
        if (!text || text.length > 4000) e.currentTarget.textContent = value;
        else if (text !== value) onCommit(text);
      }}
    />
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

// "Trocar foto" control laid over any picture while editing. The parent must be positioned.
export function ImageSwap({ label, onChange }: { label: string; onChange: (url: string) => void }) {
  const { editing, upload } = useContext(CopyContext);
  const [busy, setBusy] = useState(false);
  if (!editing) return null;
  return (
    <label className={"image-swap" + (busy ? " busy" : "")}>
      {busy ? "Enviando…" : `Trocar ${label}`}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          const url = await upload(file);
          setBusy(false);
          if (url) onChange(url);
        }}
      />
    </label>
  );
}

/* A text or button the admin may remove from a fixed section. Visitors simply don't see it;
   while editing it shows a "×" and, once removed, a slim "↺ Recolocar" placeholder. */
export function Removable({ k, label, children, block = false }: { k: string; label: string; children: React.ReactNode; block?: boolean }) {
  const { editing, hidden, setHidden, removables } = useContext(CopyContext);
  useEffect(() => {
    const map = removables.current;
    map.set(k, label);
    return () => {
      map.delete(k);
    };
  }, [k, label, removables]);
  const off = hidden.includes(k);
  const Tag = block ? "div" : "span";
  if (!editing) return off ? null : <>{children}</>;
  if (off)
    return (
      <Tag className="removed-slot">
        <button type="button" onClick={() => setHidden(k, label, false)}>
          ↺ Recolocar “{label}”
        </button>
      </Tag>
    );
  return (
    <Tag className="removable">
      {children}
      <button type="button" className="remove-x" aria-label={`Remover “${label}”`} title={`Remover “${label}”`} onClick={() => setHidden(k, label, true)}>
        ×
      </button>
    </Tag>
  );
}
