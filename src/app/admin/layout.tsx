import type { Metadata } from "next";

// The sign-in page stays out of search results.
export const metadata: Metadata = {
  title: "Entrar — Usibar",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
