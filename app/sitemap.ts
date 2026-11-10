import type { MetadataRoute } from "next";
import { PROFILE, SITE } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE.url}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE.url}/cv`, changeFrequency: "monthly", priority: 0.8 },
    ...PROFILE.shows.map((s) => ({
      url: `${SITE.url}/shows/${s.id}`,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
