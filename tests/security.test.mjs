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
