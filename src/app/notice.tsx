"use client";
import { useRef, useState } from "react";
import { noticeActive } from "@/lib/site-actions.mjs";
import { useModal } from "./editing";
import { Icon, IconPicker } from "./icons";
import type { Notice } from "./sections";

// The visitor's own calendar day (YYYY-MM-DD), so the notice starts at local midnight.
export const today = () => new Date().toLocaleDateString("sv-SE");
const COOKIE = "usibar-aviso";
const br = (d: string) => d.split("-").reverse().join("/");

/** Should this visitor see the notice now? Once per notice version, only inside its period. */
export function noticeDue(n: Notice | undefined) {
  if (!n || !noticeActive(n, today())) return false;
  return !document.cookie.split("; ").some((c) => c === `${COOKIE}=${n.version}`);
}
// Remembered until the notice ends, so a new notice (new version) is always shown again.
function remember(n: Notice) {
  const end = new Date(`${n.end}T23:59:59`);
  const seconds = Math.max(3600, Math.round((end.getTime() - Date.now()) / 1000) + 86400);
  document.cookie = `${COOKIE}=${n.version}; path=/; max-age=${seconds}; SameSite=Lax`;
}

export function NoticeModal({ notice, whatsapp, lenis, preview = false, onClose }: { notice: Notice; whatsapp: string; lenis: { stop(): void; start(): void } | null; preview?: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = () => {
    if (!preview) remember(notice);
    onClose();
  };
  useModal(true, ref, close, lenis);
  return (
    <div className="part-overlay notice-overlay" data-lenis-prevent onClick={close}>
      <div ref={ref} className="notice-card" role="dialog" aria-modal="true" aria-labelledby="notice-title" onClick={(e) => e.stopPropagation()}>
        <span className="notice-icon">
          <Icon name={notice.icon} />
        </span>
        <span className="eyebrow">
          AVISO · {br(notice.start)}
          {notice.end !== notice.start && ` A ${br(notice.end)}`}
        </span>
        <h2 id="notice-title">{notice.title}</h2>
        <p>{notice.text}</p>
        <div className="notice-actions">
          <button className="btn-solid" onClick={close}>
            {notice.button || "Entendi"}
          </button>
          <a className="notice-wa" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" /> Falar pelo WhatsApp
          </a>
        </div>
        {preview && <small className="notice-preview">Pré-visualização: fechar aqui não marca o aviso como visto.</small>}
      </div>
    </div>
  );
}

const year = new Date().getFullYear();
const PRESETS: [string, Omit<Notice, "enabled" | "version">][] = [
  [
    "Férias coletivas",
    {
      icon: "ferias",
      title: "Férias coletivas",
      text: `A Usibar estará em férias coletivas de 22/12 a 05/01. Retornamos o atendimento em 06/01. Pedidos de orçamento enviados neste período serão respondidos no retorno.`,
      start: `${year}-12-15`,
      end: `${year + 1}-01-05`,
      button: "Entendi",
    },
  ],
  ["Feriado", { icon: "feriado", title: "Feriado", text: "Não haverá expediente no feriado. Retornamos o atendimento no próximo dia útil.", start: today(), end: today() }],
  ["Horário especial", { icon: "relogio", title: "Horário especial", text: "Neste período o atendimento será das 8h às 12h.", start: today(), end: today() }],
  ["Comunicado", { icon: "info", title: "Comunicado", text: "Escreva aqui o comunicado aos clientes.", start: today(), end: today() }],
];

export function NoticePanel({ notice, whatsapp, lenis, onSave, onClose }: { notice?: Notice; whatsapp: string; lenis: { stop(): void; start(): void } | null; onSave: (n: Notice) => Promise<boolean>; onClose: () => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<Notice>(notice ?? { enabled: true, version: "novo", ...PRESETS[0][1] });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useModal(!preview, ref as React.RefObject<HTMLElement | null>, () => !busy && onClose(), lenis);
  const set = (p: Partial<Notice>) => setForm((f) => ({ ...f, ...p }));
  const t = today();
  const status = !form.enabled ? "Desligado" : t < form.start ? `Agendado: aparece a partir de ${br(form.start)}` : t > form.end ? "Encerrado (o período já passou)" : `No ar até ${br(form.end)}`;
  if (preview) return <NoticeModal notice={form} whatsapp={whatsapp} lenis={null} preview onClose={() => setPreview(false)} />;
  return (
    <div className="part-overlay" data-lenis-prevent onClick={() => !busy && onClose()}>
      <form
        ref={ref}
        className="part-dialog notice-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Aviso ao abrir o site"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!form.title.trim() || !form.text.trim()) return setMsg("Preencha o título e a mensagem.");
          if (!form.start || !form.end || form.start > form.end) return setMsg("Confira as datas: o fim não pode ser antes do início.");
          setBusy(true);
          setMsg("Salvando…");
          // A changed message gets a new version, so visitors who closed the old one see it again.
          const changed = !notice || ["title", "text", "start", "end", "icon"].some((k) => notice[k as keyof Notice] !== form[k as keyof Notice]);
          const ok = await onSave({ ...form, title: form.title.trim(), text: form.text.trim(), button: form.button?.trim() || undefined, version: changed ? crypto.randomUUID().slice(0, 8) : form.version });
          setBusy(false);
          if (ok) onClose();
          else setMsg("Não foi possível salvar. Revise os campos.");
        }}
      >
        <div className="part-dialog-top tiny-mono">
          <span>AVISO AO ABRIR O SITE</span>
          <button type="button" onClick={onClose} disabled={busy}>
            FECHAR ×
          </button>
        </div>
        <p className="picker-note">Aparece uma vez para cada visitante dentro do período escolhido; um aviso novo ou alterado volta a aparecer para todos.</p>
        <div className="notice-presets">
          {PRESETS.map(([name, p]) => (
            <button key={name} type="button" onClick={() => set(p)}>
              <Icon name={p.icon} /> {name}
            </button>
          ))}
        </div>
        <div className="company-grid">
          <label className="wide notice-switch">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Aviso ligado — <strong>{status}</strong>
          </label>
          <div className="wide">
            <span className="tiny-mono">Ícone</span>
            <IconPicker value={form.icon} onPick={(icon) => set({ icon })} />
          </div>
          <label className="wide">
            <span className="tiny-mono">Título</span>
            <input value={form.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label className="wide">
            <span className="tiny-mono">Mensagem</span>
            <textarea rows={4} value={form.text} maxLength={1000} onChange={(e) => set({ text: e.target.value })} />
          </label>
          <label>
            <span className="tiny-mono">Aparece a partir de</span>
            <input type="date" value={form.start} onChange={(e) => set({ start: e.target.value })} />
          </label>
          <label>
            <span className="tiny-mono">Até (inclusive)</span>
            <input type="date" value={form.end} onChange={(e) => set({ end: e.target.value })} />
          </label>
          <label>
            <span className="tiny-mono">Botão de fechar</span>
            <input value={form.button ?? ""} maxLength={40} placeholder="Entendi" onChange={(e) => set({ button: e.target.value })} />
          </label>
        </div>
        <p role="status" aria-live="polite" className="editor-msg">
          {msg}
        </p>
        <div className="editor-actions">
          <button type="button" className="ghost-link" onClick={() => setPreview(true)}>
            Pré-visualizar
          </button>
          <button className="solid-link" disabled={busy}>
            Salvar aviso ↗
          </button>
        </div>
      </form>
    </div>
  );
}
