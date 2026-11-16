import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Usibar Usinagens Especiais",
    short_name: "Usibar",
    description: "Cilindros hidráulicos, blocos manifold e usinagem CNC sob medida em Barão/RS.",
    lang: "pt-BR",
    start_url: "/",
    display: "browser",
    background_color: "#f7f2e9",
    theme_color: "#292c27",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
