import { test } from "node:test";
import assert from "node:assert/strict";
import { isDemo } from "../src/lib/runtime.mjs";
test("local remains editable", () => assert.equal(isDemo({}), false));
test("Vercel is editable: Supabase Auth guards the writes", () =>
  assert.equal(isDemo({ VERCEL: "1" }), false));
test("explicit demo can be rehearsed anywhere", () => {
  assert.equal(isDemo({ DEMO_MODE: "true" }), true);
  assert.equal(isDemo({ DEMO_MODE: "true", VERCEL: "1" }), true);
});
test("a false demo flag does not enable the demo", () =>
  assert.equal(isDemo({ VERCEL: "1", DEMO_MODE: "false" }), false));
