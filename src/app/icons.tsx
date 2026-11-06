// General-purpose line icons, drawn on a 24-unit grid in the same stroke as the site's glyphs.
// The names are shared with the server rules (ICON_NAMES in site-actions.mjs).
const paths: Record<string, React.ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  alerta: <path d="M12 3.5 2.8 19.5h18.4L12 3.5ZM12 10v4.5M12 17v.4" />,
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" />
    </>
  ),
  ferias: (
    <>
      <circle cx="16.5" cy="6.5" r="2.5" />
      <path d="M3 20.5h18M6 20.5c.5-4 2.5-7.5 6-9.5M12 11c-2.6-1.4-5.6-1-7.5.8M12 11c-.2-2.8-2-5-4.6-5.8M12 11c1.6 2.2 2 5.6 1.4 9.5" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  feriado: (
    <>
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  telefone: <path d="M5 3.8h3.4l1.7 4.3-2.2 1.4a11 11 0 0 0 6.6 6.6l1.4-2.2 4.3 1.7V19a1.6 1.6 0 0 1-1.7 1.6A16.6 16.6 0 0 1 3.4 5.5 1.6 1.6 0 0 1 5 3.8Z" />,
  whatsapp: (
    <>
      <path d="M4 20l1.2-3.8A8.5 8.5 0 1 1 8 19.1L4 20Z" />
      <path d="M9 8.2c.2-.5.5-.6.9-.6h.5l1 2.3-.7.9a5.3 5.3 0 0 0 2.5 2.5l.9-.7 2.3 1v.5c0 .4-.1.7-.6.9a3.6 3.6 0 0 1-3.3-.6 9 9 0 0 1-3.3-3.3A3.6 3.6 0 0 1 9 8.2Z" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>
  ),
  local: (
    <>
      <path d="M12 21s-6.5-6-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.3" />
    </>
  ),
  caminhao: (
    <>
      <path d="M2.5 6h11v10h-11zM13.5 9.5h4l3 3.5V16h-7" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  engrenagem: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9" />
      <circle cx="12" cy="12" r="6.6" />
    </>
  ),
  ferramenta: <path d="M14.5 6.5a4 4 0 0 0 5.2 4.8l-9.4 9.4a2 2 0 0 1-2.9-2.9l9.4-9.4a4 4 0 0 0-4.8-5.2l2.6 2.6-.5 2.1-2.1.5-2.6-2.6" />,
  fabrica: <path d="M2.5 20.5v-9l5 3v-3l5 3v-3l5 3V4h3v16.5zM6 17.5h2M10.5 17.5h2M15 17.5h2" />,
  escudo: <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6L12 3Zm-3.2 9 2.3 2.3 4.2-4.6" />,
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7.8 12.3 2.8 2.8 5.6-6" />
    </>
  ),
  estrela: <path d="m12 3.5 2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7L12 3.5Z" />,
  raio: <path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6l1-8Z" />,
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c.4-3.6 2.9-6 6-6s5.6 2.4 6 6M16 5a3 3 0 0 1 0 6M17.5 14.3c2 .7 3.3 2.8 3.5 5.7" />
    </>
  ),
  documento: <path d="M6 2.8h8l4.5 4.5v13.9H6zM14 2.8v4.5h4.5M9 12h6.5M9 15.5h6.5M9 8.5h2.5" />,
};
export const ICON_LABELS: Record<string, string> = {
  info: "Informação",
  alerta: "Atenção",
  calendario: "Calendário",
  ferias: "Férias",
  relogio: "Horário",
  feriado: "Feriado",
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
  local: "Endereço",
  caminhao: "Entrega",
  engrenagem: "Engrenagem",
  ferramenta: "Ferramenta",
  fabrica: "Fábrica",
  escudo: "Garantia",
  check: "Confirmado",
  estrela: "Destaque",
  raio: "Rapidez",
  pessoas: "Equipe",
  documento: "Documento",
};
export const ICONS = Object.keys(paths);

export function Icon({ name, className = "ico" }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] ?? paths.info}
    </svg>
  );
}

/* Small grid to pick an icon (editor and notice panel). */
export function IconPicker({ value, onPick }: { value?: string; onPick: (name: string) => void }) {
  return (
    <div className="icon-picker" role="listbox" aria-label="Ícones">
      {ICONS.map((n) => (
        <button key={n} type="button" role="option" aria-selected={n === value} title={ICON_LABELS[n]} aria-label={ICON_LABELS[n]} onClick={() => onPick(n)}>
          <Icon name={n} />
        </button>
      ))}
    </div>
  );
}
