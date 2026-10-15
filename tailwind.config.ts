import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        steel: {
          950: "#080A0D",
          900: "#0E1217",
          800: "#161C24",
          700: "#242D3A",
          300: "#CBD5E1",
        },
        usibar: {
          DEFAULT: "#FF5500",
          light: "#FF7733",
          dark: "#CC4400",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
