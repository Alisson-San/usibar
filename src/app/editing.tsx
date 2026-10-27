"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type Part = {
  id: string;
  code: string;
  title: string;
  category: string;
  featured: boolean;
  specs: string;
  description: string;
  imageUrl: string;
};
export type Company = Record<string, string>;
export type SaveState =
  | { kind: "idle" | "saving" | "saved" }
  | { kind: "error"; message: string; expired?: boolean };

export const blankPart: Part = {
  id: "",
  code: "",
  title: "",
  category: "cilindros",
  featured: false,
  specs: "Usinagem CNC • Sob medida",
  description: "Componente fabricado sob medida pela Usibar Usinagens Especiais.",
  imageUrl: "",
};

// Inline text field: plain text while viewing, contentEditable while editing.
// The DOM text is managed imperatively so React never fights the caret.
export function Editable({
  value,
  editing,
  label,
  onCommit,
  className,
}: {
  value: string;
  editing: boolean;
  label: string;
  onCommit: (v: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== value)
      el.textContent = value;
  }, [value, editing]);
  if (!editing) return <span className={className}>{value}</span>;
  return (
    <span
      ref={ref}
      className={(className ? className + " " : "") + "editable"}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      data-label={label}
      spellCheck
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

// Body scroll lock, Escape to close and a focus trap for dialogs.
export function useModal(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  lenis?: { stop(): void; start(): void } | null,
) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lenis?.stop();
    ref.current
      ?.querySelector<HTMLElement>("input,textarea,button")
      ?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key !== "Tab") return;
      const nodes = ref.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),a[href],input:not(:disabled),textarea,select",
      );
      if (!nodes?.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      lenis?.start();
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, [open, ref, lenis]);
}

export async function readError(res: Response) {
  try {
    return (await res.json()).error as string;
  } catch {
    return "";
  }
}

export function ProductEditor({
  part,
  codes,
  lenis,
  onSave,
  onDelete,
  onClose,
}: {
  part: Part;
  codes: string[];
  lenis: { stop(): void; start(): void } | null;
  onSave: (p: Part) => Promise<boolean>;
  onDelete: (p: Part) => Promise<boolean>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [item, setItem] = useState(part),
    [removeBg, setRemoveBg] = useState(false),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false),
    [msg, setMsg] = useState("");
  useModal(true, ref, () => !busy && onClose(), lenis);
  const set = <K extends keyof Part>(k: K, v: Part[K]) =>
    setItem((p) => ({ ...p, [k]: v }));
  async function upload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return setMsg("Envie uma imagem JPG, PNG ou WebP.");
    if (file.size > 8 * 1024 * 1024) return setMsg("Limite de 8 MB por imagem.");
    setBusy(true);
    setMsg("Preparando imagem…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("removeBg", String(removeBg));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw Error((await readError(res)) || "Falha no envio.");
      set("imageUrl", (await res.json()).url);
      setMsg("");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!item.imageUrl) return setMsg("Adicione uma foto da peça.");
    if (codes.includes(item.code.trim()))
      return setMsg("Já existe uma peça com este código.");
    setBusy(true);
    setMsg("Salvando…");
    const ok = await onSave({
      ...item,
      id: item.id || crypto.randomUUID(),
      code: item.code.trim(),
      title: item.title.trim(),
      specs: item.specs.trim(),
      description: item.description.trim(),
    });
    setBusy(false);
    if (ok) onClose();
    else setMsg("Não foi possível salvar. Revise os campos.");
  }
  return (
    <div className="part-overlay" data-lenis-prevent onClick={() => !busy && onClose()}>
      <form
        className="part-dialog part-editor"
        ref={ref as React.RefObject<HTMLFormElement & HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-label={part.id ? "Editar peça" : "Cadastrar peça"}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="part-dialog-top tiny-mono">
          <span>{part.id ? `${part.code} / EDIÇÃO` : "NOVA PEÇA / CADASTRO"}</span>
          <button type="button" onClick={onClose} disabled={busy}>
            FECHAR ×
          </button>
        </div>
        <label
          className={"part-inspect-image editor-drop" + (drag ? " dragging" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void upload(e.dataTransfer.files?.[0]);
          }}
        >
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="Prévia da peça" />
          ) : (
            <strong className="editor-drop-empty">
              Arraste a foto aqui
              <br />
              ou clique para escolher
            </strong>
          )}
          <span className="tiny-mono">
            {busy && msg.startsWith("Preparando")
              ? "ENVIANDO…"
              : item.imageUrl
                ? "TROCAR FOTO ↗"
                : "JPG, PNG OU WEBP · ATÉ 8 MB"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <div className="part-dialog-copy editor-fields">
          <label className="editor-check tiny-mono">
            <input
              type="checkbox"
              checked={removeBg}
              onChange={(e) => setRemoveBg(e.target.checked)}
            />
            Remover fundo branco ao enviar
          </label>
          <div className="editor-row">
            <label>
              <span className="tiny-mono">Código</span>
              <input
                required
                maxLength={40}
                value={item.code}
                onChange={(e) => set("code", e.target.value)}
                placeholder="USB-CH-09"
              />
            </label>
            <fieldset>
              <legend className="tiny-mono">Categoria</legend>
              {[
                ["cilindros", "Cilindro"],
                ["blocos", "Bloco"],
              ].map(([v, l]) => (
                <button
                  type="button"
                  key={v}
                  aria-pressed={item.category === v}
                  className={item.category === v ? "selected" : ""}
                  onClick={() => set("category", v)}
                >
                  {l}
                </button>
              ))}
            </fieldset>
          </div>
          <label>
            <span className="tiny-mono">Especificações</span>
            <input
              required
              maxLength={300}
              value={item.specs}
              onChange={(e) => set("specs", e.target.value)}
            />
          </label>
          <label>
            <span className="tiny-mono">Nome da peça</span>
            <textarea
              className="editor-title"
              required
              rows={2}
              maxLength={200}
              value={item.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Cilindro hidráulico…"
            />
          </label>
          <label>
            <span className="tiny-mono">Descrição</span>
            <textarea
              required
              rows={4}
              maxLength={4000}
              value={item.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <label className="editor-check tiny-mono">
            <input
              type="checkbox"
              checked={item.featured}
              onChange={(e) => set("featured", e.target.checked)}
            />
            Destacar no início do catálogo
          </label>
          <p role="status" aria-live="polite" className="editor-msg">
            {msg}
          </p>
          <div className="editor-actions">
            <button className="solid-link" disabled={busy}>
              {part.id ? "Salvar alterações" : "Cadastrar peça"} ↗
            </button>
            {part.id && (
              <button
                type="button"
                className="danger-link"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`Excluir “${part.title}” do catálogo?`)) return;
                  setBusy(true);
                  const ok = await onDelete(part);
                  setBusy(false);
                  if (ok) onClose();
                  else setMsg("Não foi possível excluir.");
                }}
              >
                Excluir peça
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

const companyFields: [string, string, string?][] = [
  ["name", "Nome da empresa"],
  ["Tagline", "Slogan"],
  ["headline", "Mensagem institucional"],
  ["subheadline", "Subtítulo do topo"],
  ["phoneDisplay", "Telefone visível"],
  ["whatsapp", "WhatsApp (somente números, com DDI)", "tel"],
  ["email", "E-mail", "email"],
  ["instagram", "Instagram (usuário)"],
  ["city", "Cidade / UF"],
  ["experienceYears", "Anos de experiência"],
];

export function CompanyPanel({
  company,
  lenis,
  onSave,
  onClose,
}: {
  company: Company;
  lenis: { stop(): void; start(): void } | null;
  onSave: (c: Company) => Promise<boolean>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(company),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  useModal(true, ref, () => !busy && onClose(), lenis);
  return (
    <div className="part-overlay" data-lenis-prevent onClick={() => !busy && onClose()}>
      <form
        ref={ref as React.RefObject<HTMLFormElement & HTMLDivElement>}
        className="part-dialog company-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Dados da empresa"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!/^\d{10,15}$/.test(form.whatsapp))
            return setMsg("WhatsApp: use de 10 a 15 dígitos, ex.: 555136969839.");
          setBusy(true);
          setMsg("Salvando…");
          const ok = await onSave(
            Object.fromEntries(
              Object.entries(form).map(([k, v]) => [k, v.trim()]),
            ),
          );
          setBusy(false);
          if (ok) onClose();
          else setMsg("Não foi possível salvar. Revise os campos.");
        }}
      >
        <div className="part-dialog-top tiny-mono">
          <span>EMPRESA / CONTATOS</span>
          <button type="button" onClick={onClose} disabled={busy}>
            FECHAR ×
          </button>
        </div>
        <div className="company-grid">
          {companyFields.map(([key, label, type]) => (
            <label key={key}>
              <span className="tiny-mono">{label}</span>
              <input
                required
                type={type === "email" ? "email" : "text"}
                inputMode={type === "tel" ? "numeric" : undefined}
                maxLength={key === "whatsapp" ? 15 : 300}
                value={form[key] ?? ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          {["aboutParagraph1", "aboutParagraph2", "aboutParagraph3"].map((key, i) => (
            <label key={key} className="wide">
              <span className="tiny-mono">Apresentação — parágrafo {i + 1}</span>
              <textarea
                required
                rows={3}
                maxLength={4000}
                value={form[key] ?? ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <p role="status" aria-live="polite" className="editor-msg">
          {msg}
        </p>
        <div className="editor-actions">
          <button className="solid-link" disabled={busy}>
            Salvar dados ↗
          </button>
        </div>
      </form>
    </div>
  );
}

export function EditBar({
  editing,
  setEditing,
  state,
  onCompany,
  onAdd,
  onLogout,
}: {
  editing: boolean;
  setEditing: (v: boolean) => void;
  state: SaveState;
  onCompany: () => void;
  onAdd: () => void;
  onLogout: () => void;
}) {
  const status =
    state.kind === "saving"
      ? "Salvando…"
      : state.kind === "saved"
        ? "Alterações publicadas"
        : state.kind === "error"
          ? state.message
          : editing
            ? "Clique nos textos destacados para editar"
            : "Visualizando como visitante";
  return (
    <div className={"edit-bar" + (editing ? " on" : "")} role="region" aria-label="Edição do site">
      <button
        className="edit-switch"
        aria-pressed={editing}
        onClick={() => setEditing(!editing)}
      >
        <i />
        {editing ? "Editando" : "Editar site"}
      </button>
      <span className={"edit-status " + state.kind} role="status" aria-live="polite">
        {status}
        {state.kind === "error" && state.expired && (
          <a href="/admin">Entrar novamente ↗</a>
        )}
      </span>
      {editing && (
        <>
          <button onClick={onAdd}>+ Nova peça</button>
          <button onClick={onCompany}>Empresa e contatos</button>
        </>
      )}
      <button className="edit-logout" onClick={onLogout}>
        Sair
      </button>
    </div>
  );
}
