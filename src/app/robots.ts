import type { MetadataRoute } from "next";
import { indexable, siteUrl } from "@/lib/seo";

// Production: everything but the admin and the API. Previews and local runs: nothing.
export default function robots(): MetadataRoute.Robots {
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
