import { test } from "node:test";
import assert from "node:assert/strict";
import { isDemo } from "../src/lib/runtime.mjs";
test("local remains editable", () => assert.equal(isDemo({}), false));
test("Vercel disables local disk mutations", () =>
  assert.equal(isDemo({ VERCEL: "1" }), true));
test("explicit demo can be rehearsed locally", () =>
  assert.equal(isDemo({ DEMO_MODE: "true" }), true));
test("cannot enable local storage on Vercel through a false demo flag", () =>
  assert.equal(isDemo({ VERCEL: "1", DEMO_MODE: "false" }), true));
