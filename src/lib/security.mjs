import { createHmac, timingSafeEqual } from "node:crypto";
export const equal = (a, b) => {
  const x = Buffer.from(String(a)),
    y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
export function createSession(secret, now = Date.now()) {
  const expires = String(now + 8 * 3600000);
  return (
    expires + "." + createHmac("sha256", secret).update(expires).digest("hex")
  );
}
export function validSession(token, secret, now = Date.now()) {
  if (!secret || typeof token !== "string") return false;
  const [expires, signature] = token.split(".");
  return (
    /^\d+$/.test(expires) &&
    Number(expires) > now &&
    Number(expires) <= now + 8 * 3600000 &&
    equal(signature, createHmac("sha256", secret).update(expires).digest("hex"))
  );
}
const text = (v, max = 4000) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const escape = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Local assets and uploads, plus photos in the configured Supabase bucket.
const imageCheck = (remoteBase) => {
  const remote = remoteBase
    ? new RegExp("^" + escape(remoteBase) + "usibar-[a-f0-9-]{36}\\.webp$")
    : null;
  return (v) =>
    typeof v === "string" &&
    (/^\/(assets|uploads)\/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$/.test(v) ||
      Boolean(remote?.test(v)));
};
export const SOCIAL_NETWORKS = ["instagram", "facebook", "linkedin", "youtube", "tiktok", "x", "site"];

/**
 * @param {any} data
 * @param {{ remoteBase?: string | null }} [options]
 */
export function validData(data, { remoteBase = null } = {}) {
  const image = imageCheck(remoteBase);
  if (
    !data ||
    typeof data !== "object" ||
    !data.company ||
    !Array.isArray(data.products) ||
    data.products.length > 200
  )
    return false;
  const c = data.company;
  if (
    ![
      "name",
      "Tagline",
      "headline",
      "subheadline",
      "experienceYears",
      "city",
      "phoneDisplay",
      "email",
      "instagram",
      "aboutParagraph1",
      "aboutParagraph2",
      "aboutParagraph3",
    ].every((k) => text(c[k]))
  )
    return false;
  if (
    !/^\d{10,15}$/.test(c.whatsapp) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) ||
    !image(c.logoDarkUrl) ||
    !image(c.benchImageUrl)
  )
    return false;
  // Optional sections: validated only when sent.
  if (
    "sectors" in data &&
    !(
      Array.isArray(data.sectors) &&
      data.sectors.length <= 20 &&
      unique(data.sectors) &&
      data.sectors.every((s) => s && text(s.id, 80) && text(s.name, 120) && text(s.code, 40))
    )
  )
    return false;
  if (
    "process" in data &&
    !(
      Array.isArray(data.process) &&
      data.process.length === 3 &&
      data.process.every(
        (s) => s && text(s.label, 60) && text(s.title, 120) && text(s.copy, 400),
      )
    )
  )
    return false;
  if ("motto" in c && !text(c.motto, 200)) return false;
  if ("address" in c && !text(c.address, 200)) return false;
  if ("zip" in c && !(typeof c.zip === "string" && /^\d{5}-?\d{3}$/.test(c.zip))) return false;
  if ("heroImageUrl" in c && !image(c.heroImageUrl)) return false;
  if (
    "socials" in c &&
    !(
      Array.isArray(c.socials) &&
      c.socials.length <= 10 &&
      unique(c.socials) &&
      c.socials.every(
        (s) =>
          s &&
          text(s.id, 80) &&
          SOCIAL_NETWORKS.includes(s.network) &&
          typeof s.url === "string" &&
          s.url.length <= 300 &&
          /^https:\/\/[^\s"'<>]+$/.test(s.url),
      )
    )
  )
    return false;
  if ("styles" in data && !validStyles(data.styles)) return false;
  if ("layout" in data && !validLayout(data.layout, image)) return false;
  // Free texts of the page, keyed by place ("hero.title.1"); defaults live in the code.
  if (
    "copy" in data &&
    !(
      data.copy &&
      typeof data.copy === "object" &&
      !Array.isArray(data.copy) &&
      Object.keys(data.copy).length <= 400 &&
      Object.entries(data.copy).every(([k, v]) => /^[a-z0-9][a-z0-9._-]{0,59}$/.test(k) && text(v, 1200))
    )
  )
    return false;
  if (
    "services" in data &&
    !(
      Array.isArray(data.services) &&
      data.services.length <= 6 &&
      unique(data.services) &&
      data.services.every(
        (s) =>
          s &&
          text(s.id, 80) &&
          text(s.title, 120) &&
          text(s.lead, 200) &&
          text(s.copy, 600) &&
          ["cilindros", "blocos", "all"].includes(s.category) &&
          image(s.imageUrl),
      )
    )
  )
    return false;
  if (
    "pillars" in data &&
    !(
      Array.isArray(data.pillars) &&
      data.pillars.length <= 8 &&
      unique(data.pillars) &&
      data.pillars.every((s) => s && text(s.id, 80) && text(s.title, 60) && text(s.desc, 300))
    )
  )
    return false;
  return (
    unique(data.products) &&
    data.products.every(
      (p) =>
        p &&
        ["id", "code", "title", "specs", "description"].every((k) => text(p[k])) &&
        ["cilindros", "blocos"].includes(p.category) &&
        typeof p.featured === "boolean" &&
        image(p.imageUrl),
    )
  );
}
function unique(list) {
  const ids = new Set(list.map((x) => x?.id));
  return ids.size === list.length;
}

const KEY = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
// Per-text colour and size chosen in the editor: { "hero.title.1": { color: "#bf4f29", size: 1.2 } }.
function validStyles(styles) {
  if (!styles || typeof styles !== "object" || Array.isArray(styles)) return false;
  const entries = Object.entries(styles);
  return (
    entries.length <= 600 &&
    entries.every(
      ([k, v]) =>
        KEY.test(k) &&
        v &&
        typeof v === "object" &&
        Object.keys(v).every((f) => f === "color" || f === "size") &&
        (v.color === undefined || (typeof v.color === "string" && /^#[0-9a-f]{6}$/i.test(v.color))) &&
        (v.size === undefined || (typeof v.size === "number" && v.size >= 0.5 && v.size <= 3)),
    )
  );
}

export const BUILTIN_SECTIONS = ["solutions", "process", "catalog", "origin", "sectors", "quote"];
const opt = (v, max) => v === undefined || (typeof v === "string" && v.length <= max);
// Fields allowed in each template section and their limits; anything else is refused.
const TEMPLATE_FIELDS = {
  "text-image": { nav: 40, eyebrow: 80, title: 160, accent: 160, text: 1500, cta: 60, side: 5, imageUrl: "image" },
  stats: { nav: 40, eyebrow: 80, title: 160, items: "items" },
  gallery: { nav: 40, eyebrow: 80, title: 160, images: "images" },
  cta: { nav: 40, title: 160, text: 600, button: 60 },
  testimonial: { nav: 40, quote: 1200, author: 120, role: 160 },
};
function validLayout(layout, image) {
  if (!Array.isArray(layout) || layout.length > 30) return false;
  const ids = new Set();
  for (const b of layout) {
    if (!b || typeof b.id !== "string" || !/^[a-z0-9-]{1,40}$/i.test(b.id) || ids.has(b.id)) return false;
    ids.add(b.id);
    if ("hidden" in b && typeof b.hidden !== "boolean") return false;
    if (BUILTIN_SECTIONS.includes(b.type)) {
      if (b.id !== b.type || "data" in b) return false;
      continue;
    }
    const spec = TEMPLATE_FIELDS[b.type];
    const d = b.data;
    if (!spec || !d || typeof d !== "object" || Array.isArray(d)) return false;
    for (const [k, v] of Object.entries(d)) {
      const rule = spec[k];
      if (!rule) return false;
      if (rule === "image") {
        if (!image(v)) return false;
      } else if (rule === "items") {
        if (!(Array.isArray(v) && v.length <= 6 && v.every((it) => it && text(it.value, 40) && text(it.label, 200)))) return false;
      } else if (rule === "images") {
        if (!(Array.isArray(v) && v.length <= 12 && v.every((it) => it && image(it.url) && opt(it.caption, 200)))) return false;
      } else if (k === "side") {
        if (v !== "left" && v !== "right") return false;
      } else if (!opt(v, rule)) return false;
    }
  }
  return true;
}
