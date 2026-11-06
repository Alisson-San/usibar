import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getStore, isSiteAdmin, remoteImageBase, supabaseSettings, supabaseStore } from "../src/lib/storage.mjs";

const env = { NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co/", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub" };
const TOKEN = "user-jwt-user-jwt-user-jwt";
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

test("USIBAR_STORAGE=file writes to disk", () =>
  assert.equal(getStore({ env: { USIBAR_STORAGE: "file" }, seed }).kind, "file"));
test("file mode is ignored on Vercel", () =>
  assert.equal(getStore({ env: { USIBAR_STORAGE: "file", VERCEL: "1" }, seed }).kind, "supabase"));
test("Supabase is the default, even on Vercel", () => {
  assert.equal(getStore({ env: {}, seed }).kind, "supabase");
  assert.equal(getStore({ env: { VERCEL: "1" }, seed }).kind, "supabase");
});
test("explicit demo wins over Supabase", () => {
  const s = getStore({ env: { ...env, DEMO_MODE: "true" }, seed });
  assert.equal(s.kind, "bundled");
  assert.equal(s.readonly, true);
});
test("defaults point at the central project and the usibar bucket", () => {
  const s = supabaseSettings({});
  assert.equal(s.url, "https://rwkvsepkevhqzpltmsck.supabase.co");
  assert.match(s.key, /^sb_publishable_/);
  assert.equal(s.bucket, "usibar");
  assert.equal(supabaseSettings(env).url, "https://demo.supabase.co");
});
test("remote image base follows the bucket", () => {
  assert.equal(
    remoteImageBase({ ...env, SUPABASE_BUCKET: "fotos" }),
    "https://demo.supabase.co/storage/v1/object/public/fotos/",
  );
  assert.match(remoteImageBase({}), /\/public\/usibar\/$/);
});

const settings = { url: "https://demo.supabase.co", key: "pub", bucket: "usibar" };

test("public read uses the usibar schema and no user token; empty table falls back to the seed", async () => {
  const f = fakeFetch([{ status: 200, body: [] }]);
  const s = supabaseStore(settings, seed, f);
  assert.deepEqual(await s.read(), seed);
  assert.match(f.calls[0].url, /\/rest\/v1\/site_content\?id=eq\.main&select=data$/);
  assert.equal(f.calls[0].headers["Accept-Profile"], "usibar");
  assert.equal(f.calls[0].headers.apikey, "pub");
  assert.equal("Authorization" in f.calls[0].headers, false);
});

test("Supabase write upserts the merged document as the user", async () => {
  const f = fakeFetch([
    { status: 200, body: [{ data: { ...seed, company: { name: "Old" } } }] },
    { status: 204 },
  ]);
  const s = supabaseStore(settings, seed, f);
  await s.write({ company: { name: "Nova" }, products: [], adminPassword: "x" }, TOKEN);
  const post = f.calls[1];
  assert.equal(post.method, "POST");
  assert.equal(post.headers["Content-Profile"], "usibar");
  assert.equal(post.headers.apikey, "pub");
  assert.equal(post.headers.Authorization, `Bearer ${TOKEN}`);
  assert.match(post.headers.Prefer, /resolution=merge-duplicates/);
  const body = JSON.parse(post.body);
  assert.equal(body.id, "main");
  assert.equal(body.data.company.name, "Nova");
  assert.deepEqual(body.data.pillars, [1]);
  assert.equal("adminPassword" in body.data, false);
});

test("writes and uploads without a user token never reach Supabase", async () => {
  const f = fakeFetch([]);
  const s = supabaseStore(settings, seed, f);
  await assert.rejects(s.write({ company: {}, products: [] }), /Sessão expirada/);
  await assert.rejects(s.saveImage(Buffer.from("x")), /Sessão expirada/);
  assert.equal(f.calls.length, 0);
});

test("Supabase upload returns the public URL and sends the user JWT with long cache", async () => {
  const f = fakeFetch([{ status: 200, body: { Key: "x" } }]);
  const s = supabaseStore(settings, seed, f);
  const url = await s.saveImage(Buffer.from("webp"), TOKEN);
  assert.match(url, /^https:\/\/demo\.supabase\.co\/storage\/v1\/object\/public\/usibar\/usibar-[a-f0-9-]{36}\.webp$/);
  assert.match(f.calls[0].url, /\/storage\/v1\/object\/usibar\/usibar-/);
  assert.equal(f.calls[0].headers["Content-Type"], "image/webp");
  assert.equal(f.calls[0].headers.Authorization, `Bearer ${TOKEN}`);
  assert.match(f.calls[0].headers["Cache-Control"], /31536000/);
});

test("Supabase errors surface as failures", async () => {
  const f = fakeFetch([{ status: 500, body: { message: "boom" } }]);
  const s = supabaseStore(settings, seed, f);
  await assert.rejects(s.read(), /Supabase: falha ao ler o conteúdo \(500\)/);
});

test("RLS refusal is reported as an authorization failure", async () => {
  const f = fakeFetch([{ status: 200, body: [] }, { status: 403, body: { message: "rls" } }]);
  const s = supabaseStore(settings, seed, f);
  await assert.rejects(s.write({ company: {}, products: [] }, TOKEN), (e) => e.status === 403);
});

test("isSiteAdmin asks the database with the user's bearer", async () => {
  const yes = fakeFetch([{ status: 200, body: true }]);
  assert.equal(await isSiteAdmin(settings, TOKEN, yes), true);
  assert.match(yes.calls[0].url, /\/rest\/v1\/rpc\/is_site_admin$/);
  assert.equal(yes.calls[0].headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(yes.calls[0].body), { p_site: "usibar" });
  assert.equal(await isSiteAdmin(settings, TOKEN, fakeFetch([{ status: 200, body: false }])), false);
  assert.equal(await isSiteAdmin(settings, TOKEN, fakeFetch([{ status: 401, body: {} }])), false);
  assert.equal(await isSiteAdmin(settings, "short", fakeFetch([])), false);
  assert.equal(await isSiteAdmin(settings, undefined, fakeFetch([])), false);
});

test("isSiteAdmin reports an unreachable database instead of answering no", async () => {
  const tls = async () => {
    throw new TypeError("fetch failed", { cause: Object.assign(Error("self-signed certificate in certificate chain"), { code: "SELF_SIGNED_CERT_IN_CHAIN" }) });
  };
  await assert.rejects(isSiteAdmin(settings, TOKEN, tls), (e) => e.status === 503 && /certificado.*SELF_SIGNED_CERT_IN_CHAIN.*Rede da empresa/.test(e.message));
  const offline = async () => {
    throw new TypeError("fetch failed", { cause: Object.assign(Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }) });
  };
  await assert.rejects(isSiteAdmin(settings, TOKEN, offline), (e) => e.status === 503 && /não conseguiu falar com o Supabase \(ENOTFOUND\)/.test(e.message));
});

test("file store keeps unrelated keys and strips the password", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "usibar-"));
  await fs.mkdir(path.join(root, "data"));
  await fs.writeFile(
    path.join(root, "data/db.json"),
    JSON.stringify({ ...seed, adminPassword: "old" }),
  );
  const s = getStore({ env: { USIBAR_STORAGE: "file" }, seed, root });
  await s.write({ company: { name: "Nova" }, products: [], junk: 1 });
  const saved = JSON.parse(await fs.readFile(path.join(root, "data/db.json"), "utf8"));
  assert.equal(saved.company.name, "Nova");
  assert.deepEqual(saved.pillars, [1]);
  assert.equal("adminPassword" in saved || "junk" in saved, false);
  const url = await s.saveImage(Buffer.from("x"));
  assert.match(url, /^\/uploads\/usibar-[a-f0-9-]{36}\.webp$/);
  await fs.rm(root, { recursive: true });
});
