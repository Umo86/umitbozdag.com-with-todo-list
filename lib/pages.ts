import type { Metadata } from "next";
import { PROFILE as p, SITE } from "./content";

// The site's main pages, in menu order, with what search engines and link
// previews see for each.
export type PageInfo = { href: string; label: string; title: string; description: string };

export const PAGES: PageInfo[] = [
  {
    href: "/about",
    label: "About",
    title: "About Umit Bozdag, exhibition and events operations manager",
    description: `${p.statement} ${p.stats[0]?.value ?? 14} years running exhibitions and conferences in London and abroad, in English and Turkish.`,
  },
  {
    href: "/services",
    label: "What I do",
    title: "Exhibition and event operations services",
    description:
      "Show operations end to end: budgets and suppliers, venues and floorplans, health and safety, on-site services and staffing, sponsorship features and digital tools.",
  },
  {
    href: "/show-cycle",
    label: "Show cycle",
    title: "The exhibition show cycle, from floorplan to breakdown",
    description:
      "How a trade show comes together: twelve months of floorplan, sales and planning, a week of build-up, three days open and 48 hours of breakdown.",
  },
  {
    href: "/events",
    label: "Events",
    title: `Exhibitions and conferences since 2012 (${p.shows.length} shows)`,
    description: `Every show Umit Bozdag has worked on: ${p.shows
      .slice(0, 4)
      .map((s) => s.name)
      .join(", ")} and more, across ${p.stats.find((s) => /countr/i.test(s.label))?.value ?? 8} countries.`,
  },
  {
    href: "/contact",
    label: "Contact",
    title: "Contact Umit Bozdag",
    description: "Planning a show, hiring or want to compare notes? Message Umit Bozdag by WhatsApp, email or the contact form.",
  },
];

export const page = (href: string) => PAGES.find((x) => x.href === href)!;

/** Title, description, canonical and link-preview tags for one page. */
export function pageMetadata(href: string): Metadata {
  const pg = page(href);
  return {
    // titles that already name Umit don't get "— Umit Bozdag" added again
    title: pg.title.includes(SITE.name) ? { absolute: pg.title } : pg.title,
    description: pg.description,
    alternates: { canonical: href },
    openGraph: { type: "website", url: href, siteName: SITE.name, title: pg.title, description: pg.description, locale: "en_GB" },
    twitter: { card: "summary_large_image", title: pg.title, description: pg.description },
  };
}

/** Breadcrumb structured data: Home › This page. */
export function breadcrumbLd(href: string) {
  const pg = page(href);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE.url}/` },
      { "@type": "ListItem", position: 2, name: pg.label, item: `${SITE.url}${href}` },
    ],
  };
}
