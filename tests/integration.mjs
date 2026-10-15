import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = process.env.TEST_BASE || "http://127.0.0.1:3000";
const json = (body, cookie) => ({
  method: "POST",
  headers: {
    origin: base,
    "content-type": "application/json",
    ...(cookie ? { cookie } : {}),
  },
  body: JSON.stringify(body),
});
let checks = 0;
function check(value, want, label) {
  assert.equal(value, want, label);
  checks++;
  console.log("PASS", label);
}
const response = await fetch(base + "/api/company");
const data = await response.json();
check(response.status, 200, "public catalog");
check("adminPassword" in data, false, "password never returned");
check(data.products.length, 8, "eight products");
check(
  (await fetch(base + "/api/company", json(data))).status,
  401,
  "anonymous save blocked",
);
check(
  (
    await fetch(base + "/api/upload", {
      method: "POST",
      headers: { origin: base },
    })
  ).status,
  401,
  "anonymous upload blocked",
);
check(
  (await fetch(base + "/api/auth", json({ password: "wrong" }))).status,
  401,
  "wrong password rejected",
);
const login = await fetch(
  base + "/api/auth",
  json({ password: process.env.ADMIN_PASSWORD }),
);
check(login.status, 200, "login accepted");
const cookie = login.headers.get("set-cookie").split(";")[0];
check(
  (
    await fetch(
      base + "/api/company",
      json({ company: {}, products: [] }, cookie),
    )
  ).status,
  400,
  "invalid data rejected",
);
check(
  (
    await fetch(base + "/api/company", {
      ...json(data, cookie),
      headers: { ...json(data, cookie).headers, origin: "https://example.org" },
    })
  ).status,
  403,
  "foreign origin rejected",
);
const original = await fs.readFile("data/db.json", "utf8");
let uploaded;
try {
  const next = structuredClone(data);
  next.company.headline = "Teste de persistência Usibar";
  check(
    (await fetch(base + "/api/company", json(next, cookie))).status,
    200,
    "authenticated save",
  );
  check(
    (await (await fetch(base + "/api/company")).json()).company.headline,
    next.company.headline,
    "fresh public data after save",
  );
  check(
    (await fetch(base + "/api/company", json(data, cookie))).status,
    200,
    "restore original catalog",
  );
  const form = new FormData();
  form.append(
    "file",
    new Blob([await fs.readFile("raw/image_3.jpg")], { type: "image/jpeg" }),
    "peca.jpg",
  );
  form.append("removeBg", "true");
  const upload = await fetch(base + "/api/upload", {
    method: "POST",
    headers: { origin: base, cookie },
    body: form,
  });
  const result = await upload.json();
  check(upload.status, 200, "authenticated image upload");
  uploaded = result.url;
  const photo = await fetch(base + uploaded);
  check(photo.status, 200, "new upload immediately accessible");
  check(
    photo.headers.get("content-type")?.includes("image/webp"),
    true,
    "upload converted to WebP",
  );
  const bad = new FormData();
  bad.append(
    "file",
    new Blob(["broken image"], { type: "image/jpeg" }),
    "bad.jpg",
  );
  check(
    (
      await fetch(base + "/api/upload", {
        method: "POST",
        headers: { origin: base, cookie },
        body: bad,
      })
    ).status,
    400,
    "corrupt image rejected",
  );
  for (const url of new Set([
    data.company.logoDarkUrl,
    data.company.benchImageUrl,
    ...data.products.map((p) => p.imageUrl),
  ])) {
    check((await fetch(base + url)).status, 200, "asset " + url);
  }
  check(
    (
      await fetch(base + "/api/auth", {
        method: "DELETE",
        headers: { origin: base, cookie },
      })
    ).status,
    200,
    "logout",
  );
} finally {
  await fs.writeFile("data/db.json", original);
  if (uploaded && /^\/uploads\/usibar-[\w-]+\.webp$/.test(uploaded))
    await fs.unlink("data" + uploaded);
}
console.log(`${checks} integration checks passed`);
