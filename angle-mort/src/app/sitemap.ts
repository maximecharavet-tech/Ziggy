import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_URL ?? "https://angle-mort.fr";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${base}/diagnostic`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/mentions-legales`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/cgu`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];
}
