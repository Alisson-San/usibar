"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import {
  EngineeringScene,
  sceneTimeline,
  STAGE_REST,
  STAGE_START,
} from "./EngineeringScene";
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

type Content = { company: Company; products: Part[] };
const steps = [
  {
    no: "01",
    label: "O desenho",
    title: "Projeto conforme\na aplicação.",
    copy: "Geometria, fixações e conexões definidas conforme as especificações do equipamento e do circuito hidráulico.",
  },
  {
    no: "02",
    label: "A usinagem",
    title: "Usinagem de\nblocos hidráulicos.",
    copy: "Usinagem de cavidades, furos e conexões para integrar os componentes do circuito hidráulico em um bloco.",
  },
  {
    no: "03",
    label: "O movimento",
    title: "Cilindros de\nsimples e dupla ação.",
    copy: "Cilindros fabricados conforme a aplicação, com curso, dimensões e fixações definidos em projeto.",
  },
];
function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function UsibarHome() {
  const [data, setData] = useState<any>(null),
    [content, setContent] = useState<Content | null>(null),
    [failed, setFailed] = useState(false),
    [filter, setFilter] = useState("all"),
    [active, setActive] = useState<Part | null>(null),
    [menu, setMenu] = useState(false),
    [stage, setStage] = useState(0),
    [zoom, setZoom] = useState(false),
    [logged, setLogged] = useState(false),
    [editing, setEditing] = useState(false),
    [save, setSave] = useState<SaveState>({ kind: "idle" }),
    [editorPart, setEditorPart] = useState<Part | null>(null),
    [companyOpen, setCompanyOpen] = useState(false);
  const root = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    meter = useRef<HTMLElement>(null),
    counter = useRef<HTMLSpanElement>(null),
    lenisRef = useRef<Lenis | null>(null),
    scene = useRef<{ tl: gsap.core.Timeline; mode: "scroll" | "play" | "static" } | null>(null),
    sceneTween = useRef<gsap.core.Tween | null>(null),
    contentRef = useRef<Content | null>(null),
    savedRef = useRef<Content | null>(null),
    queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    fetch("/api/company", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        const c = { company: d.company, products: d.products };
        contentRef.current = savedRef.current = c;
        setContent(c);
        setData(d);
      })
      .catch(() => setFailed(true));
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((a) => {
        if (!a.authenticated || a.demoMode) return;
        setLogged(true);
        const url = new URL(location.href);
        if (url.searchParams.has("editar")) {
          setEditing(true);
          url.searchParams.delete("editar");
          history.replaceState(null, "", url.pathname + url.search + url.hash);
        }
      })
      .catch(() => {});
  }, []);

  // Every committed edit is published at once; requests run one after another.
  const commit = useCallback((change: (c: Content) => Content) => {
    const next = change(contentRef.current!);
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
        if (!res.ok) {
          throw Object.assign(
            Error((await readError(res)) || "Não foi possível salvar."),
            { expired: res.status === 401 },
          );
        }
        savedRef.current = next;
        setSave({ kind: "saved" });
        return true;
      } catch (e) {
        // Keep the page truthful: show the last version the server accepted.
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
  useEffect(() => {
    if (save.kind !== "saved") return;
    const t = setTimeout(() => setSave({ kind: "idle" }), 2400);
    return () => clearTimeout(t);
  }, [save]);

  useEffect(() => {
    if (!data) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const count = { value: 0 };
        const intro = gsap.timeline();
        intro
          .to(count, {
            value: 100,
            duration: 1.1,
            ease: "power2.inOut",
            onUpdate: () => {
              const v = Math.round(count.value);
              if (meter.current) meter.current.style.transform = `scaleX(${v / 100})`;
              if (counter.current) counter.current.textContent = String(v).padStart(3, "0");
            },
          })
          .to(".intro-brand", { yPercent: -40, opacity: 0, duration: 0.5, ease: "power2.in" })
          .to(".intro-shutter", { clipPath: "inset(0 0 100% 0)", duration: 0.9, ease: "expo.inOut" }, "-=.2")
          .from(".site-header", { yPercent: -100, duration: 0.8, ease: "power3.out" }, "-=.5")
          .from(
            ".hero-title .line-inner",
            { yPercent: 115, rotate: 4, stagger: 0.09, duration: 1.05, ease: "expo.out" },
            "-=.7",
          )
          .from(
            ".hero-product",
            { y: 120, rotate: -22, scale: 0.75, opacity: 0, duration: 1.6, ease: "expo.out" },
            "-=1.1",
          )
          .from(".hero-orbit", { scale: 0.6, opacity: 0, duration: 1.4, ease: "expo.out" }, "<")
          .from(
            ".hero-topline, .hero-note, .hero-actions, .hero-part-label, .hero-seal, .dimension-line, .hero-bottom",
            { y: 30, opacity: 0, stagger: 0.07, duration: 0.8, ease: "power3.out" },
            "-=1.2",
          );
        gsap.to(".hero-product", {
          y: -18,
          rotate: 2.5,
          duration: 3.6,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          delay: 2.8,
        });
        gsap.to(".hero-orbit", { rotate: 360, duration: 80, repeat: -1, ease: "none" });
        gsap.to(".page-course", {
          scaleY: 1,
          ease: "none",
          scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.5 },
        });
        gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) =>
          gsap.from(el, {
            y: 60,
            opacity: 0,
            duration: 1.1,
            ease: "expo.out",
            scrollTrigger: { trigger: el, start: "top 88%" },
          }),
        );
        gsap.set(".product-card", { y: 60, opacity: 0 });
        ScrollTrigger.batch(".product-card", {
          start: "top 92%",
          once: true,
          onEnter: (els) =>
            gsap.to(els, { y: 0, opacity: 1, stagger: 0.09, duration: 1, ease: "expo.out", overwrite: true }),
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
          {
            scale: 1.04,
            yPercent: 6,
            ease: "none",
            scrollTrigger: { trigger: ".origin", start: "top bottom", end: "bottom top", scrub: true },
          },
        );
        return () => intro.kill();
      });

      // The process illustration: scrubbed by scroll on desktop, played on smaller screens.
      const sceneEl = root.current!.querySelector<HTMLElement>(".engineering-scene")!;
      mm.add(
        {
          desktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
          compact: "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
          reduced: "(prefers-reduced-motion: reduce)",
        },
        (c) => {
          const { desktop, compact } = c.conditions!;
          const tl = sceneTimeline(sceneEl, setStage);
          scene.current = { tl, mode: desktop ? "scroll" : compact ? "play" : "static" };
          if (desktop)
            ScrollTrigger.create({
              id: "manufacturing",
              trigger: ".manufacturing",
              start: "top top",
              end: "+=2800",
              pin: true,
              scrub: 0.8,
              animation: tl,
            });
          else if (compact)
            ScrollTrigger.create({
              trigger: sceneEl,
              start: "top 70%",
              once: true,
              onEnter: () => tl.play(),
            });
          else tl.time(STAGE_REST[0]);
          return () => {
            sceneTween.current?.kill();
            tl.kill();
            scene.current = null;
          };
        },
      );

      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.to(".hero-product-wrap", {
          yPercent: 22,
          rotate: -8,
          ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
        });
        // Subtle depth: the part and its orbit follow the pointer at different rates.
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
        return () => hero.removeEventListener("pointermove", move);
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
  }, [data]);
  useEffect(() => {
    if (!data) return;
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [filter, editing, data]);

  useEffect(() => setZoom(false), [active]);
  useModal(!!active, dialog, () => setActive(null), lenisRef.current);

  useEffect(() => {
    document.documentElement.classList.toggle("is-editing", editing);
  }, [editing]);

  function goStage(i: number) {
    const s = scene.current;
    if (!s) return setStage(i);
    if (s.mode === "scroll") {
      const st = ScrollTrigger.getById("manufacturing");
      if (!st) return;
      const target = st.start + (st.end - st.start) * (STAGE_REST[i] / s.tl.duration());
      if (lenisRef.current) lenisRef.current.scrollTo(target, { duration: 1.4 });
      else window.scrollTo({ top: target, behavior: "smooth" });
    } else if (s.mode === "play") {
      s.tl.pause();
      sceneTween.current?.kill();
      sceneTween.current = s.tl.tweenFromTo(STAGE_START[i], STAGE_REST[i]);
    } else s.tl.time(STAGE_REST[i]);
  }

  if (!data || !content)
    return (
      <main className="site-loading">
        <span className="eyebrow">USIBAR / COMPONENTES HIDRÁULICOS</span>
        <p>{failed ? "Não foi possível carregar o catálogo." : "Preparando a apresentação."}</p>
        {failed && <button onClick={() => location.reload()}>Tentar novamente ↗</button>}
      </main>
    );
  const { sectors } = data;
  const { company, products } = content;
  const parts = products
    .filter((p) => filter === "all" || p.category === filter)
    .sort((a, b) => Number(b.featured) - Number(a.featured));
  const wa = (text: string) =>
    `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(text)}`;
  const text = (key: string, label: string, className?: string) => (
    <Editable
      value={company[key]}
      editing={editing}
      label={label}
      className={className}
      onCommit={(v) => commit((c) => ({ ...c, company: { ...c.company, [key]: v } }))}
    />
  );
  return (
    <main className={"usibar-site" + (editing ? " editing" : "")} ref={root}>
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
        <nav className={menu ? "main-nav open" : "main-nav"} aria-label="Navegação principal">
          {[
            ["#processo", "Processo"],
            ["#pecas", "Produtos"],
            ["#origem", "Empresa"],
          ].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenu(false)}>
              {label}
            </a>
          ))}
        </nav>
        <a
          className="header-contact"
          href={wa("Olá! Gostaria de conversar sobre um projeto com a Usibar.")}
          target="_blank"
          rel="noreferrer"
        >
          Solicitar orçamento <Arrow />
        </a>
        <button
          className="menu-toggle"
          aria-label={menu ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menu}
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
          <span>
            {text("city", "Cidade / UF")} — BRASIL
          </span>
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
              <span className="mini-cross">✳</span>
              <p>
                {text("subheadline", "Subtítulo do topo")}
                <br />
                Envie o desenho técnico ou as especificações da sua aplicação.
              </p>
            </div>
            <div className="hero-actions">
              <a href="#pecas">
                Ver catálogo <Arrow />
              </a>
              <a
                href={wa("Olá! Gostaria de solicitar um orçamento à Usibar.")}
                target="_blank"
                rel="noreferrer"
              >
                Solicitar orçamento <Arrow />
              </a>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-orbit">
              <i />
              <i />
              <b>+</b>
              <b>+</b>
            </div>
            <div className="hero-product-wrap">
              <img
                className="hero-product"
                src="/assets/cilindro-olhal.webp"
                alt="Cilindro hidráulico Usibar com olhal de fixação"
              />
            </div>
            <div className="dimension-line horizontal">
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
            <span className="scroll-disc">↓</span>CONHEÇA O PROCESSO DE FABRICAÇÃO
          </a>
          <p>{text("headline", "Mensagem institucional")}</p>
          <a href="#pecas" className="text-link">
            Ver catálogo <Arrow />
          </a>
        </div>
      </section>
      <section id="processo" className="manufacturing">
        <div className="process-top eyebrow">
          <span>01 — PROJETO E FABRICAÇÃO</span>
          <span>ETAPAS DO PROCESSO ↓</span>
        </div>
        <div className="process-layout">
          <div className="process-copy">
            <div className="process-index" aria-live="polite">
              <span className="process-digit" key={stage}>
                {steps[stage].no}
              </span>
              <small>/ 03</small>
            </div>
            <div className="process-text" key={stage}>
              <span className="eyebrow">{steps[stage].label}</span>
              <h2>
                {steps[stage].title.split("\n").map((line, i) => (
                  <span key={i}>
                    <span>{line}</span>
                  </span>
                ))}
              </h2>
              <p>{steps[stage].copy}</p>
            </div>
            <div className="process-navigation">
              {steps.map((step, i) => (
                <button
                  key={step.no}
                  className={stage === i ? "active" : ""}
                  onClick={() => goStage(i)}
                  aria-pressed={stage === i}
                >
                  <span>{step.no}</span>
                  {step.label}
                </button>
              ))}
            </div>
          </div>
          <div className="process-visual">
            <EngineeringScene />
          </div>
        </div>
        <p className="process-footnote">
          Desenhos e mecanismos ilustrativos. Cada componente é desenvolvido conforme a aplicação.
        </p>
      </section>
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
            Veja os modelos e solicite uma cotação.
          </p>
        </div>
        <div className="catalog-toolbar">
          <div className="catalog-tabs" aria-label="Categorias de componentes">
            {[
              ["all", "Todas as peças"],
              ["cilindros", "Cilindros"],
              ["blocos", "Blocos"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? "selected" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
                <span>
                  {value === "all"
                    ? products.length
                    : products.filter((p) => p.category === value).length}
                </span>
              </button>
            ))}
          </div>
          <span className="tiny-mono">
            {editing ? "CLIQUE EM UMA PEÇA PARA EDITAR ↙" : "PRODUÇÃO CONFORME PROJETO ↙"}
          </span>
        </div>
        <div className="product-grid">
          {editing && (
            <button
              className="product-card product-add"
              onClick={() =>
                setEditorPart({
                  ...blankPart,
                  category: filter === "blocos" ? "blocos" : "cilindros",
                })
              }
            >
              <span className="product-add-plus">+</span>
              <strong>Cadastrar nova peça</strong>
              <span className="tiny-mono">FOTO · CÓDIGO · DESCRIÇÃO</span>
            </button>
          )}
          {parts.map((part, i) => (
            <button
              className="product-card"
              key={part.id}
              onClick={() => (editing ? setEditorPart(part) : setActive(part))}
              aria-label={`${editing ? "Editar" : "Inspecionar"} ${part.title}`}
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
                <img loading="lazy" src={part.imageUrl} alt={part.title} />
              </div>
              <div className="product-bottom">
                <div>
                  <span className="eyebrow">
                    {part.category === "cilindros" ? "CILINDRO HIDRÁULICO" : "BLOCO HIDRÁULICO"}
                  </span>
                  <h3>{part.title}</h3>
                </div>
                <span className="round-arrow">{editing ? "✎" : "↗"}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="catalog-close">
          <span className="mini-cross">✳</span>
          <p>
            Precisa de outra configuração?
            <br />
            <strong>Fabricamos conforme as especificações do seu projeto.</strong>
          </p>
          <a
            href={wa("Olá! Tenho um projeto especial e gostaria de conversar com a Usibar.")}
            target="_blank"
            rel="noreferrer"
          >
            Enviar especificações <Arrow />
          </a>
        </div>
      </section>
      <section className="origin" id="origem">
        <div className="origin-image">
          <img
            src={company.benchImageUrl}
            alt="Cilindros hidráulicos fabricados pela Usibar sobre a bancada da oficina"
          />
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
      <section className="sectors-section">
        <span className="eyebrow reveal">SEGMENTOS ATENDIDOS</span>
        <div className="sector-list">
          {sectors.map((s: any, i: number) => (
            <div className="sector-row reveal" key={s.id}>
              <span className="tiny-mono">0{i + 1}</span>
              <h3>{s.name}</h3>
              <span className="sector-symbol">↗</span>
            </div>
          ))}
        </div>
      </section>
      <section className="contact-section" id="contato">
        <div className="contact-top eyebrow">
          <span>CONTATO COMERCIAL</span>
          <span>{company.city}</span>
        </div>
        <a
          className="contact-title"
          href={wa("Olá! Gostaria de solicitar um orçamento de componentes hidráulicos.")}
          target="_blank"
          rel="noreferrer"
        >
          <span>
            SOLICITE<span className="contact-arrow">↗</span>
          </span>
          <em>UM ORÇAMENTO.</em>
        </a>
        <div className="contact-bottom">
          <p>
            Envie seu desenho, sua especificação
            <br />e informe a aplicação e a quantidade necessária.
          </p>
          <a href={wa("Olá, equipe Usibar!")} target="_blank" rel="noreferrer">
            {company.phoneDisplay} ↗
          </a>
          <a href={`mailto:${company.email}`}>{company.email} ↗</a>
        </div>
      </section>
      <footer className="site-footer">
        <span>
          © {new Date().getFullYear()} {company.name}
        </span>
        <span>CILINDROS · BLOCOS HIDRÁULICOS · USINAGEM CNC</span>
        {logged ? (
          <button onClick={() => setEditing(true)}>Editar site ↗</button>
        ) : (
          <a href="/admin">Área administrativa ↗</a>
        )}
      </footer>
      {active && (
        <div className="part-overlay" data-lenis-prevent onClick={() => setActive(null)}>
          <div
            className="part-dialog"
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="part-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="part-dialog-top tiny-mono">
              <span>{active.code} / INSPEÇÃO</span>
              <button onClick={() => setActive(null)} aria-label="Fechar inspeção">
                FECHAR ×
              </button>
            </div>
            <button
              className={"part-inspect-image " + (zoom ? "zoomed" : "")}
              onClick={() => setZoom(!zoom)}
              aria-label={zoom ? "Reduzir imagem" : "Ampliar imagem"}
            >
              <img src={active.imageUrl} alt={active.title} />
              <span className="tiny-mono">{zoom ? "− REDUZIR" : "+ AMPLIAR DETALHES"}</span>
            </button>
            <div className="part-dialog-copy">
              <span className="eyebrow">{active.specs}</span>
              <h2 id="part-title">{active.title}</h2>
              <p>{active.description}</p>
              <a
                href={wa(`Olá! Gostaria de uma cotação para ${active.title} (${active.code}).`)}
                target="_blank"
                rel="noreferrer"
                className="solid-link"
              >
                Solicitar cotação desta peça <Arrow />
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
            commit((c) => ({
              ...c,
              products: c.products.some((x) => x.id === p.id)
                ? c.products.map((x) => (x.id === p.id ? p : x))
                : [p, ...c.products],
            }))
          }
          onDelete={(p) =>
            commit((c) => ({ ...c, products: c.products.filter((x) => x.id !== p.id) }))
          }
        />
      )}
      {companyOpen && (
        <CompanyPanel
          company={company}
          lenis={lenisRef.current}
          onClose={() => setCompanyOpen(false)}
          onSave={(co) => commit((c) => ({ ...c, company: { ...c.company, ...co } }))}
        />
      )}
      {logged && (
        <EditBar
          editing={editing}
          setEditing={setEditing}
          state={save}
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
