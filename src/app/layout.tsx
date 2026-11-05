import type { Metadata } from "next";
import {
  Space_Grotesk,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import seed from "../../data/db.json";

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono",
});

const c = seed.company;
const description =
  "Cilindros hidráulicos de simples e dupla ação, blocos hidráulicos (manifolds) e usinagem CNC sob medida. Mais de 20 anos de experiência, em Barão/RS.";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Usibar Usinagens Especiais | Cilindros e blocos hidráulicos sob medida — Barão/RS",
  description,
  openGraph: {
    title: "Usibar — Tecnologia em hidráulica",
    description,
    type: "website",
    locale: "pt_BR",
    images: [{ url: "/assets/hero-bench.webp", alt: "Cilindros hidráulicos fabricados pela Usibar" }],
  },
};
// Structured data from the published catalog, so search engines read the real contacts.
const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: c.name,
  slogan: c.motto,
  description,
  email: c.email,
  telephone: "+" + c.whatsapp,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Rua Martin Biancho, 803 — Bairro Bela Vista",
    addressLocality: "Barão",
    addressRegion: "RS",
    postalCode: "95730-000",
    addressCountry: "BR",
  },
  sameAs: c.socials?.map((s) => s.url) ?? [`https://instagram.com/${c.instagram}`],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${space.variable} ${jakarta.variable} ${mono.variable} scroll-smooth`}
    >
      <body className="font-sans antialiased selection:bg-usibar selection:text-white">
        <svg
          aria-hidden="true"
          width="0"
          height="0"
          style={{ position: "absolute", pointerEvents: "none" }}
        >
          <defs>
            <filter id="logo-background" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -1 -1 -1 2.6 0"
              />
            </filter>
          </defs>
        </svg>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
        {children}
      </body>
    </html>
  );
}
