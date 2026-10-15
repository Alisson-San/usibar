// Remove only neutral white pixels connected to the exterior, retaining metal highlights.
export function removeBackground(data, width, height) {
  const pixels = new Uint8Array(data),
    seen = new Uint8Array(width * height),
    queue = new Int32Array(width * height);
  let head = 0,
    tail = 0;
  const push = (n) => {
    if (seen[n]) return;
    seen[n] = 1;
    const i = n * 4;
    const lo = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]),
      hi = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (lo < 249 || hi - lo > 8) return;
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
      i = n * 4;
    const bright = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    pixels[i + 3] = Math.min(
      pixels[i + 3],
      Math.round(Math.max(0, Math.min(1, (255 - bright) / 6)) * 255),
    );
    const x = n % width,
      y = Math.floor(n / width);
    if (x > 0) push(n - 1);
    if (x < width - 1) push(n + 1);
    if (y > 0) push(n - width);
    if (y < height - 1) push(n + width);
  }
  return pixels;
}
