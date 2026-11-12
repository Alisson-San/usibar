"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "@/lib/browser-auth";
import { removeBackground } from "@/lib/cutout.mjs";
import {
  applyAdjustments,
  clampCrop,
  coverScale,
  detectTransparency,
  fitAspectCrop,
  hasColorChanges,
  resizeCropBox,
} from "@/lib/photo-edit.mjs";
import { useModal } from "./editing";

export type PhotoSource = File | Blob | string;

type CropRect = { x: number; y: number; w: number; h: number };
type HandleDir = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
type AspectId = "free" | "original" | "4:3" | "3:2" | "1:1" | "16:9" | "3:4";
type BackdropMode = "checker" | "paper" | "dark";

const ASPECT_OPTIONS: { id: AspectId; label: string; ratio?: number }[] = [
  { id: "free", label: "Livre" },
  { id: "original", label: "Original" },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "3:4", label: "3:4", ratio: 3 / 4 },
];

const SIZE_OPTIONS: { value: number; label: string; hint: string }[] = [
  { value: 1600, label: "1600 px", hint: "Alta nitidez" },
  { value: 1200, label: "1200 px", hint: "Equilibrado" },
  { value: 800, label: "800 px", hint: "Mais leve" },
];

const HANDLES: HandleDir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));

interface LoadedImage {
  fullCanvas: HTMLCanvasElement;
  previewCanvas: HTMLCanvasElement;
  fullPixels: Uint8ClampedArray;
  previewPixels: Uint8ClampedArray;
  width: number;
  height: number;
  hasAlpha: boolean;
}

function rasterizeBitmap(bmp: ImageBitmap, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  const pixels = new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data);
  return { canvas, pixels, width: w, height: h };
}

async function fetchImageBlob(source: PhotoSource): Promise<Blob> {
  if (source instanceof Blob) {
    if (source.type && !["image/jpeg", "image/png", "image/webp"].includes(source.type)) {
      throw Error("Envie uma imagem JPG, PNG ou WebP.");
    }
    if (source.size > 16 * 1024 * 1024) {
      throw Error("Limite de 16 MB para abrir no editor.");
    }
    return source;
  }
  const url = source.trim();
  if (!url) throw Error("Nenhuma imagem selecionada.");
  if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) {
    const res = await fetch(url);
    if (!res.ok) throw Error("Não foi possível carregar a imagem atual.");
    return res.blob();
  }
  try {
    const direct = await fetch(url, { mode: "cors", cache: "no-store" });
    if (direct.ok) return await direct.blob();
  } catch {
    // Fallback to authenticated server-side bucket reader when CORS or proxy blocks direct fetch.
  }
  const proxied = await authFetch(`/api/upload?url=${encodeURIComponent(url)}`);
  if (!proxied.ok) throw Error("Não foi possível carregar a foto remota para edição.");
  return proxied.blob();
}

async function decodePhoto(source: PhotoSource): Promise<LoadedImage> {
  const blob = await fetchImageBlob(source);
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    bmp = await createImageBitmap(blob);
  }
  try {
    const full = rasterizeBitmap(bmp, 2200);
    const prev = rasterizeBitmap(bmp, 880);
    const hasAlpha = detectTransparency(prev.pixels, prev.width, prev.height);
    return {
      fullCanvas: full.canvas,
      previewCanvas: prev.canvas,
      fullPixels: full.pixels,
      previewPixels: prev.pixels,
      width: full.width,
      height: full.height,
      hasAlpha,
    };
  } finally {
    bmp.close?.();
  }
}

function drawTransformed(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  crop: CropRect,
  opts: {
    rot90: number;
    angle: number;
    flipX: boolean;
    flipY: boolean;
    zoom: number;
    panX: number;
    panY: number;
    autoCover: boolean;
  },
) {
  const srcW = img.width;
  const srcH = img.height;
  const baseW = opts.rot90 % 2 === 1 ? srcH : srcW;
  const baseH = opts.rot90 % 2 === 1 ? srcW : srcH;
  if (!baseW || !baseH || !crop.w || !crop.h) return;

  const scaleX = destW / (crop.w * baseW);
  const scaleY = destH / (crop.h * baseH);
  const cx = baseW * (0.5 + opts.panX);
  const cy = baseH * (0.5 + opts.panY);
  const effZoom = opts.zoom * (opts.autoCover ? coverScale(opts.angle, baseW, baseH) : 1);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(destX - crop.x * baseW * scaleX, destY - crop.y * baseH * scaleY);
  ctx.scale(scaleX, scaleY);
  ctx.translate(cx, cy);
  ctx.rotate((opts.angle * Math.PI) / 180);
  ctx.scale(opts.flipX ? -effZoom : effZoom, opts.flipY ? -effZoom : effZoom);
  ctx.rotate((opts.rot90 * Math.PI) / 2);
  ctx.drawImage(img, -srcW / 2, -srcH / 2, srcW, srcH);
  ctx.restore();
}

let checkerPatternCache: CanvasPattern | null = null;
function getCheckerPattern(ctx: CanvasRenderingContext2D) {
  if (checkerPatternCache) return checkerPatternCache;
  const tile = document.createElement("canvas");
  tile.width = 16;
  tile.height = 16;
  const g = tile.getContext("2d")!;
  g.fillStyle = "#ebe6dc";
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = "#dad4c8";
  g.fillRect(0, 0, 8, 8);
  g.fillRect(8, 8, 8, 8);
  checkerPatternCache = ctx.createPattern(tile, "repeat");
  return checkerPatternCache;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Não foi possível exportar a imagem."))),
      type,
      quality,
    );
  });
}

export function PhotoEditorModal({
  source: initialSource,
  initialRemoveBg = false,
  label = "foto",
  lenis,
  onApply,
  onClose,
}: {
  source: PhotoSource;
  initialRemoveBg?: boolean;
  label?: string;
  lenis?: { stop(): void; start(): void } | null;
  onApply: (editedFile: File) => Promise<void> | void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const stageCanvasRef = useRef<HTMLCanvasElement>(null);
  const adjustedPreviewRef = useRef<HTMLCanvasElement | null>(null);
  const cropScratchRef = useRef<HTMLCanvasElement | null>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);

  const [currentSource, setCurrentSource] = useState<PhotoSource>(initialSource);
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"frame" | "adjust">("frame");

  // Transform & crop state
  const [rot90, setRot90] = useState(0);
  const [angle, setAngle] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [autoCover, setAutoCover] = useState(!initialRemoveBg);
  const [aspect, setAspect] = useState<AspectId>("free");
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 1, h: 1 });
  const [maxSide, setMaxSide] = useState(1600);

  // Light, color & background state
  const [removeBg, setRemoveBg] = useState(initialRemoveBg);
  const [tolerance, setTolerance] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [warmth, setWarmth] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [backdrop, setBackdrop] = useState<BackdropMode>("checker");

  // Stage layout & interaction state
  const [stageSize, setStageSize] = useState({ w: 560, h: 400 });
  const [interacting, setInteracting] = useState<"" | "pan" | "angle" | "crop">("");

  useModal(true, dialogRef, () => !saving && onClose(), lenis);

  const resetAll = useCallback(
    (img?: LoadedImage | null) => {
      const hasAlpha = img?.hasAlpha ?? loaded?.hasAlpha ?? false;
      const wantCutout = !hasAlpha && initialRemoveBg;
      setRot90(0);
      setAngle(0);
      setFlipX(false);
      setFlipY(false);
      setZoom(1);
      setPanX(0);
      setPanY(0);
      setAspect("free");
      setCrop({ x: 0, y: 0, w: 1, h: 1 });
      setMaxSide(1600);
      setRemoveBg(wantCutout);
      setAutoCover(!hasAlpha && !wantCutout);
      setTolerance(0);
      setBrightness(0);
      setContrast(0);
      setSaturation(0);
      setWarmth(0);
      setSharpness(0);
      setMsg("");
    },
    [initialRemoveBg, loaded?.hasAlpha],
  );

  // Load & decode image whenever currentSource changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setMsg("");
    decodePhoto(currentSource)
      .then((img) => {
        if (cancelled) return;
        setLoaded(img);
        resetAll(img);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError((e as Error).message || "Não foi possível abrir esta imagem.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track stage container dimensions
  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) {
        setStageSize({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    };
    sync();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [loading]);

  // Base oriented full-res dimensions
  const baseFullW = loaded ? (rot90 % 2 === 1 ? loaded.height : loaded.width) : 1;
  const baseFullH = loaded ? (rot90 % 2 === 1 ? loaded.width : loaded.height) : 1;

  const lockedRatio = useMemo(() => {
    if (aspect === "free") return null;
    if (aspect === "original") return baseFullW / baseFullH;
    return ASPECT_OPTIONS.find((a) => a.id === aspect)?.ratio ?? null;
  }, [aspect, baseFullW, baseFullH]);

  // Output pixel dimensions preview
  const outputDims = useMemo(() => {
    const rawW = crop.w * baseFullW;
    const rawH = crop.h * baseFullH;
    const sc = Math.min(1, maxSide / Math.max(1, rawW, rawH));
    return {
      w: Math.max(1, Math.round(rawW * sc)),
      h: Math.max(1, Math.round(rawH * sc)),
    };
  }, [crop, baseFullW, baseFullH, maxSide]);

  // Frame layout inside stage
  const frameLayout = useMemo(() => {
    const pad = stageSize.w < 500 ? 18 : 26;
    const availW = Math.max(80, stageSize.w - pad * 2);
    const availH = Math.max(80, stageSize.h - pad * 2);
    const sc = Math.min(availW / baseFullW, availH / baseFullH);
    const fw = baseFullW * sc;
    const fh = baseFullH * sc;
    const fx = (stageSize.w - fw) / 2;
    const fy = (stageSize.h - fh) / 2;
    return {
      fx,
      fy,
      fw,
      fh,
      bx: fx + crop.x * fw,
      by: fy + crop.y * fh,
      bw: crop.w * fw,
      bh: crop.h * fh,
    };
  }, [stageSize, baseFullW, baseFullH, crop]);

  // Stage 1 cache: update color-adjusted preview canvas only when color sliders or image change
  useEffect(() => {
    if (!loaded) return;
    const w = loaded.previewCanvas.width;
    const h = loaded.previewCanvas.height;
    let c = adjustedPreviewRef.current;
    if (!c) {
      c = document.createElement("canvas");
      adjustedPreviewRef.current = c;
    }
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    const adj = { brightness, contrast, saturation, warmth, sharpness };
    if (!hasColorChanges(adj)) {
      ctx.drawImage(loaded.previewCanvas, 0, 0);
    } else {
      const next = applyAdjustments(loaded.previewPixels, w, h, adj);
      ctx.putImageData(new ImageData(new Uint8ClampedArray(next), w, h), 0, 0);
    }
  }, [loaded, brightness, contrast, saturation, warmth, sharpness]);

  // Stage 2 render: draw interactive stage preview
  useEffect(() => {
    const canvas = stageCanvasRef.current;
    const adjCanvas = adjustedPreviewRef.current;
    if (!canvas || !adjCanvas || !loaded) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const sw = stageSize.w;
    const sh = stageSize.h;
    if (canvas.width !== Math.round(sw * dpr) || canvas.height !== Math.round(sh * dpr)) {
      canvas.width = Math.round(sw * dpr);
      canvas.height = Math.round(sh * dpr);
    }
    const ctx = canvas.getContext("2d")!;
    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear studio background
    ctx.fillStyle = "#191b18";
    ctx.fillRect(0, 0, sw, sh);

    const { fx, fy, fw, fh, bx, by, bw, bh } = frameLayout;
    const transformOpts = { rot90, angle, flipX, flipY, zoom, panX, panY, autoCover };

    // 1. Subtle outer context inside full frame (dimmed outside crop box)
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx, fy, fw, fh);
    ctx.clip();
    ctx.fillStyle = "#242722";
    ctx.fillRect(fx, fy, fw, fh);
    ctx.globalAlpha = 0.26;
    drawTransformed(ctx, adjCanvas, fx, fy, fw, fh, { x: 0, y: 0, w: 1, h: 1 }, transformOpts);
    ctx.restore();

    // 2. Render active crop interior cleanly (exact match with export pipeline)
    const maxCropPreview = 720;
    const cScale = Math.min(1, maxCropPreview / Math.max(1, bw * dpr, bh * dpr));
    const cw = Math.max(1, Math.round(bw * dpr * cScale));
    const ch = Math.max(1, Math.round(bh * dpr * cScale));

    let scratch = cropScratchRef.current;
    if (!scratch) {
      scratch = document.createElement("canvas");
      cropScratchRef.current = scratch;
    }
    if (scratch.width !== cw || scratch.height !== ch) {
      scratch.width = cw;
      scratch.height = ch;
    }
    const sctx = scratch.getContext("2d", { willReadFrequently: true })!;
    sctx.clearRect(0, 0, cw, ch);
    if (!loaded.hasAlpha) {
      sctx.fillStyle = "#ffffff";
      sctx.fillRect(0, 0, cw, ch);
    }
    drawTransformed(sctx, adjCanvas, 0, 0, cw, ch, crop, transformOpts);

    if (removeBg && !loaded.hasAlpha) {
      const imgData = sctx.getImageData(0, 0, cw, ch);
      const cut = removeBackground(imgData.data, cw, ch, { tolerance });
      sctx.putImageData(new ImageData(new Uint8ClampedArray(cut), cw, ch), 0, 0);
    }

    // Backdrop inside crop box
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();
    if (loaded.hasAlpha || removeBg) {
      if (backdrop === "paper") {
        ctx.fillStyle = "#f7f2e9";
      } else if (backdrop === "dark") {
        ctx.fillStyle = "#222520";
      } else {
        const pat = getCheckerPattern(ctx);
        ctx.fillStyle = pat || "#e8e3d9";
      }
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.fillRect(bx, by, bw, bh);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(scratch, bx, by, bw, bh);
    ctx.restore();

    ctx.restore();
  }, [
    loaded,
    stageSize,
    frameLayout,
    rot90,
    angle,
    flipX,
    flipY,
    zoom,
    panX,
    panY,
    autoCover,
    crop,
    removeBg,
    tolerance,
    brightness,
    contrast,
    saturation,
    warmth,
    sharpness,
    backdrop,
  ]);

  function rotateBy90(dir: -1 | 1) {
    setRot90((r) => (r + (dir === 1 ? 1 : 3)) % 4);
    if (dir === 1) {
      setPanX(-panY);
      setPanY(panX);
      setCrop((c) => clampCrop({ x: 1 - (c.y + c.h), y: c.x, w: c.h, h: c.w }));
    } else {
      setPanX(panY);
      setPanY(-panX);
      setCrop((c) => clampCrop({ x: c.y, y: 1 - (c.x + c.w), w: c.h, h: c.w }));
    }
    if (aspect === "4:3") setAspect("3:4");
    else if (aspect === "3:4") setAspect("4:3");
    else if (aspect !== "free" && aspect !== "original" && aspect !== "1:1") setAspect("free");
  }

  function selectAspect(next: AspectId) {
    setAspect(next);
    if (next === "free") return;
    const ratio = next === "original" ? baseFullW / baseFullH : ASPECT_OPTIONS.find((a) => a.id === next)?.ratio ?? 1;
    setCrop((c) => fitAspectCrop(baseFullW, baseFullH, ratio, c));
  }

  // Pan photo inside stage
  function startPan(e: React.PointerEvent) {
    if (!loaded || saving) return;
    if ((e.target as HTMLElement).closest(".pe-handle")) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const sPanX = panX;
    const sPanY = panY;
    const { fw, fh } = frameLayout;
    setInteracting("pan");

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / Math.max(1, fw);
      const dy = (ev.clientY - startY) / Math.max(1, fh);
      setPanX(clamp(-1.2, 1.2, sPanX + dx));
      setPanY(clamp(-1.2, 1.2, sPanY + dy));
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      setInteracting("");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }

  // Drag any of the 8 crop handles
  const startCropHandle = (handle: HandleDir) => (e: React.PointerEvent) => {
    if (!loaded || saving) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = { ...crop };
    const { fw, fh } = frameLayout;
    setInteracting("crop");

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / Math.max(1, fw);
      const dy = (ev.clientY - startY) / Math.max(1, fh);
      setCrop(resizeCropBox(startRect, handle, dx, dy, baseFullW, baseFullH, lockedRatio));
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      setInteracting("");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

  function onWheelStage(e: React.WheelEvent) {
    if (!loaded || saving) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((z) => Math.round(clamp(0.5, 3, z + step) * 100) / 100);
  }

  async function applyAndSave() {
    if (!loaded || saving) return;
    setSaving(true);
    setMsg("Preparando imagem editada…");
    try {
      // Yield one frame so status message renders immediately
      await new Promise((r) => requestAnimationFrame(r));

      // 1. Build full-resolution color-adjusted canvas
      const fw = loaded.fullCanvas.width;
      const fh = loaded.fullCanvas.height;
      const fullAdj = document.createElement("canvas");
      fullAdj.width = fw;
      fullAdj.height = fh;
      const fctx = fullAdj.getContext("2d")!;
      const adj = { brightness, contrast, saturation, warmth, sharpness };
      if (!hasColorChanges(adj)) {
        fctx.drawImage(loaded.fullCanvas, 0, 0);
      } else {
        const adjusted = applyAdjustments(loaded.fullPixels, fw, fh, adj);
        fctx.putImageData(new ImageData(new Uint8ClampedArray(adjusted), fw, fh), 0, 0);
      }

      // 2. Render cropped & transformed output
      const { w: outW, h: outH } = outputDims;
      const outCanvas = document.createElement("canvas");
      outCanvas.width = outW;
      outCanvas.height = outH;
      const octx = outCanvas.getContext("2d", { willReadFrequently: true })!;
      if (!loaded.hasAlpha) {
        octx.fillStyle = "#ffffff";
        octx.fillRect(0, 0, outW, outH);
      }
      drawTransformed(octx, fullAdj, 0, 0, outW, outH, crop, {
        rot90,
        angle,
        flipX,
        flipY,
        zoom,
        panX,
        panY,
        autoCover,
      });

      // 3. Apply background cutout if enabled
      if (removeBg && !loaded.hasAlpha) {
        const imgData = octx.getImageData(0, 0, outW, outH);
        const cut = removeBackground(imgData.data, outW, outH, { tolerance });
        octx.putImageData(new ImageData(new Uint8ClampedArray(cut), outW, outH), 0, 0);
      }

      // 4. Encode as high-quality WebP (with PNG fallback if browser lacks WebP encoding)
      let blob: Blob;
      let ext = "webp";
      try {
        blob = await canvasToBlob(outCanvas, "image/webp", 0.94);
        if (blob.type !== "image/webp") {
          blob = await canvasToBlob(outCanvas, "image/png");
          ext = "png";
        } else if (blob.size > 7.5 * 1024 * 1024) {
          blob = await canvasToBlob(outCanvas, "image/webp", 0.84);
        }
      } catch {
        blob = await canvasToBlob(outCanvas, "image/png");
        ext = "png";
      }

      const file = new File([blob], `usibar-editada.${ext}`, {
        type: blob.type || `image/${ext}`,
      });
      setMsg("Enviando para o site…");
      await onApply(file);
    } catch (e) {
      setMsg((e as Error).message || "Não foi possível salvar a foto.");
      setSaving(false);
    }
  }

  const hasEdits =
    rot90 !== 0 ||
    angle !== 0 ||
    flipX ||
    flipY ||
    Math.abs(zoom - 1) > 0.005 ||
    Math.abs(panX) > 0.002 ||
    Math.abs(panY) > 0.002 ||
    crop.x > 0.002 ||
    crop.y > 0.002 ||
    crop.w < 0.998 ||
    crop.h < 0.998 ||
    brightness !== 0 ||
    contrast !== 0 ||
    saturation !== 0 ||
    warmth !== 0 ||
    sharpness !== 0 ||
    tolerance !== 0;

  return (
    <div
      className="part-overlay photo-editor-overlay"
      data-lenis-prevent
      onClick={() => !saving && onClose()}
    >
      <div
        ref={dialogRef}
        className="part-dialog photo-editor"
        role="dialog"
        aria-modal="true"
        aria-label={`Editor de ${label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="part-dialog-top tiny-mono pe-top">
          <span>EDITOR DE FOTO · {label.toUpperCase()}</span>
          <div className="pe-top-actions">
            <button
              type="button"
              className="pe-swap-file"
              disabled={saving}
              onClick={() => filePickerRef.current?.click()}
            >
              ⇄ Outra foto…
            </button>
            <button type="button" onClick={onClose} disabled={saving}>
              FECHAR ×
            </button>
          </div>
          <input
            ref={filePickerRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setCurrentSource(f);
            }}
          />
        </div>

        {loading ? (
          <div className="pe-loading tiny-mono" role="status">
            CARREGANDO IMAGEM NO ESTÚDIO…
          </div>
        ) : loadError ? (
          <div className="pe-loading pe-error">
            <p>{loadError}</p>
            <div className="editor-actions">
              <button
                type="button"
                className="solid-link"
                onClick={() => filePickerRef.current?.click()}
              >
                Escolher arquivo do computador ↗
              </button>
              <button type="button" className="danger-link" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="pe-body">
            <div className="pe-left">
              <div
                ref={stageWrapRef}
                className={"pe-stage" + (interacting ? ` is-${interacting}` : "")}
                onPointerDown={startPan}
                onWheel={onWheelStage}
                onDoubleClick={() => {
                  setZoom(1);
                  setPanX(0);
                  setPanY(0);
                }}
                title="Arraste para mover a foto · Role para dar zoom · Duplo clique centraliza"
              >
                <canvas ref={stageCanvasRef} className="pe-canvas" />

                {/* Interactive crop & alignment overlay */}
                <div
                  className="pe-crop-box"
                  style={{
                    left: `${frameLayout.bx}px`,
                    top: `${frameLayout.by}px`,
                    width: `${frameLayout.bw}px`,
                    height: `${frameLayout.bh}px`,
                  }}
                >
                  <i className="pe-grid pe-grid-v1" />
                  <i className="pe-grid pe-grid-v2" />
                  <i className="pe-grid pe-grid-h1" />
                  <i className="pe-grid pe-grid-h2" />
                  <i className="pe-crosshair-h" />
                  <i className="pe-crosshair-v" />
                  {HANDLES.map((h) => (
                    <span
                      key={h}
                      className={`pe-handle pe-h-${h}`}
                      onPointerDown={startCropHandle(h)}
                    />
                  ))}
                </div>

                <span className="pe-badge tiny-mono">
                  {outputDims.w} × {outputDims.h} PX
                  {angle !== 0 ? ` · ${angle > 0 ? "+" : ""}${angle.toFixed(1)}°` : ""}
                  {Math.abs(zoom - 1) > 0.01 ? ` · ${Math.round(zoom * 100)}%` : ""}
                </span>

                {(loaded?.hasAlpha || removeBg) && (
                  <div
                    className="pe-backdrop-bar tiny-mono"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <span>FUNDO:</span>
                    {(
                      [
                        ["checker", "Grade"],
                        ["paper", "Claro"],
                        ["dark", "Escuro"],
                      ] as [BackdropMode, string][]
                    ).map(([id, text]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={backdrop === id}
                        className={backdrop === id ? "on" : ""}
                        onClick={() => setBackdrop(id)}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pe-quickbar">
                <button type="button" onClick={() => rotateBy90(-1)} title="Girar 90° para a esquerda">
                  ↺ −90°
                </button>
                <button type="button" onClick={() => rotateBy90(1)} title="Girar 90° para a direita">
                  ↻ +90°
                </button>
                <button
                  type="button"
                  aria-pressed={flipX}
                  className={flipX ? "on" : ""}
                  onClick={() => setFlipX((v) => !v)}
                  title="Espelhar horizontalmente"
                >
                  ⇆ Espelhar H
                </button>
                <button
                  type="button"
                  aria-pressed={flipY}
                  className={flipY ? "on" : ""}
                  onClick={() => setFlipY((v) => !v)}
                  title="Espelhar verticalmente"
                >
                  ⇅ Espelhar V
                </button>
                <button
                  type="button"
                  className="pe-reset"
                  disabled={!hasEdits}
                  onClick={() => resetAll(loaded)}
                  title="Desfazer todos os ajustes desta foto"
                >
                  ↺ Restaurar
                </button>
              </div>
            </div>

            <div className="pe-right">
              <div className="pe-tabs tiny-mono" role="tablist" aria-label="Ferramentas de edição">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "frame"}
                  className={tab === "frame" ? "on" : ""}
                  onClick={() => setTab("frame")}
                >
                  Enquadrar e ângulo
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "adjust"}
                  className={tab === "adjust" ? "on" : ""}
                  onClick={() => setTab("adjust")}
                >
                  Luz, cor e fundo
                </button>
              </div>

              {tab === "frame" ? (
                <div className="pe-controls">
                  <div className="pe-control">
                    <div className="pe-control-head">
                      <span className="tiny-mono">Ângulo / nivelamento</span>
                      <span className="pe-val tiny-mono">
                        {angle > 0 ? `+${angle.toFixed(1)}°` : `${angle.toFixed(1)}°`}
                        {angle !== 0 && (
                          <button type="button" onClick={() => setAngle(0)}>
                            zerar
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="pe-slider-row">
                      <button
                        type="button"
                        className="pe-step"
                        aria-label="Diminuir 0,5 grau"
                        onClick={() => setAngle((a) => clamp(-45, 45, Math.round((a - 0.5) * 2) / 2))}
                      >
                        −
                      </button>
                      <input
                        type="range"
                        min={-45}
                        max={45}
                        step={0.5}
                        value={angle}
                        aria-label="Ângulo em graus"
                        onPointerDown={() => setInteracting("angle")}
                        onPointerUp={() => setInteracting("")}
                        onBlur={() => setInteracting("")}
                        onDoubleClick={() => setAngle(0)}
                        onChange={(e) => setAngle(Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className="pe-step"
                        aria-label="Aumentar 0,5 grau"
                        onClick={() => setAngle((a) => clamp(-45, 45, Math.round((a + 0.5) * 2) / 2))}
                      >
                        +
                      </button>
                    </div>
                    {!loaded?.hasAlpha && (
                      <label className="editor-check pe-inline-check tiny-mono">
                        <input
                          type="checkbox"
                          checked={autoCover}
                          onChange={(e) => setAutoCover(e.target.checked)}
                        />
                        Preencher cantos automaticamente ao inclinar
                      </label>
                    )}
                  </div>

                  <div className="pe-control">
                    <div className="pe-control-head">
                      <span className="tiny-mono">Zoom / escala da peça</span>
                      <span className="pe-val tiny-mono">
                        {Math.round(zoom * 100)}%
                        {Math.abs(zoom - 1) > 0.005 && (
                          <button
                            type="button"
                            onClick={() => {
                              setZoom(1);
                              setPanX(0);
                              setPanY(0);
                            }}
                          >
                            100%
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="pe-slider-row">
                      <button
                        type="button"
                        className="pe-step"
                        aria-label="Reduzir zoom"
                        onClick={() => setZoom((z) => Math.round(clamp(0.5, 3, z - 0.1) * 100) / 100)}
                      >
                        −
                      </button>
                      <input
                        type="range"
                        min={0.5}
                        max={3}
                        step={0.02}
                        value={zoom}
                        aria-label="Zoom"
                        onDoubleClick={() => setZoom(1)}
                        onChange={(e) => setZoom(Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className="pe-step"
                        aria-label="Aumentar zoom"
                        onClick={() => setZoom((z) => Math.round(clamp(0.5, 3, z + 0.1) * 100) / 100)}
                      >
                        +
                      </button>
                    </div>
                    <small className="pe-hint">
                      Abaixo de 100% cria margem ao redor da peça; arraste a foto no quadro para posicionar.
                    </small>
                  </div>

                  <div className="pe-control">
                    <span className="tiny-mono">Proporção do recorte</span>
                    <div className="pe-pills">
                      {ASPECT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={aspect === opt.id}
                          className={aspect === opt.id ? "selected" : ""}
                          onClick={() => selectAspect(opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pe-control">
                    <div className="pe-control-head">
                      <span className="tiny-mono">Redimensionar saída</span>
                      <span className="tiny-mono pe-dim-note">
                        Final: {outputDims.w} × {outputDims.h} px
                      </span>
                    </div>
                    <div className="pe-pills">
                      {SIZE_OPTIONS.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          aria-pressed={maxSide === s.value}
                          className={maxSide === s.value ? "selected" : ""}
                          onClick={() => setMaxSide(s.value)}
                          title={s.hint}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pe-controls">
                  {loaded?.hasAlpha ? (
                    <div className="pe-alpha-banner tiny-mono">
                      ✓ Esta imagem já possui fundo transparente preservado.
                    </div>
                  ) : (
                    <div className="pe-cutout-box">
                      <label className="editor-check tiny-mono">
                        <input
                          type="checkbox"
                          checked={removeBg}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setRemoveBg(next);
                            setAutoCover(!next);
                          }}
                        />
                        Remover fundo branco automaticamente
                      </label>
                      {removeBg && (
                        <div className="pe-control pe-subcontrol">
                          <div className="pe-control-head">
                            <span className="tiny-mono">Sensibilidade do fundo</span>
                            <span className="pe-val tiny-mono">
                              {tolerance > 0 ? `+${tolerance}` : tolerance}
                              {tolerance !== 0 && (
                                <button type="button" onClick={() => setTolerance(0)}>
                                  padrão
                                </button>
                              )}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-10}
                            max={35}
                            step={1}
                            value={tolerance}
                            aria-label="Sensibilidade do recorte de fundo"
                            onDoubleClick={() => setTolerance(0)}
                            onChange={(e) => setTolerance(Number(e.target.value))}
                          />
                          <small className="pe-hint">
                            Aumente se o fundo da foto estiver levemente acinzentado ou com sombra.
                          </small>
                        </div>
                      )}
                    </div>
                  )}

                  {(
                    [
                      ["Brilho", brightness, setBrightness, -50, 50],
                      ["Contraste", contrast, setContrast, -50, 50],
                      ["Saturação", saturation, setSaturation, -50, 50],
                      ["Temperatura", warmth, setWarmth, -50, 50],
                      ["Nitidez dos detalhes", sharpness, setSharpness, 0, 100],
                    ] as [string, number, (v: number) => void, number, number][]
                  ).map(([name, val, setter, min, max]) => (
                    <div className="pe-control" key={name}>
                      <div className="pe-control-head">
                        <span className="tiny-mono">{name}</span>
                        <span className="pe-val tiny-mono">
                          {val > 0 && min < 0 ? `+${val}` : val}
                          {val !== 0 && (
                            <button type="button" onClick={() => setter(0)}>
                              zerar
                            </button>
                          )}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={1}
                        value={val}
                        aria-label={name}
                        onDoubleClick={() => setter(0)}
                        onChange={(e) => setter(Number(e.target.value))}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="pe-footer">
                {msg && (
                  <p role="status" aria-live="polite" className="editor-msg">
                    {msg}
                  </p>
                )}
                <div className="editor-actions pe-actions">
                  <button
                    type="button"
                    className="solid-link"
                    disabled={saving}
                    onClick={() => void applyAndSave()}
                  >
                    {saving ? "Aplicando…" : "Aplicar foto"} ↗
                  </button>
                  <button
                    type="button"
                    className="pe-cancel"
                    disabled={saving}
                    onClick={onClose}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
