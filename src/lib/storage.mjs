// Where the site content and uploaded photos live. Three back ends share one shape:
//   file      local development: data/db.json + data/uploads
//   supabase  durable storage (Postgres row + Storage bucket), used whenever configured
//   bundled   read-only copy shipped with the build (Vercel demonstration)
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isDemo } from "./runtime.mjs";

export const CONTENT_KEYS = ["company", "products", "sectors", "process", "services", "pillars"];
const ROW_ID = "main";

export function supabaseSettings(env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    url: env.SUPABASE_URL.replace(/\/+$/, ""),
    key: env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: env.SUPABASE_BUCKET || "catalog",
  };
}

// Public URL prefix of uploaded photos, so validation can accept them.
export function remoteImageBase(env = process.env) {
  const s = supabaseSettings(env);
  return s ? `${s.url}/storage/v1/object/public/${s.bucket}/` : null;
}

const pick = (data) =>
  Object.fromEntries(CONTENT_KEYS.filter((k) => k in data).map((k) => [k, data[k]]));
const imageName = () => "usibar-" + randomUUID() + ".webp";

export function fileStore(root = process.cwd()) {
  const db = path.join(root, "data", "db.json");
  return {
    kind: "file",
    readonly: false,
    async read() {
      const { adminPassword, ...data } = JSON.parse(await fs.readFile(db, "utf8"));
      return data;
    },
    async write(content) {
      const current = JSON.parse(await fs.readFile(db, "utf8"));
      delete current.adminPassword;
      const temp = db + "." + randomUUID() + ".tmp";
      await fs.writeFile(temp, JSON.stringify({ ...current, ...pick(content) }, null, 2));
      await fs.rename(temp, db);
    },
    async saveImage(webp) {
      const dir = path.join(root, "data", "uploads"),
        name = imageName();
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, name), webp);
      return "/uploads/" + name;
    },
  };
}

export function bundledStore(catalog) {
  const readonly = () => {
    throw Object.assign(Error("A demonstração permite apenas consulta."), { status: 403 });
  };
  return { kind: "bundled", readonly: true, read: async () => catalog, write: readonly, saveImage: readonly };
}

export function supabaseStore(settings, seed, fetchImpl = fetch) {
  const { url, key, bucket } = settings;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const fail = async (res, what) => {
    const detail = await res.text().catch(() => "");
    throw Object.assign(Error(`Supabase: falha ao ${what} (${res.status}). ${detail}`.trim()), {
      status: 502,
    });
  };
  return {
    kind: "supabase",
    readonly: false,
    async read() {
      const res = await fetchImpl(`${url}/rest/v1/site_content?id=eq.${ROW_ID}&select=data`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) await fail(res, "ler o conteúdo");
      const [row] = await res.json();
      // An empty table falls back to the bundled catalog until the first save or seed.
      return row ? { ...seed, ...row.data } : seed;
    },
    async write(content) {
      const current = await this.read();
      const res = await fetchImpl(`${url}/rest/v1/site_content`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id: ROW_ID,
          data: { ...current, ...pick(content) },
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) await fail(res, "salvar o conteúdo");
    },
    async saveImage(webp) {
      const name = imageName();
      const res = await fetchImpl(`${url}/storage/v1/object/${bucket}/${name}`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "image/webp",
          "Cache-Control": "31536000",
          "x-upsert": "false",
        },
        body: webp,
      });
      if (!res.ok) await fail(res, "enviar a imagem");
      return `${url}/storage/v1/object/public/${bucket}/${name}`;
    },
  };
}

/**
 * @param {{ env?: Record<string, string | undefined>, seed?: any, root?: string, fetchImpl?: typeof fetch }} [options]
 */
export function getStore({ env = process.env, seed, root, fetchImpl } = {}) {
  const s = supabaseSettings(env);
  if (isDemo(env)) return bundledStore(seed);
  if (s) return supabaseStore(s, seed, fetchImpl);
  return fileStore(root);
}
