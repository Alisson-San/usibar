import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import seed from "../../data/db.json";

// Fontes hospedadas no próprio repositório (subconjunto latin, fontes variáveis),
// para o build não depender do Google Fonts estar respondendo.
const space = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  weight: "600 700",
  variable: "--font-display",
  display: "swap",
});
const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans-latin.woff2",
  weight: "400 700",
  variable: "--font-sans",
  display: "swap",
});
const mono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  weight: "400 600",
  variable: "--font-mono",
  display: "swap",
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
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
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
