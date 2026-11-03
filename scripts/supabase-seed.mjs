// Copies the local catalog (data/db.json and photos in data/uploads) to Supabase.
// Usage: node --env-file=.env.local scripts/supabase-seed.mjs
import fs from "node:fs/promises";
import { supabaseSettings, supabaseStore } from "../src/lib/storage.mjs";

const settings = supabaseSettings();
if (!settings) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ex.: em .env.local).");
  process.exit(1);
}
const { adminPassword, ...local } = JSON.parse(await fs.readFile("data/db.json", "utf8"));
const store = supabaseStore(settings, local);
let moved = 0;
for (const product of local.products) {
  if (!product.imageUrl.startsWith("/uploads/")) continue;
  const file = await fs.readFile("data" + product.imageUrl);
  product.imageUrl = await store.saveImage(file);
  moved++;
}
await store.write(local);
console.log(
  `Supabase atualizado: ${local.products.length} peças, ${moved} foto(s) enviadas ao bucket "${settings.bucket}".`,
);
