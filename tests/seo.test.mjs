import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

process.env.NEXT_PUBLIC_SITE_URL = "https://www.exemplo.com.br/";
const { buildJsonLd, buildMetadata, seoTitle } = await import("../src/lib/seo.ts");
const data = JSON.parse(fs.readFileSync("data/db.json"));

test("seo: structured data describes the business from the published content", () => {
  const json = buildJsonLd(data);
  const graph = JSON.parse(json)["@graph"];
  const biz = graph.find((n) => n["@type"] === "LocalBusiness");
  assert.equal(biz.name, data.company.name);
  assert.equal(biz.url, "https://www.exemplo.com.br/");
  assert.equal(biz.telephone, "+" + data.company.whatsapp);
  assert.equal(biz.address.addressLocality, "Barão");
  assert.equal(biz.address.addressRegion, "RS");
  assert.equal(biz.address.postalCode, data.company.zip);
  assert.ok(biz.logo.url.startsWith("https://www.exemplo.com.br/"));
  assert.equal(biz.hasOfferCatalog.itemListElement.length, data.services.length);
  assert.ok(biz.knowsAbout.some((k) => /Agrícola/.test(k)));
  assert.ok(graph.some((n) => n["@type"] === "WebSite") && graph.some((n) => n["@type"] === "WebPage"));
  assert.ok(!json.includes("<"), "never closes the script tag");
  // Edited content flows through, and markup typed in the editor stays inert.
  const edited = { ...data, company: { ...data.company, city: "Montenegro/RS", motto: "</script><b>x" } };
  const e = JSON.parse(buildJsonLd(edited))["@graph"][0];
  assert.equal(e.address.addressLocality, "Montenegro");
  assert.ok(!buildJsonLd(edited).includes("</script>"));
});

test("seo: title, description, canonical and share image", () => {
  const m = buildMetadata(data);
  assert.match(seoTitle(data), /Cilindros Hidráulicos/);
  assert.match(String(m.title), /Barão\/RS/);
  assert.ok(String(m.description).length <= 160, String(m.description).length);
  assert.equal(m.alternates.canonical, "/");
  assert.equal(m.openGraph.images[0].url, "/og-usibar.jpg");
  assert.equal(String(m.metadataBase), "https://www.exemplo.com.br/");
});
