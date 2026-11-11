import type { MetadataRoute } from "next";
import { PROFILE, SITE } from "@/lib/content";
import { PAGES } from "@/lib/pages";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE.url}/`, changeFrequency: "monthly", priority: 1, lastModified: new Date() },
    ...PAGES.map((pg) => ({ url: `${SITE.url}${pg.href}`, changeFrequency: "monthly" as const, priority: 0.8, lastModified: new Date() })),
    ...PROFILE.shows.map((s) => ({
      url: `${SITE.url}/shows/${s.id}`,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
