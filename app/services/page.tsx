import PageShell from "@/components/PageShell";
import { ServicesSection } from "@/components/Sections";
import { pageMetadata } from "@/lib/pages";
import { PROFILE as p, SITE } from "@/lib/content";

const services = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: p.services.map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: { "@type": "Service", name: s.title, description: s.text, provider: { "@type": "Person", name: SITE.name }, areaServed: "GB" },
  })),
};

export const metadata = pageMetadata("/services");

export default function Page() {
  return (
    <PageShell href="/services" ld={services}>
      <ServicesSection as="h1" />
    </PageShell>
  );
}
