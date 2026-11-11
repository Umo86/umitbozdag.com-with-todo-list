import PageShell from "@/components/PageShell";
import { AboutSection } from "@/components/Sections";
import { pageMetadata } from "@/lib/pages";
import { PROFILE as p, SITE } from "@/lib/content";

const person = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE.name,
  url: `${SITE.url}/about`,
  jobTitle: SITE.role,
  worksFor: { "@type": "Organization", name: SITE.employer },
  address: { "@type": "PostalAddress", addressLocality: SITE.city, addressCountry: "GB" },
  knowsLanguage: p.languages,
  description: p.statement,
  hasCredential: {
    "@type": "EducationalOccupationalCredential",
    name: "IOSH Safe Management at Live Events",
    credentialCategory: "certificate",
    recognizedBy: { "@type": "Organization", name: "Institution of Occupational Safety and Health (IOSH)", url: "https://iosh.com" },
  },
  sameAs: [SITE.linkedin],
};

export const metadata = pageMetadata("/about");

export default function Page() {
  return (
    <PageShell href="/about" ld={person}>
      <AboutSection as="h1" />
    </PageShell>
  );
}
