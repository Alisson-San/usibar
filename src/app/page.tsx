"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { ProcessSection, type Step } from "./ProcessSection";
import {
  blankPart,
  CompanyPanel,
  EditBar,
  Editable,
  ProductEditor,
  readError,
  useModal,
  type Company,
  type Part,
  type SaveState,
} from "./editing";

type Sector = { id: string; name: string; code: string };
type Content = { company: Company; products: Part[]; sectors: Sector[]; process: Step[] };
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
const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
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

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function UsibarHome() {
  const [content, setContent] = useState<Content | null>(null),
    [failed, setFailed] = useState(false),
    [filter, setFilter] = useState("all"),
    [activeId, setActiveId] = useState<string | null>(null),
    [menu, setMenu] = useState(false),
    [zoom, setZoom] = useState(false),
    [logged, setLogged] = useState(false),
    [storage, setStorage] = useState("file"),
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
    lenisRef = useRef<Lenis | null>(null),
    contentRef = useRef<Content | null>(null),
    savedRef = useRef<Content | null>(null),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    loaded = !!content;

  useEffect(() => {
    fetch("/api/company", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        const c: Content = {
          company: d.company,
          products: d.products,
          sectors: d.sectors ?? [],
          process: d.process?.length === 3 ? d.process : defaultProcess,
        };
        contentRef.current = savedRef.current = c;
        setContent(c);
      })
      .catch(() => setFailed(true));
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((a) => {
        if (!a.authenticated || a.demoMode) return;
        setLogged(true);
        setStorage(a.storage ?? "file");
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
  const commit = useCallback(
    (label: string, change: (c: Content) => Content, recordUndo = true) => {
      const before = contentRef.current!;
      const next = change(before);
      contentRef.current = next;
      setContent(next);
      setSave({ kind: "saving" });
      const run = async () => {
        try {
          const res = await fetch("/api/company", {
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
    },
    [],
  );
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

  useEffect(() => {
    if (!loaded) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    const repeat = safeStorage.get("usibar-intro") === "1";
    safeStorage.set("usibar-intro", "1", true);
    const ctx = gsap.context(() => {
      mm.add("(prefers-reduced-motion: no-preference)", () => {
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
          .from(".site-header", { yPercent: -100, duration: 0.8, ease: "power3.out" }, repeat ? 0 : "-=.5")
          .from(".hero-title .line-inner", { yPercent: 115, rotate: 4, stagger: 0.09, duration: 1.05, ease: "expo.out" }, "-=.7")
          .from(".hero-product", { y: 120, rotate: -22, scale: 0.75, opacity: 0, duration: 1.6, ease: "expo.out" }, "-=1.1")
          .from(".hero-orbit", { scale: 0.6, opacity: 0, duration: 1.4, ease: "expo.out" }, "<")
          .from(
            ".hero-topline, .hero-note, .hero-actions, .hero-part-label, .hero-seal, .dimension-line, .hero-bottom",
            { y: 30, opacity: 0, stagger: 0.07, duration: 0.8, ease: "power3.out" },
            "-=1.2",
          );
        gsap.to(".hero-product", { y: -18, rotate: 2.5, duration: 3.6, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 2.6 });
        gsap.to(".hero-orbit", { rotate: 360, duration: 80, repeat: -1, ease: "none" });
        gsap.to(".page-course", {
          scaleY: 1,
          ease: "none",
          scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.5 },
        });
        gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) =>
          gsap.from(el, { y: 60, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } }),
        );
        gsap.set(".product-card", { y: 60, opacity: 0 });
        ScrollTrigger.batch(".product-card", {
          start: "top 92%",
          once: true,
          onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, stagger: 0.09, duration: 1, ease: "expo.out", overwrite: true }),
        });
        gsap.from(".contact-title > *", {
          yPercent: 60,
          opacity: 0,
          stagger: 0.12,
          duration: 1.2,
          ease: "expo.out",
          scrollTrigger: { trigger: ".contact-title", start: "top 85%" },
        });
        gsap.fromTo(
          ".origin-image > img",
          { scale: 1.18, yPercent: -6 },
          { scale: 1.04, yPercent: 6, ease: "none", scrollTrigger: { trigger: ".origin", start: "top bottom", end: "bottom top", scrub: true } },
        );
        return () => intro.kill();
      });

      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference) and (pointer: fine)", () => {
        gsap.to(".hero-product-wrap", {
          yPercent: 22,
          rotate: -8,
          ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
        });
        const hero = root.current!.querySelector<HTMLElement>(".hero")!;
        const px = gsap.quickTo(".hero-product", "x", { duration: 1.2, ease: "power3" }),
          ox = gsap.quickTo(".hero-orbit", "x", { duration: 1.6, ease: "power3" }),
          oy = gsap.quickTo(".hero-orbit", "y", { duration: 1.6, ease: "power3" }),
          sx = gsap.quickTo(".hero-seal", "x", { duration: 1, ease: "power3" });
        const move = (e: PointerEvent) => {
          const nx = e.clientX / innerWidth - 0.5,
            ny = e.clientY / innerHeight - 0.5;
          px(nx * 36);
          ox(nx * -18);
          oy(ny * -14);
          sx(nx * 14);
        };
        hero.addEventListener("pointermove", move);
        // A label follows the pointer over the catalog, so a card reads as clickable.
        const grid = root.current!.querySelector<HTMLElement>(".product-grid")!;
        const cx = gsap.quickTo(cursor.current, "x", { duration: 0.35, ease: "power3" }),
          cy = gsap.quickTo(cursor.current, "y", { duration: 0.35, ease: "power3" });
        const track = (e: PointerEvent) => {
          const card = (e.target as HTMLElement).closest(".product-card");
          cursor.current?.classList.toggle("on", !!card);
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
  const step = (d: number) =>
    parts.length && setActiveId(parts[(activeIndex + d + parts.length) % parts.length].id);
  useEffect(() => setZoom(false), [activeId]);
  useModal(!!active, dialog, () => setActiveId(null), lenisRef.current);
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  if (!content)
    return (
      <main className="site-loading">
        <span className="eyebrow">USIBAR / COMPONENTES HIDRÁULICOS</span>
        <p>{failed ? "Não foi possível carregar o catálogo." : "Preparando a apresentação."}</p>
        {failed && <button onClick={() => location.reload()}>Tentar novamente ↗</button>}
      </main>
    );
  const { company, products, sectors, process: steps } = content;
  const wa = (text: string) => `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(text)}`;
  const text = (key: string, label: string, className?: string) => (
    <Editable
      value={company[key]}
      editing={editing}
      label={label}
      className={className}
      onCommit={(v) => commit(`${label} alterado`, (c) => ({ ...c, company: { ...c.company, [key]: v } }))}
    />
  );
  return (
    <main className={"usibar-site" + (editing ? " editing" : "")} ref={root}>
      <a className="skip-link" href="#pecas">
        Pular para o catálogo
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
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Usibar, início">
          <img src="/assets/logo-usibar-light.webp" alt="Usibar — Tecnologia em hidráulica" />
        </a>
        <nav id="menu" className={menu ? "main-nav open" : "main-nav"} aria-label="Navegação principal">
          {[
            ["#processo", "Processo"],
            ["#pecas", "Produtos"],
            ["#origem", "Empresa"],
            ["#contato", "Contato"],
          ].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenu(false)}>
              {label}
            </a>
          ))}
        </nav>
        <a className="header-contact" href={wa("Olá! Gostaria de conversar sobre um projeto com a Usibar.")} target="_blank" rel="noreferrer">
          Solicitar orçamento <Arrow />
        </a>
        <button
          className="menu-toggle"
          aria-label={menu ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menu}
          aria-controls="menu"
          onClick={() => setMenu(!menu)}
        >
          {menu ? "−" : "+"}
        </button>
      </header>
      <aside className="course-indicator" aria-hidden="true">
        <span>CURSO</span>
        <div>
          <i className="page-course" />
        </div>
        <span>100</span>
      </aside>
      <section className="hero" id="inicio">
        <div className="hero-topline eyebrow">
          <span>FABRICAÇÃO SOB MEDIDA · USINAGEM CNC</span>
          <span>{text("city", "Cidade / UF")} — BRASIL</span>
        </div>
        <div className="hero-layout">
          <div className="hero-copy">
            <h1 className="hero-title">
              <span>
                <span className="line-inner">CILINDROS</span>
              </span>
              <span>
                <span className="line-inner">E BLOCOS</span>
              </span>
              <span className="accent-line">
                <span className="line-inner">
                  HIDRÁULICOS<span className="title-period">.</span>
                </span>
              </span>
            </h1>
            <div className="hero-note">
              <span className="mini-cross" aria-hidden="true">
                ✳
              </span>
              <p>
                {text("subheadline", "Subtítulo do topo")}
                <br />
                Envie o desenho técnico ou as especificações da sua aplicação.
              </p>
            </div>
            <div className="hero-actions">
              <a href={wa("Olá! Gostaria de solicitar um orçamento à Usibar.")} target="_blank" rel="noreferrer">
                Solicitar orçamento <Arrow />
              </a>
              <a href="#pecas">
                Ver catálogo <Arrow />
              </a>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-orbit" aria-hidden="true">
              <i />
              <i />
              <b>+</b>
              <b>+</b>
            </div>
            <div className="hero-product-wrap">
              <img className="hero-product" src="/assets/cilindro-olhal.webp" alt="Cilindro hidráulico Usibar com olhal de fixação" />
            </div>
            <div className="dimension-line horizontal" aria-hidden="true">
              <span>ENGENHARIA APLICADA</span>
            </div>
            <div className="hero-part-label">
              <span className="eyebrow">COMPONENTE / 01</span>
              <strong>
                Cilindro hidráulico
                <br />
                com olhal usinado
              </strong>
              <span className="tiny-mono">FORÇA LINEAR · FABRICAÇÃO SOB MEDIDA</span>
            </div>
            <div className="hero-seal">
              <strong>{text("experienceYears", "Anos de experiência")}</strong>
              <span>
                ANOS DE
                <br />
                EXPERIÊNCIA
              </span>
            </div>
          </div>
        </div>
        <div className="hero-bottom">
          <a href="#processo" className="scroll-link">
            <span className="scroll-disc" aria-hidden="true">
              ↓
            </span>
            ROLE E VEJA UMA PEÇA SAIR DO DESENHO
          </a>
          <p>{text("headline", "Mensagem institucional")}</p>
          <a href="#pecas" className="text-link">
            Ver catálogo <Arrow />
          </a>
        </div>
      </section>
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
            <span className="eyebrow">02 — CATÁLOGO DE COMPONENTES</span>
            <h2>
              Cilindros e blocos.
              <br />
              <em>Fabricação sob projeto.</em>
            </h2>
          </div>
          <p>
            Explore cilindros e blocos hidráulicos.
            <br />
            Abra um modelo para ver detalhes e pedir cotação.
          </p>
        </div>
        <div className="catalog-toolbar">
          <div className="catalog-tabs" role="group" aria-label="Filtrar por categoria">
            {[
              ["all", "Todas as peças"],
              ["cilindros", "Cilindros"],
              ["blocos", "Blocos"],
            ].map(([value, label]) => (
              <button key={value} aria-pressed={filter === value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>
                {label}
                <span>{value === "all" ? products.length : products.filter((p) => p.category === value).length}</span>
              </button>
            ))}
          </div>
          <span className="tiny-mono" aria-live="polite">
            {editing ? "CLIQUE EM UMA PEÇA PARA EDITAR ↙" : `${parts.length} MODELOS · PRODUÇÃO CONFORME PROJETO`}
          </span>
        </div>
        <div className="product-grid">
          {editing && (
            <button
              className="product-card product-add"
              onClick={() => setEditorPart({ ...blankPart, category: filter === "blocos" ? "blocos" : "cilindros" })}
            >
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
                  {part.featured ? " / DESTAQUE" : ""}
                </span>
                <span>
                  {String(i + 1).padStart(2, "0")} / <span className="inspect-plus">+</span>
                </span>
              </div>
              <div className="product-photo">
                <div className="product-cross one" />
                <div className="product-cross two" />
                <img loading="lazy" src={part.imageUrl} alt="" />
              </div>
              <div className="product-bottom">
                <div>
                  <span className="eyebrow">{part.category === "cilindros" ? "CILINDRO HIDRÁULICO" : "BLOCO HIDRÁULICO"}</span>
                  <h3>{part.title}</h3>
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
            Precisa de outra configuração?
            <br />
            <strong>Fabricamos conforme as especificações do seu projeto.</strong>
          </p>
          <a href={wa("Olá! Tenho um projeto especial e gostaria de conversar com a Usibar.")} target="_blank" rel="noreferrer">
            Enviar especificações <Arrow />
          </a>
        </div>
      </section>
      <section className="origin" id="origem">
        <div className="origin-image">
          <img src={company.benchImageUrl} alt="Cilindros hidráulicos fabricados pela Usibar sobre a bancada da oficina" />
          <span className="image-caption tiny-mono">DENTRO DA USIBAR / {company.city}</span>
          <span className="image-bracket tl" />
          <span className="image-bracket br" />
        </div>
        <div className="origin-copy reveal">
          <span className="eyebrow">03 — USIBAR USINAGENS ESPECIAIS</span>
          <h2>
            Usibar.
            <br />
            <em>
              Usinagens
              <br />
              especiais.
            </em>
          </h2>
          <p>{text("aboutParagraph1", "Apresentação — parágrafo 1")}</p>
          <p>{text("aboutParagraph2", "Apresentação — parágrafo 2")}</p>
          <p>{text("aboutParagraph3", "Apresentação — parágrafo 3")}</p>
          <div className="origin-stat">
            <strong>{text("experienceYears", "Anos de experiência")}</strong>
            <span>
              ANOS DE EXPERIÊNCIA
              <br />
              EM TECNOLOGIA HIDRÁULICA
            </span>
          </div>
        </div>
      </section>
      <section className="sectors-section" aria-labelledby="sectors-title">
        <span className="eyebrow reveal" id="sectors-title">
          SEGMENTOS ATENDIDOS
        </span>
        <div className="sector-list">
          {sectors.map((s, i) => (
            <div className="sector-row reveal" key={s.id}>
              <span className="tiny-mono">{String(i + 1).padStart(2, "0")}</span>
              <h3>
                <Editable
                  value={s.name}
                  editing={editing}
                  label={`Segmento ${i + 1}`}
                  onCommit={(v) =>
                    commit("Segmento alterado", (c) => ({
                      ...c,
                      sectors: c.sectors.map((x) => (x.id === s.id ? { ...x, name: v } : x)),
                    }))
                  }
                />
              </h3>
              {editing ? (
                <button
                  className="sector-remove"
                  aria-label={`Remover segmento ${s.name}`}
                  onClick={() =>
                    commit(`Segmento “${s.name}” removido`, (c) => ({
                      ...c,
                      sectors: c.sectors.filter((x) => x.id !== s.id),
                    }))
                  }
                >
                  ×
                </button>
              ) : (
                <span className="sector-symbol" aria-hidden="true">
                  ↗
                </span>
              )}
            </div>
          ))}
          {editing && sectors.length < 20 && (
            <button
              className="sector-add"
              onClick={() =>
                commit("Segmento adicionado", (c) => ({
                  ...c,
                  sectors: [
                    ...c.sectors,
                    { id: crypto.randomUUID(), name: "Novo segmento", code: `SEC-${String(c.sectors.length + 1).padStart(2, "0")}` },
                  ],
                }))
              }
            >
              + Adicionar segmento
            </button>
          )}
        </div>
      </section>
      <section className="contact-section" id="contato">
        <div className="contact-top eyebrow">
          <span>CONTATO COMERCIAL</span>
          <span>{company.city}</span>
        </div>
        <a className="contact-title" href={wa("Olá! Gostaria de solicitar um orçamento de componentes hidráulicos.")} target="_blank" rel="noreferrer">
          <span>
            SOLICITE<span className="contact-arrow" aria-hidden="true">↗</span>
          </span>
          <em>UM ORÇAMENTO.</em>
        </a>
        <div className="contact-bottom">
          <p>
            Envie seu desenho, sua especificação
            <br />e informe a aplicação e a quantidade necessária.
          </p>
          <a href={wa("Olá, equipe Usibar!")} target="_blank" rel="noreferrer">
            WhatsApp {company.phoneDisplay} ↗
          </a>
          <a href={`mailto:${company.email}`}>{company.email} ↗</a>
        </div>
      </section>
      <footer className="site-footer">
        <span>
          © {new Date().getFullYear()} {company.name}
        </span>
        <span>CILINDROS · BLOCOS HIDRÁULICOS · USINAGEM CNC</span>
        {logged ? <button onClick={() => setEditing(true)}>Editar site ↗</button> : <a href="/admin">Área administrativa ↗</a>}
      </footer>
      <div className="cursor-label" ref={cursor} aria-hidden="true">
        {editing ? "Editar" : "Ver peça"}
      </div>
      {active && (
        <div className="part-overlay" data-lenis-prevent onClick={() => setActiveId(null)}>
          <div className="part-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="part-title" onClick={(e) => e.stopPropagation()}>
            <div className="part-dialog-top tiny-mono">
              <span>
                {active.code} · {activeIndex + 1} DE {parts.length}
              </span>
              <span className="part-nav">
                <button onClick={() => step(-1)} aria-label="Peça anterior">
                  ←
                </button>
                <button onClick={() => step(1)} aria-label="Próxima peça">
                  →
                </button>
                <button onClick={() => setActiveId(null)} aria-label="Fechar detalhes">
                  FECHAR ×
                </button>
              </span>
            </div>
            <button className={"part-inspect-image " + (zoom ? "zoomed" : "")} onClick={() => setZoom(!zoom)} aria-label={zoom ? "Reduzir imagem" : "Ampliar imagem"}>
              <img src={active.imageUrl} alt={active.title} key={active.id} />
              <span className="tiny-mono">{zoom ? "− REDUZIR" : "+ AMPLIAR DETALHES"}</span>
            </button>
            <div className="part-dialog-copy" key={active.id}>
              <span className="eyebrow">{active.specs}</span>
              <h2 id="part-title">{active.title}</h2>
              <p>{active.description}</p>
              <a href={wa(`Olá! Gostaria de uma cotação para ${active.title} (${active.code}).`)} target="_blank" rel="noreferrer" className="solid-link">
                Pedir cotação desta peça pelo WhatsApp <Arrow />
              </a>
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
          onLogout={async () => {
            await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
            setEditing(false);
            setLogged(false);
          }}
        />
      )}
    </main>
  );
}
