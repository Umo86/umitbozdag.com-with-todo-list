// The frame around each section page: menu, breadcrumb data, the section,
// a link on to the next page, and the footer.
import { SiteFooter, SiteNav } from "@/components/SiteChrome";
import { PAGES, breadcrumbLd } from "@/lib/pages";

export default function PageShell({ href, children, ld }: { href: string; children: React.ReactNode; ld?: object }) {
  const i = PAGES.findIndex((x) => x.href === href);
  const next = PAGES[(i + 1) % PAGES.length];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd(href)) }} />
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />}
      <SiteNav current={href} />
      <main id="top">{children}</main>
      {href !== "/contact" && (
        <nav className="nextpage" aria-label="Next page">
          <div className="wrap">
            <span className="label">Next</span>
            <a href={next.href}>
              {next.label} <span aria-hidden="true">→</span>
            </a>
          </div>
        </nav>
      )}
      <SiteFooter />
    </>
  );
}
