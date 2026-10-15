import type { Metadata } from "next";
import {
  Space_Grotesk,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Usibar Usinagens Especiais | Tecnologia em Hidráulica — Barão/RS",
  description:
    "Mais de 20 anos de experiência em Cilindros Hidráulicos, Blocos Hidráulicos (Manifolds) e Usinagem de Precisão em Barão/RS.",
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
        {children}
      </body>
    </html>
  );
}
