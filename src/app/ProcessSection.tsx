"use client";
import { useContext, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";
import {
  EngineeringScene,
  ROD_EYE,
  TITLE_BLOCK,
  VIEW,
  sceneTimeline,
  type SceneTimeline,
} from "./EngineeringScene";
import { CopyContext, Editable, styleOf, T } from "./copy";

export type Step = { label: string; title: string; copy: string };

// Places a note in drawing units so it stays glued to the art at any width.
const at = (x: number, y: number, w: number, h?: number) =>
  ({ "--x": x, "--y": y, "--w": w, ...(h ? { "--h": h } : {}) }) as React.CSSProperties;

// Title words rise from a mask; body words are "typed" in. Plain text while editing.
function Words({ text, kind }: { text: string; kind: "w" | "t" }) {
  return (
    <>
      {text.split(/\s+/).map((word, i) => (
        <span key={i}>
          {i > 0 && " "}
          {kind === "w" ? (
            <span className="w">
              <span>{word}</span>
            </span>
          ) : (
            <span className="t">{word}</span>
          )}
        </span>
      ))}
    </>
  );
}

export function ProcessSection({
  num,
  steps,
  editing,
  lenis,
  onEdit,
}: {
  num: string;
  steps: Step[];
  editing: boolean;
  lenis: React.RefObject<Lenis | null>;
  onEdit: (index: number, key: keyof Step, value: string) => void;
}) {
  const { styles } = useContext(CopyContext);
  const spacer = useRef<HTMLDivElement>(null),
    section = useRef<HTMLElement>(null),
    frame = useRef<HTMLDivElement>(null),
    rail = useRef<HTMLDivElement>(null),
    scene = useRef<{ s: SceneTimeline; scroll: boolean } | null>(null);
  const [stage, setStage] = useState(0),
    [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 699px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const textKey = steps.map((s) => s.label + s.title + s.copy).join("|");

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        reduced: "(prefers-reduced-motion: reduce)",
      },
      (c) => {
        let last = -1;
        const fills = Array.from(rail.current!.querySelectorAll<HTMLElement>("i"));
        const s = sceneTimeline(frame.current!, (t, st) => {
          const ends = [...s.starts.slice(1), s.tl.duration()];
          fills.forEach((f, i) =>
            f.style.setProperty(
              "--fill",
              String(gsap.utils.clamp(0, 1, (t - s.starts[i]) / (ends[i] - s.starts[i]))),
            ),
          );
          if (st !== last) {
            frame.current!.dataset.stage = String(st);
            setStage((last = st));
          }
        }, { compact });
        const scroll = !!c.conditions?.motion;
        scene.current = { s, scroll };
        if (scroll)
          ScrollTrigger.create({
            id: "manufacturing",
            trigger: section.current,
            start: "top top",
            end: () => "+=" + Math.round(innerHeight * 3.4),
            pin: true,
            // Our own wrapper is the pin spacer, so GSAP never moves the section out of the place
            // React rendered it; otherwise React's later edits around the section would fail.
            pinSpacer: spacer.current,
            scrub: 0.8,
            animation: s.tl,
            anticipatePin: 1,
            refreshPriority: 1,
            invalidateOnRefresh: true,
          });
        else s.tl.time(s.rests[0]);
        return () => {
          s.tl.kill();
          scene.current = null;
        };
      },
    );
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    return () => mm.revert();
  }, [compact, editing, textKey]);

  function goStage(i: number) {
    const cur = scene.current;
    if (!cur) return;
    const { s, scroll } = cur;
    if (!scroll) return s.tl.time(s.rests[i]);
    const st = ScrollTrigger.getById("manufacturing");
    if (!st) return;
    const target = st.start + (st.end - st.start) * (s.rests[i] / s.tl.duration());
    if (lenis.current) lenis.current.scrollTo(target, { duration: 1.4 });
    else window.scrollTo({ top: target, behavior: "smooth" });
  }

  const field = (i: number, key: keyof Step, kind: "w" | "t", label: string) =>
    editing ? (
      <Editable
        value={steps[i][key]}
        editing
        label={`Etapa ${i + 1} — ${label}`}
        styleKey={`process.${i}.${key}`}
        onCommit={(v) => onEdit(i, key, v)}
      />
    ) : (
      <span style={styleOf(styles[`process.${i}.${key}`])}>
        <Words text={steps[i][key]} kind={kind} />
      </span>
    );

  return (
    <div className="pin-host" ref={spacer}>
      <section id="processo" className="manufacturing" ref={section}>
        <div className="process-top eyebrow">
          <span>
            {num} — <T k="process.eyebrow" d="DO DESENHO À PEÇA" label="Processo — rótulo" />
          </span>
          <a href="#pecas" className="skip-scene">
            <T k="process.skip" d="Pular animação" label="Processo — pular" /> ↓
          </a>
        </div>
        <span className="stage-mark" aria-hidden="true" key={stage}>
          0{stage + 1}
        </span>
        <div
          className="scene-frame"
          ref={frame}
          role="group"
          aria-label="Processo de fabricação em três etapas: desenho, usinagem e movimento"
          style={{ "--vw": VIEW.w, "--vh": VIEW.h } as React.CSSProperties}
        >
          <div className="scene-grid" />
          <EngineeringScene compact={compact} />
          <div className="note-stack">
            <article className="note note-drawing" aria-label={`Etapa 1 de 3: ${steps[0].label}`}>
              <div className="pos tb-head" style={at(TITLE_BLOCK.x, TITLE_BLOCK.y, TITLE_BLOCK.w, TITLE_BLOCK.head)}>
                <span>
                  <T k="process.tb.title" d="USIBAR · DESENHO TÉCNICO" label="Carimbo — título" />
                </span>
                <span>
                  <T k="process.tb.sheet" d="FOLHA 01/03" label="Carimbo — folha" />
                </span>
              </div>
              <div className="pos tb-main" style={at(TITLE_BLOCK.x, TITLE_BLOCK.y + TITLE_BLOCK.head, TITLE_BLOCK.w, TITLE_BLOCK.h - TITLE_BLOCK.head - TITLE_BLOCK.foot)}>
                <span className="note-label">{field(0, "label", "t", "rótulo")}</span>
                <h3>{field(0, "title", "w", "título")}</h3>
                <p>{field(0, "copy", "t", "texto")}</p>
              </div>
              <div className="pos tb-foot" style={at(TITLE_BLOCK.x, TITLE_BLOCK.y + TITLE_BLOCK.h - TITLE_BLOCK.foot, TITLE_BLOCK.w, TITLE_BLOCK.foot)}>
                <span>
                  <small>
                    <T k="process.tb.scale" d="ESCALA" label="Carimbo — campo 1" />
                  </small>
                  <T k="process.tb.scale.v" d="1:5" label="Carimbo — valor 1" />
                </span>
                <span>
                  <small>
                    <T k="process.tb.unit" d="UNIDADE" label="Carimbo — campo 2" />
                  </small>
                  <T k="process.tb.unit.v" d="mm" label="Carimbo — valor 2" />
                </span>
                <span>
                  <small>
                    <T k="process.tb.rev" d="REVISÃO" label="Carimbo — campo 3" />
                  </small>
                  <T k="process.tb.rev.v" d="A" label="Carimbo — valor 3" />
                </span>
              </div>
            </article>
            <article className="note note-machine pos" style={at(740, 130, 420, 330)} aria-label={`Etapa 2 de 3: ${steps[1].label}`}>
              <div className="cnc-head">
                <span>
                  <T k="process.cnc.title" d="CNC · G81 FURAÇÃO" label="Painel CNC — título" />
                </span>
                <span className="cnc-live">
                  <T k="process.cnc.live" d="EM EXECUÇÃO" label="Painel CNC — estado" />
                </span>
              </div>
              <dl className="cnc-dro">
                {["x", "y", "z"].map((a) => (
                  <div key={a}>
                    <dt>{a.toUpperCase()}</dt>
                    <dd className={`dro-${a}`}>000.00</dd>
                  </div>
                ))}
              </dl>
              <span className="note-label">
                <span aria-hidden="true">&gt; </span>
                {field(1, "label", "t", "rótulo")}
              </span>
              <h3>{field(1, "title", "w", "título")}</h3>
              <p>
                {field(1, "copy", "t", "texto")}
                <span className="caret" aria-hidden="true" />
              </p>
            </article>
            <article className="note note-force" aria-label={`Etapa 3 de 3: ${steps[2].label}`}>
              <div className="pos push" style={at(880, 150, 290)}>
                <span className="note-label">{field(2, "label", "t", "rótulo")}</span>
                <h3>{field(2, "title", "w", "título")}</h3>
              </div>
              <span className="pos stroke-label" style={at(ROD_EYE.from, ROD_EYE.y + 72, 200)}>
                <T k="process.stroke" d="CURSO" label="Processo — cota" /> <span className="stroke-mm">000</span> mm
              </span>
              <p className="pos force-copy" style={at(120, 470, 470)}>
                {field(2, "copy", "t", "texto")}
              </p>
            </article>
          </div>
        </div>
        <div className="process-rail" ref={rail}>
          {steps.map((step, i) => (
            <button
              key={i}
              className={stage === i ? "active" : ""}
              aria-current={stage === i ? "step" : undefined}
              onClick={() => goStage(i)}
            >
              <span>0{i + 1}</span>
              {step.label}
              <i />
            </button>
          ))}
        </div>
        <p className="process-footnote">
          <T k="process.note" d="Desenhos e mecanismos ilustrativos. Cada componente é desenvolvido conforme a aplicação." label="Processo — nota" />
        </p>
      </section>
    </div>
  );
}
