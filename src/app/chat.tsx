"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { askAi, type AiStatus } from "./assistant";
import { CopyContext } from "./copy";
import { PhotoEditorModal } from "./photo-editor";
import { AUTO_ACTIONS, describeAction } from "@/lib/site-actions.mjs";

export type ChatAction = { name: string; args: Record<string, unknown> };
export type ChatSite = {
  sections: { id: string; type: string; name: string; hidden: boolean; blocks?: { id: string; kind: string; text: string }[] }[];
  removables: { key: string; label: string; hidden: boolean }[];
  notice?: object;
  products: { id: string; code: string; title: string; category: string; featured: boolean; specs?: string; description?: string }[];
  services?: { id: string; title: string; lead: string; copy: string; category: string }[];
  sectors?: { id: string; name: string; code: string }[];
  pillars?: { id: string; title: string; desc: string }[];
  process?: { label: string; title: string; copy: string }[];
  styles?: Record<string, unknown>;
  company: Record<string, string>;
  socials: { network: string; url: string }[];
  images: { target: string; label: string }[];
};
type Photo = { id: string; name: string; file: File; preview: string; inline: { mimeType: string; data: string } };
type Item = { action: ChatAction; state?: "running" | "applied" | "ignored" | "error"; note?: string; issue?: string; before?: string };
type Msg = { role: "user" | "assistant"; text: string; photos?: string[]; items?: Item[]; failed?: boolean };

const MAX_PHOTOS = 8;
const STATE_TEXT = { applied: "aplicada", ignored: "ignorada pelo administrador", error: "falhou", running: "em andamento" } as const;

// The photo as the model sees it: small JPEG on white (enough to recognise a part, light to send).
async function inline(file: File) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 896 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.8);
  return { mimeType: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}

/* Editing chat: the admin asks in plain words, the assistant answers and prepares actions. */
export function ChatPanel({
  open,
  ai,
  site,
  run,
  runBatch,
  canUndo = false,
  onUndo,
  show: reveal,
  onClose,
}: {
  open: boolean;
  ai: AiStatus;
  site: ChatSite;
  run: (action: ChatAction, files: Map<string, File>) => Promise<string>;
  runBatch: (actions: ChatAction[], files: Map<string, File>) => Promise<string[]>;
  canUndo?: boolean;
  onUndo?: () => void;
  show: (target: { section?: string; key?: string }) => void;
  onClose: () => void;
}) {
  const { fields } = useContext(CopyContext);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState("");
  const [ideas, setIdeas] = useState(false);
  const [drag, setDrag] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const list = useRef<HTMLOListElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const afterPick = useRef("");

  useEffect(() => {
    try {
      if (localStorage.getItem("usibar-ai-auto") === "0") setAutoMode(false);
    } catch {}
  }, []);

  // The page's texts as the server accepts them: up to 200, about 40 000 characters in all.
  const texts = () => {
    let total = 0;
    return [...fields.current.values()]
      .map((f) => ({ key: f.key, label: f.label.slice(0, 120), text: (f.el.textContent || f.get()).trim() }))
      .filter((f) => f.text.length > 1 && f.text.length <= 4000 && (total += f.text.length) <= 39000)
      .slice(0, 200);
  };
  const fullSite = () => ({ ...site, images: site.images.slice(0, 80), attachments: photos.map((p) => ({ id: p.id, name: p.name.slice(0, 120) })) });
  const describe = (a: ChatAction) => describeAction(a, fullSite(), texts());
  const photo = (id: unknown) => photos.find((p) => p.id === id);
  // On a phone the panel covers the page, so showing something folds it into a slim bar.
  const show = (target: { section?: string; key?: string }) => {
    if (matchMedia("(max-width: 700px)").matches) setCollapsed(true);
    reveal(target);
  };

  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy]);
  const previews = useRef<Photo[]>([]);
  previews.current = photos;
  useEffect(() => () => previews.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  async function attach(files: FileList | File[]) {
    const room = MAX_PHOTOS - photos.length;
    const chosen = [...files].filter((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type)).slice(0, room);
    if (!chosen.length) {
      if (room <= 0) note(`Esta conversa já tem ${MAX_PHOTOS} fotos. Comece uma conversa nova para enviar mais.`);
      else note("Envie fotos JPG, PNG ou WebP.");
      return;
    }
    const added: Photo[] = [];
    for (const [i, file] of chosen.entries()) {
      if (file.size > 8 * 1024 * 1024) {
        note(`${file.name}: limite de 8 MB por foto.`);
        continue;
      }
      try {
        added.push({ id: `foto-${photos.length + added.length + 1}`, name: file.name || `foto ${i + 1}`, file, preview: URL.createObjectURL(file), inline: await inline(file) });
      } catch {
        note(`Não consegui abrir ${file.name}.`);
      }
    }
    if (!added.length) return;
    setPhotos((p) => [...p, ...added]);
    setPending((p) => [...p, ...added.map((a) => a.id)]);
    if (afterPick.current) {
      setInput(afterPick.current);
      afterPick.current = "";
    }
    box.current?.focus();
  }
  const note = (text: string) => setMessages((m) => [...m, { role: "assistant", text, failed: true }]);

  // What the model reads of the conversation: texts, plus what happened to each proposed action.
  const transcript = (m: Msg) => {
    if (m.role === "user") return m.text + (m.photos?.length ? `\n[Fotos anexadas nesta mensagem: ${m.photos.join(", ")}]` : "");
    const acts = (m.items ?? []).map((it) => `- ${describe(it.action)} — ${it.state ? STATE_TEXT[it.state] : "aguardando o administrador"}${it.note && it.state === "error" ? `: ${it.note}` : ""}`);
    return [m.text, acts.length ? `Ações propostas:\n${acts.join("\n")}` : ""].filter(Boolean).join("\n\n");
  };

  async function send(text: string) {
    const clean = text.trim();
    if (busy || (!clean && !pending.length)) return;
    const user: Msg = { role: "user", text: clean || "O que posso fazer com esta foto?", photos: pending };
    const history = [...messages, user];
    setMessages(history);
    setInput("");
    setPending([]);
    setIdeas(false);
    setBusy("Pensando…");
    try {
      const sent = history.filter((m) => !m.failed).slice(-30);
      const res = await askAi<{ reply: string; actions: ChatAction[]; dropped: number }>({
        action: "chat",
        messages: sent.map((m) => ({
          role: m.role,
          text: transcript(m).slice(0, 6000),
          images: m.photos?.map((id) => photo(id)?.inline).filter(Boolean),
        })),
        site: fullSite(),
        texts: texts(),
      });
      const auto = res.actions.filter((a) => AUTO_ACTIONS.has(a.name));
      const rawItems: Item[] = res.actions
        .filter((a) => !AUTO_ACTIONS.has(a.name))
        .map((action) => {
          const f = typeof action.args.key === "string" ? fields.current.get(action.args.key) : undefined;
          return { action, before: f ? f.el.textContent || f.get() : undefined, state: autoMode ? "running" : undefined };
        });
      const reply =
        res.reply ||
        (rawItems.length
          ? autoMode
            ? `Executando ${rawItems.length === 1 ? "a alteração solicitada" : `${rawItems.length} tarefas em sequência`}…`
            : "Preparei estas alterações. Confira e aplique:"
          : auto.length
            ? ""
            : "Não entendi bem o que mudar. Pode explicar de outro jeito?");
      const dropped = res.dropped ? `\n\n(${res.dropped === 1 ? "Uma ação foi descartada" : `${res.dropped} ações foram descartadas`} por não corresponder ao site atual.)` : "";
      let msgIndex = -1;
      if (reply || rawItems.length) {
        msgIndex = history.length;
        setMessages([...history, { role: "assistant", text: reply + dropped, items: rawItems }]);
      }
      if (autoMode && rawItems.length && msgIndex >= 0) {
        setBusy(rawItems.length > 1 ? `Aplicando ${rawItems.length} tarefas…` : "Aplicando alteração…");
        const files = new Map(photos.map((p) => [p.id, p.file]));
        try {
          const notes = await runBatch(
            rawItems.map((it) => it.action),
            files,
          );
          setMessages((all) =>
            all.map((m, i) =>
              i === msgIndex ? { ...m, items: m.items?.map((it, j) => ({ ...it, state: "applied", note: notes[j] || "Aplicada" })) } : m,
            ),
          );
        } catch (e) {
          const err = (e as Error).message;
          setMessages((all) =>
            all.map((m, i) => (i === msgIndex ? { ...m, items: m.items?.map((it) => ({ ...it, state: "error", note: err })) } : m)),
          );
        }
      }
      for (const a of auto) {
        if (a.name === "show_on_site") show(a.args as { section?: string; key?: string });
        if (a.name === "review_texts") await review();
      }
    } catch (e) {
      note((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function review() {
    setBusy("Revisando os textos… (pode levar até um minuto)");
    try {
      const res = await askAi<{ summary: string; suggestions: { key: string; issue: string; suggestion: string }[] }>({ action: "review", fields: texts() });
      const items: Item[] = res.suggestions.map((s) => {
        const f = fields.current.get(s.key);
        return {
          action: { name: "set_text", args: { key: s.key, text: s.suggestion } },
          issue: s.issue,
          before: f ? f.el.textContent || f.get() : undefined,
        };
      });
      setMessages((m) => [
        ...m,
        { role: "assistant", text: [res.summary, items.length ? "Sugestões de mudança:" : "Nenhuma mudança necessária: os textos estão consistentes."].filter(Boolean).join("\n\n"), items },
      ]);
    } catch (e) {
      note((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const setItem = (mi: number, ii: number, patch: Partial<Item>) =>
    setMessages((all) => all.map((m, i) => (i === mi ? { ...m, items: m.items?.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : m)));
  async function apply(mi: number, ii: number) {
    const it = messages[mi].items?.[ii];
    if (!it || it.state === "running" || it.state === "applied") return;
    setItem(mi, ii, { state: "running", note: "" });
    try {
      const files = new Map(photos.map((p) => [p.id, p.file]));
      setItem(mi, ii, { state: "applied", note: await run(it.action, files) });
    } catch (e) {
      setItem(mi, ii, { state: "error", note: (e as Error).message });
    }
  }
  async function applyAll(mi: number) {
    const items = messages[mi].items ?? [];
    const pendingIdx = items.map((it, i) => (!it.state || it.state === "error" ? i : -1)).filter((i) => i >= 0);
    if (!pendingIdx.length) return;
    if (pendingIdx.length === 1) {
      await apply(mi, pendingIdx[0]);
      return;
    }
    const idxSet = new Set(pendingIdx);
    setMessages((all) =>
      all.map((m, i) => (i === mi ? { ...m, items: m.items?.map((it, j) => (idxSet.has(j) ? { ...it, state: "running", note: "" } : it)) } : m)),
    );
    const files = new Map(photos.map((p) => [p.id, p.file]));
    try {
      const notes = await runBatch(
        pendingIdx.map((i) => items[i].action),
        files,
      );
      const noteByIdx = new Map(pendingIdx.map((idx, k) => [idx, notes[k] || "Aplicada"]));
      setMessages((all) =>
        all.map((m, i) =>
          i === mi ? { ...m, items: m.items?.map((it, j) => (noteByIdx.has(j) ? { ...it, state: "applied", note: noteByIdx.get(j) } : it)) } : m,
        ),
      );
    } catch {
      for (const i of pendingIdx) await apply(mi, i);
    }
  }

  const first = (type: string) => site.sections.find((s) => s.type === type)?.name;
  const ideasList: [string, string?][] = [
    ["O que você consegue fazer no site?"],
    ["Cadastrar 2 cilindros e 1 bloco hidráulico novos em lote"],
    ["Esticar o subtítulo do topo para ocupar mais largura na tela"],
    ["Criar e publicar uma seção completa sobre a linha agrícola"],
    ["Cadastrar uma peça nova com foto recortando o fundo", "Cadastre esta peça no catálogo recortando o fundo."],
    ["Trocar a foto do topo", "Use esta foto como a foto grande do topo do site, recortando o fundo."],
    ["Revisar todos os textos da página"],
    first("sectors") && first("solutions") ? [`Mover “${first("sectors")}” para logo depois de “${first("solutions")}”`] : ["Mudar a ordem das seções"],
    ["Adicionar um novo segmento atendido e atualizar o WhatsApp"],
    ["Deixar o título do topo mais comercial"],
    ["Mudar a cor do título do catálogo para laranja"],
    ["Adicionar o LinkedIn da empresa"],
    ["Avisar sobre as férias coletivas de fim de ano"],
  ];
  const photoIdeas: [string, string?][] = [
    ["Cadastre como peça nova no catálogo, recortando o fundo"],
    ["Use como foto do topo do site"],
    ["Troque a foto de uma peça do catálogo por esta"],
    ["Crie uma galeria com estas fotos"],
  ];
  const pick = (idea: [string, string?]) => {
    if (idea[1]) {
      afterPick.current = idea[1];
      picker.current?.click();
    } else void send(idea[0]);
  };

  // Closing keeps the conversation: the panel stays mounted while the editor is on.
  if (!open) return null;
  if (collapsed)
    return (
      <aside className="chat-panel collapsed" aria-label="Assistente de edição">
        <button onClick={() => setCollapsed(false)}>✦ Voltar ao assistente</button>
      </aside>
    );
  const editingPhoto = editingPhotoId ? photo(editingPhotoId) : undefined;
  return (
    <>
    <aside
      className={"chat-panel" + (drag ? " drag" : "")}
      role="dialog"
      aria-label="Assistente de edição"
      data-lenis-prevent
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void attach(e.dataTransfer.files);
      }}
      onKeyDown={(e) => e.key === "Escape" && !busy && onClose()}
    >
      <header className="chat-top">
        <span>✦ Assistente do site</span>
        {ai?.configured && (
          <button
            type="button"
            className={"chat-auto" + (autoMode ? " on" : "")}
            aria-pressed={autoMode}
            title={
              autoMode
                ? "Modo autônomo ativo: aplica alterações e múltiplas tarefas na hora (clique para aprovar manualmente)"
                : "Modo manual: prepara as ações para você revisar antes de aplicar (clique para ativar autonomia)"
            }
            onClick={() => {
              const next = !autoMode;
              setAutoMode(next);
              try {
                localStorage.setItem("usibar-ai-auto", next ? "1" : "0");
              } catch {}
            }}
          >
            ⚡ {autoMode ? "Autônoma" : "Manual"}
          </button>
        )}
        {messages.length > 0 && (
          <button
            disabled={!!busy}
            onClick={() => {
              photos.forEach((p) => URL.revokeObjectURL(p.preview));
              setMessages([]);
              setPending([]);
              setPhotos([]);
            }}
          >
            Nova conversa
          </button>
        )}
        <button onClick={onClose} aria-label="Fechar o assistente">
          ×
        </button>
      </header>

      {!ai?.configured ? (
        <div className="chat-empty">
          <h2>A IA ainda não está configurada.</h2>
          <p>
            Defina <code>GEMINI_API_KEY</code> nas variáveis de ambiente do servidor (na Vercel: Settings → Environment Variables) e publique de novo.
          </p>
        </div>
      ) : (
        <>
          <ol className="chat-log" ref={list} aria-live="polite">
            {messages.length === 0 && (
              <li className="chat-empty">
                <h2>Peça uma ou várias tarefas de uma vez.</h2>
                <p>
                  {autoMode
                    ? "No modo ⚡ Autônoma, a assistente realiza edições, cadastros em lote, cria seções e ajusta larguras/posições automaticamente. Tudo pode ser desfeito em “↶ Desfazer”."
                    : "No modo Manual, a assistente prepara a lista de alterações para você aplicar com um clique. Tudo pode ser desfeito em “↶ Desfazer”."}
                </p>
                <Ideas list={ideasList} onPick={pick} />
              </li>
            )}
            {messages.map((m, mi) => (
              <li key={mi} className={`chat-msg ${m.role}` + (m.failed ? " failed" : "")}>
                {m.photos && m.photos.length > 0 && (
                  <span className="chat-thumbs">
                    {m.photos.map((id) => (
                      <img key={id} src={photo(id)?.preview} alt={id} title={id} />
                    ))}
                  </span>
                )}
                {m.text && <p>{m.text}</p>}
                {m.items && m.items.length > 0 && (
                  <div className="chat-actions">
                    <ol>
                      {m.items.map((it, ii) => {
                        const a = it.action.args;
                        const field = typeof a.key === "string" ? fields.current.get(a.key) : undefined;
                        const img = photo(a.image);
                        const prevText = it.before ?? (field ? field.el.textContent || field.get() : undefined);
                        return (
                          <li key={ii} className={it.state ?? ""}>
                            <span className="chat-act-title">
                              {typeof a.color === "string" && <i className="chat-swatch" style={{ background: a.color }} aria-hidden="true" />}
                              {describe(it.action)}
                            </span>
                            {it.issue && <span className="chat-act-issue">{it.issue}</span>}
                            {it.action.name === "set_text" && (
                              <span className="chat-diff" lang="pt-BR">
                                {prevText && prevText !== String(a.text) && <del>{prevText}</del>}
                                <ins>{String(a.text)}</ins>
                              </span>
                            )}
                            {img && <img className="chat-act-photo" src={img.preview} alt={img.id} />}
                            <span className="chat-act-row">
                              {it.state === "applied" ? (
                                <em>✓ {it.note || "Aplicada"}</em>
                              ) : it.state === "ignored" ? (
                                <em>Ignorada</em>
                              ) : it.state === "running" ? (
                                <em>Aplicando…</em>
                              ) : (
                                <>
                                  {it.state === "error" && <em className="err">{it.note}</em>}
                                  <button className="primary" onClick={() => apply(mi, ii)}>
                                    {it.state === "error" ? "Tentar de novo" : "Aplicar"}
                                  </button>
                                  <button onClick={() => setItem(mi, ii, { state: "ignored" })}>Ignorar</button>
                                </>
                              )}
                              {field && (
                                <button className="link" onClick={() => show({ key: field.key })}>
                                  Ver no site
                                </button>
                              )}
                              {typeof a.section === "string" && it.action.name !== "remove_section" && (
                                <button className="link" onClick={() => show({ section: String(a.section) })}>
                                  Ver no site
                                </button>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                    {m.items.filter((it) => !it.state || it.state === "error").length > 1 && (
                      <button className="primary all" onClick={() => applyAll(mi)}>
                        Aplicar todas ({m.items.filter((it) => !it.state || it.state === "error").length})
                      </button>
                    )}
                    {m.items.some((it) => it.state === "applied") && (
                      <span className="chat-undo-row">
                        <small>Tudo salvo no site.</small>
                        {canUndo && onUndo && (
                          <button type="button" className="link" onClick={onUndo}>
                            ↶ Desfazer última alteração
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
            {busy && <li className="chat-msg assistant busy">{busy}</li>}
          </ol>

          {pending.length > 0 && !busy && <Ideas list={photoIdeas} onPick={pick} compact />}
          {ideas && messages.length > 0 && <Ideas list={ideasList} onPick={pick} compact />}

          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            {pending.length > 0 && (
              <span className="chat-pending">
                {pending.map((id) => (
                  <span key={id}>
                    <img src={photo(id)?.preview} alt="" />
                    {id}
                    <button
                      type="button"
                      aria-label={`Editar ${id}`}
                      title="Recortar, redimensionar ou nivelar foto"
                      onClick={() => setEditingPhotoId(id)}
                    >
                      ✎
                    </button>
                    <button type="button" aria-label={`Tirar ${id}`} onClick={() => setPending((p) => p.filter((x) => x !== id))}>
                      ×
                    </button>
                  </span>
                ))}
              </span>
            )}
            <textarea
              ref={box}
              rows={2}
              value={input}
              maxLength={4000}
              placeholder={pending.length ? "O que fazer com a foto? (ou envie para a IA sugerir)" : "Ex.: mova a seção Segmentos para cima"}
              aria-label="Mensagem para o assistente"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              onPaste={(e) => {
                const files = [...e.clipboardData.files];
                if (files.length) {
                  e.preventDefault();
                  void attach(files);
                }
              }}
            />
            <span className="chat-tools">
              <button type="button" onClick={() => picker.current?.click()} disabled={!!busy || photos.length >= MAX_PHOTOS} title="Anexar foto">
                + Foto
              </button>
              <button type="button" onClick={() => setIdeas(!ideas)} aria-pressed={ideas} disabled={messages.length === 0}>
                ✦ Ideias
              </button>
              <button className="primary" disabled={!!busy || (!input.trim() && !pending.length)}>
                Enviar ↗
              </button>
            </span>
            <input
              ref={picker}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) void attach([...files]);
                e.target.value = "";
              }}
            />
          </form>
        </>
      )}
    </aside>
    {editingPhoto && (
      <PhotoEditorModal
        source={editingPhoto.file}
        label={editingPhoto.id}
        onClose={() => setEditingPhotoId(null)}
        onApply={async (editedFile) => {
          const nextPreview = URL.createObjectURL(editedFile);
          const nextInline = await inline(editedFile);
          setPhotos((all) =>
            all.map((p) => {
              if (p.id !== editingPhoto.id) return p;
              URL.revokeObjectURL(p.preview);
              return { ...p, file: editedFile, preview: nextPreview, inline: nextInline };
            }),
          );
          setEditingPhotoId(null);
        }}
      />
    )}
    </>
  );
}

function Ideas({ list, onPick, compact = false }: { list: [string, string?][]; onPick: (i: [string, string?]) => void; compact?: boolean }) {
  return (
    <div className={"chat-ideas" + (compact ? " compact" : "")}>
      {list.map((i) => (
        <button key={i[0]} type="button" onClick={() => onPick(i)}>
          {i[1] ? "＋ " : ""}
          {i[0]}
        </button>
      ))}
    </div>
  );
}
