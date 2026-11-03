import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getStore, remoteImageBase, supabaseStore } from "../src/lib/storage.mjs";

const env = { SUPABASE_URL: "https://demo.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "service" };
const seed = { company: { name: "Usibar" }, products: [], pillars: [1] };
function fakeFetch(replies) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, ...init });
    const r = replies.shift() ?? { status: 200, body: [] };
    return new Response(r.status === 204 ? null : JSON.stringify(r.body), { status: r.status });
  };
  return Object.assign(fn, { calls });
}

test("local development writes to disk", () =>
  assert.equal(getStore({ env: {}, seed }).kind, "file"));
test("Vercel without Supabase stays read-only", () => {
  const s = getStore({ env: { VERCEL: "1" }, seed });
  assert.equal(s.kind, "bundled");
  assert.equal(s.readonly, true);
});
test("Supabase makes Vercel editable", () =>
  assert.equal(getStore({ env: { ...env, VERCEL: "1" }, seed }).kind, "supabase"));
test("explicit demo wins over Supabase", () =>
  assert.equal(getStore({ env: { ...env, DEMO_MODE: "true" }, seed }).kind, "bundled"));
test("remote image base follows the bucket", () =>
  assert.equal(
    remoteImageBase({ ...env, SUPABASE_BUCKET: "fotos" }),
    "https://demo.supabase.co/storage/v1/object/public/fotos/",
  ));

test("empty Supabase table falls back to the bundled catalog", async () => {
  const f = fakeFetch([{ status: 200, body: [] }]);
  const s = supabaseStore({ url: "https://demo.supabase.co", key: "k", bucket: "catalog" }, seed, f);
  assert.deepEqual(await s.read(), seed);
  assert.match(f.calls[0].url, /\/rest\/v1\/site_content\?id=eq\.main&select=data$/);
  assert.equal(f.calls[0].headers.Authorization, "Bearer k");
});

test("Supabase write upserts the merged document", async () => {
  const f = fakeFetch([
    { status: 200, body: [{ data: { ...seed, company: { name: "Old" } } }] },
    { status: 204 },
  ]);
  const s = supabaseStore({ url: "https://demo.supabase.co", key: "k", bucket: "catalog" }, seed, f);
  await s.write({ company: { name: "Nova" }, products: [], adminPassword: "x" });
  const post = f.calls[1];
  assert.equal(post.method, "POST");
  assert.match(post.headers.Prefer, /resolution=merge-duplicates/);
  const body = JSON.parse(post.body);
  assert.equal(body.id, "main");
  assert.equal(body.data.company.name, "Nova");
  assert.deepEqual(body.data.pillars, [1]);
  assert.equal("adminPassword" in body.data, false);
});

test("Supabase upload returns the public URL", async () => {
  const f = fakeFetch([{ status: 200, body: { Key: "x" } }]);
  const s = supabaseStore({ url: "https://demo.supabase.co", key: "k", bucket: "catalog" }, seed, f);
  const url = await s.saveImage(Buffer.from("webp"));
  assert.match(url, /^https:\/\/demo\.supabase\.co\/storage\/v1\/object\/public\/catalog\/usibar-[a-f0-9-]{36}\.webp$/);
  assert.match(f.calls[0].url, /\/storage\/v1\/object\/catalog\/usibar-/);
  assert.equal(f.calls[0].headers["Content-Type"], "image/webp");
});

test("Supabase errors surface as failures", async () => {
  const f = fakeFetch([{ status: 401, body: { message: "bad key" } }]);
  const s = supabaseStore({ url: "https://demo.supabase.co", key: "k", bucket: "catalog" }, seed, f);
  await assert.rejects(s.read(), /Supabase: falha ao ler o conteúdo \(401\)/);
});

test("file store keeps unrelated keys and strips the password", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "usibar-"));
  await fs.mkdir(path.join(root, "data"));
  await fs.writeFile(
    path.join(root, "data/db.json"),
    JSON.stringify({ ...seed, adminPassword: "old" }),
  );
  const s = getStore({ env: {}, seed, root });
  await s.write({ company: { name: "Nova" }, products: [], junk: 1 });
  const saved = JSON.parse(await fs.readFile(path.join(root, "data/db.json"), "utf8"));
  assert.equal(saved.company.name, "Nova");
  assert.deepEqual(saved.pillars, [1]);
  assert.equal("adminPassword" in saved || "junk" in saved, false);
  const url = await s.saveImage(Buffer.from("x"));
  assert.match(url, /^\/uploads\/usibar-[a-f0-9-]{36}\.webp$/);
  await fs.rm(root, { recursive: true });
});
