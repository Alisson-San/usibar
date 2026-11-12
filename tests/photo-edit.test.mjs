import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import sharp from "sharp";
import {
  applyAdjustments,
  clampCrop,
  coverScale,
  detectTransparency,
  fitAspectCrop,
  hasColorChanges,
  packIco,
  resizeCropBox,
} from "../src/lib/photo-edit.mjs";

test("public/icon.svg renders crisp micrometer-only favicon with transparent outer corners", async () => {
  const svg = await fs.readFile("public/icon.svg");
  const { data, info } = await sharp(svg).resize(64, 64).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 64);
  assert.equal(info.height, 64);
  // Top-left and bottom-right exterior corners are transparent
  assert.equal(data[3], 0, "top-left corner is transparent");
  assert.equal(data[(63 * 64 + 63) * 4 + 3], 0, "bottom-right corner is transparent");

  // Contains Usibar orange (#fa4804) pixels from the micrometer frame
  let orangePixels = 0;
  for (let i = 0; i < 64 * 64; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    if (a > 220 && r > 220 && g > 50 && g < 110 && b < 30) orangePixels++;
  }
  assert.ok(orangePixels > 400, `expected micrometer orange body pixels, got ${orangePixels}`);
});

test("packIco builds valid multi-resolution ICO binary with embedded PNG frames", async () => {
  const svg = await fs.readFile("public/icon.svg");
  const sizes = [16, 32, 48];
  const frames = await Promise.all(
    sizes.map(async (size) => ({
      size,
      png: new Uint8Array(await sharp(svg).resize(size, size).png().toBuffer()),
    })),
  );
  const ico = packIco(frames);
  const view = new DataView(ico.buffer);

  assert.equal(view.getUint16(0, true), 0, "ICONDIR reserved = 0");
  assert.equal(view.getUint16(2, true), 1, "ICONDIR type = 1 (ICO)");
  assert.equal(view.getUint16(4, true), 3, "ICONDIR count = 3");

  let expectedOffset = 6 + 3 * 16;
  frames.forEach((f, idx) => {
    const entry = 6 + idx * 16;
    assert.equal(ico[entry], f.size, `frame ${idx} width`);
    assert.equal(ico[entry + 1], f.size, `frame ${idx} height`);
    assert.equal(view.getUint16(entry + 6, true), 32, "32bpp");
    assert.equal(view.getUint32(entry + 8, true), f.png.byteLength, "payload byte length");
    assert.equal(view.getUint32(entry + 12, true), expectedOffset, "payload byte offset");
    // Verify PNG signature at offset: 89 50 4E 47
    assert.equal(ico[expectedOffset], 0x89);
    assert.equal(ico[expectedOffset + 1], 0x50);
    assert.equal(ico[expectedOffset + 2], 0x4e);
    assert.equal(ico[expectedOffset + 3], 0x47);
    expectedOffset += f.png.byteLength;
  });
  assert.equal(ico.byteLength, expectedOffset);
});

test("coverScale computes exact corner-covering zoom when leveling tilted photos", () => {
  assert.equal(coverScale(0, 1600, 1200), 1);
  const tilted = coverScale(5, 1600, 1200);
  assert.ok(tilted > 1.05 && tilted < 1.2, `expected modest cover scale for 5°, got ${tilted}`);
  assert.equal(coverScale(-5, 1600, 1200), tilted, "symmetric for ±angle");
});

test("fitAspectCrop and resizeCropBox preserve pixel aspect ratios and stay within [0, 1]", () => {
  // 1600x800 (2:1) image cropped to 1:1 square should have w=0.5, h=1 centered at x=0.25
  const sq = fitAspectCrop(1600, 800, 1);
  assert.ok(Math.abs(sq.w - 0.5) < 1e-6);
  assert.ok(Math.abs(sq.h - 1) < 1e-6);
  assert.ok(Math.abs(sq.x - 0.25) < 1e-6);

  // Resize free from SE handle
  const free = resizeCropBox({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, "se", -0.2, -0.3, 1000, 1000, null);
  assert.ok(Math.abs(free.w - 0.6) < 1e-6);
  assert.ok(Math.abs(free.h - 0.5) < 1e-6);

  // Resize aspect-locked (4:3) on a 1600x1200 image from NW handle
  const locked = resizeCropBox({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, "nw", 0.2, 0.2, 1600, 1200, 4 / 3);
  const pixelRatio = (locked.w * 1600) / (locked.h * 1200);
  assert.ok(Math.abs(pixelRatio - 4 / 3) < 1e-3, `expected 4:3 pixel ratio, got ${pixelRatio}`);
  assert.ok(locked.x >= 0 && locked.y >= 0 && locked.x + locked.w <= 1.0001 && locked.y + locked.h <= 1.0001);

  const clamped = clampCrop({ x: -0.4, y: 0.9, w: 0.5, h: 0.5 });
  assert.equal(clamped.x, 0);
  assert.ok(Math.abs(clamped.y - 0.5) < 1e-6);
});

test("detectTransparency distinguishes cutout images from opaque photos", () => {
  const opaque = new Uint8ClampedArray(10 * 10 * 4).fill(255);
  assert.equal(detectTransparency(opaque, 10, 10), false);

  const cutout = new Uint8ClampedArray(10 * 10 * 4).fill(255);
  for (let x = 0; x < 10; x++) cutout[x * 4 + 3] = 0; // transparent top border
  assert.equal(detectTransparency(cutout, 10, 10), true);
});

test("applyAdjustments adjusts brightness, contrast, warmth, saturation and sharpness without touching transparent pixels", () => {
  assert.equal(hasColorChanges({}), false);
  assert.equal(hasColorChanges({ brightness: 0, sharpness: 0 }), false);
  assert.equal(hasColorChanges({ warmth: 10 }), true);

  const w = 5,
    h = 5;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = 120;
    px[i * 4 + 1] = 110;
    px[i * 4 + 2] = 100;
    px[i * 4 + 3] = i === 0 ? 0 : 255;
  }
  // High-contrast center pixel for sharpness test
  const c = (2 * w + 2) * 4;
  px[c] = 180;
  px[c + 1] = 180;
  px[c + 2] = 180;

  const out = applyAdjustments(px, w, h, { brightness: 15, warmth: 20, sharpness: 50 });
  // Transparent pixel RGB stays untouched and alpha remains 0
  assert.equal(out[3], 0);
  assert.equal(out[0], 120);
  // Opaque pixel warmed (R boosted more than B) and brightened
  assert.ok(out[4] > px[4], "red channel brightened & warmed");
  assert.ok(out[4] - out[6] > px[4] - px[6], "warmth increased R-B spread");
  // Center bright pixel sharpened further above neighbors
  const unsharpOnly = applyAdjustments(px, w, h, { sharpness: 60 });
  assert.ok(unsharpOnly[c] > px[c], "sharpness accentuates local detail edge");
});
