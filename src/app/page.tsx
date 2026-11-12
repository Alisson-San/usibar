"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { ProcessSection, type Step } from "./ProcessSection";
import { authFetch, hasStoredSession, isAdmin, signOut } from "@/lib/browser-auth";
import {
  AdminsPanel,
  blankPart,
  CompanyPanel,
  EditBar,
  Editable,
  ProductEditor,
  readError,
  useModal,
  type Part,
  type SaveState,
} from "./editing";
import { CopyContext, ImageSwap, Removable, T, type Field, type PhotoEditorOpts, type TextStyle } from "./copy";
import { PhotoEditorModal } from "./photo-editor";
import { TextToolbar, type AiStatus } from "./assistant";
import { ChatPanel, type ChatAction, type ChatSite } from "./chat";
import { NoticeModal, NoticePanel, NoticeStrip, noticeDue } from "./notice";
import { applyAction, COMPANY_FIELDS } from "@/lib/site-actions.mjs";
import {
  BlockBar,
  blockDom,
  BUILTIN_INFO,
  BUILTINS,
  defaultLayout,
  isBuiltin,
  SectionPicker,
  TEMPLATE_INFO,
  TEMPLATES,
  TemplateSection,
  type Block,
} from "./blocks";
import { LogoFull } from "./logo";
import {
  Arrow,
  ContactCard,
  emptyQuote,
  Glyph,
  HERO_IMAGE,
  HeroArt,
  Pillars,
  ProofBar,
  QuoteBuilder,
  SectorIcon,
  SiteFooter,
  socialsOf,
  Solutions,
  type Content,
  type Ed,
  type Quote,
} from "./sections";

type Undo = { label: string; before: Content };

const defaultProcess: Step[] = [
  {
    label: "O desenho",
    title: "Projeto conforme a aplicação.",
    copy: "Geometria, fixações e conexões definidas conforme as especificações do equipamento e do circuito hidráulico.",
  },
  {
    label: "A usinagem",
    title: "Usinagem de blocos hidráulicos.",
    copy: "Usinagem de cavidades, furos e conexões para integrar os componentes do circuito hidráulico em um bloco.",
  },
  {
    label: "O movimento",
    title: "Cilindros de simples e dupla ação.",
    copy: "Cilindros fabricados conforme a aplicação, com curso, dimensões e fixações definidos em projeto.",
  },
];
// Sections as numbered sheets: header, cylinder navigation, index menu and footer all follow
// the visible sections in the order the admin chose.
type NavItem = { id: string; n: string; label: string; hint: string };
function buildNav(c: Content): NavItem[] {
  return c.layout
    .filter((b) => !b.hidden)
    .map((b, i) => {
      const n = String(i + 1).padStart(2, "0");
      if (isBuiltin(b.type)) {
        const info = BUILTIN_INFO[b.type];
        return { id: info.dom, n, label: c.copy[`nav.${b.type}`] ?? info.nav, hint: c.copy[`nav.${b.type}.hint`] ?? info.hint };
      }
      return { id: blockDom(b), n, label: String(b.data?.nav ?? TEMPLATE_INFO[b.type].name), hint: String(b.data?.title ?? "") };
    });
}
// The top label of the hero: key, editor label and default (empty = the company's city).
const HERO_EYEBROW: [string, string, string][] = [
  ["hero.eyebrow", "Topo — rótulo", "FABRICAÇÃO SOB MEDIDA"],
  ["hero.city", "Topo — cidade", ""],
  ["hero.country", "Topo — país", "BRASIL"],
];
const knownType = (t: unknown) => (BUILTINS as readonly unknown[]).includes(t) || (TEMPLATES as readonly unknown[]).includes(t);
// Facts that may be missing from content saved before they existed.
const companyDefaults = {
  address: "Rua Martin Biancho, 803 — Bairro Bela Vista",
  zip: "95730-000",
};
// The server could not read the saved content and served the copy shipped with the code;
// editing stays paused so that copy never overwrites the real data.
const staleMessage = (reason: unknown) =>
  (reason === "certificate"
    ? "O servidor não confiou no certificado da conexão com o Supabase (proxy da rede?)."
    : reason === "network" || reason === "timeout"
      ? "O servidor não conseguiu ler o conteúdo no Supabase."
      : "O conteúdo salvo não pôde ser lido agora.") + " A edição está pausada; recarregue a página depois de resolver.";
const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
const safeStorage = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k) ?? localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string, session = false) => {
    try {
      (session ? sessionStorage : localStorage).setItem(k, v);
    } catch {}
  },
};

export default function UsibarHome() {
  const [content, setContent] = useState<Content | null>(null),
    [failed, setFailed] = useState(false),
    [filter, setFilter] = useState("all"),
    [activeId, setActiveId] = useState<string | null>(null),
    [menu, setMenu] = useState(false),
    [zoom, setZoom] = useState(false),
    [section, setSection] = useState(""),
    [quote, setQuote] = useState<Quote>(emptyQuote),
    [logged, setLogged] = useState(false),
    [storage, setStorage] = useState("file"),
    [accounts, setAccounts] = useState(false),
    [adminsOpen, setAdminsOpen] = useState(false),
    [editing, setEditing] = useState(false),
    [save, setSave] = useState<SaveState>({ kind: "idle" }),
    [undo, setUndo] = useState<Undo[]>([]),
    [hint, setHint] = useState(false),
    [editorPart, setEditorPart] = useState<Part | null>(null),
    [companyOpen, setCompanyOpen] = useState(false),
    [activeField, setActiveField] = useState<Field | null>(null),
    [aiStatus, setAiStatus] = useState<AiStatus>(null),
    [chatOpen, setChatOpen] = useState(false),
    [noticeShown, setNoticeShown] = useState(false),
    [noticeEdit, setNoticeEdit] = useState(false),
    [pickerAt, setPickerAt] = useState<number | null>(null),
    [photoJob, setPhotoJob] = useState<({ source: File | string } & PhotoEditorOpts) | null>(null),
    [waHello, setWaHello] = useState(false);
  const root = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    meter = useRef<HTMLElement>(null),
    counter = useRef<HTMLSpanElement>(null),
    cursor = useRef<HTMLDivElement>(null),
    cylNav = useRef<HTMLElement>(null),
    indexRef = useRef<HTMLDivElement>(null),
    lenisRef = useRef<Lenis | null>(null),
    contentRef = useRef<Content | null>(null),
    savedRef = useRef<Content | null>(null),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    stale = useRef(""),
    fields = useRef(new Map<string, Field>()),
    uploaded = useRef(new WeakMap<File, Record<string, string>>()),
    removables = useRef(new Map<string, string>()),
    loaded = !!content;
  const nav = content ? buildNav(content) : [];
  const navKey = nav.map((n) => n.id).join("|");

  useEffect(() => {
    fetch("/api/company", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        const c: Content = {
          company: { ...companyDefaults, ...d.company },
          products: d.products,
          sectors: d.sectors ?? [],
          process: d.process?.length === 3 ? d.process : defaultProcess,
          services: d.services ?? [],
          pillars: d.pillars ?? [],
          copy: d.copy ?? {},
          styles: d.styles ?? {},
          hidden: Array.isArray(d.hidden) ? d.hidden : [],
          notice: d.notice,
          layout: Array.isArray(d.layout) && d.layout.length && d.layout.every((b: Block) => knownType(b?.type)) ? d.layout : defaultLayout(),
        };
        contentRef.current = savedRef.current = c;
        if (d.stale === true) {
          stale.current = staleMessage(d.staleReason);
          setSave({ kind: "error", message: stale.current });
        }
        setContent(c);
      })
      .catch(() => setFailed(true));
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then(async (a) => {
        if (a.demoMode) return;
        let ok = !!a.authenticated;
        // Supabase mode: restore the admin session only if this browser has one.
        if (!ok && a.login === "supabase" && hasStoredSession()) ok = await isAdmin();
        if (!ok) return;
        setLogged(true);
        setStorage(a.storage ?? "file");
        fetch("/api/ai", { cache: "no-store" })
          .then((r) => r.json())
          .then(setAiStatus)
          .catch(() => setAiStatus({ configured: false }));
        setAccounts(a.login === "supabase");
        const url = new URL(location.href);
        if (url.searchParams.has("editar")) {
          setEditing(true);
          url.searchParams.delete("editar");
          history.replaceState(null, "", url.pathname + url.search + url.hash);
        }
      })
      .catch(() => {});
  }, []);

  // Each confirmed change is published at once, in order. A failure restores the
  // last version the server accepted; a success can be undone from the edit bar.
  const commit = useCallback((label: string, change: (c: Content) => Content, recordUndo = true) => {
    // Content served from the bundled copy (store unreachable) must never overwrite the real data.
    if (stale.current) {
      setSave({ kind: "error", message: stale.current });
      return Promise.resolve(false);
    }
    const before = contentRef.current!;
    const next = change(before);
    contentRef.current = next;
    setContent(next);
    setSave({ kind: "saving" });
    const run = async () => {
      try {
        const res = await authFetch("/api/company", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok)
          throw Object.assign(Error((await readError(res)) || "Não foi possível salvar."), {
            expired: res.status === 401,
          });
        savedRef.current = next;
        if (recordUndo) setUndo((u) => [...u.slice(-19), { label, before }]);
        setSave({ kind: "saved", message: label });
        return true;
      } catch (e) {
        if (contentRef.current === next) {
          contentRef.current = savedRef.current;
          setContent(savedRef.current);
        }
        setSave({
          kind: "error",
          message:
            e instanceof TypeError
              ? "Sem conexão com o servidor. Alteração desfeita."
              : `${(e as Error).message} Alteração desfeita.`,
          expired: (e as { expired?: boolean }).expired,
        });
        return false;
      }
    };
    const p = queue.current.then(run);
    queue.current = p;
    return p;
  }, []);
  // Photo upload for the in-place "Trocar foto" controls; errors show in the edit bar.
  const upload = useCallback(async (file: File, removeBg = false) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setSave({ kind: "error", message: "Envie uma imagem JPG, PNG ou WebP." });
      return null;
    }
    setSave({ kind: "saving" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (removeBg) fd.append("removeBg", "true");
      const res = await authFetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw Error((await readError(res)) || "Falha no envio da imagem.");
      return (await res.json()).url as string;
    } catch (e) {
      setSave({ kind: "error", message: e instanceof TypeError ? "Sem conexão com o servidor." : (e as Error).message });
      return null;
    }
  }, []);
  const undoLast = useCallback(() => {
    setUndo((u) => {
      const last = u[u.length - 1];
      if (!last) return u;
      void commit(`Desfeito: ${last.label.toLowerCase()}`, () => last.before, false);
      return u.slice(0, -1);
    });
  }, [commit]);

  useEffect(() => {
    if (save.kind !== "saved") return;
    const t = setTimeout(() => setSave({ kind: "idle" }), 6000);
    return () => clearTimeout(t);
  }, [save]);
  // The opening notice (holidays and the like) waits for the intro, and never interrupts editing.
  useEffect(() => {
    if (!content?.notice || editing || !noticeDue(content.notice)) return;
    const t = setTimeout(() => setNoticeShown(true), 2600);
    return () => clearTimeout(t);
  }, [loaded, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.documentElement.classList.toggle("chat-open", editing && chatOpen);
  }, [editing, chatOpen]);
  useEffect(() => {
    document.documentElement.classList.toggle("is-editing", editing);
    if (editing && !safeStorage.get("usibar-edit-hint")) setHint(true);
  }, [editing]);
  useEffect(() => {
    if (!logged) return;
    const key = (e: KeyboardEvent) => {
      if (!editing || typing(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undoLast();
      }
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (save.kind === "saving") e.preventDefault();
    };
    addEventListener("keydown", key);
    addEventListener("beforeunload", leave);
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("beforeunload", leave);
    };
  }, [logged, editing, undoLast, save.kind]);

  // Header: shows the section in view, and steps aside while reading downwards.
  useEffect(() => {
    if (!loaded) return;
    const ids = navKey.split("|").filter(Boolean);
    const seen = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setSection(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) seen.observe(el);
    });
    let frame = 0;
    // Tone of the page at a point, looking past the floating header, rail and WhatsApp button.
    const toneAt = (x: number, y: number) =>
      document
        .elementsFromPoint(x, y)
        .find((el) => !el.closest(".site-header, .cyl-nav, .wa-float"))
        ?.closest<HTMLElement>("[data-tone]")?.dataset.tone;
    // The navigation rod reaches station i when section i is at the reading line.
    const rod = () => {
      frame = 0;
      const line = scrollY + innerHeight * 0.45;
      const tops = ids.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? 0).map((t) => t + scrollY);
      let p = 0;
      for (let i = 0; i < tops.length; i++) {
        const next = tops[i + 1] ?? document.body.scrollHeight;
        if (line >= tops[i]) p = i + Math.min(1, (line - tops[i]) / Math.max(1, next - tops[i]));
      }
      // The floating logo takes its light version only while it is entirely over a dark area
      // (light cards inside dark sections carry data-tone="light").
      const brand = document.querySelector(".site-header .brand")?.getBoundingClientRect();
      if (brand) {
        const y = brand.top + brand.height / 2;
        const dark = [0.15, 0.5, 0.85].every((f) => toneAt(brand.left + brand.width * f, y) === "dark");
        document.querySelector(".site-header")?.classList.toggle("on-dark", dark);
      }
      const rail = cylNav.current;
      if (!rail) return;
      rail.style.setProperty("--p", String(Math.min(1, p / Math.max(1, ids.length - 1))));
      // The rail switches to its light treatment over dark sections, so it never fights the text.
      rail.classList.toggle("on-dark", toneAt(innerWidth - 130, innerHeight / 2) === "dark");
    };
    rod();
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(rod);
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      seen.disconnect();
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [loaded, navKey]);

  useEffect(() => {
    if (!loaded) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    const repeat = safeStorage.get("usibar-intro") === "1";
    safeStorage.set("usibar-intro", "1", true);
    const ctx = gsap.context(() => {
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(".hc-line", { strokeDasharray: 1, strokeDashoffset: 1 });
        const intro = gsap.timeline();
        if (repeat) gsap.set(".intro-shutter", { display: "none" });
        else {
          const count = { value: 0 };
          // The big logo of the opening flies into its place in the header.
          const flight = () => {
            const from = root.current!.querySelector(".intro-logo svg")!.getBoundingClientRect();
            const to = root.current!.querySelector(".site-header .brand-logo")!.getBoundingClientRect();
            return {
              x: to.left + to.width / 2 - (from.left + from.width / 2),
              y: to.top + to.height / 2 - (from.top + from.height / 2),
              scale: to.width / from.width,
            };
          };
          let f = { x: 0, y: 0, scale: 1 };
          gsap.set(".site-header, .cyl-nav", { opacity: 0 });
          intro
            .from(".intro-logo", { opacity: 0, scale: 0.92, duration: 0.6, ease: "power3.out" })
            .to(
              count,
              {
                value: 100,
                duration: 0.9,
                ease: "power2.inOut",
                onUpdate: () => {
                  const v = Math.round(count.value);
                  if (meter.current) meter.current.style.transform = `scaleX(${v / 100})`;
                  if (counter.current) counter.current.textContent = String(v).padStart(3, "0");
                },
              },
              "-=.2",
            )
            .to(".intro-meter, .intro-info", { opacity: 0, duration: 0.3 })
            .add(() => {
              f = flight();
            })
            .to(".intro-logo", { x: () => f.x, y: () => f.y, scale: () => f.scale, duration: 1, ease: "expo.inOut" })
            .to(".intro-shutter", { backgroundColor: "rgba(238, 231, 220, 0)", duration: 0.7, ease: "power2.inOut" }, "<+.25")
            .set(".site-header, .cyl-nav", { opacity: 1 })
            .set(".intro-shutter", { display: "none" })
            .add(() => {
              setWaHello(true);
              setTimeout(() => setWaHello(false), 5200);
            });
        }
        intro
          .from(".site-header .main-nav > a, .site-header .header-contact, .site-header .menu-toggle", { opacity: 0, y: -12, stagger: 0.05, duration: 0.6, ease: "power3.out" }, repeat ? 0 : "-=.3")
          .from(".hero-title .line-inner", { yPercent: 115, rotate: 3, stagger: 0.09, duration: 1.05, ease: "expo.out" }, "-=.7")
          .from(".hero-target", { scale: 0.7, opacity: 0, svgOrigin: "262 176", duration: 1.4, ease: "expo.out" }, "-=1")
          .from(".hero-part", { y: 50, x: 40, opacity: 0, duration: 1.4, ease: "expo.out" }, "<")
          .from(".hero-eyebrow, .hero-lead, .hero-note, .hero-actions", { y: 24, opacity: 0, stagger: 0.08, duration: 0.8, ease: "power3.out" }, "-=1.1")
          .to(".hc-line", { strokeDashoffset: 0, stagger: 0.14, duration: 0.7, ease: "power2.inOut" }, "-=.6")
          .from(".hc-dot", { scale: 0, transformOrigin: "50% 50%", stagger: 0.14, duration: 0.4, ease: "back.out(3)" }, "<")
          .from(".hc-label", { opacity: 0, x: -8, stagger: 0.14, duration: 0.5 }, "<+.3")
          .from(".proof-bar li", { y: 30, opacity: 0, stagger: 0.08, duration: 0.8, ease: "power3.out" }, "-=.8");
        gsap.to(".hero-part", { y: -8, duration: 3.2, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 3 });
        gsap.to(".hero-target", { rotation: 360, svgOrigin: "262 176", duration: 90, repeat: -1, ease: "none" });
        gsap.fromTo(
          ".hc-ring",
          { scale: 0.6, opacity: 0.9, transformOrigin: "50% 50%" },
          { scale: 1.8, opacity: 0, duration: 1.8, repeat: -1, stagger: 0.5, ease: "power1.out", delay: 3.4 },
        );
        gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) =>
          gsap.from(el, { y: 50, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } }),
        );
        for (const sel of [".solution-card", ".product-card", ".sector-tile"]) {
          gsap.set(sel, { y: 60, opacity: 0 });
          ScrollTrigger.batch(sel, {
            start: "top 92%",
            once: true,
            onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, stagger: 0.09, duration: 1, ease: "expo.out", overwrite: true }),
          });
        }
        gsap.utils.toArray<HTMLElement>(".solution-figure img").forEach((img) =>
          gsap.fromTo(img, { yPercent: 6 }, { yPercent: -6, ease: "none", scrollTrigger: { trigger: img, start: "top bottom", end: "bottom top", scrub: true } }),
        );
        gsap.fromTo(
          ".origin-image > img",
          { scale: 1.18, yPercent: -6 },
          { scale: 1.04, yPercent: 6, ease: "none", scrollTrigger: { trigger: ".origin", start: "top bottom", end: "bottom top", scrub: true } },
        );
        return () => intro.kill();
      });

      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference) and (pointer: fine)", () => {
        const hero = root.current!.querySelector<HTMLElement>(".hero")!;
        const px = gsap.quickTo(".hero-part", "x", { duration: 1.2, ease: "power3" }),
          tx = gsap.quickTo(".hero-target", "x", { duration: 1.6, ease: "power3" });
        const move = (e: PointerEvent) => {
          const nx = e.clientX / innerWidth - 0.5;
          px(nx * 18);
          tx(nx * -10);
        };
        hero.addEventListener("pointermove", move);
        // A label follows the pointer over the catalog, so a card reads as clickable.
        const grid = root.current!.querySelector<HTMLElement>(".product-grid")!;
        const cx = gsap.quickTo(cursor.current, "x", { duration: 0.35, ease: "power3" }),
          cy = gsap.quickTo(cursor.current, "y", { duration: 0.35, ease: "power3" });
        const track = (e: PointerEvent) => {
          cursor.current?.classList.toggle("on", !!(e.target as HTMLElement).closest(".product-card"));
          cx(e.clientX);
          cy(e.clientY);
        };
        const out = () => cursor.current?.classList.remove("on");
        grid.addEventListener("pointermove", track);
        grid.addEventListener("pointerleave", out);
        return () => {
          hero.removeEventListener("pointermove", move);
          grid.removeEventListener("pointermove", track);
          grid.removeEventListener("pointerleave", out);
        };
      });

      // Docking: as reading starts, each item of the header menu travels to its station on the
      // cylinder at the side, which becomes the page index. The logo never leaves: it only settles
      // into a smaller badge in the corner.
      mm.add("(min-width: 1100px) and (prefers-reduced-motion: no-preference)", () => {
        const r = root.current!;
        r.classList.add("docking");
        const labels = gsap.utils.toArray<HTMLElement>(".cyl-track .station-label", r);
        // From the item's place in the header to its place beside the station (both unaffected
        // by the transform being animated, so refreshes at any scroll position stay exact).
        const from = (el: HTMLElement) => {
          const btn = el.parentElement!;
          const b = btn.getBoundingClientRect();
          const rest = { x: b.left + el.offsetLeft + el.offsetWidth / 2, y: b.top + el.offsetTop + el.offsetHeight / 2 };
          const slot = r.querySelector(`.main-nav a[data-slot="${btn.dataset.id}"]`);
          if (!slot) return { x: 0, y: -30, o: 0 };
          const s = slot.getBoundingClientRect();
          return { x: s.left + s.width / 2 - rest.x, y: s.top + s.height / 2 - rest.y, o: 1 };
        };
        gsap.set(".rail-fade", { opacity: 0 });
        const dock = gsap.timeline({
          scrollTrigger: { start: 0, end: () => innerHeight * 0.55, scrub: 0.5, invalidateOnRefresh: true },
        });
        labels.forEach((el, i) =>
          dock.fromTo(
            el,
            { x: () => from(el).x, y: () => from(el).y, opacity: () => from(el).o },
            { x: 0, y: 0, opacity: 1, duration: 0.7, ease: "power2.inOut" },
            i * 0.05,
          ),
        );
        dock
          .to(".site-header .header-contact, .site-header .menu-toggle", { autoAlpha: 0, duration: 0.25 }, 0)
          .to(".site-header .header-bg", { opacity: 0, duration: 0.4 }, 0.1)
          .to(".site-header .brand", { scale: 0.82, transformOrigin: "0% 50%", duration: 0.6, ease: "power2.inOut" }, 0.2)
          .to(".site-header .brand-plate", { opacity: 1, duration: 0.3 }, 0.1)
          .to(".rail-fade", { opacity: 1, duration: 0.35, stagger: 0.02 }, 0.55);
        return () => {
          dock.kill();
          r.classList.remove("docking");
        };
      });

      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, anchors: true });
        lenisRef.current = lenis;
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        return () => {
          gsap.ticker.remove(tick);
          lenis.destroy();
          lenisRef.current = null;
        };
      });
    }, root);
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    const timer = setTimeout(refresh, 1800);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("load", refresh);
      mm.revert();
      ctx.revert();
    };
  }, [loaded]);
  useEffect(() => {
    if (!loaded) return;
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [filter, editing, loaded, navKey, content?.layout.length]);

  const parts = (content?.products ?? [])
    .filter((p) => filter === "all" || p.category === filter)
    .sort((a, b) => Number(b.featured) - Number(a.featured));
  const activeIndex = parts.findIndex((p) => p.id === activeId);
  const active = activeIndex >= 0 ? parts[activeIndex] : null;
  const step = (d: number) => parts.length && setActiveId(parts[(activeIndex + d + parts.length) % parts.length].id);
  useEffect(() => setZoom(false), [activeId]);
  useModal(!!active, dialog, () => setActiveId(null), lenisRef.current);
  useModal(menu, indexRef, () => setMenu(false), lenisRef.current);
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { duration: 1.4 });
    else el.scrollIntoView({ behavior: "smooth" });
  };

  if (!content)
    return (
      <main className="site-loading">
        <span className="eyebrow">USIBAR / COMPONENTES HIDRÁULICOS</span>
        <p>{failed ? "Não foi possível carregar o catálogo." : "Preparando a apresentação."}</p>
        {failed && <button onClick={() => location.reload()}>Tentar novamente ↗</button>}
      </main>
    );
  const { company, products, sectors, process: steps, services, pillars, layout } = content;
  const wa = (text: string) => `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(text)}`;
  const ed: Ed = (value, label, apply, key) => (
    <Editable
      value={value}
      editing={editing}
      label={label}
      styleKey={key ?? label.normalize("NFD").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 70)}
      onCommit={(v) => commit(`${label} alterado`, (c) => apply(c, v))}
    />
  );
  const text = (key: string, label: string) => ed(company[key] ?? "", label, (c, v) => ({ ...c, company: { ...c.company, [key]: v } }), `company.${key}`);
  const tx = (k: string, d: string) => content.copy[k] ?? d;
  const hidden = content.hidden ?? [];
  // A removed first item takes its separator along ("· cidade — país" never starts the line).
  const heroEyebrow = HERO_EYEBROW.filter(([k]) => !hidden.includes(k));
  const copyCtx = {
    copy: content.copy,
    styles: content.styles,
    editing,
    setText: (k: string, v: string, label: string) => commit(`${label} alterado`, (c) => ({ ...c, copy: { ...c.copy, [k]: v } })),
    setStyle: (k: string, st: TextStyle | null, label: string) =>
      commit(`Estilo de “${label}” alterado`, (c) => {
        const styles = { ...c.styles };
        if (st) styles[k] = st;
        else delete styles[k];
        return { ...c, styles };
      }),
    upload,
    openPhotoEditor: (source: File | string, opts: PhotoEditorOpts) => setPhotoJob({ source, ...opts }),
    fields,
    hidden: content.hidden,
    setHidden: (k: string, label: string, hide: boolean) =>
      commit(hide ? `“${label}” removido` : `“${label}” recolocado`, (c) => {
        const rest = c.hidden.filter((x) => x !== k);
        return { ...c, hidden: hide ? [...rest, k] : rest };
      }),
    removables,
    active: activeField,
    activate: setActiveField,
  };
  const heroImage = company.heroImageUrl || HERO_IMAGE;
  const footerNav = nav.map((n) => [`#${n.id}`, n.label] as [string, string]);

  // Section order, visibility and template sections.
  const setLayout = (label: string, change: (l: Block[]) => Block[]) => commit(label, (c) => ({ ...c, layout: change(c.layout) }));
  const updateBlock = (id: string, change: (d: Record<string, unknown>) => Record<string, unknown>, label: string) =>
    setLayout(`${label} alterado`, (l) => l.map((b) => (b.id === id ? { ...b, data: change(b.data ?? {}) } : b)));
  const blockName = (b: Block) => (isBuiltin(b.type) ? tx(`nav.${b.type}`, BUILTIN_INFO[b.type].nav) : String(b.data?.nav ?? TEMPLATE_INFO[b.type].name));
  const missing = BUILTINS.filter((t) => !layout.some((b) => b.type === t));

  // The editing chat: what it may know about the site, and how its actions are carried out.
  const chatSite: ChatSite = {
    sections: layout.map((b) => ({
      id: b.id,
      type: b.type,
      name: blockName(b).slice(0, 80),
      hidden: !!b.hidden,
      ...(b.type === "blocks"
        ? { blocks: ((b.data?.blocks as { id: string; kind: string; text?: string; title?: string }[]) ?? []).map((x) => ({ id: x.id, kind: x.kind, text: String(x.text ?? x.title ?? "").slice(0, 200) })) }
        : {}),
    })),
    removables: [...removables.current].map(([key, label]) => ({ key, label: label.slice(0, 120), hidden: content.hidden.includes(key) })),
    notice: content.notice,
    products: products.map(({ id, code, title, category, featured, specs, description }) => ({
      id,
      code: code.slice(0, 40),
      title: title.slice(0, 200),
      category,
      featured,
      specs: (specs ?? "").slice(0, 300),
      description: (description ?? "").slice(0, 1200),
    })),
    services: services.map((s) => ({
      id: s.id,
      title: s.title.slice(0, 200),
      lead: (s.lead ?? "").slice(0, 300),
      copy: (s.copy ?? "").slice(0, 1200),
      category: s.category,
    })),
    sectors: sectors.map((s) => ({ id: s.id, name: s.name.slice(0, 120), code: (s.code ?? "").slice(0, 40) })),
    pillars: pillars.map((p) => ({ id: p.id, title: p.title.slice(0, 120), desc: (p.desc ?? "").slice(0, 400) })),
    process: steps.map((s) => ({ label: s.label.slice(0, 80), title: s.title.slice(0, 200), copy: (s.copy ?? "").slice(0, 600) })),
    styles: content.styles,
    company: Object.fromEntries(Object.keys(COMPANY_FIELDS).flatMap((k) => (typeof company[k] === "string" && company[k] ? [[k, company[k]]] : []))),
    socials: socialsOf(company).map(({ network, url }) => ({ network, url })),
    images: [
      { target: "hero", label: "a foto grande do topo" },
      { target: "company", label: "a foto da seção da empresa" },
      ...services.map((x) => ({ target: `service:${x.id}`, label: `a foto da solução “${x.title.slice(0, 80)}”` })),
      ...layout.filter((b) => b.type === "text-image").map((b) => ({ target: `section:${b.id}`, label: `a foto da seção “${blockName(b).slice(0, 80)}”` })),
      ...products.map((p) => ({ target: `product:${p.id}`, label: `a foto da peça ${p.code.slice(0, 40)}` })),
    ],
  };
  const runChatBatch = async (actions: ChatAction[], files: Map<string, File>) => {
    if (!actions.length) return [];
    // Collect and upload any needed photos across the whole batch; each version of a file is sent once.
    const wanted: [string, boolean][] = [];
    for (const { name, args } of actions) {
      if (typeof args.image === "string") {
        const defaultCutout = name === "add_service" || name === "update_service";
        wanted.push([args.image, args.remove_background === undefined ? defaultCutout : args.remove_background === true]);
      }
      if (Array.isArray(args.photos)) for (const ph of args.photos as { image: string }[]) wanted.push([ph.image, false]);
      if (Array.isArray(args.blocks)) for (const b of args.blocks as { image?: string }[]) if (b.image) wanted.push([b.image, false]);
    }
    const urls = new Map<string, string>();
    for (const [id, removeBg] of wanted) {
      if (urls.has(`${id}:${removeBg}`)) continue;
      const file = files.get(id);
      if (!file) throw Error(`A foto ${id} não está mais disponível.`);
      const done = uploaded.current.get(file) ?? {};
      const kind = removeBg ? "cutout" : "plain";
      if (!done[kind]) {
        const url = await upload(file, removeBg);
        if (!url) throw Error("Não foi possível enviar a foto.");
        uploaded.current.set(file, { ...done, [kind]: url });
      }
      urls.set(`${id}:${removeBg}`, uploaded.current.get(file)![kind]);
    }
    let nextContent = contentRef.current!;
    const labels: string[] = [];
    try {
      for (const action of actions) {
        const r = applyAction(nextContent, action, {
          url: (id: string, removeBg?: boolean) => urls.get(`${id}:${!!removeBg}`),
          templateData: (type: string) => TEMPLATE_INFO[type as keyof typeof TEMPLATE_INFO].data(),
          newId: () => crypto.randomUUID().replace(/-/g, "").slice(0, 10),
          sectionName: (b: Block) => blockName(b),
        });
        nextContent = r.content;
        if (action.name === "set_text") {
          const f = fields.current.get(String(action.args.key));
          if (f) {
            f.el.textContent = String(action.args.text);
            labels.push(`Texto “${f.label}” alterado`);
            continue;
          }
        }
        labels.push(r.label);
      }
    } catch (e) {
      if (wanted.length) setSave({ kind: "idle" });
      throw e;
    }
    const summary = labels.length === 1 ? labels[0] : `${labels.length} alterações aplicadas pelo assistente`;
    if (!(await commit(summary, () => nextContent))) throw Error("O servidor recusou a alteração; ela foi desfeita.");
    return labels;
  };
  const runChatAction = async (action: ChatAction, files: Map<string, File>) => (await runChatBatch([action], files))[0];
  const showOnSite = ({ section: id, key }: { section?: string; key?: string }) => {
    const el = key ? fields.current.get(key)?.el : undefined;
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 2200);
      return;
    }
    const b = layout.find((x) => x.id === id);
    if (b) goTo(blockDom(b));
  };
  const numbers = new Map<string, string>();
  layout.filter((b) => !b.hidden).forEach((b, i) => numbers.set(b.id, String(i + 1).padStart(2, "0")));

  const catalog = (num: string) => (
    <section className="product-section" id="pecas">
      <div className="section-head reveal">
        <div>
          <span className="eyebrow">
            {num} — <T k="catalog.eyebrow" d="CATÁLOGO DE COMPONENTES" label="Catálogo — rótulo" />
          </span>
          <h2>
            <T k="catalog.title.1" d="Modelos que já produzimos." label="Catálogo — título" />
            <br />
            <em>
              <T k="catalog.title.2" d="Ponto de partida para o seu projeto." label="Catálogo — título (destaque)" />
            </em>
          </h2>
        </div>
        <Removable k="catalog.intro" label="Catálogo — introdução" block>
          <p>
            <T k="catalog.intro" d="Abra um modelo para ver detalhes, pedir cotação ou incluí-lo como referência no seu orçamento." label="Catálogo — introdução" />
          </p>
        </Removable>
      </div>
      <div className="catalog-toolbar">
        <div className="catalog-tabs" role="group" aria-label="Filtrar por categoria">
          {[
            ["all", "catalog.tab.all", "Todas as peças"],
            ["cilindros", "catalog.tab.cilindros", "Cilindros"],
            ["blocos", "catalog.tab.blocos", "Blocos"],
          ].map(([value, k, d]) => (
            <button key={value} aria-pressed={filter === value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>
              <T k={k} d={d} label="Catálogo — filtro" />
              <span>{value === "all" ? products.length : products.filter((p) => p.category === value).length}</span>
            </button>
          ))}
        </div>
        <span className="tiny-mono" aria-live="polite">
          {editing ? (
            "CLIQUE EM UMA PEÇA PARA EDITAR ↙"
          ) : (
            <>
              {parts.length} <T k="catalog.count" d="MODELOS · PRODUÇÃO CONFORME PROJETO" label="Catálogo — contador" />
            </>
          )}
        </span>
      </div>
      <div className="product-grid">
        {editing && (
          <button className="product-card product-add" onClick={() => setEditorPart({ ...blankPart, category: filter === "blocos" ? "blocos" : "cilindros" })}>
            <span className="product-add-plus" aria-hidden="true">
              +
            </span>
            <strong>Cadastrar nova peça</strong>
            <span className="tiny-mono">FOTO · NOME · DESCRIÇÃO</span>
          </button>
        )}
        {parts.map((part, i) => (
          <button
            className="product-card"
            key={part.id}
            onClick={() => (editing ? setEditorPart(part) : setActiveId(part.id))}
            aria-label={`${editing ? "Editar" : "Ver detalhes de"} ${part.title}`}
          >
            <div className="product-top tiny-mono">
              <span>{part.featured ? tx("catalog.featured", "DESTAQUE") : ""}</span>
              <span>{quote.refs.includes(part.id) ? `${tx("catalog.inquote", "NO ORÇAMENTO")} ✓` : String(i + 1).padStart(2, "0")}</span>
            </div>
            <div className="product-photo">
              <div className="product-cross one" />
              <div className="product-cross two" />
              <img loading="lazy" src={part.imageUrl} alt="" />
            </div>
            <div className="product-bottom">
              <div>
                <span className="eyebrow">{part.category === "cilindros" ? tx("catalog.cat.cilindros", "CILINDRO HIDRÁULICO") : tx("catalog.cat.blocos", "BLOCO HIDRÁULICO")}</span>
                <h3>{part.title}</h3>
                <span className="product-specs">{part.specs}</span>
              </div>
              <span className="round-arrow" aria-hidden="true">
                {editing ? "✎" : "↗"}
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="catalog-close">
        <span className="mini-cross" aria-hidden="true">
          ✳
        </span>
        <p>
          <T k="catalog.close.1" d="Não encontrou a configuração que precisa?" label="Catálogo — fechamento" />
          <br />
          <strong>
            <T k="catalog.close.2" d="Fabricamos conforme as especificações do seu projeto." label="Catálogo — fechamento (destaque)" />
          </strong>
        </p>
        <a href="#orcamento">
          <T k="catalog.close.cta" d="Enviar especificações" label="Catálogo — botão" /> <Arrow />
        </a>
      </div>
    </section>
  );

  const origin = (num: string) => (
    <section className="origin" id="origem">
      <div className="origin-image">
        <img src={company.benchImageUrl} alt="Cilindros hidráulicos fabricados pela Usibar sobre a bancada da oficina" />
        <span className="image-caption tiny-mono">
          <T k="origin.caption" d="DENTRO DA USIBAR" label="Empresa — legenda da foto" /> / {company.city}
        </span>
        <span className="image-bracket tl" />
        <span className="image-bracket br" />
        <ImageSwap src={company.benchImageUrl} label="foto da empresa" onChange={(url) => commit("Foto da empresa trocada", (c) => ({ ...c, company: { ...c.company, benchImageUrl: url } }))} />
      </div>
      <div className="origin-copy reveal">
        <span className="eyebrow">
          {num} — <T k="origin.eyebrow" d="A EMPRESA" label="Empresa — rótulo" />
        </span>
        <h2>
          <T k="origin.title.1" d="Usibar." label="Empresa — título" />
          <br />
          <em>
            <T k="origin.title.2" d="Usinagens especiais." label="Empresa — título (destaque)" />
          </em>
        </h2>
        <p>{text("aboutParagraph1", "Apresentação — parágrafo 1")}</p>
        <p>{text("aboutParagraph2", "Apresentação — parágrafo 2")}</p>
        <p>{text("aboutParagraph3", "Apresentação — parágrafo 3")}</p>
        <div className="origin-stat">
          <strong>{text("experienceYears", "Anos de experiência")}</strong>
          <span>
            <T k="origin.stat" d="ANOS DE EXPERIÊNCIA EM TECNOLOGIA HIDRÁULICA" label="Empresa — legenda do número" />
          </span>
        </div>
      </div>
      <Pillars pillars={pillars} ed={ed} />
    </section>
  );

  const sectorsSection = (num: string) => (
    <section className="sectors-section" id="segmentos" aria-labelledby="sectors-title">
      <div className="section-head reveal">
        <div>
          <span className="eyebrow" id="sectors-title">
            {num} — <T k="sectors.eyebrow" d="SEGMENTOS ATENDIDOS" label="Segmentos — rótulo" />
          </span>
          <h2>
            <T k="sectors.title.1" d="Onde nossos componentes" label="Segmentos — título" />
            <br />
            <em>
              <T k="sectors.title.2" d="trabalham todos os dias." label="Segmentos — título (destaque)" />
            </em>
          </h2>
        </div>
      </div>
      <ul className="sector-grid">
        {sectors.map((s, i) => (
          <li className="sector-tile" key={s.id}>
            <SectorIcon id={s.id} />
            <span className="tiny-mono">{String(i + 1).padStart(2, "0")}</span>
            <h3>
              {ed(
                s.name,
                `Segmento ${i + 1}`,
                (c, v) => ({ ...c, sectors: c.sectors.map((x) => (x.id === s.id ? { ...x, name: v } : x)) }),
                `sector.${s.id}.name`,
              )}
            </h3>
            {s.id === "elevadores" && (
              <span className="sector-badge">
                <T k="sectors.badge" d="Atuação de destaque" label="Segmentos — selo" />
              </span>
            )}
            {editing && (
              <button
                className="sector-remove"
                aria-label={`Remover segmento ${s.name}`}
                onClick={() => commit(`Segmento “${s.name}” removido`, (c) => ({ ...c, sectors: c.sectors.filter((x) => x.id !== s.id) }))}
              >
                ×
              </button>
            )}
          </li>
        ))}
        {editing && sectors.length < 20 && (
          <li>
            <button
              className="sector-add"
              onClick={() =>
                commit("Segmento adicionado", (c) => ({
                  ...c,
                  sectors: [...c.sectors, { id: crypto.randomUUID(), name: "Novo segmento", code: `SEC-${String(c.sectors.length + 1).padStart(2, "0")}` }],
                }))
              }
            >
              + Adicionar segmento
            </button>
          </li>
        )}
      </ul>
    </section>
  );

  const renderBlock = (b: Block, num: string) => {
    switch (b.type) {
      case "solutions":
        return (
          <Solutions
            num={num}
            services={services}
            products={products}
            ed={ed}
            apply={(change, label) => commit(label, change)}
            onBrowse={(cat) => {
              setFilter(cat);
              goTo("pecas");
            }}
            onQuote={(type) => {
              setQuote((q) => ({ ...q, type }));
              goTo("orcamento");
            }}
          />
        );
      case "process":
        return (
          <ProcessSection
            num={num}
            steps={steps}
            editing={editing}
            lenis={lenisRef}
            onEdit={(i, key, v) =>
              commit(`Texto da etapa ${i + 1} alterado`, (c) => ({ ...c, process: c.process.map((s, j) => (j === i ? { ...s, [key]: v } : s)) }))
            }
          />
        );
      case "catalog":
        return catalog(num);
      case "origin":
        return origin(num);
      case "sectors":
        return sectorsSection(num);
      case "quote":
        return <QuoteBuilder num={num} company={company} sectors={sectors} services={services} products={products} quote={quote} setQuote={setQuote} />;
      default:
        return <TemplateSection block={b} num={num} update={updateBlock} whatsapp={wa} />;
    }
  };

  return (
    <CopyContext.Provider value={copyCtx}>
      <main className={"usibar-site" + (editing ? " editing" : "")} ref={root}>
        <a className="skip-link" href="#pecas">
          {tx("skip", "Pular para o catálogo")}
        </a>
        <div className="intro-shutter" aria-hidden="true">
          <div className="intro-logo">
            <LogoFull />
          </div>
          <div className="intro-meter">
            <i ref={meter} />
          </div>
          <div className="intro-info">
            <span>TECNOLOGIA, FORÇA E DESEMPENHO</span>
            <span>
              <span ref={counter}>000</span> / 100
            </span>
          </div>
        </div>

        <header className="site-header">
          <span className="header-bg" aria-hidden="true" />
          <a className="brand" href="#inicio" aria-label="Usibar, início">
            <span className="brand-plate" aria-hidden="true" />
            <LogoFull className="brand-logo" />
          </a>
          <nav className="main-nav" aria-label="Navegação principal">
            {nav
              .filter((n) => n.id !== "orcamento")
              .slice(0, 5)
              .map((n) => (
                <a key={n.id} href={`#${n.id}`} data-slot={n.id} aria-current={section === n.id ? "location" : undefined}>
                  <small>{n.n}</small>
                  {n.label}
                </a>
              ))}
          </nav>
          <a className="header-contact" href="#orcamento" aria-current={section === "orcamento" ? "location" : undefined}>
            <T k="header.cta" d="Solicitar orçamento" label="Cabeçalho — botão" />
            {quote.refs.length > 0 ? <b className="quote-count">{quote.refs.length}</b> : <Arrow />}
          </a>
          <button className="menu-toggle" aria-expanded={menu} aria-controls="index-menu" onClick={() => setMenu(true)}>
            <i aria-hidden="true" />
            <span>{tx("header.index", "Índice")}</span>
          </button>
        </header>

        {/* The page index, drawn as a hydraulic cylinder: on wide screens the header menu travels
            here while reading, the rod extends to the current section and each station leads to one. */}
        <nav className="cyl-nav" ref={cylNav} aria-label="Índice da página">
          <span className="cyl-barrel rail-fade" aria-hidden="true">
            <i />
          </span>
          <span className="cyl-track">
            <i className="cyl-line rail-fade" aria-hidden="true" />
            <i className="cyl-rod rail-fade" aria-hidden="true" />
            <i className="cyl-eye rail-fade" aria-hidden="true" />
            {nav.map((n, i) => (
              <button
                key={n.id}
                data-id={n.id}
                style={{ top: `${(i / Math.max(1, nav.length - 1)) * 100}%` }}
                className={"station" + (section === n.id ? " on" : "")}
                aria-current={section === n.id ? "location" : undefined}
                onClick={() => goTo(n.id)}
              >
                <span className="station-label">
                  <small>{n.n}</small>
                  {n.label}
                </span>
                <i className="station-dot rail-fade" aria-hidden="true" />
              </button>
            ))}
          </span>
          <button className="rail-index rail-fade" onClick={() => setMenu(true)}>
            <i aria-hidden="true" />
            {tx("header.index", "Índice")}
          </button>
        </nav>

        <a
          className={"wa-float" + (waHello ? " hello" : "")}
          href={wa(tx("wa.float.msg", "Olá, equipe Usibar! Gostaria de falar sobre um projeto."))}
          target="_blank"
          rel="noreferrer"
          aria-label="Falar com a Usibar pelo WhatsApp"
        >
          <Glyph name="whatsapp" />
          <span>
            <T k="wa.float" d="Fale no WhatsApp" label="Botão flutuante do WhatsApp" />
          </span>
        </a>

        {menu && (
          <div className="index-menu" id="index-menu" role="dialog" aria-modal="true" aria-label={tx("header.index", "Índice")} data-lenis-prevent ref={indexRef}>
            <div className="index-top">
              <span className="index-logo">
                <LogoFull />
              </span>
              <span className="tiny-mono">{tx("index.title", "ÍNDICE DE FOLHAS")}</span>
              <button onClick={() => setMenu(false)}>{tx("index.close", "Fechar")} ×</button>
            </div>
            <ol className="index-list">
              {nav.map((n, i) => (
                <li key={n.id} style={{ "--i": i } as React.CSSProperties}>
                  <a
                    href={`#${n.id}`}
                    aria-current={section === n.id ? "location" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setMenu(false);
                      setTimeout(() => goTo(n.id), 60);
                    }}
                  >
                    <b>{n.n}</b>
                    <strong>{n.label}</strong>
                    <span>{n.hint}</span>
                  </a>
                </li>
              ))}
            </ol>
            <ContactCard company={company} />
          </div>
        )}

        <section className="hero" id="inicio">
          <div className="hero-layout">
            <div className="hero-copy">
              {/* Label, city and country are separate texts: each one is edited, styled and removed
                  on its own. The city starts from the company's city and, once edited here, stays
                  independent from the contact data. */}
              {(editing || heroEyebrow.length > 0) && (
                <span className="eyebrow hero-eyebrow">
                  {(editing ? HERO_EYEBROW : heroEyebrow).map(([k, label, d], i) => (
                    <Removable key={k} k={k} label={label}>
                      {i > 0 && (k === "hero.country" ? " — " : " · ")}
                      <T k={k} d={d || company.city || ""} label={label} />
                    </Removable>
                  ))}
                </span>
              )}
              <h1 className="hero-title">
                <span>
                  <span className="line-inner">
                    <T k="hero.title.1" d="CILINDROS" label="Título principal — linha 1" />
                  </span>
                </span>
                <span>
                  <span className="line-inner">
                    <T k="hero.title.2" d="E BLOCOS" label="Título principal — linha 2" />
                  </span>
                </span>
                <span className="accent-line">
                  <span className="line-inner">
                    <T k="hero.title.3" d="HIDRÁULICOS" label="Título principal — linha 3" />
                    <span className="title-period">.</span>
                  </span>
                </span>
              </h1>
              <Removable k="hero.lead" label="Topo — lema" block>
                <p className="hero-lead">{text("motto", "Lema da empresa")}</p>
              </Removable>
              {(editing || !hidden.includes("hero.subheadline") || !hidden.includes("hero.note")) && (
                <p className="hero-note">
                  <Removable k="hero.subheadline" label="Topo — subtítulo">
                    {text("subheadline", "Subtítulo do topo")}
                  </Removable>{" "}
                  <Removable k="hero.note" label="Topo — convite">
                    <T k="hero.note" d="Envie o desenho técnico ou as especificações da sua aplicação." label="Topo — convite" />
                  </Removable>
                </p>
              )}
              <div className="hero-actions">
                <Removable k="hero.cta.1" label="Topo — botão principal">
                  <a href="#orcamento" className="btn-primary">
                    <T k="hero.cta.1" d="Solicitar orçamento" label="Topo — botão principal" /> <Arrow />
                  </a>
                </Removable>
                <Removable k="hero.cta.2" label="Topo — botão secundário">
                  <a href="#pecas" className="btn-ghost">
                    <T k="hero.cta.2" d="Ver catálogo" label="Topo — botão secundário" /> <Arrow down />
                  </a>
                </Removable>
              </div>
            </div>
            <div className="hero-visual">
              <Removable k="hero.sheet" label="Topo — etiqueta da foto">
                <span className="sheet-tag tiny-mono">
                  <T k="hero.sheet" d="FICHA / COMPONENTE 01 · CILINDRO COM OLHAL" label="Topo — etiqueta da foto" />
                </span>
              </Removable>
              <HeroArt src={heroImage} />
              <ImageSwap src={heroImage} label="foto do topo" cutout onChange={(url) => commit("Foto do topo trocada", (c) => ({ ...c, company: { ...c.company, heroImageUrl: url } }))} />
            </div>
          </div>
          <ProofBar company={company} />
        </section>
        {content.notice && <NoticeStrip notice={content.notice} onOpen={() => (editing ? setNoticeEdit(true) : setNoticeShown(true))} />}

        {editing && (
          <button className="block-insert" onClick={() => setPickerAt(0)}>
            + Inserir seção aqui
          </button>
        )}
        {layout.map((b, i) => {
          if (b.hidden && !editing) return null;
          const num = numbers.get(b.id) ?? "··";
          return (
            <div key={b.id} className={"block" + (b.hidden ? " is-hidden" : "")} data-block={b.type}>
              {editing && (
                <BlockBar
                  block={b}
                  num={num}
                  name={blockName(b)}
                  first={i === 0}
                  last={i === layout.length - 1}
                  onMove={(dir) =>
                    setLayout(`Seção “${blockName(b)}” movida`, (l) => {
                      const next = [...l];
                      const j = i + dir;
                      [next[i], next[j]] = [next[j], next[i]];
                      return next;
                    })
                  }
                  onToggle={() =>
                    setLayout(b.hidden ? `Seção “${blockName(b)}” publicada` : `Seção “${blockName(b)}” ocultada`, (l) =>
                      l.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden || undefined } : x)),
                    )
                  }
                  onRemove={() => setLayout(`Seção “${blockName(b)}” removida`, (l) => l.filter((x) => x.id !== b.id))}
                  onRename={isBuiltin(b.type) ? undefined : (v) => updateBlock(b.id, (d) => ({ ...d, nav: v.slice(0, 40) }), "Nome da seção")}
                />
              )}
              {renderBlock(b, num)}
              {editing && (
                <button className="block-insert" onClick={() => setPickerAt(i + 1)}>
                  + Inserir seção aqui
                </button>
              )}
            </div>
          );
        })}
        <SiteFooter company={company} logged={logged} onEdit={() => setEditing(true)} nav={footerNav} />

        <div className="cursor-label" ref={cursor} aria-hidden="true">
          {editing ? "Editar" : tx("catalog.cursor", "Ver peça")}
        </div>
        {active && (
          <div className="part-overlay" data-lenis-prevent onClick={() => setActiveId(null)}>
            <div className="part-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="part-title" onClick={(e) => e.stopPropagation()}>
              <div className="part-dialog-top tiny-mono">
                <span>
                  {activeIndex + 1} / {parts.length}
                </span>
                <span className="part-nav">
                  <button onClick={() => step(-1)} aria-label="Peça anterior">
                    ←
                  </button>
                  <button onClick={() => step(1)} aria-label="Próxima peça">
                    →
                  </button>
                  <button onClick={() => setActiveId(null)} aria-label="Fechar detalhes">
                    {tx("dialog.close", "FECHAR")} ×
                  </button>
                </span>
              </div>
              <button className={"part-inspect-image " + (zoom ? "zoomed" : "")} onClick={() => setZoom(!zoom)} aria-label={zoom ? "Reduzir imagem" : "Ampliar imagem"}>
                <img src={active.imageUrl} alt={active.title} key={active.id} />
                <span className="tiny-mono">{zoom ? `− ${tx("dialog.zoomout", "REDUZIR")}` : `+ ${tx("dialog.zoomin", "AMPLIAR DETALHES")}`}</span>
              </button>
              <div className="part-dialog-copy" key={active.id}>
                <span className="eyebrow">{active.specs}</span>
                <h2 id="part-title">{active.title}</h2>
                <p>{active.description}</p>
                <div className="part-actions">
                  <a href={wa(`Olá! Gostaria de uma cotação para ${active.title}.`)} target="_blank" rel="noreferrer" className="solid-link">
                    <span className="with-glyph">
                      <Glyph name="whatsapp" /> {tx("dialog.quote", "Pedir cotação pelo WhatsApp")}
                    </span>
                    <Arrow />
                  </a>
                  <button
                    className="ghost-link"
                    aria-pressed={quote.refs.includes(active.id)}
                    onClick={() =>
                      setQuote((q) => ({
                        ...q,
                        type: q.type || (services.find((s) => s.category === active.category)?.title ?? ""),
                        refs: q.refs.includes(active.id) ? q.refs.filter((r) => r !== active.id) : [...q.refs, active.id],
                      }))
                    }
                  >
                    {quote.refs.includes(active.id) ? `${tx("dialog.added", "Incluído no orçamento")} ✓` : `+ ${tx("dialog.add", "Incluir no orçamento")}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {editorPart && (
          <ProductEditor
            part={editorPart}
            codes={products.filter((p) => p.id !== editorPart.id).map((p) => p.code)}
            lenis={lenisRef.current}
            onClose={() => setEditorPart(null)}
            onSave={(p) =>
              commit(products.some((x) => x.id === p.id) ? `Peça “${p.title}” atualizada` : `Peça “${p.title}” cadastrada`, (c) => ({
                ...c,
                products: c.products.some((x) => x.id === p.id) ? c.products.map((x) => (x.id === p.id ? p : x)) : [p, ...c.products],
              }))
            }
            onDelete={(p) => commit(`Peça “${p.title}” excluída`, (c) => ({ ...c, products: c.products.filter((x) => x.id !== p.id) }))}
          />
        )}
        {companyOpen && (
          <CompanyPanel
            company={company}
            lenis={lenisRef.current}
            onClose={() => setCompanyOpen(false)}
            onSave={(co) => commit("Dados da empresa alterados", (c) => ({ ...c, company: { ...c.company, ...co } }))}
          />
        )}
        {pickerAt !== null && (
          <SectionPicker
            missing={missing}
            lenis={lenisRef.current}
            onClose={() => setPickerAt(null)}
            onPick={(b) => {
              const at = pickerAt;
              setPickerAt(null);
              setLayout(isBuiltin(b.type) ? `Seção “${blockName(b)}” recolocada` : `Seção “${blockName(b)}” inserida`, (l) => [...l.slice(0, at), b, ...l.slice(at)]);
              setTimeout(() => document.getElementById(blockDom(b))?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
            }}
          />
        )}
        {editing && (
          <ChatPanel
            open={chatOpen}
            ai={aiStatus}
            site={chatSite}
            run={runChatAction}
            runBatch={runChatBatch}
            canUndo={undo.length > 0}
            onUndo={undoLast}
            show={showOnSite}
            onClose={() => setChatOpen(false)}
          />
        )}
        {editing && <TextToolbar ai={aiStatus} />}
        {noticeShown && !editing && content.notice && <NoticeModal notice={content.notice} whatsapp={company.whatsapp} lenis={lenisRef.current} onClose={() => setNoticeShown(false)} />}
        {noticeEdit && (
          <NoticePanel
            notice={content.notice}
            whatsapp={company.whatsapp}
            lenis={lenisRef.current}
            onClose={() => setNoticeEdit(false)}
            onSave={(n) => commit(n.enabled ? "Aviso de abertura salvo" : "Aviso de abertura desligado", (c) => ({ ...c, notice: n }))}
          />
        )}
        {adminsOpen && <AdminsPanel lenis={lenisRef.current} onClose={() => setAdminsOpen(false)} />}
        {photoJob && (
          <PhotoEditorModal
            source={photoJob.source}
            initialRemoveBg={photoJob.cutout}
            label={photoJob.label}
            lenis={lenisRef.current}
            onClose={() => setPhotoJob(null)}
            onApply={async (editedFile) => {
              const url = await upload(editedFile, false);
              if (!url) throw Error("Não foi possível enviar a imagem.");
              photoJob.onSave(url);
              setPhotoJob(null);
            }}
          />
        )}
        {logged && (
          <EditBar
            editing={editing}
            setEditing={setEditing}
            state={save}
            storage={storage}
            canUndo={undo.length > 0}
            onUndo={undoLast}
            hint={hint}
            onHintClose={() => {
              setHint(false);
              safeStorage.set("usibar-edit-hint", "1");
            }}
            onAdd={() => setEditorPart({ ...blankPart })}
            onCompany={() => setCompanyOpen(true)}
            onNotice={() => setNoticeEdit(true)}
            noticeOn={!!content.notice?.enabled}
            onCurate={() => setChatOpen((o) => !o)}
            onAdmins={accounts ? () => setAdminsOpen(true) : undefined}
            onLogout={async () => {
              await Promise.all([fetch("/api/auth", { method: "DELETE" }).catch(() => {}), signOut()]);
              setEditing(false);
              setLogged(false);
            }}
          />
        )}
      </main>
    </CopyContext.Provider>
  );
}
