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
import { CopyContext, ImageSwap, T } from "./copy";
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
// Sections as numbered sheets: header, cylinder navigation, index menu and footer share them.
const navItems = [
  { id: "solucoes", n: "01", k: "nav.1", d: "Soluções", hint: "Cilindros, blocos e usinagem de precisão" },
  { id: "processo", n: "02", k: "nav.2", d: "Processo", hint: "Do desenho técnico à peça em movimento" },
  { id: "pecas", n: "03", k: "nav.3", d: "Catálogo", hint: "Modelos que já produzimos" },
  { id: "origem", n: "04", k: "nav.4", d: "Empresa", hint: "Quem somos e nossos pilares" },
  { id: "segmentos", n: "05", k: "nav.5", d: "Segmentos", hint: "Onde nossos componentes trabalham" },
  { id: "orcamento", n: "06", k: "nav.6", d: "Orçamento", hint: "Seu pedido em quatro respostas" },
];
// Facts that may be missing from content saved before they existed.
const companyDefaults = {
  address: "Rua Martin Biancho, 803 — Bairro Bela Vista",
  zip: "95730-000",
};
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
    [headerHidden, setHeaderHidden] = useState(false),
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
    [companyOpen, setCompanyOpen] = useState(false);
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
    stale = useRef(false),
    loaded = !!content;

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
        };
        contentRef.current = savedRef.current = c;
        stale.current = d.stale === true;
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
      setSave({ kind: "error", message: "O conteúdo salvo não pôde ser lido agora; a edição está pausada. Recarregue a página." });
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
  const upload = useCallback(async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setSave({ kind: "error", message: "Envie uma imagem JPG, PNG ou WebP." });
      return null;
    }
    setSave({ kind: "saving" });
    try {
      const fd = new FormData();
      fd.append("file", file);
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
    const ids = navItems.map((n) => n.id);
    const seen = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setSection(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) seen.observe(el);
    });
    let last = scrollY,
      frame = 0;
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
      cylNav.current?.style.setProperty("--p", String(Math.min(1, p / (ids.length - 1))));
    };
    rod();
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(rod);
      const y = scrollY;
      setHeaderHidden(y > 240 && y > last + 4);
      if (y < last - 4 || y < 240) setHeaderHidden(false);
      last = y;
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      seen.disconnect();
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [loaded]);

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
          intro
            .to(count, {
              value: 100,
              duration: 0.9,
              ease: "power2.inOut",
              onUpdate: () => {
                const v = Math.round(count.value);
                if (meter.current) meter.current.style.transform = `scaleX(${v / 100})`;
                if (counter.current) counter.current.textContent = String(v).padStart(3, "0");
              },
            })
            .to(".intro-brand", { yPercent: -40, opacity: 0, duration: 0.45, ease: "power2.in" })
            .to(".intro-shutter", { clipPath: "inset(0 0 100% 0)", duration: 0.8, ease: "expo.inOut" }, "-=.2")
            .set(".intro-shutter", { display: "none" });
        }
        intro
          .from(".site-header", { opacity: 0, y: -20, duration: 0.8, ease: "power3.out" }, repeat ? 0 : "-=.5")
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
  }, [filter, editing, loaded]);

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
  const { company, products, sectors, process: steps, services, pillars } = content;
  const wa = (text: string) => `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(text)}`;
  const ed: Ed = (value, label, apply) => (
    <Editable value={value} editing={editing} label={label} onCommit={(v) => commit(`${label} alterado`, (c) => apply(c, v))} />
  );
  const text = (key: string, label: string) => ed(company[key] ?? "", label, (c, v) => ({ ...c, company: { ...c.company, [key]: v } }));
  const tx = (k: string, d: string) => content.copy[k] ?? d;
  const copyCtx = {
    copy: content.copy,
    editing,
    setText: (k: string, v: string, label: string) => commit(`${label} alterado`, (c) => ({ ...c, copy: { ...c.copy, [k]: v } })),
    upload,
  };
  const heroImage = company.heroImageUrl || HERO_IMAGE;
  const footerNav = navItems.map((n) => [`#${n.id}`, tx(n.k, n.d)] as [string, string]);
  return (
    <CopyContext.Provider value={copyCtx}>
      <main className={"usibar-site" + (editing ? " editing" : "")} ref={root}>
        <a className="skip-link" href="#pecas">
          {tx("skip", "Pular para o catálogo")}
        </a>
        <div className="intro-shutter" aria-hidden="true">
          <div className="intro-brand">
            USIBAR<span>✳</span>
          </div>
          <div className="intro-meter">
            <i ref={meter} />
          </div>
          <div className="intro-info">
            <span>USIBAR / TECNOLOGIA EM HIDRÁULICA</span>
            <span>
              <span ref={counter}>000</span> / 100
            </span>
          </div>
        </div>

        <header className={"site-header" + (headerHidden && !menu ? " tucked" : "")}>
          <a className="brand" href="#inicio" aria-label="Usibar, início">
            <img src="/assets/logo-usibar-light.webp" alt="Usibar — Tecnologia em hidráulica" />
          </a>
          <nav className="main-nav" aria-label="Navegação principal">
            {navItems.slice(0, 5).map((n) => (
              <a key={n.id} href={`#${n.id}`} aria-current={section === n.id ? "location" : undefined}>
                <small>{n.n}</small>
                <T k={n.k} d={n.d} label={`Menu — ${n.d}`} />
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

        {/* Section navigation drawn as a hydraulic cylinder: the rod extends with the reading. */}
        <nav className="cyl-nav" ref={cylNav} aria-label="Seções da página">
          <span className="cyl-barrel" aria-hidden="true">
            <i />
          </span>
          <span className="cyl-track">
            <i className="cyl-rod" aria-hidden="true" />
            <i className="cyl-eye" aria-hidden="true" />
            {navItems.map((n, i) => (
              <button
                key={n.id}
                style={{ top: `${(i / (navItems.length - 1)) * 100}%` }}
                className={section === n.id ? "on" : ""}
                aria-current={section === n.id ? "location" : undefined}
                onClick={() => goTo(n.id)}
              >
                <b>{n.n}</b>
                <span>{tx(n.k, n.d)}</span>
              </button>
            ))}
          </span>
        </nav>

        {menu && (
          <div className="index-menu" id="index-menu" role="dialog" aria-modal="true" aria-label={tx("header.index", "Índice")} data-lenis-prevent ref={indexRef}>
            <div className="index-top">
              <span className="tiny-mono">{tx("index.title", "ÍNDICE DE FOLHAS · USIBAR")}</span>
              <button onClick={() => setMenu(false)}>{tx("index.close", "Fechar")} ×</button>
            </div>
            <ol className="index-list">
              {navItems.map((n, i) => (
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
                    <strong>{tx(n.k, n.d)}</strong>
                    <span>{tx(`${n.k}.hint`, n.hint)}</span>
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
              <span className="eyebrow hero-eyebrow">
                <T k="hero.eyebrow" d="FABRICAÇÃO SOB MEDIDA" label="Topo — rótulo" /> · {text("city", "Cidade / UF")} —{" "}
                <T k="hero.country" d="BRASIL" label="Topo — país" />
              </span>
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
              <p className="hero-lead">{text("motto", "Lema da empresa")}</p>
              <p className="hero-note">
                {text("subheadline", "Subtítulo do topo")}{" "}
                <T k="hero.note" d="Envie o desenho técnico ou as especificações da sua aplicação." label="Topo — convite" />
              </p>
              <div className="hero-actions">
                <a href="#orcamento" className="btn-primary">
                  <T k="hero.cta.1" d="Solicitar orçamento" label="Topo — botão principal" /> <Arrow />
                </a>
                <a href="#pecas" className="btn-ghost">
                  <T k="hero.cta.2" d="Ver catálogo" label="Topo — botão secundário" /> <Arrow down />
                </a>
              </div>
            </div>
            <div className="hero-visual">
              <span className="sheet-tag tiny-mono">
                <T k="hero.sheet" d="FICHA / COMPONENTE 01 · CILINDRO COM OLHAL" label="Topo — etiqueta da foto" />
              </span>
              <HeroArt src={heroImage} />
              <ImageSwap
                label="foto do topo"
                onChange={(url) => commit("Foto do topo trocada", (c) => ({ ...c, company: { ...c.company, heroImageUrl: url } }))}
              />
            </div>
          </div>
          <ProofBar company={company} ed={ed} />
        </section>

        <Solutions
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

        <ProcessSection
          steps={steps}
          editing={editing}
          lenis={lenisRef}
          onEdit={(i, key, v) =>
            commit(`Texto da etapa ${i + 1} alterado`, (c) => ({
              ...c,
              process: c.process.map((s, j) => (j === i ? { ...s, [key]: v } : s)),
            }))
          }
        />

        <section className="product-section" id="pecas">
          <div className="section-head reveal">
            <div>
              <span className="eyebrow">
                <T k="catalog.eyebrow" d="03 — CATÁLOGO DE COMPONENTES" label="Catálogo — rótulo" />
              </span>
              <h2>
                <T k="catalog.title.1" d="Modelos que já produzimos." label="Catálogo — título" />
                <br />
                <em>
                  <T k="catalog.title.2" d="Ponto de partida para o seu projeto." label="Catálogo — título (destaque)" />
                </em>
              </h2>
            </div>
            <p>
              <T k="catalog.intro" d="Abra um modelo para ver detalhes, pedir cotação ou incluí-lo como referência no seu orçamento." label="Catálogo — introdução" />
            </p>
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
              {editing ? "CLIQUE EM UMA PEÇA PARA EDITAR ↙" : (
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
                <span className="tiny-mono">FOTO · CÓDIGO · DESCRIÇÃO</span>
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
                  <span>
                    {part.code}
                    {part.featured ? ` / ${tx("catalog.featured", "DESTAQUE")}` : ""}
                  </span>
                  <span>{quote.refs.includes(part.code) ? `${tx("catalog.inquote", "NO ORÇAMENTO")} ✓` : String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="product-photo">
                  <div className="product-cross one" />
                  <div className="product-cross two" />
                  <img loading="lazy" src={part.imageUrl} alt="" />
                </div>
                <div className="product-bottom">
                  <div>
                    <span className="eyebrow">
                      {part.category === "cilindros" ? tx("catalog.cat.cilindros", "CILINDRO HIDRÁULICO") : tx("catalog.cat.blocos", "BLOCO HIDRÁULICO")}
                    </span>
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

        <section className="origin" id="origem">
          <div className="origin-image">
            <img src={company.benchImageUrl} alt="Cilindros hidráulicos fabricados pela Usibar sobre a bancada da oficina" />
            <span className="image-caption tiny-mono">
              <T k="origin.caption" d="DENTRO DA USIBAR" label="Empresa — legenda da foto" /> / {company.city}
            </span>
            <span className="image-bracket tl" />
            <span className="image-bracket br" />
            <ImageSwap label="foto da empresa" onChange={(url) => commit("Foto da empresa trocada", (c) => ({ ...c, company: { ...c.company, benchImageUrl: url } }))} />
          </div>
          <div className="origin-copy reveal">
            <span className="eyebrow">
              <T k="origin.eyebrow" d="04 — A EMPRESA" label="Empresa — rótulo" />
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

        <section className="sectors-section" id="segmentos" aria-labelledby="sectors-title">
          <div className="section-head reveal">
            <div>
              <span className="eyebrow" id="sectors-title">
                <T k="sectors.eyebrow" d="05 — SEGMENTOS ATENDIDOS" label="Segmentos — rótulo" />
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
                  {ed(s.name, `Segmento ${i + 1}`, (c, v) => ({
                    ...c,
                    sectors: c.sectors.map((x) => (x.id === s.id ? { ...x, name: v } : x)),
                  }))}
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

        <QuoteBuilder company={company} sectors={sectors} services={services} quote={quote} setQuote={setQuote} />
        <SiteFooter company={company} logged={logged} onEdit={() => setEditing(true)} nav={footerNav} />

        <div className="cursor-label" ref={cursor} aria-hidden="true">
          {editing ? "Editar" : tx("catalog.cursor", "Ver peça")}
        </div>
        {active && (
          <div className="part-overlay" data-lenis-prevent onClick={() => setActiveId(null)}>
            <div className="part-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="part-title" onClick={(e) => e.stopPropagation()}>
              <div className="part-dialog-top tiny-mono">
                <span>
                  {active.code} · {activeIndex + 1} / {parts.length}
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
                  <a href={wa(`Olá! Gostaria de uma cotação para ${active.title} (${active.code}).`)} target="_blank" rel="noreferrer" className="solid-link">
                    <span className="with-glyph">
                      <Glyph name="whatsapp" /> {tx("dialog.quote", "Pedir cotação pelo WhatsApp")}
                    </span>
                    <Arrow />
                  </a>
                  <button
                    className="ghost-link"
                    aria-pressed={quote.refs.includes(active.code)}
                    onClick={() =>
                      setQuote((q) => ({
                        ...q,
                        type: q.type || (services.find((s) => s.category === active.category)?.title ?? ""),
                        refs: q.refs.includes(active.code) ? q.refs.filter((r) => r !== active.code) : [...q.refs, active.code],
                      }))
                    }
                  >
                    {quote.refs.includes(active.code) ? `${tx("dialog.added", "Incluído no orçamento")} ✓` : `+ ${tx("dialog.add", "Incluir no orçamento")}`}
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
        {adminsOpen && <AdminsPanel lenis={lenisRef.current} onClose={() => setAdminsOpen(false)} />}
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
