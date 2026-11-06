"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminCall, authFetch, changeMyPassword, type AdminRow } from "@/lib/browser-auth";

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
  | { kind: "idle" | "saving" }
  | { kind: "saved"; message?: string }
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

export { Editable } from "./copy";

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
      const res = await authFetch("/api/upload", { method: "POST", body: fd });
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

type Social = { id: string; network: string; url: string };
const NETWORKS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X (Twitter)",
  site: "Site",
};

const companyFields: [string, string, string?][] = [
  ["name", "Nome da empresa"],
  ["Tagline", "Slogan"],
  ["motto", "Lema (topo do site)"],
  ["headline", "Mensagem institucional"],
  ["subheadline", "Subtítulo do topo"],
  ["phoneDisplay", "Telefone visível"],
  ["whatsapp", "WhatsApp (somente números, com DDI)", "tel"],
  ["email", "E-mail", "email"],
  ["instagram", "Instagram (usuário)"],
  ["address", "Endereço (rua, número, bairro)"],
  ["city", "Cidade / UF"],
  ["zip", "CEP"],
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
  const { socials: initialSocials, ...fields } = company as Company & { socials?: unknown };
  const [form, setForm] = useState<Company>(fields as Company),
    [socials, setSocials] = useState<Social[]>(
      Array.isArray(initialSocials)
        ? (initialSocials as Social[])
        : company.instagram
          ? [{ id: "instagram", network: "instagram", url: `https://instagram.com/${company.instagram}` }]
          : [],
    ),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  useModal(true, ref, () => !busy && onClose(), lenis);
  const setSocial = (i: number, patch: Partial<Social>) => setSocials(socials.map((x, j) => (j === i ? { ...x, ...patch } : x)));
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
          if (form.zip && !/^\d{5}-?\d{3}$/.test(form.zip.trim())) return setMsg("CEP: use o formato 00000-000.");
          const links = socials.map((x) => ({ ...x, url: x.url.trim() })).filter((x) => x.url);
          const bad = links.find((x) => !/^https:\/\/[^\s"'<>]+$/.test(x.url));
          if (bad) return setMsg(`${NETWORKS[bad.network] ?? "Rede"}: o link deve começar com https://`);
          setBusy(true);
          setMsg("Salvando…");
          const ok = await onSave({
            ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])),
            socials: links,
          } as unknown as Company);
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
          <fieldset className="wide socials-editor">
            <legend className="tiny-mono">Redes sociais (aparecem com ícone no contato e no rodapé)</legend>
            {socials.map((x, i) => (
              <div key={x.id} className="social-row">
                <select value={x.network} onChange={(e) => setSocial(i, { network: e.target.value })} aria-label="Rede">
                  {Object.entries(NETWORKS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input
                  value={x.url}
                  maxLength={300}
                  placeholder="https://…"
                  aria-label={`Link do ${NETWORKS[x.network] ?? "perfil"}`}
                  onChange={(e) => setSocial(i, { url: e.target.value })}
                />
                <button type="button" className="danger-link" onClick={() => setSocials(socials.filter((_, j) => j !== i))}>
                  Remover
                </button>
              </div>
            ))}
            {socials.length < 10 && (
              <button
                type="button"
                className="ghost-link add-social"
                onClick={() => setSocials([...socials, { id: crypto.randomUUID(), network: "facebook", url: "" }])}
              >
                + Adicionar rede
              </button>
            )}
          </fieldset>
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

const storageLabel: Record<string, string> = {
  supabase: "no Supabase",
  file: "neste computador",
};

export function EditBar({
  editing,
  setEditing,
  state,
  storage,
  canUndo,
  onUndo,
  hint,
  onHintClose,
  onCompany,
  onAdmins,
  onAdd,
  onCurate,
  onLogout,
}: {
  editing: boolean;
  setEditing: (v: boolean) => void;
  state: SaveState;
  storage: string;
  canUndo: boolean;
  onUndo: () => void;
  hint: boolean;
  onHintClose: () => void;
  onCompany: () => void;
  onAdmins?: () => void;
  onAdd: () => void;
  onCurate: () => void;
  onLogout: () => void;
}) {
  const where = storageLabel[storage] ?? `em ${storage}`;
  const status =
    state.kind === "saving"
      ? "Salvando…"
      : state.kind === "saved"
        ? `${state.message ?? "Alteração publicada"} · salvo ${where}`
        : state.kind === "error"
          ? state.message
          : editing
            ? `Cada alteração é publicada na hora, ${where}`
            : "Visualizando como visitante";
  return (
    <div className={"edit-bar" + (editing ? " on" : "")} role="region" aria-label="Edição do site">
      {editing && hint && (
        <div className="edit-hint" role="note">
          <strong>Como editar</strong>
          <ul>
            <li>Textos com contorno tracejado: clique e digite. Enter confirma, Esc cancela.</li>
            <li>Ao clicar num texto, uma barra permite mudar cor e tamanho e pedir sugestões à IA.</li>
            <li>“✦ Assistente IA” abre um chat: peça em palavras (mover seções, trocar fotos, cadastrar peças…) e aplique com um clique.</li>
            <li>Cada seção tem controles para subir, descer, ocultar ou excluir; “+ Inserir seção” adiciona novas.</li>
            <li>Peças: clique no cartão para editar; “+ Nova peça” para cadastrar.</li>
            <li>Errou? Use “Desfazer” ou Ctrl+Z — vale também para exclusões.</li>
          </ul>
          <button onClick={onHintClose}>Entendi</button>
        </div>
      )}
      <button className="edit-switch" aria-pressed={editing} onClick={() => setEditing(!editing)}>
        <i />
        {editing ? "Editando" : "Editar site"}
      </button>
      <span className={"edit-status " + state.kind} role="status" aria-live="polite">
        {status}
        {state.kind === "error" && state.expired && <a href="/admin">Entrar novamente ↗</a>}
      </span>
      {editing && (
        <>
          <button onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
            ↶ Desfazer
          </button>
          <button onClick={onAdd}>+ Nova peça</button>
          <button onClick={onCompany}>Empresa e contatos</button>
          <button className="edit-ai" onClick={onCurate}>
            ✦ Assistente IA
          </button>
          {onAdmins && <button onClick={onAdmins}>Administradores</button>}
        </>
      )}
      <button className="edit-logout" onClick={onLogout}>
        Sair
      </button>
    </div>
  );
}

// Who may edit this site, and the signed-in admin's own password.
export function AdminsPanel({
  lenis,
  onClose,
}: {
  lenis: { stop(): void; start(): void } | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [admins, setAdmins] = useState<AdminRow[] | null>(null),
    [email, setEmail] = useState(""),
    [pw, setPw] = useState(""),
    [pw2, setPw2] = useState(""),
    [mine, setMine] = useState(""),
    [mine2, setMine2] = useState(""),
    [confirmRemove, setConfirmRemove] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  useModal(true, ref, () => !busy && onClose(), lenis);
  const load = useCallback(async () => {
    try {
      setAdmins((await adminCall<{ admins: AdminRow[] }>("list")).admins);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    setMsg("");
    try {
      setMsg(await work());
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="part-overlay" data-lenis-prevent onClick={() => !busy && onClose()}>
      <div
        ref={ref}
        className="part-dialog company-panel admins-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Administradores"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="part-dialog-top tiny-mono">
          <span>ADMINISTRADORES</span>
          <button type="button" onClick={onClose} disabled={busy}>
            FECHAR ×
          </button>
        </div>
        <ul className="admins-list" aria-busy={!admins}>
          {admins?.length === 0 && <li className="tiny-mono">Nenhum administrador cadastrado ainda.</li>}
          {admins?.map((a) => (
            <li key={a.email}>
              <span>{a.email}</span>
              {confirmRemove === a.email ? (
                <span className="admins-confirm">
                  <span>Remover o acesso?</span>
                  <button
                    type="button"
                    className="danger-link"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await adminCall("remove", { email: a.email });
                        setConfirmRemove(null);
                        await load();
                        return `${a.email} não administra mais o site.`;
                      })
                    }
                  >
                    Sim, remover
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirmRemove(null)}>
                    Cancelar
                  </button>
                </span>
              ) : (
                <button type="button" disabled={busy} onClick={() => setConfirmRemove(a.email)}>
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="company-grid"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.length < 10) return setMsg("A senha precisa de ao menos 10 caracteres.");
            if (pw !== pw2) return setMsg("As senhas não coincidem.");
            void run(async () => {
              const r = await adminCall<{ existingAccount?: boolean }>("add", {
                email: email.trim(),
                password: pw,
              });
              const who = email.trim();
              setEmail("");
              setPw("");
              setPw2("");
              await load();
              return r.existingAccount
                ? `${who} já tinha conta e agora administra o site. A pessoa mantém a senha atual dela.`
                : `${who} foi adicionado(a). Passe a senha informada por um canal seguro.`;
            });
          }}
        >
          <label className="wide">
            <span className="tiny-mono">Novo administrador — e-mail</span>
            <input type="email" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            <span className="tiny-mono">Senha (mín. 10 caracteres)</span>
            <input type="password" required minLength={10} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          <label>
            <span className="tiny-mono">Confirmar senha</span>
            <input type="password" required minLength={10} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </label>
          <div className="editor-actions wide">
            <button className="solid-link" disabled={busy}>
              Adicionar administrador ↗
            </button>
          </div>
        </form>
        <form
          className="company-grid"
          onSubmit={(e) => {
            e.preventDefault();
            if (mine.length < 10) return setMsg("A nova senha precisa de ao menos 10 caracteres.");
            if (mine !== mine2) return setMsg("As senhas não coincidem.");
            void run(async () => {
              await changeMyPassword(mine);
              setMine("");
              setMine2("");
              return "Sua senha foi alterada.";
            });
          }}
        >
          <label>
            <span className="tiny-mono">Alterar minha senha — nova senha</span>
            <input type="password" required minLength={10} autoComplete="new-password" value={mine} onChange={(e) => setMine(e.target.value)} />
          </label>
          <label>
            <span className="tiny-mono">Confirmar nova senha</span>
            <input type="password" required minLength={10} autoComplete="new-password" value={mine2} onChange={(e) => setMine2(e.target.value)} />
          </label>
          <div className="editor-actions wide">
            <button className="solid-link" disabled={busy}>
              Alterar minha senha ↗
            </button>
          </div>
        </form>
        <p role="status" aria-live="polite" className="editor-msg">
          {msg}
        </p>
      </div>
    </div>
  );
}
