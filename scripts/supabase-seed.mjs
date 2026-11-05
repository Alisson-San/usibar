// Copies the bundled catalog (data/db.json and photos in data/uploads) to the central Supabase
// project, signed in as an administrator of this site. Only the publishable key is used.
// Usage: SEED_EMAIL=... SEED_PASSWORD=... node scripts/supabase-seed.mjs
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { supabaseSettings, supabaseStore } from "../src/lib/storage.mjs";

const { SEED_EMAIL, SEED_PASSWORD } = process.env;
if (!SEED_EMAIL || !SEED_PASSWORD) {
  console.error("Defina SEED_EMAIL e SEED_PASSWORD (conta administradora do site usibar).");
  process.exit(1);
}
const settings = supabaseSettings();
const auth = createClient(settings.url, settings.key, { auth: { persistSession: false } });
const { data, error } = await auth.auth.signInWithPassword({ email: SEED_EMAIL, password: SEED_PASSWORD });
if (error) {
  console.error("Falha ao entrar:", error.message);
  process.exit(1);
}
const token = data.session.access_token;
const { data: admin } = await auth.rpc("is_site_admin", { p_site: "usibar" });
if (admin !== true) {
  console.error("Esta conta não administra o site usibar.");
  process.exit(1);
}

const { adminPassword, ...local } = JSON.parse(await fs.readFile("data/db.json", "utf8"));
const store = supabaseStore(settings, local);
let moved = 0;
for (const product of local.products) {
  if (!product.imageUrl.startsWith("/uploads/")) continue;
  const file = await fs.readFile("data" + product.imageUrl);
  product.imageUrl = await store.saveImage(file, token);
  moved++;
}
await store.write(local, token);
console.log(
  `Supabase atualizado: ${local.products.length} peças, ${moved} foto(s) enviadas ao bucket "${settings.bucket}".`,
);
