"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

type Part = {
  id: string;
  code: string;
  title: string;
  category: string;
  featured: boolean;
  specs: string;
  description: string;
  imageUrl: string;
};
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
function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "↗"}</span>;
}
function EngineeringScene() {
  return (
    <div
      className="engineering-scene"
      aria-label="Ilustração de projeto, usinagem e acionamento hidráulico"
    >
      <div className="scene-grid" />
      <div className="scene-coordinates">
        <span>X / PROJETO</span>
        <span>Y / PRECISÃO</span>
        <span>Z / MOVIMENTO</span>
      </div>
      <div className="blueprint scene-phase">
        <svg viewBox="0 0 700 440" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1">
            <path d="M130 170 410 100 560 175 280 250Z M130 170v160l150 75 280-75V175 M280 250v155 M410 100v160l150 70 M130 330l280-70" />
            <path
              strokeDasharray="5 7"
              d="M65 170h560M65 330h560M280 50v390M410 50v340"
            />
            <path d="M130 140V95m430 65V60M130 95 410 25l150 35M100 170H60v160h40" />
            <circle cx="225" cy="190" r="19" />
            <circle cx="330" cy="162" r="19" />
            <circle cx="435" cy="193" r="19" />
            <ellipse cx="337" cy="304" rx="19" ry="27" />
            <ellipse cx="424" cy="283" rx="19" ry="27" />
            <ellipse cx="510" cy="262" rx="19" ry="27" />
          </g>
          <g fill="currentColor" fontFamily="monospace" fontSize="11">
            <text x="190" y="80">
              GEOMETRIA SOB MEDIDA
            </text>
            <text x="293" y="430">
              ESTUDO DE ENGENHARIA / ILUSTRATIVO
            </text>
          </g>
        </svg>
        <div className="drawing-crosshair" />
      </div>
      <div className="machining scene-phase">
        <div className="machine-spindle">
          <div className="spindle-motor" />
          <div className="spindle-neck" />
          <div className="spindle-tool" />
        </div>
        <div className="metal-stock">
          <div className="milled-channel" />
          <i />
          <i />
          <i />
        </div>
        <div className="machine-bed" />
        {Array.from({ length: 7 }, (_, i) => (
          <i className={`metal-chip chip-${i}`} key={i} />
        ))}
      </div>
      <div className="hydraulics scene-phase">
        <div className="cylinder-shadow" />
        <div className="cylinder-body">
          <i className="cylinder-band first" />
          <i className="cylinder-band second" />
          <span className="cylinder-mark">USIBAR / HIDRÁULICA</span>
          <div className="cylinder-port" />
        </div>
        <div className="cylinder-rod">
          <div className="rod-eye" />
        </div>
        <div className="cylinder-back-eye" />
        <div className="force-line">
          <span>PRESSÃO → FORÇA LINEAR</span>
          <i />
        </div>
      </div>
      <div className="scene-caption">
        <span>VISUALIZAÇÃO CONCEITUAL</span>
        <span>USIBAR / ENGENHARIA</span>
      </div>
    </div>
  );
}

export default function UsibarHome() {
  const [data, setData] = useState<any>(null),
    [failed, setFailed] = useState(false),
    [filter, setFilter] = useState("all"),
    [active, setActive] = useState<Part | null>(null),
    [menu, setMenu] = useState(false),
    [stage, setStage] = useState(0),
    [zoom, setZoom] = useState(false),
    [progress, setProgress] = useState(0);
  const root = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    lenisRef = useRef<Lenis | null>(null);
  useEffect(() => {
    fetch("/api/company", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
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
            onUpdate: () => setProgress(Math.round(count.value)),
          })
          .to(".intro-shutter", {
            yPercent: -100,
            duration: 0.8,
            ease: "power4.inOut",
          })
          .from(
            ".hero-title .line-inner",
            {
              yPercent: 110,
              rotate: 5,
              stagger: 0.1,
              duration: 1,
              ease: "power4.out",
            },
            "-=.45",
          )
          .from(
            ".hero-product",
            {
              y: 130,
              rotate: -18,
              scale: 0.7,
              opacity: 0,
              duration: 1.5,
              ease: "power3.out",
            },
            "-=1",
          )
          .from(
            ".hero-note,.hero-bottom",
            { y: 35, opacity: 0, stagger: 0.12, duration: 0.8 },
            "-=.8",
          );
        gsap.to(".hero-product", {
          y: -24,
          rotate: 3,
          duration: 3.5,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          delay: 2.6,
        });
        gsap.to(".hero-orbit", {
          rotate: 360,
          duration: 65,
          repeat: -1,
          ease: "none",
        });
        gsap.to(".page-course", {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: "body",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.5,
          },
        });
        gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) =>
          gsap.from(el, {
            y: 70,
            opacity: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%" },
          }),
        );
        const machining = gsap.timeline({ repeat: -1 });
        machining
          .to(".machine-spindle", { x: 110, duration: 1.4, ease: "sine.inOut" })
          .to(".machine-spindle", { y: 36, duration: 0.7 })
          .to(".machine-spindle", { x: -90, duration: 2.4, ease: "none" })
          .to(".machine-spindle", { y: 0, duration: 0.7 })
          .to(".machine-spindle", { x: 0, duration: 1 });
        gsap.to(".metal-chip", {
          x: () => gsap.utils.random(-130, 130),
          y: () => gsap.utils.random(-100, -20),
          rotate: () => gsap.utils.random(-170, 170),
          opacity: 0,
          stagger: 0.12,
          duration: 0.8,
          repeat: -1,
          ease: "power2.out",
        });
        gsap.to(".cylinder-rod", {
          x: 100,
          duration: 2.5,
          ease: "power2.inOut",
          repeat: -1,
          yoyo: true,
        });
        gsap.to(".drawing-crosshair", {
          x: 180,
          y: 100,
          duration: 3,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
        return () => {
          intro.kill();
          machining.kill();
        };
      });
      mm.add(
        "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
        () => {
          const tl = gsap.timeline({
            scrollTrigger: {
              id: "manufacturing",
              trigger: ".manufacturing",
              start: "top top",
              end: "+=2100",
              pin: true,
              scrub: 0.7,
              onUpdate: (s) =>
                setStage(Math.min(2, Math.floor(s.progress * 3))),
            },
          });
          tl.to(".blueprint", { opacity: 0, scale: 1.2, duration: 1 }, 1)
            .fromTo(
              ".machining",
              { opacity: 0, y: 80 },
              { opacity: 1, y: 0, duration: 1 },
              1,
            )
            .to(".machining", { opacity: 0, y: -60, duration: 1 }, 3)
            .fromTo(
              ".hydraulics",
              { opacity: 0, x: -70 },
              { opacity: 1, x: 0, duration: 1 },
              3,
            )
            .to(".hydraulics", { scale: 1.04, duration: 1 }, 4);
          gsap.to(".hero-product-wrap", {
            yPercent: 25,
            rotate: -9,
            ease: "none",
            scrollTrigger: {
              trigger: ".hero",
              start: "top top",
              end: "bottom top",
              scrub: 1,
            },
          });
        },
      );
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const lenis = new Lenis({
            lerp: 0.08,
            smoothWheel: true,
            anchors: true,
          });
          lenisRef.current = lenis;
          lenis.on("scroll", ScrollTrigger.update);
          const tick = (time: number) => lenis.raf(time * 1000);
          gsap.ticker.add(tick);
          return () => {
            gsap.ticker.remove(tick);
            lenis.destroy();
            lenisRef.current = null;
          };
        },
      );
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
  }, [filter, data]);
  useEffect(() => {
    if (!active) return;
    const prev = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lenisRef.current?.stop();
    setZoom(false);
    dialog.current?.querySelector("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
      if (e.key === "Tab") {
        const nodes =
          dialog.current?.querySelectorAll<HTMLElement>("button,a[href]");
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
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      lenisRef.current?.start();
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, [active]);
  if (!data)
    return (
      <main className="site-loading">
        <span className="eyebrow">USIBAR / COMPONENTES HIDRÁULICOS</span>
        <p>
          {failed
            ? "Não foi possível carregar o catálogo."
            : "Preparando a apresentação."}
        </p>
        {failed && (
          <button onClick={() => location.reload()}>Tentar novamente ↗</button>
        )}
      </main>
    );
  const { company, sectors, products } = data;
  const parts: Part[] = products
    .filter((p: Part) => filter === "all" || p.category === filter)
    .sort((a: Part, b: Part) => Number(b.featured) - Number(a.featured));
  const wa = (text: string) =>
    `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(text)}`;
  return (
    <main className="usibar-site" ref={root}>
      <div className="intro-shutter" aria-hidden="true">
        <div className="intro-brand">
          USIBAR<span>✳</span>
        </div>
        <div className="intro-meter">
          <i style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <div className="intro-info">
          <span>USIBAR / TECNOLOGIA EM HIDRÁULICA</span>
          <span>{String(progress).padStart(3, "0")} / 100</span>
        </div>
      </div>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Usibar, início">
          <img
            src="/assets/logo-usibar-light.webp"
            alt="Usibar — Tecnologia em hidráulica"
          />
        </a>
        <nav
          className={menu ? "main-nav open" : "main-nav"}
          aria-label="Navegação principal"
        >
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
          <span>{company.city} — BRASIL</span>
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
                {company.subheadline}
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
              <span className="tiny-mono">
                FORÇA LINEAR · FABRICAÇÃO SOB MEDIDA
              </span>
            </div>
            <div className="hero-seal">
              <strong>{company.experienceYears}</strong>
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
            <span className="scroll-disc">↓</span>CONHEÇA O PROCESSO DE
            FABRICAÇÃO
          </a>
          <p>{company.headline}</p>
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
            <div className="process-index">
              {steps[stage].no}
              <span>/ 03</span>
            </div>
            <div className="process-text" key={stage}>
              <span className="eyebrow">{steps[stage].label}</span>
              <h2>
                {steps[stage].title.split("\n").map((line, i) => (
                  <span key={i}>
                    {line}
                    <br />
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
                  onClick={() => {
                    const sequence = ScrollTrigger.getById("manufacturing");
                    if (sequence) {
                      const target =
                        sequence.start +
                        (sequence.end - sequence.start) * ((i + 0.5) / 3);
                      if (lenisRef.current) lenisRef.current.scrollTo(target);
                      else window.scrollTo({ top: target, behavior: "smooth" });
                    } else setStage(i);
                  }}
                  aria-pressed={stage === i}
                >
                  <span>{step.no}</span>
                  {step.label}
                </button>
              ))}
            </div>
          </div>
          <div className={`process-visual mobile-stage-${stage}`}>
            <EngineeringScene />
          </div>
        </div>
        <p className="process-footnote">
          Desenhos e mecanismos ilustrativos. Cada componente é desenvolvido
          conforme a aplicação.
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
                    : products.filter((p: Part) => p.category === value).length}
                </span>
              </button>
            ))}
          </div>
          <span className="tiny-mono">PRODUÇÃO CONFORME PROJETO ↙</span>
        </div>
        <div className="product-grid">
          {parts.map((part, i) => (
            <button
              className="product-card"
              key={part.id}
              onClick={() => setActive(part)}
              aria-label={`Inspecionar ${part.title}`}
            >
              <div className="product-top tiny-mono">
                <span>
                  {part.code}
                  {part.featured ? " / DESTAQUE" : ""}
                </span>
                <span>
                  {String(i + 1).padStart(2, "0")} /{" "}
                  <span className="inspect-plus">+</span>
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
                    {part.category === "cilindros"
                      ? "CILINDRO HIDRÁULICO"
                      : "BLOCO HIDRÁULICO"}
                  </span>
                  <h3>{part.title}</h3>
                </div>
                <span className="round-arrow">↗</span>
              </div>
            </button>
          ))}
        </div>
        <div className="catalog-close">
          <span className="mini-cross">✳</span>
          <p>
            Precisa de outra configuração?
            <br />
            <strong>
              Fabricamos conforme as especificações do seu projeto.
            </strong>
          </p>
          <a
            href={wa(
              "Olá! Tenho um projeto especial e gostaria de conversar com a Usibar.",
            )}
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
          <span className="image-caption tiny-mono">
            DENTRO DA USIBAR / {company.city}
          </span>
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
          <p>{company.aboutParagraph1}</p>
          <p>{company.aboutParagraph2}</p>
          <p>{company.aboutParagraph3}</p>
          <div className="origin-stat">
            <strong>{company.experienceYears}</strong>
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
          href={wa(
            "Olá! Gostaria de solicitar um orçamento de componentes hidráulicos.",
          )}
          target="_blank"
          rel="noreferrer"
        >
          SOLICITE<span className="contact-arrow">↗</span>
          <br />
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
        <a href="/admin">Área administrativa ↗</a>
      </footer>
      {active && (
        <div
          className="part-overlay"
          data-lenis-prevent
          onClick={() => setActive(null)}
        >
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
              <button
                onClick={() => setActive(null)}
                aria-label="Fechar inspeção"
              >
                FECHAR ×
              </button>
            </div>
            <button
              className={"part-inspect-image " + (zoom ? "zoomed" : "")}
              onClick={() => setZoom(!zoom)}
              aria-label={zoom ? "Reduzir imagem" : "Ampliar imagem"}
            >
              <img src={active.imageUrl} alt={active.title} />
              <span className="tiny-mono">
                {zoom ? "− REDUZIR" : "+ AMPLIAR DETALHES"}
              </span>
            </button>
            <div className="part-dialog-copy">
              <span className="eyebrow">{active.specs}</span>
              <h2 id="part-title">{active.title}</h2>
              <p>{active.description}</p>
              <a
                href={wa(
                  `Olá! Gostaria de uma cotação para ${active.title} (${active.code}).`,
                )}
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
    </main>
  );
}
