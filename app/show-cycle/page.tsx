import PageShell from "@/components/PageShell";
import { CycleSection } from "@/components/Sections";
import { pageMetadata } from "@/lib/pages";

export const metadata = pageMetadata("/show-cycle");

export default function Page() {
  return (
    <PageShell href="/show-cycle">
      <CycleSection as="h1" />
    </PageShell>
  );
}
