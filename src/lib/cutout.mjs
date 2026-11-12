// Remove neutral white studio background (exterior + enclosed holes) while keeping
// pre-cutout transparent PNGs intact and retaining bright metallic faces/highlights.
export function removeBackground(data, width, height, options = {}) {
  const tolerance = typeof options?.tolerance === "number" && Number.isFinite(options.tolerance) ? options.tolerance : 0;
  const edgeLo = Math.max(175, Math.min(253, Math.round(247 - tolerance * 1.6)));
  const edgeDiff = Math.max(4, Math.min(42, Math.round(10 + tolerance * 0.8)));
  const holeSeedLo = Math.max(205, Math.min(254, Math.round(252 - tolerance * 0.6)));
  const holeLo = Math.max(195, Math.min(253, Math.round(248 - tolerance * 0.8)));
  const holeDiff = Math.max(4, Math.min(30, Math.round(8 + tolerance * 0.5)));
  const softTop = Math.max(190, Math.min(254, edgeLo + 3));
  const softSpan = Math.max(5, Math.round(5 + Math.max(0, tolerance) * 0.25));

  const pixels = new Uint8Array(data);
  const total = width * height;
  if (!total) return pixels;

  // 1. Preserve images that already have transparent borders (e.g. cutout PNGs/WebPs).
  let borderCount = 0,
    borderTrans = 0;
  const checkBorder = (n) => {
    borderCount++;
    if (pixels[n * 4 + 3] < 32) borderTrans++;
  };
  for (let x = 0; x < width; x++) {
    checkBorder(x);
    if (height > 1) checkBorder((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    checkBorder(y * width);
    if (width > 1) checkBorder(y * width + width - 1);
  }
  if (borderCount > 0 && borderTrans > borderCount * 0.05) return pixels;

  // 2. Flood-fill neutral white pixels connected to the outer edges.
  const bg = new Uint8Array(total),
    seen = new Uint8Array(total),
    queue = new Int32Array(total);
  let head = 0,
    tail = 0;
  const push = (n) => {
    if (seen[n]) return;
    seen[n] = 1;
    const i = n * 4;
    const lo = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]),
      hi = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (lo < edgeLo || hi - lo > edgeDiff) return;
    bg[n] = 1;
    queue[tail++] = n;
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (head < tail) {
    const n = queue[head++],
      x = n % width,
      y = (n / width) | 0;
    if (x > 0) push(n - 1);
    if (x < width - 1) push(n + 1);
    if (y > 0) push(n - width);
    if (y < height - 1) push(n + width);
  }

  // 3. Clear enclosed pure-white backdrop holes (mounting eyes, tube gaps, loops)
  // while leaving small specular highlights on bright aluminum faces opaque.
  const visitedHole = new Uint8Array(total),
    comp = new Int32Array(total);
  for (let start = 0; start < total; start++) {
    if (bg[start] || visitedHole[start]) continue;
    const si = start * 4;
    const slo = Math.min(pixels[si], pixels[si + 1], pixels[si + 2]),
      shi = Math.max(pixels[si], pixels[si + 1], pixels[si + 2]);
    if (slo < holeSeedLo || shi - slo > Math.max(4, Math.round(4 + tolerance * 0.35))) continue;

    let cHead = 0,
      cTail = 0,
      pure255 = 0,
      edgeSum = 0,
      edgeCnt = 0;
    visitedHole[start] = 1;
    comp[cTail++] = start;
    while (cHead < cTail) {
      const n = comp[cHead++],
        x = n % width,
        y = (n / width) | 0,
        i = n * 4;
      if (pixels[i] >= 254 && pixels[i + 1] >= 254 && pixels[i + 2] >= 254) pure255++;
      const nbs = [
        x > 0 ? n - 1 : -1,
        x < width - 1 ? n + 1 : -1,
        y > 0 ? n - width : -1,
        y < height - 1 ? n + width : -1,
      ];
      for (const nb of nbs) {
        if (nb < 0 || bg[nb] || visitedHole[nb]) continue;
        const ni = nb * 4;
        const lo = Math.min(pixels[ni], pixels[ni + 1], pixels[ni + 2]),
          hi = Math.max(pixels[ni], pixels[ni + 1], pixels[ni + 2]);
        if (lo >= holeLo && hi - lo <= holeDiff) {
          visitedHole[nb] = 1;
          comp[cTail++] = nb;
        } else {
          edgeSum += (pixels[ni] + pixels[ni + 1] + pixels[ni + 2]) / 3;
          edgeCnt++;
        }
      }
    }
    const purePct = (pure255 * 100) / cTail;
    const avgEdge = edgeCnt > 0 ? edgeSum / edgeCnt : 255;
    if (cTail >= 10 && purePct >= 55 && (avgEdge < 230 || (cTail >= 150 && purePct >= 75))) {
      for (let k = 0; k < cTail; k++) bg[comp[k]] = 1;
    }
  }

  // 4. Make background pixels transparent with smooth transition near edgeLo..softTop.
  for (let n = 0; n < total; n++) {
    if (!bg[n]) continue;
    const i = n * 4;
    const bright = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    const a = bright >= softTop ? 0 : Math.round(Math.max(0, Math.min(1, (softTop - bright) / softSpan)) * 255);
    pixels[i + 3] = Math.min(pixels[i + 3], a);
  }

  // 5. Decontaminate 1px white anti-aliased fringe along darker part edges.
  const orig = new Uint8Array(pixels);
  for (let n = 0; n < total; n++) {
    if (bg[n]) continue;
    const x = n % width,
      y = (n / width) | 0;
    let touchesBg = false,
      darkest = 255,
      darkR = 0,
      darkG = 0,
      darkB = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        const nb = ny * width + nx;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && bg[nb]) touchesBg = true;
        if (!bg[nb]) {
          const ni = nb * 4;
          const b = (orig[ni] + orig[ni + 1] + orig[ni + 2]) / 3;
          if (b < darkest) {
            darkest = b;
            darkR = orig[ni];
            darkG = orig[ni + 1];
            darkB = orig[ni + 2];
          }
        }
      }
    }
    if (!touchesBg) continue;
    const i = n * 4;
    const r = orig[i],
      g = orig[i + 1],
      b = orig[i + 2];
    const bright = (r + g + b) / 3;
    if (bright > 190 && darkest < 195 && bright > darkest + 18) {
      const alpha = Math.max(0, Math.min(1, (252 - bright) / Math.max(20, 252 - darkest)));
      pixels[i + 3] = Math.min(orig[i + 3], Math.round(alpha * 255));
      if (alpha > 0.05) {
        pixels[i] = Math.max(0, Math.min(255, Math.round((r - (1 - alpha) * 255) / alpha)));
        pixels[i + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - alpha) * 255) / alpha)));
        pixels[i + 2] = Math.max(0, Math.min(255, Math.round((b - (1 - alpha) * 255) / alpha)));
      } else {
        pixels[i] = darkR;
        pixels[i + 1] = darkG;
        pixels[i + 2] = darkB;
      }
    }
  }
  return pixels;
}
