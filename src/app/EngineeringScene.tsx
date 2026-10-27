import gsap from "gsap";

// Isometric manifold block (mm-like units) projected into a 720×460 viewBox.
const L = 300,
  W = 160,
  H = 120,
  OX = 300,
  OY = 190;
type V3 = [number, number, number];
const P = (x: number, y: number, z: number) =>
  [OX + (x - y) * 0.866, OY + (x + y) * 0.5 - z] as const;
const fmt = (p: readonly [number, number]) =>
  `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
const line = (...pts: V3[]) => "M" + pts.map((p) => fmt(P(...p))).join("L");
const face = (...pts: V3[]) => line(...pts) + "Z";
function ring([cx, cy, cz]: V3, r: number, plane: "xy" | "xz" | "yz") {
  const pts: V3[] = [];
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * Math.PI * 2,
      c = r * Math.cos(a),
      s = r * Math.sin(a);
    pts.push(
      plane === "xy"
        ? [cx + c, cy + s, cz]
        : plane === "xz"
          ? [cx + c, cy, cz + s]
          : [cx, cy + c, cz + s],
    );
  }
  return line(...pts) + "Z";
}

const holes: { x: number; y: number; r: number }[] = [
  { x: 60, y: 48, r: 15 },
  { x: 150, y: 48, r: 15 },
  { x: 240, y: 48, r: 15 },
  { x: 105, y: 112, r: 11 },
  { x: 195, y: 112, r: 11 },
];
const ports: { c: V3; r: number; plane: "xz" | "yz" }[] = [
  { c: [80, W, 60], r: 20, plane: "xz" },
  { c: [220, W, 60], r: 20, plane: "xz" },
  { c: [L, 80, 60], r: 17, plane: "yz" },
];
const edges = [
  line([0, 0, H], [L, 0, H]),
  line([L, 0, H], [L, W, H]),
  line([L, W, H], [0, W, H]),
  line([0, W, H], [0, 0, H]),
  line([0, W, H], [0, W, 0]),
  line([0, W, 0], [L, W, 0]),
  line([L, W, 0], [L, W, H]),
  line([L, W, 0], [L, 0, 0]),
  line([L, 0, 0], [L, 0, H]),
];
const hidden = [
  line([0, 0, 0], [L, 0, 0]),
  line([0, 0, 0], [0, W, 0]),
  line([0, 0, 0], [0, 0, H]),
];
const dims = [
  {
    path: line([0, W + 34, 0], [L, W + 34, 0]),
    ext: [line([0, W + 6, 0], [0, W + 42, 0]), line([L, W + 6, 0], [L, W + 42, 0])],
    at: P(L / 2, W + 52, 0),
    text: "300",
  },
  {
    path: line([L + 34, 0, 0], [L + 34, W, 0]),
    ext: [line([L + 6, 0, 0], [L + 42, 0, 0]), line([L + 6, W, 0], [L + 42, W, 0])],
    at: P(L + 60, W / 2, 0),
    text: "160",
  },
  {
    path: line([0, W + 34, 0], [0, W + 34, H]),
    ext: [line([0, W + 6, H], [0, W + 42, H])],
    at: P(0, W + 70, H / 2),
    text: "120",
  },
];
const holeAt = (h: (typeof holes)[number]) => P(h.x, h.y, H);
const chipSeeds = Array.from({ length: 6 }, (_, i) => i);

// Hydraulic cylinder section (side elevation).
const CY = 250,
  STROKE = 110;

export function EngineeringScene() {
  return (
    <div
      className="engineering-scene"
      role="img"
      aria-label="Ilustração do processo: desenho técnico de um bloco hidráulico, usinagem CNC dos furos e acionamento de um cilindro hidráulico em corte"
    >
      <div className="scene-grid" />
      <div className="scene-coordinates">
        <span>X / PROJETO</span>
        <span>Y / PRECISÃO</span>
        <span>Z / MOVIMENTO</span>
      </div>
      <svg className="scene-svg" viewBox="0 0 720 460" aria-hidden="true">
        <defs>
          <linearGradient id="sc-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e9e8dd" />
            <stop offset=".55" stopColor="#cfd2c4" />
            <stop offset="1" stopColor="#b9beae" />
          </linearGradient>
          <linearGradient id="sc-front" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#a9af9d" />
            <stop offset=".45" stopColor="#c9cdbd" />
            <stop offset=".5" stopColor="#dfe1d4" />
            <stop offset="1" stopColor="#9da491" />
          </linearGradient>
          <linearGradient id="sc-side" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8a927d" />
            <stop offset="1" stopColor="#6c7462" />
          </linearGradient>
          <radialGradient id="sc-bore" cx=".6" cy=".35" r=".7">
            <stop offset="0" stopColor="#1c211b" />
            <stop offset=".7" stopColor="#3a4135" />
            <stop offset="1" stopColor="#7d8670" />
          </radialGradient>
          <linearGradient id="sc-metal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#4a5145" />
            <stop offset=".25" stopColor="#9aa08f" />
            <stop offset=".45" stopColor="#e6e7dc" />
            <stop offset=".7" stopColor="#7d8473" />
            <stop offset="1" stopColor="#40463b" />
          </linearGradient>
          <linearGradient id="sc-chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a8ae9c" />
            <stop offset=".25" stopColor="#fbfbf4" />
            <stop offset=".6" stopColor="#8f9a80" />
            <stop offset="1" stopColor="#c9cfbd" />
          </linearGradient>
          <linearGradient id="sc-oil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d9703f" />
            <stop offset="1" stopColor="#a8431f" />
          </linearGradient>
          <pattern
            id="sc-hatch"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="7" height="7" fill="#f7f2e9" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="#292c27" strokeWidth="1" />
          </pattern>
          <pattern
            id="sc-flutes"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <rect width="6" height="6" fill="#c8cdbb" />
            <rect width="3" height="6" fill="#363c32" />
          </pattern>
        </defs>

        {/* 01 — Blueprint and 02 — machined solid share the same geometry. */}
        <g className="sc-block">
          <g className="sc-solid">
            <path className="solid-face" d={face([0, 0, H], [L, 0, H], [L, W, H], [0, W, H])} fill="url(#sc-top)" />
            <path className="solid-face" d={face([0, W, H], [L, W, H], [L, W, 0], [0, W, 0])} fill="url(#sc-front)" />
            <path className="solid-face" d={face([L, 0, H], [L, W, H], [L, W, 0], [L, 0, 0])} fill="url(#sc-side)" />
            <path className="solid-face" d={line([0, W, H], [L, W, H], [L, 0, H])} fill="none" stroke="#f9f8f0" strokeWidth="1.5" />
            {ports.map((p, i) => (
              <path key={i} className="solid-face" d={ring(p.c, p.r, p.plane)} fill="url(#sc-bore)" stroke="#e7e8dc" strokeWidth="2" />
            ))}
            {holes.map((h, i) => (
              <g className={`sc-hole sc-hole-${i}`} key={i}>
                <path d={ring([h.x, h.y, H], h.r, "xy")} fill="url(#sc-bore)" stroke="#f3f3ea" strokeWidth="1.5" />
                <path d={ring([h.x + 2, h.y - 2, H], h.r * 0.55, "xy")} fill="#151913" />
              </g>
            ))}
          </g>
          <g className="sc-blueprint" fill="none" stroke="var(--orange)" strokeWidth="1.2">
            {edges.map((d, i) => (
              <path key={i} className="bp-draw" d={d} pathLength={1} />
            ))}
            {holes.map((h, i) => (
              <path key={i} className="bp-draw" d={ring([h.x, h.y, H], h.r, "xy")} pathLength={1} />
            ))}
            {ports.map((p, i) => (
              <path key={i} className="bp-draw" d={ring(p.c, p.r, p.plane)} pathLength={1} />
            ))}
            <g className="bp-fade" strokeDasharray="5 5" strokeWidth="1">
              {hidden.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
            <g className="bp-fade" strokeDasharray="14 4 2 4" strokeWidth=".8">
              <path d={line([-20, 48, H], [L + 20, 48, H])} />
              <path d={line([-20, 112, H], [L + 20, 112, H])} />
              <path d={line([150, -20, H], [150, W + 20, H])} />
            </g>
            {dims.map((d, i) => (
              <g key={i} className="bp-fade sc-dim" strokeWidth=".8">
                <path d={d.path} />
                {d.ext.map((e, j) => (
                  <path key={j} d={e} />
                ))}
                <text x={d.at[0]} y={d.at[1]} fill="var(--orange)" stroke="none" textAnchor="middle">
                  {d.text}
                </text>
              </g>
            ))}
            <g className="bp-fade sc-detail" strokeWidth=".8">
              <path d={`M${fmt(holeAt(holes[2]))}l70 -70h96`} />
              <text x={holeAt(holes[2])[0] + 76} y={holeAt(holes[2])[1] - 78} fill="var(--orange)" stroke="none">
                5× Ø ROSCA SAE
              </text>
            </g>
          </g>
        </g>

        <g className="sc-chips">
          {holes.map((h, i) =>
            chipSeeds.map((c) => (
              <rect
                key={`${i}-${c}`}
                className={`sc-chip sc-chip-${i}`}
                x={holeAt(h)[0] - 3}
                y={holeAt(h)[1] - 1}
                width={c % 2 ? 7 : 5}
                height="2"
                rx="1"
                fill={c % 3 ? "#7f8872" : "#c4c8b8"}
              />
            )),
          )}
        </g>

        <g className="sc-spindle">
          <rect x="-30" y="-232" width="60" height="118" rx="5" fill="url(#sc-metal)" stroke="#4b5246" />
          <rect x="-30" y="-200" width="60" height="5" fill="#3d4339" opacity=".5" />
          <rect x="-30" y="-150" width="60" height="5" fill="#3d4339" opacity=".5" />
          <path d="M-22 -114h44l-10 30h-24z" fill="url(#sc-metal)" stroke="#4b5246" />
          <rect x="-9" y="-84" width="18" height="20" fill="url(#sc-metal)" />
          <rect x="-5" y="-64" width="10" height="60" fill="url(#sc-flutes)" />
          <path d="M-5 -4h10l-5 6z" fill="#363c32" />
        </g>

        <g className="sc-dro sc-detail" fontFamily="var(--font-mono), monospace" fontSize="11">
          <rect x="18" y="20" width="150" height="74" fill="#292c27" rx="2" />
          <text x="30" y="40" fill="#d97848" fontSize="9" letterSpacing="1">CNC / G81 FURAÇÃO</text>
          <text className="dro-x" x="30" y="58" fill="#f7f2e9">X  000.00</text>
          <text className="dro-y" x="30" y="72" fill="#f7f2e9">Y  000.00</text>
          <text className="dro-z" x="30" y="86" fill="#f7f2e9">Z  000.00</text>
        </g>

        {/* 03 — Hydraulic cylinder in section. */}
        <g className="sc-cylinder">
          <g className="cyl-ports" fill="none" stroke="#292c27" strokeWidth="1.2">
            <path d="M162 204V150h-24" />
            <path d="M176 204V164h-38" />
            <path d="M392 204V164h70" />
            <path d="M406 204V150h56" />
            <path className="cyl-flow-a" d="M108 157h46V206" stroke="var(--orange)" strokeWidth="5" strokeDasharray="7 9" />
            <path className="cyl-flow-b" d="M399 206V157h70" stroke="var(--orange)" strokeWidth="5" strokeDasharray="7 9" opacity=".45" />
          </g>
          <g className="cyl-gauge">
            <circle cx="120" cy="110" r="30" fill="#f7f2e9" stroke="#292c27" strokeWidth="1.2" />
            <path d="M99 131a30 30 0 1 1 42 0" fill="none" stroke="var(--orange)" strokeWidth="3" strokeDasharray="2 4" />
            <path className="cyl-needle" d="M120 110l0 -22" stroke="#292c27" strokeWidth="2" strokeLinecap="round" />
            <circle cx="120" cy="110" r="3" fill="#292c27" />
            <text className="cyl-bar" x="120" y="68" textAnchor="middle" fontFamily="var(--font-mono), monospace" fontSize="11" fill="#292c27">
              000 bar
            </text>
          </g>
          {/* barrel walls and end caps */}
          <rect x="148" y={CY - 36} width="264" height="72" fill="#f7f2e9" />
          <rect className="cyl-oil-a" x="148" y={CY - 36} width="22" height="72" fill="url(#sc-oil)" />
          <rect className="cyl-oil-b" x="196" y={CY - 36} width="216" height="72" fill="#d97848" opacity=".22" />
          <rect x="148" y={CY - 46} width="264" height="10" fill="url(#sc-hatch)" stroke="#292c27" />
          <rect x="148" y={CY + 36} width="264" height="10" fill="url(#sc-hatch)" stroke="#292c27" />
          <rect x="128" y={CY - 52} width="20" height="104" fill="url(#sc-hatch)" stroke="#292c27" />
          <g className="cyl-move">
            <rect x="196" y={CY - 14} width="300" height="28" fill="url(#sc-chrome)" stroke="#6b745f" />
            <rect x="170" y={CY - 36} width="26" height="72" fill="#3d4339" stroke="#292c27" />
            <rect x="176" y={CY - 36} width="4" height="72" fill="var(--orange)" />
            <rect x="186" y={CY - 36} width="4" height="72" fill="var(--orange)" />
            <circle cx="518" cy={CY} r="24" fill="#f7f2e9" stroke="#292c27" strokeWidth="9" />
            <circle cx="518" cy={CY} r="9" fill="none" stroke="#292c27" strokeWidth="1" />
          </g>
          <rect x="412" y={CY - 52} width="24" height="38" fill="url(#sc-hatch)" stroke="#292c27" />
          <rect x="412" y={CY + 14} width="24" height="38" fill="url(#sc-hatch)" stroke="#292c27" />
          <circle cx="104" cy={CY} r="22" fill="#f7f2e9" stroke="#292c27" strokeWidth="8" />
          <path d="M126 250h2" stroke="#292c27" strokeWidth="20" />
          <g className="cyl-labels sc-detail" fontFamily="var(--font-mono), monospace" fontSize="10" fill="#292c27">
            <path d="M250 204v-40h20" fill="none" stroke="#292c27" strokeWidth=".8" />
            <text x="274" y="167">CAMISA BRUNIDA</text>
            <path d="M183 296v52h20" fill="none" stroke="#292c27" strokeWidth=".8" />
            <text x="207" y="351">ÊMBOLO + VEDAÇÕES</text>
            <path d="M424 302v46h20" fill="none" stroke="#292c27" strokeWidth=".8" />
            <text x="448" y="351">HASTE CROMADA</text>
          </g>
          <g className="cyl-force" stroke="var(--orange)" fill="none">
            <path d="M550 250h50" strokeWidth="1.5" />
            <path d="M592 242l10 8-10 8" strokeWidth="1.5" />
            <text x="550" y="236" fill="var(--orange)" stroke="none" fontFamily="var(--font-mono), monospace" fontSize="11">
              F = P × A
            </text>
          </g>
        </g>
      </svg>
      <div className="scene-caption">
        <span>VISUALIZAÇÃO CONCEITUAL</span>
        <span>USIBAR / ENGENHARIA</span>
      </div>
    </div>
  );
}

// Stage boundaries (timeline seconds) and the moment each stage reads as complete.
export const STAGE_START = [0, 1.9, 7.1];
export const STAGE_REST = [1.7, 6.8, 10];

export function sceneTimeline(root: HTMLElement, onStage: (s: number) => void) {
  const q = gsap.utils.selector(root);
  const tool = { x: L + 140, y: -60, z: H + 170 };
  const spindle = q(".sc-spindle")[0];
  const [dx, dy, dz] = [".dro-x", ".dro-y", ".dro-z"].map((s) => q(s)[0]);
  const syncTool = () => {
    const [sx, sy] = P(tool.x, tool.y, tool.z);
    gsap.set(spindle, { x: sx, y: sy });
    dx.textContent = `X  ${tool.x.toFixed(2).padStart(6, "0")}`;
    dy.textContent = `Y  ${tool.y.toFixed(2).padStart(6, "0")}`;
    dz.textContent = `Z  ${(tool.z - H).toFixed(2).padStart(6, "0")}`;
  };
  const gauge = { bar: 0 };
  const barText = q(".cyl-bar")[0];
  let stage = -1;

  gsap.set(q(".bp-draw"), { strokeDasharray: 1, strokeDashoffset: 1 });
  gsap.set(q(".bp-fade, .solid-face, .sc-dro, .sc-cylinder, .cyl-labels, .cyl-force"), { opacity: 0 });
  gsap.set(q(".sc-hole"), { scale: 0, transformOrigin: "50% 50%", opacity: 0 });
  gsap.set(q(".sc-chip"), { opacity: 0 });
  gsap.set(q(".sc-spindle"), { opacity: 0 });
  gsap.set(q(".cyl-needle"), { rotation: -120, svgOrigin: "120 110" });
  syncTool();

  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: "none", immediateRender: false },
    onUpdate() {
      const t = tl.time(),
        next = t < STAGE_START[1] ? 0 : t < STAGE_START[2] ? 1 : 2;
      if (next !== stage) onStage((stage = next));
    },
  });

  // 01 — the drawing traces itself, then annotations settle in.
  tl.to(q(".bp-draw"), { strokeDashoffset: 0, duration: 0.7, stagger: 0.035, ease: "power2.inOut" }, 0)
    .to(q(".bp-fade"), { opacity: 1, duration: 0.35, stagger: 0.08 }, 0.6)
    // 02 — the drawing becomes material and the spindle machines each port.
    .to(q(".solid-face"), { opacity: 1, duration: 0.5, stagger: 0.05, ease: "power1.inOut" }, STAGE_START[1])
    .to(q(".sc-blueprint"), { opacity: 0.18, duration: 0.5 }, STAGE_START[1])
    .to(q(".sc-spindle, .sc-dro"), { opacity: 1, duration: 0.3 }, STAGE_START[1] + 0.3);
  let t = STAGE_START[1] + 0.5;
  holes.forEach((h, i) => {
    tl.to(tool, { x: h.x, y: h.y, z: H + 40, duration: 0.42, ease: "power2.inOut", onUpdate: syncTool }, t)
      .to(tool, { z: H + 6, duration: 0.16, ease: "power1.in", onUpdate: syncTool }, t + 0.42)
      .to(q(`.sc-hole-${i}`), { scale: 1, opacity: 1, duration: 0.18, ease: "power2.out" }, t + 0.46)
      .fromTo(
        q(`.sc-chip-${i}`),
        { x: 0, y: 0, rotation: 0, opacity: 1 },
        {
          x: (k) => [-46, 34, -22, 52, -60, 18][k],
          y: (k) => [-34, -48, -58, -20, -14, -64][k],
          rotation: (k) => [-140, 160, 90, -200, 120, -80][k],
          opacity: 0,
          duration: 0.34,
          ease: "power2.out",
        },
        t + 0.5,
      )
      .to(tool, { z: H + 40, duration: 0.16, ease: "power1.out", onUpdate: syncTool }, t + 0.66);
    t += 0.86;
  });
  tl.to(tool, { x: L + 140, y: -60, z: H + 170, duration: 0.5, ease: "power2.in", onUpdate: syncTool }, t)
    .to(q(".sc-spindle, .sc-dro"), { opacity: 0, duration: 0.3 }, t + 0.3)
    // 03 — the block leaves; the cylinder section is pressurised and extends.
    .to(q(".sc-block"), { x: -90, y: -40, opacity: 0, duration: 0.6, ease: "power2.in" }, STAGE_START[2] - 0.2)
    .fromTo(q(".sc-cylinder"), { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, STAGE_START[2] + 0.2)
    .to(q(".cyl-labels"), { opacity: 1, duration: 0.4 }, STAGE_START[2] + 0.6)
    .to(q(".cyl-flow-a"), { strokeDashoffset: -96, duration: 1.8 }, STAGE_START[2] + 0.9)
    .to(q(".cyl-flow-b"), { strokeDashoffset: 96, duration: 1.8 }, STAGE_START[2] + 0.9)
    .to(gauge, {
      bar: 210,
      duration: 0.9,
      ease: "power2.out",
      onUpdate: () => {
        barText.textContent = `${String(Math.round(gauge.bar)).padStart(3, "0")} bar`;
      },
    }, STAGE_START[2] + 0.9)
    .to(q(".cyl-needle"), { rotation: 75, duration: 0.9, ease: "power2.out" }, STAGE_START[2] + 0.9)
    .to(q(".cyl-move"), { x: STROKE, duration: 1.5, ease: "power2.inOut" }, STAGE_START[2] + 1.2)
    .to(q(".cyl-oil-a"), { attr: { width: 22 + STROKE }, duration: 1.5, ease: "power2.inOut" }, STAGE_START[2] + 1.2)
    .to(q(".cyl-oil-b"), { attr: { x: 196 + STROKE, width: 216 - STROKE }, duration: 1.5, ease: "power2.inOut" }, STAGE_START[2] + 1.2)
    .fromTo(q(".cyl-force"), { opacity: 0, x: 0 }, { opacity: 1, x: STROKE, duration: 1.5, ease: "power2.inOut" }, STAGE_START[2] + 1.2)
    .to({}, { duration: 0.2 }, STAGE_REST[2] - 0.2);
  return tl;
}
