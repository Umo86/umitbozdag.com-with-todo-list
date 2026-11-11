import PageShell from "@/components/PageShell";
import { EventsSection } from "@/components/Sections";
import { pageMetadata } from "@/lib/pages";
import { PROFILE as p, SITE } from "@/lib/content";

const list = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: p.shows.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.name, url: `${SITE.url}/shows/${s.id}` })),
};

export const metadata = pageMetadata("/events");

export default function Page() {
  return (
    <PageShell href="/events" ld={list}>
      <EventsSection as="h1" />
    </PageShell>
  );
}
