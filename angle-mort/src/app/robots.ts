import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/rapport"],
    },
    sitemap: `${process.env.NEXT_PUBLIC_URL ?? "https://angle-mort.fr"}/sitemap.xml`,
  };
}
