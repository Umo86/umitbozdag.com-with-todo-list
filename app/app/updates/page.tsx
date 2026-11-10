import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "@/components/SiteChrome";
import { latestRelease } from "@/lib/app-download";
import changelog from "@/lib/changelog.json";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Backstage app updates",
  description: "Every Backstage update: new features and fixes, with dates.",
  alternates: { canonical: "/app/updates" },
  robots: { index: false, follow: true },
};

const day = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

export default async function UpdatesPage() {
  const rel = await latestRelease();
  const features = changelog.reduce((n, c) => n + c.items.length, 0);
  return (
    <>
      <SiteNav />
      <main id="top" className="appdl">
        <section className="appdl__hero">
          <div className="wrap">
            <span className="kicker">Backstage for Android</span>
            <h1>Updates</h1>
            <p className="lead">
              Everything new in Backstage, newest first. {changelog.length} updates, {features} changes so far.
            </p>
            <div className="appdl__cta">
              <a className="appdl__btn" href="/app/download">
                Download the latest app
              </a>
              <a className="appdl__alt" href="/app">
                How to install
              </a>
            </div>
            <p className="appdl__small">
              {rel.build ? `Latest app: version ${rel.build}` : "Latest app"}
              {rel.published
                ? `, built ${new Date(rel.published).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}`
                : ""}
              . Already installed? It updates itself the next time you open it.
            </p>
          </div>
        </section>

        <section className="wrap appdl__section">
          <ol className="appdl__news">
            {changelog.map((c, i) => (
              <li key={`${c.date}-${i}`} id={`u${changelog.length - i}`}>
                <div className="when">
                  {day(c.date)}
                  <span className="quiet">Update {changelog.length - i}</span>
                  {i === 0 && <span className="new">Latest</span>}
                </div>
                <div>
                  <h3>{c.title}</h3>
                  <ul>
                    {c.items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
