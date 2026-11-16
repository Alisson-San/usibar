// Search engines: the page's title, description, canonical address and the structured data
// (schema.org) that tells Google who the company is, where it is and what it makes. Built from
// the published content, so a change made in the editor (contacts, catalog, sections) shows up
// in search results without touching code.
import type { Metadata } from "next";

type Raw = Record<string, any>;

/** The address search engines should index: the custom domain when set, else the Vercel one. */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

/** Only the production site is indexed; previews and local runs stay out of Google. */
export const indexable = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : process.env.NODE_ENV === "production";

const abs = (path: string) => (/^https?:\/\//.test(path) ? path : `${siteUrl}${path.startsWith("/") ? "" : "/"}${path}`);
const cityOf = (c: Raw) => String(c.city ?? "Barão/RS");
const locality = (c: Raw) => cityOf(c).split("/")[0].trim();
const region = (c: Raw) => (cityOf(c).split("/")[1] ?? "RS").trim();
const years = (c: Raw) => String(c.experienceYears ?? "20+").replace("+", "");
const phoneE164 = (c: Raw) => (c.whatsapp ? `+${String(c.whatsapp).replace(/\D/g, "")}` : undefined);

export function seoTitle(d: Raw) {
  const c = d.company ?? {};
  return `${c.name ?? "Usibar Usinagens Especiais"} | Cilindros Hidráulicos e Blocos Manifold em ${cityOf(c)}`;
}

export function seoDescription(d: Raw) {
  const c = d.company ?? {};
  // About 155 characters: what Google shows under the title before cutting.
  return `Fabricante de cilindros hidráulicos, blocos manifold e peças usinadas em CNC sob medida em ${cityOf(c)}. Mais de ${years(c)} anos de experiência. Peça seu orçamento.`;
}

export function buildMetadata(d: Raw): Metadata {
  const c = d.company ?? {};
  const title = seoTitle(d);
  const description = seoDescription(d);
  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    applicationName: c.name,
    keywords: [
      "cilindro hidráulico",
      "cilindros hidráulicos sob medida",
      "cilindro hidráulico dupla ação",
      "cilindro hidráulico simples ação",
      "bloco hidráulico",
      "bloco manifold",
      "usinagem CNC",
      "usinagem de precisão",
      "peças usinadas sob medida",
      "componentes hidráulicos",
      `cilindro hidráulico ${locality(c)}`,
      `usinagem ${locality(c)} ${region(c)}`,
      "cilindro hidráulico Rio Grande do Sul",
      "Usibar",
    ],
    alternates: { canonical: "/" },
    robots: indexable
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } }
      : { index: false, follow: false },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url: "/",
      siteName: c.name,
      title,
      description,
      images: [{ url: "/og-usibar.jpg", width: 1200, height: 630, alt: `${c.name}: cilindros hidráulicos, blocos manifold e usinagem CNC sob medida` }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og-usibar.jpg"] },
    formatDetection: { telephone: true, email: true, address: true },
    category: "industrial",
    ...(process.env.GOOGLE_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION
      ? {
          verification: {
            ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
            ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
          },
        }
      : {}),
  };
}

/** schema.org graph: the business (local search, knowledge panel), its offer and the website. */
export function buildJsonLd(d: Raw) {
  const c = d.company ?? {};
  const org = `${siteUrl}/#empresa`;
  const description = seoDescription(d);
  const services: Raw[] = Array.isArray(d.services) ? d.services : [];
  const sectors: Raw[] = Array.isArray(d.sectors) ? d.sectors : [];
  const sameAs = (Array.isArray(c.socials) ? c.socials.map((s: Raw) => s.url) : []).filter((u: unknown) => typeof u === "string" && /^https:\/\//.test(u));
  if (!sameAs.length && c.instagram) sameAs.push(`https://instagram.com/${c.instagram}`);
  const name = (s: Raw) => String(s.title ?? s.name ?? "").trim();

  const business = {
    "@type": "LocalBusiness",
    "@id": org,
    name: c.name,
    alternateName: "Usibar",
    slogan: c.motto,
    description,
    url: `${siteUrl}/`,
    logo: { "@type": "ImageObject", url: abs("/logo-usibar.png"), width: 512, height: 512 },
    image: [abs("/og-usibar.jpg"), abs(String(c.benchImageUrl ?? "/assets/hero-bench.webp"))],
    email: c.email,
    telephone: phoneE164(c),
    address: {
      "@type": "PostalAddress",
      streetAddress: c.address,
      addressLocality: locality(c),
      addressRegion: region(c),
      postalCode: c.zip,
      addressCountry: "BR",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        telephone: phoneE164(c),
        email: c.email,
        availableLanguage: "Portuguese",
        areaServed: "BR",
      },
    ],
    knowsAbout: [
      "Cilindros hidráulicos",
      "Cilindros hidráulicos de simples ação",
      "Cilindros hidráulicos de dupla ação",
      "Blocos hidráulicos manifold",
      "Usinagem CNC",
      ...services.map(name),
      ...sectors.map((s) => `Hidráulica para o setor ${name(s)}`),
    ].filter((v, i, a) => v && a.indexOf(v) === i),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      // Services only: products without a price would be flagged as incomplete product snippets.
      name: "Cilindros, blocos hidráulicos e usinagem sob medida",
      itemListElement: [
        ...services.map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: name(s), description: String(s.text ?? s.description ?? "") || undefined, provider: { "@id": org } },
        })),
      ],
    },
    ...(sameAs.length ? { sameAs } : {}),
  };
  const website = {
    "@type": "WebSite",
    "@id": `${siteUrl}/#site`,
    url: `${siteUrl}/`,
    name: c.name,
    alternateName: "Usibar",
    inLanguage: "pt-BR",
    publisher: { "@id": org },
  };
  const page = {
    "@type": "WebPage",
    "@id": `${siteUrl}/#pagina`,
    url: `${siteUrl}/`,
    name: seoTitle(d),
    description,
    inLanguage: "pt-BR",
    isPartOf: { "@id": `${siteUrl}/#site` },
    about: { "@id": org },
    primaryImageOfPage: { "@type": "ImageObject", url: abs("/og-usibar.jpg") },
  };
  // JSON.stringify drops the undefined fields; "<" is escaped so content can never close the script tag.
  return JSON.stringify({ "@context": "https://schema.org", "@graph": [business, website, page] }).replace(/</g, "\\u003c");
}
