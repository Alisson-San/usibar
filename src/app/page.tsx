import type { Metadata } from "next";
import { bundled, store } from "@/lib/content";
import { networkProblem } from "@/lib/net.mjs";
import { buildJsonLd, buildMetadata } from "@/lib/seo";
import UsibarHome from "./site";

// Rendered on the server for every visit: the HTML already carries the texts, sections, catalog
// and contacts, which is what search engines index (and what a slow phone shows first).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function content() {
  try {
    return await store().read();
  } catch (e) {
    const problem = networkProblem(e, "o Supabase");
    console.error("[page] leitura do conteúdo falhou:", problem ? problem.message : e);
    // Same rule as /api/company: show the shipped catalog, flagged so the editor never saves over the real data.
    return { ...bundled, stale: true, staleReason: problem?.kind ?? "error" };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(await content());
}

export default async function Page() {
  const data = await content();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildJsonLd(data) }} />
      {/* Without JavaScript the opening animation never runs: show the page straight away. */}
      <noscript>
        <style>{`.intro-shutter{display:none!important}`}</style>
      </noscript>
      <UsibarHome initial={data} />
    </>
  );
}
