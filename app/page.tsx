import HeroFilm from "@/components/HeroFilm";
import { SiteFooter, SiteNav } from "@/components/SiteChrome";
import { AboutSection, ContactSection, CycleSection, EventsSection, ServicesSection, WorldSection } from "@/components/Sections";
import { PROFILE as p, SITE } from "@/lib/content";

// The home page: the city film and the map, then a short version of each
// section with a link to its own page (/about, /services, /show-cycle,
// /events, /contact).
const ld = [
  {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE.name,
    url: SITE.url,
    jobTitle: SITE.role,
    worksFor: { "@type": "Organization", name: SITE.employer },
    address: { "@type": "PostalAddress", addressLocality: SITE.city, addressCountry: "GB" },
    knowsLanguage: p.languages,
    sameAs: [SITE.linkedin],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    inLanguage: "en-GB",
  },
];

export default function Home() {
  return (
    <>
      <a className="skip" href="#about">
        Skip to content
      </a>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <SiteNav />
      <main id="top">
        <HeroFilm />
        <WorldSection />
        <AboutSection short />
        <ServicesSection short />
        <CycleSection short />
        <EventsSection short />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}
