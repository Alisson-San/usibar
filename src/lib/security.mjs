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
const image = (v) =>
  typeof v === "string" &&
  /^\/(assets|uploads)\/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$/.test(v);
export function validData(data) {
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
  const ids = new Set();
  return data.products.every((p) => {
    if (
      !p ||
      !["id", "code", "title", "specs", "description"].every((k) =>
        text(p[k]),
      ) ||
      !["cilindros", "blocos"].includes(p.category) ||
      typeof p.featured !== "boolean" ||
      !image(p.imageUrl) ||
      ids.has(p.id)
    )
      return false;
    ids.add(p.id);
    return true;
  });
}
