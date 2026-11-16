import type { MetadataRoute } from "next";
import { bundled, store } from "@/lib/content";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

// One page, with the catalog photos so they can show up in Google Images.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data: Record<string, any> = await store().read().catch(() => bundled);
  const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${siteUrl}${u}`);
  const images = [
    "/og-usibar.jpg",
    ...(Array.isArray(data.products) ? data.products.map((p: { imageUrl?: string }) => p.imageUrl).filter(Boolean) : []),
  ].map((u) => abs(String(u)));
  return [{ url: `${siteUrl}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1, images: [...new Set(images)] }];
}
