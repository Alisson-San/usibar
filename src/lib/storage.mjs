// Where the site content and uploaded photos live. Three back ends share one shape:
//   file      local development only (USIBAR_STORAGE=file): data/db.json + data/uploads
//   supabase  durable storage in the central Supabase project (schema "usibar" + bucket "usibar");
//             reads are public, writes carry the signed-in admin's JWT and RLS decides
//   bundled   read-only copy shipped with the build (Vercel demonstration)
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { networkProblem } from "./net.mjs";
import { isDemo } from "./runtime.mjs";
import { SITE_ID, SUPABASE_DEFAULTS } from "./supabase-config.mjs";

export const CONTENT_KEYS = ["company", "products", "sectors", "process", "services", "pillars", "copy", "styles", "layout"];
const ROW_ID = "main";

export { SITE_ID, SUPABASE_DEFAULTS };

export function supabaseSettings(env = process.env) {
  return {
    url: (env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_DEFAULTS.url).replace(/\/+$/, ""),
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || SUPABASE_DEFAULTS.key,
    bucket: env.SUPABASE_BUCKET || SUPABASE_DEFAULTS.bucket,
  };
}

// Local development can opt out of Supabase and keep everything on disk (USIBAR_STORAGE=file).
export const useLocalFiles = (env = process.env) =>
  env.USIBAR_STORAGE === "file" && env.VERCEL !== "1";

// True when the bearer token belongs to an admin of this site (database decides, via RLS helper).
// When the database cannot be asked at all (network, proxy certificate) it throws a 503 instead:
// "could not check" must not read as "not an admin", or the editor would report an expired session.
export async function isSiteAdmin(settings, token, fetchImpl = fetch) {
  if (typeof token !== "string" || token.length < 20 || token.length > 4096) return false;
  let res;
  try {
    res = await fetchImpl(`${settings.url}/rest/v1/rpc/is_site_admin`, {
      method: "POST",
      headers: {
        apikey: settings.key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_site: SITE_ID }),
      cache: "no-store",
    });
  } catch (e) {
    const message = networkProblem(e, "o Supabase")?.message ?? "O servidor do site não conseguiu consultar o Supabase.";
    throw Object.assign(Error(message), { status: 503, cause: e });
  }
  return res.ok && (await res.json().catch(() => false)) === true;
}

// Public URL prefix of uploaded photos, so validation can accept them.
export function remoteImageBase(env = process.env) {
  const s = supabaseSettings(env);
  return `${s.url}/storage/v1/object/public/${s.bucket}/`;
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
  const fail = async (res, what) => {
    const detail = await res.text().catch(() => "");
    throw Object.assign(Error(`Supabase: falha ao ${what} (${res.status}). ${detail}`.trim()), {
      status: res.status === 401 || res.status === 403 ? res.status : 502,
    });
  };
  const requireToken = (token) => {
    if (!token) throw Object.assign(Error("Sessão expirada. Entre novamente."), { status: 401 });
  };
  const readRow = async (token) => {
    const res = await fetchImpl(`${url}/rest/v1/site_content?id=eq.${ROW_ID}&select=data`, {
      headers: {
        apikey: key,
        "Accept-Profile": SITE_ID,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });
    if (!res.ok) await fail(res, "ler o conteúdo");
    const [row] = await res.json();
    return row;
  };
  return {
    kind: "supabase",
    readonly: false,
    async read() {
      // An empty table falls back to the bundled catalog until the first save or seed.
      const row = await readRow();
      return row ? { ...seed, ...row.data } : seed;
    },
    // Writes run AS the signed-in admin: the user's JWT is the Authorization, so RLS decides.
    async write(content, token) {
      requireToken(token);
      const row = await readRow(token);
      const current = row ? { ...seed, ...row.data } : seed;
      const res = await fetchImpl(`${url}/rest/v1/site_content`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          "Content-Profile": SITE_ID,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({ id: ROW_ID, data: { ...current, ...pick(content) } }),
      });
      if (!res.ok) await fail(res, "salvar o conteúdo");
    },
    async saveImage(webp, token) {
      requireToken(token);
      const name = imageName();
      const res = await fetchImpl(`${url}/storage/v1/object/${bucket}/${name}`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          "Content-Type": "image/webp",
          "Cache-Control": "max-age=31536000",
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
  if (isDemo(env)) return bundledStore(seed);
  if (useLocalFiles(env)) return fileStore(root);
  return supabaseStore(supabaseSettings(env), seed, fetchImpl);
}
