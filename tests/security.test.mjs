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
