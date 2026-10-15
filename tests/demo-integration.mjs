import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = process.env.TEST_BASE || "http://127.0.0.1:3002";
const before = await fs.readFile("data/db.json", "utf8");
const res = await fetch(base + "/api/company"),
  data = await res.json();
assert.equal(res.status, 200);
assert.equal(data.products.length, 8);
assert.equal("adminPassword" in data, false);
const status = await (await fetch(base + "/api/auth")).json();
assert.equal(status.demoMode, true);
assert.equal(status.authenticated, false);
for (const route of ["/api/company", "/api/upload", "/api/auth"]) {
  const reply = await fetch(base + route, {
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(reply.status, 403, route);
}
assert.equal(await fs.readFile("data/db.json", "utf8"), before);
assert.equal((await fetch(base + "/admin")).status, 200);
console.log(
  "Demo passed: public catalog, no credentials, read-only auth, three mutations blocked, data unchanged, admin available.",
);
