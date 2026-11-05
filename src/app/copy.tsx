"use client";
import { createContext, useContext, useState } from "react";
import { Editable } from "./editing";

// Every fixed text of the page has a key and a default written in the code. The admin's
// version (content.copy[key]) wins when present, so new texts never need a data migration.
type CopyCtx = {
  copy: Record<string, string>;
  editing: boolean;
  setText: (key: string, value: string, label: string) => void;
  upload: (file: File) => Promise<string | null>;
};
export const CopyContext = createContext<CopyCtx>({
  copy: {},
  editing: false,
  setText: () => {},
  upload: async () => null,
});

export function T({ k, d, label }: { k: string; d: string; label?: string }) {
  const { copy, editing, setText } = useContext(CopyContext);
  const name = label ?? "Texto";
  return <Editable value={copy[k] ?? d} editing={editing} label={name} onCommit={(v) => setText(k, v, name)} />;
}

// Plain string version, for places that cannot hold an editor (attributes, split words).
export function useText() {
  const { copy } = useContext(CopyContext);
  return (k: string, d: string) => copy[k] ?? d;
}

export function useEditing() {
  return useContext(CopyContext).editing;
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
