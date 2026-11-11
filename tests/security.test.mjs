import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validData,
  validSession,
  createSession,
} from "../src/lib/security.mjs";
const sample = JSON.parse(fs.readFileSync("data/db.json"));
const publicData = { company: sample.company, products: sample.products };
test("accept complete company and catalog", () =>
  assert.equal(validData(publicData), true));
test("reject missing company fields", () =>
  assert.equal(validData({ company: {}, products: [] }), false));
test("reject executable image URLs", () =>
  assert.equal(
    validData({
      ...publicData,
      products: [{ ...sample.products[0], imageUrl: "javascript:alert(1)" }],
    }),
    false,
  ));
test("reject duplicate product IDs", () =>
  assert.equal(
    validData({
      ...publicData,
      products: [sample.products[0], sample.products[0]],
    }),
    false,
  ));
test("reject unknown category", () =>
  assert.equal(
    validData({
      ...publicData,
      products: [{ ...sample.products[0], category: "other" }],
    }),
    false,
  ));
test("signed session validates", () =>
  assert.equal(
    validSession(createSession("test-secret", 1000), "test-secret", 1001),
    true,
  ));
test("wrong signing key rejected", () =>
  assert.equal(
    validSession(createSession("test-secret", 1000), "wrong-secret", 1001),
    false,
  ));
test("expired session rejected", () =>
  assert.equal(
    validSession(
      createSession("test-secret", 1000),
      "test-secret",
      1000 + 9 * 3600000,
    ),
    false,
  ));
test("malformed session rejected", () =>
  assert.equal(validSession("abc", "secret"), false));
const remoteBase = "https://demo.supabase.co/storage/v1/object/public/catalog/";
const remote = remoteBase + "usibar-00000000-0000-0000-0000-000000000000.webp";
test("accept photos from the configured bucket", () =>
  assert.equal(
    validData({ ...publicData, products: [{ ...sample.products[0], imageUrl: remote }] }, { remoteBase }),
    true,
  ));
test("reject remote photos without a configured bucket", () =>
  assert.equal(
    validData({ ...publicData, products: [{ ...sample.products[0], imageUrl: remote }] }),
    false,
  ));
test("reject photos from another host", () =>
  assert.equal(
    validData(
      { ...publicData, products: [{ ...sample.products[0], imageUrl: remote.replace("demo", "evil") }] },
      { remoteBase },
    ),
    false,
  ));
test("accept editable process and sectors", () =>
  assert.equal(validData({ ...publicData, sectors: sample.sectors, process: sample.process }), true));
test("reject incomplete process", () =>
  assert.equal(validData({ ...publicData, process: sample.process.slice(0, 2) }), false));
test("accept editable services and pillars", () =>
  assert.equal(validData({ ...publicData, services: sample.services, pillars: sample.pillars }), true));
test("reject service with unknown category", () =>
  assert.equal(
    validData({ ...publicData, services: [{ ...sample.services[0], category: "x" }] }),
    false,
  ));

test("accepts photos from the usibar bucket of the central project", () => {
  const base = "https://rwkvsepkevhqzpltmsck.supabase.co/storage/v1/object/public/usibar/";
  const ok = `${base}usibar-123e4567-e89b-12d3-a456-426614174000.webp`;
  assert.equal(
    validData({ ...publicData, products: [{ ...sample.products[0], imageUrl: ok }] }, { remoteBase: base }),
    true,
  );
  assert.equal(
    validData(
      { ...publicData, products: [{ ...sample.products[0], imageUrl: ok.replace("/usibar/usibar-", "/outro/usibar-") }] },
      { remoteBase: base },
    ),
    false,
  );
});
test("accept page texts, address and social links", () =>
  assert.equal(
    validData({
      ...publicData,
      company: { ...sample.company, address: "Rua Martin Biancho, 803", zip: "95730-000" },
      copy: { "hero.title.1": "CILINDROS" },
    }),
    true,
  ));
test("reject social link that is not https", () =>
  assert.equal(
    validData({
      ...publicData,
      company: { ...sample.company, socials: [{ id: "a", network: "instagram", url: "javascript:alert(1)" }] },
    }),
    false,
  ));
test("reject unknown social network", () =>
  assert.equal(
    validData({
      ...publicData,
      company: { ...sample.company, socials: [{ id: "a", network: "orkut", url: "https://x.com" }] },
    }),
    false,
  ));
test("reject malformed text keys", () =>
  assert.equal(validData({ ...publicData, copy: { "<b>": "x" } }), false));
test("accept text colours, sizes, stretched widths and responsive positions", () =>
  assert.equal(
    validData({
      ...publicData,
      styles: {
        "hero.title.1": { color: "#bf4f29", size: 1.2 },
        "hero.note": { width: 85, align: "right", x: 100, y: 0 },
        "origin.eyebrow": { x: 0, y: 100, align: "left" },
      },
    }),
    true,
  ));
test("reject style with script, odd size or out-of-bounds width/position", () => {
  assert.equal(validData({ ...publicData, styles: { a: { color: "red;background:url(x)" } } }), false);
  assert.equal(validData({ ...publicData, styles: { a: { size: 40 } } }), false);
  assert.equal(validData({ ...publicData, styles: { a: { color: "#000000", font: "x" } } }), false);
  assert.equal(validData({ ...publicData, styles: { a: { width: 5 } } }), false);
  assert.equal(validData({ ...publicData, styles: { a: { width: 105 } } }), false);
  assert.equal(validData({ ...publicData, styles: { a: { align: "justify" } } }), false);
  assert.equal(validData({ ...publicData, styles: { a: { x: -1 } } }), false);
  assert.equal(validData({ ...publicData, styles: { a: { y: 101 } } }), false);
});
test("accept reordered built-in and template sections", () =>
  assert.equal(
    validData({
      ...publicData,
      layout: [
        { id: "catalog", type: "catalog" },
        { id: "a1b2c3", type: "stats", hidden: true, data: { title: "Números", items: [{ value: "20+", label: "anos" }] } },
        { id: "x9", type: "text-image", data: { title: "T", imageUrl: "/assets/hero-bench.webp", side: "left" } },
        { id: "quote", type: "quote" },
      ],
    }),
    true,
  ));
test("reject unknown section fields, foreign photos and duplicates", () => {
  assert.equal(validData({ ...publicData, layout: [{ id: "a", type: "cta", data: { onclick: "x" } }] }), false);
  assert.equal(validData({ ...publicData, layout: [{ id: "a", type: "text-image", data: { imageUrl: "https://evil.com/a.webp" } }] }), false);
  assert.equal(validData({ ...publicData, layout: [{ id: "quote", type: "quote" }, { id: "quote", type: "quote" }] }), false);
  assert.equal(validData({ ...publicData, layout: [{ id: "x", type: "catalog" }] }), false);
  assert.equal(validData({ ...publicData, layout: [{ id: "a", type: "iframe", data: {} }] }), false);
});
