import type { MetadataRoute } from "next";

const SITE_URL = "https://ziggy.ai";

const locales = [
  "fr",
  "en",
  "es",
  "de",
  "pt",
  "it",
  "nl",
  "tr",
  "ja",
  "ko",
  "zh",
  "ar",
] as const;

const pages = [
  { path: "", changeFrequency: "weekly" as const, priority: 1.0 },
  { path: "/demo", changeFrequency: "monthly" as const, priority: 0.9 },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/cookies", changeFrequency: "yearly" as const, priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return locales.flatMap((locale) =>
    pages.map((page) => ({
      url: `${SITE_URL}/${locale}${page.path}`,
      lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    }))
  );
}
