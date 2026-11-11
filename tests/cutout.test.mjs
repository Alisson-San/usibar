import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { removeBackground } from "../src/lib/cutout.mjs";
import { ASSET_IMAGES } from "../src/lib/site-actions.mjs";

test("removeBackground preserves images that already have transparent backgrounds", async () => {
  const w = 20,
    h = 20;
  const raw = Buffer.alloc(w * h * 4, 0);
  // Opaque bright white square in the middle over transparent border
  for (let y = 5; y < 15; y++) {
    for (let x = 5; x < 15; x++) {
      const p = (y * w + x) * 4;
      raw[p] = 255;
      raw[p + 1] = 255;
      raw[p + 2] = 255;
      raw[p + 3] = 255;
    }
  }
  const out = removeBackground(new Uint8Array(raw), w, h);
  assert.equal(out[3], 0, "corner stays transparent");
  assert.equal(out[(10 * w + 10) * 4 + 3], 255, "interior bright highlight stays opaque");
});

test("removeBackground cuts outer white backdrop and enclosed eyelet holes while keeping bright metal", async () => {
  const w = 60,
    h = 40;
  const raw = new Uint8Array(w * h * 4);
  // Fill pure white backdrop
  for (let i = 0; i < w * h; i++) {
    raw[i * 4] = 255;
    raw[i * 4 + 1] = 255;
    raw[i * 4 + 2] = 255;
    raw[i * 4 + 3] = 255;
  }
  // Left side: dark steel ring (x: 6..24, y: 8..32) with an enclosed pure-white mounting hole (x: 12..18, y: 15..25)
  for (let y = 8; y <= 32; y++) {
    for (let x = 6; x <= 24; x++) {
      if (x >= 12 && x <= 18 && y >= 15 && y <= 25) continue;
      const p = (y * w + x) * 4;
      raw[p] = 45;
      raw[p + 1] = 48;
      raw[p + 2] = 50;
    }
  }
  // Right side: bright machined aluminum block (x: 32..52, y: 8..32) with a specular glare spot (x: 40..44, y: 16..22)
  for (let y = 8; y <= 32; y++) {
    for (let x = 32; x <= 52; x++) {
      const p = (y * w + x) * 4;
      const glare = x >= 40 && x <= 44 && y >= 16 && y <= 22;
      raw[p] = glare ? 252 : 236;
      raw[p + 1] = glare ? 252 : 238;
      raw[p + 2] = glare ? 252 : 240;
    }
  }
  const out = removeBackground(raw, w, h);
  assert.equal(out[3], 0, "outer backdrop removed");
  assert.equal(out[(10 * w + 10) * 4 + 3], 255, "dark steel body opaque");
  assert.equal(out[(20 * w + 15) * 4 + 3], 0, "enclosed mounting hole cut out");
  assert.equal(out[(20 * w + 42) * 4 + 3], 255, "bright aluminum specular highlight remains 100% opaque");
});

test("all bundled hydraulic part WebP assets have clean alpha cutouts and opaque interiors", async () => {
  for (const rel of ASSET_IMAGES.filter((p) => !p.includes("hero-bench"))) {
    const { data, info } = await sharp(`public${rel}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0, `${rel} top-left corner is transparent`);
    const total = info.width * info.height;
    let transparent = 0,
      opaque = 0,
      semi = 0;
    for (let i = 0; i < total; i++) {
      const a = data[i * 4 + 3];
      if (a === 0) transparent++;
      else if (a === 255) opaque++;
      else semi++;
    }
    assert.ok(transparent > total * 0.15, `${rel} has clean transparent background`);
    assert.ok(opaque > total * 0.03, `${rel} has solid opaque part pixels`);
    assert.ok(semi < opaque * 0.15, `${rel} interior is crisp and not translucent`);
  }
});
