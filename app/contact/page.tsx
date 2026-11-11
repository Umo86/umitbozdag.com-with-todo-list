import PageShell from "@/components/PageShell";
import { ContactSection } from "@/components/Sections";
import { pageMetadata } from "@/lib/pages";

export const metadata = pageMetadata("/contact");

export default function Page() {
  return (
    <PageShell href="/contact">
      <ContactSection as="h1" />
    </PageShell>
  );
}
