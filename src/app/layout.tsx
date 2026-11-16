import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { siteUrl } from "@/lib/seo";

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

// Defaults for every page; the home page builds its own title, description and structured data
// from the published content (src/lib/seo.ts).
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Usibar Usinagens Especiais",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
};
export const viewport: Viewport = { themeColor: "#292c27" };

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
        {children}
      </body>
    </html>
  );
}
