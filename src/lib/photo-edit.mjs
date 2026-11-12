const clamp = (min, max, v) => Math.max(min, Math.min(max, v));
const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/**
 * Packs PNG-encoded square frames (e.g. 16x16, 32x32) into a standard Windows .ico binary buffer.
 * @param {{ size: number, png: Uint8Array }[]} frames
 * @returns {Uint8Array}
 */
export function packIco(frames) {
  const count = frames.length;
  const headerSize = 6 + count * 16;
  let total = headerSize;
  for (const f of frames) total += f.png.byteLength;

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  // ICONDIR: reserved=0, type=1 (icon), count
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, count, true);

  let offset = headerSize;
  frames.forEach((f, idx) => {
    const entry = 6 + idx * 16;
    const dim = f.size >= 256 ? 0 : f.size;
    out[entry] = dim; // width
    out[entry + 1] = dim; // height
    out[entry + 2] = 0; // palette colors
    out[entry + 3] = 0; // reserved
    view.setUint16(entry + 4, 1, true); // color planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, f.png.byteLength, true); // byte size
    view.setUint32(entry + 12, offset, true); // byte offset
    out.set(f.png, offset);
    offset += f.png.byteLength;
  });
  return out;
}

/**
 * Minimum scale factor so a rectangle of size (width x height) rotated by angleDeg
 * completely covers an axis-aligned rectangle of the same dimensions.
 * @param {number} angleDeg
 * @param {number} width
 * @param {number} height
 */
export function coverScale(angleDeg, width, height) {
  const rad = (Math.abs(angleDeg) * Math.PI) / 180;
  if (rad < 1e-5 || width <= 0 || height <= 0) return 1;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const aspect = Math.max(width / height, height / width);
  return c + s * aspect;
}

/**
 * Clamps a normalized crop box { x, y, w, h } into [0, 1].
 * @param {{ x: number, y: number, w: number, h: number }} crop
 * @param {number} [minSize]
 */
export function clampCrop(crop, minSize = 0.08) {
  const w = clamp(minSize, 1, crop.w);
  const h = clamp(minSize, 1, crop.h);
  const x = clamp(0, 1 - w, crop.x);
  const y = clamp(0, 1 - h, crop.y);
  return { x, y, w, h };
}

/**
 * Computes a normalized crop box matching a target pixel aspect ratio (targetW / targetH),
 * centered around the existing crop center when provided.
 * @param {number} baseW
 * @param {number} baseH
 * @param {number} targetRatio
 * @param {{ x: number, y: number, w: number, h: number }} [current]
 */
export function fitAspectCrop(baseW, baseH, targetRatio, current) {
  if (baseW <= 0 || baseH <= 0 || targetRatio <= 0) return { x: 0, y: 0, w: 1, h: 1 };
  // Normalized w/h ratio so that (w * baseW) / (h * baseH) === targetRatio
  const normRatio = targetRatio * (baseH / baseW);
  let maxW = 1;
  let maxH = 1 / normRatio;
  if (maxH > 1) {
    maxH = 1;
    maxW = normRatio;
  }
  if (!current) {
    return { x: (1 - maxW) / 2, y: (1 - maxH) / 2, w: maxW, h: maxH };
  }
  const cx = current.x + current.w / 2;
  const cy = current.y + current.h / 2;
  // Preserve approximate scale if already cropped smaller than full, else fit largest centered
  const areaScale = current.w < 0.99 || current.h < 0.99 ? clamp(0.25, 1, Math.sqrt((current.w * current.h) / (maxW * maxH))) : 1;
  const w = maxW * areaScale;
  const h = maxH * areaScale;
  return clampCrop({ x: cx - w / 2, y: cy - h / 2, w, h });
}

/**
 * Resizes a normalized crop box from one of 8 handles ("n","s","e","w","nw","ne","sw","se"),
 * optionally locking pixel aspect ratio.
 * @param {{ x: number, y: number, w: number, h: number }} start
 * @param {"n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se"} handle
 * @param {number} dx
 * @param {number} dy
 * @param {number} baseW
 * @param {number} baseH
 * @param {number | null} [lockedRatio]
 */
export function resizeCropBox(start, handle, dx, dy, baseW, baseH, lockedRatio = null) {
  const minW = Math.min(0.5, Math.max(0.08, 64 / Math.max(64, baseW)));
  const minH = Math.min(0.5, Math.max(0.08, 64 / Math.max(64, baseH)));

  let left = start.x;
  let right = start.x + start.w;
  let top = start.y;
  let bottom = start.y + start.h;

  if (!lockedRatio) {
    if (handle.includes("w")) left = clamp(0, right - minW, left + dx);
    if (handle.includes("e")) right = clamp(left + minW, 1, right + dx);
    if (handle.includes("n")) top = clamp(0, bottom - minH, top + dy);
    if (handle.includes("s")) bottom = clamp(top + minH, 1, bottom + dy);
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  // Normalized ratio k = w / h = lockedRatio * (baseH / baseW)
  const k = lockedRatio * (baseH / baseW);
  const effMinW = Math.max(minW, minH * k);

  if (handle === "e" || handle === "w") {
    const anchorX = handle === "e" ? start.x : right;
    const cy = (top + bottom) / 2;
    const rawW = handle === "e" ? start.w + dx : start.w - dx;
    const maxAvailH = 2 * Math.min(cy, 1 - cy);
    const maxAvailW = handle === "e" ? 1 - anchorX : anchorX;
    const w = clamp(Math.min(effMinW, maxAvailW, maxAvailH * k), Math.min(maxAvailW, maxAvailH * k), rawW);
    const h = w / k;
    return clampCrop({ x: handle === "e" ? anchorX : anchorX - w, y: cy - h / 2, w, h }, 0.04);
  }

  if (handle === "n" || handle === "s") {
    const anchorY = handle === "s" ? start.y : bottom;
    const cx = (left + right) / 2;
    const rawH = handle === "s" ? start.h + dy : start.h - dy;
    const maxAvailW = 2 * Math.min(cx, 1 - cx);
    const maxAvailH = handle === "s" ? 1 - anchorY : anchorY;
    const minHLocked = effMinW / k;
    const h = clamp(Math.min(minHLocked, maxAvailH, maxAvailW / k), Math.min(maxAvailH, maxAvailW / k), rawH);
    const w = h * k;
    return clampCrop({ x: cx - w / 2, y: handle === "s" ? anchorY : anchorY - h, w, h }, 0.04);
  }

  // Corner handles: anchor opposite corner
  const west = handle.includes("w");
  const north = handle.includes("n");
  const ax = west ? right : left;
  const ay = north ? bottom : top;
  const maxAvailW = west ? ax : 1 - ax;
  const maxAvailH = north ? ay : 1 - ay;
  const rawW = west ? start.w - dx : start.w + dx;
  const rawH = north ? start.h - dy : start.h + dy;
  // Blend horizontal & vertical drag delta onto the aspect diagonal
  const targetW = (rawW + rawH * k) / 2;
  const capW = Math.min(maxAvailW, maxAvailH * k);
  const w = clamp(Math.min(effMinW, capW), capW, targetW);
  const h = w / k;
  return clampCrop({ x: west ? ax - w : ax, y: north ? ay - h : ay, w, h }, 0.04);
}

/**
 * Returns true if the RGBA buffer already contains meaningful transparency (e.g. cutout WebP/PNG).
 * @param {Uint8Array | Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 */
export function detectTransparency(rgba, width, height) {
  const total = width * height;
  if (!total) return false;
  let borderCount = 0;
  let borderTrans = 0;
  const check = (n) => {
    borderCount++;
    if (rgba[n * 4 + 3] < 200) borderTrans++;
  };
  for (let x = 0; x < width; x++) {
    check(x);
    if (height > 1) check((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    check(y * width);
    if (width > 1) check(y * width + width - 1);
  }
  return borderCount > 0 && borderTrans > borderCount * 0.03;
}

/**
 * @typedef {{ brightness?: number, contrast?: number, saturation?: number, warmth?: number, sharpness?: number }} ColorAdjustments
 */

/**
 * @param {ColorAdjustments} [adj]
 */
export function hasColorChanges(adj) {
  if (!adj) return false;
  return Boolean(adj.brightness || adj.contrast || adj.saturation || adj.warmth || adj.sharpness);
}

/**
 * Applies brightness (-50..50), contrast (-50..50), saturation (-50..50),
 * warmth (-50..50) and sharpness (0..100) to an RGBA buffer, returning a new Uint8ClampedArray.
 * @param {Uint8Array | Uint8ClampedArray} input
 * @param {number} width
 * @param {number} height
 * @param {ColorAdjustments} adj
 * @returns {Uint8ClampedArray}
 */
export function applyAdjustments(input, width, height, adj = {}) {
  const out = new Uint8ClampedArray(input);
  const total = width * height;
  if (!total || !hasColorChanges(adj)) return out;

  const br = (adj.brightness ?? 0) * 2.1; // -105..+105
  const cVal = clamp(-50, 50, adj.contrast ?? 0);
  const cFactor = cVal >= 0 ? 1 + (cVal / 50) * 1.15 : 1 + (cVal / 50) * 0.55;
  const sat = 1 + clamp(-50, 50, adj.saturation ?? 0) / 50; // 0..2
  const warm = clamp(-50, 50, adj.warmth ?? 0) * 0.65; // -32.5..+32.5
  const sharpAmt = clamp(0, 100, adj.sharpness ?? 0) / 100; // 0..1

  const needTone = br !== 0 || cFactor !== 1 || sat !== 1 || warm !== 0;
  if (needTone) {
    // Precompute per-channel lookup tables for brightness + contrast + warmth
    const lutR = new Int16Array(256);
    const lutG = new Int16Array(256);
    const lutB = new Int16Array(256);
    for (let v = 0; v < 256; v++) {
      const base = (v - 128) * cFactor + 128 + br;
      lutR[v] = Math.round(base + warm);
      lutG[v] = Math.round(base + warm * 0.12);
      lutB[v] = Math.round(base - warm);
    }
    const satChanged = Math.abs(sat - 1) > 0.001;
    for (let i = 0; i < total * 4; i += 4) {
      if (out[i + 3] === 0) continue;
      let r = lutR[out[i]];
      let g = lutG[out[i + 1]];
      let b = lutB[out[i + 2]];
      if (satChanged) {
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        r = Math.round(luma + (r - luma) * sat);
        g = Math.round(luma + (g - luma) * sat);
        b = Math.round(luma + (b - luma) * sat);
      }
      out[i] = clampByte(r);
      out[i + 1] = clampByte(g);
      out[i + 2] = clampByte(b);
    }
  }

  if (sharpAmt > 0.01 && width >= 3 && height >= 3) {
    const src = new Uint8ClampedArray(out);
    const strength = sharpAmt * 0.85;
    const stride = width * 4;
    for (let y = 1; y < height - 1; y++) {
      let idx = (y * width + 1) * 4;
      for (let x = 1; x < width - 1; x++, idx += 4) {
        if (src[idx + 3] < 16) continue;
        for (let c = 0; c < 3; c++) {
          const center = src[idx + c];
          const lap =
            4 * center -
            src[idx - 4 + c] -
            src[idx + 4 + c] -
            src[idx - stride + c] -
            src[idx + stride + c];
          out[idx + c] = clampByte(Math.round(center + lap * strength));
        }
      }
    }
  }

  return out;
}
