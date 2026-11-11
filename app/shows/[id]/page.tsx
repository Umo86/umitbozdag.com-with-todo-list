import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteNav, WaIcon } from "@/components/SiteChrome";
import { PROFILE as p, SITE } from "@/lib/content";
import { SIDE } from "@/components/EventsList";

type Params = { params: Promise<{ id: string }> };
type ShowT = (typeof p.shows)[number];

// "12 – 14 May 2026", "30 Sep – 2 Oct 2025", "5 March 2024" → ISO dates
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function isoRange(s: string): { start?: string; end?: string } {
  const m = /^(\d{1,2})(?:\s+([A-Za-z]+))?\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(s.trim()) ?? null;
  const one = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(s.trim());
  const mon = (x?: string) => (x ? MONTHS.indexOf(x.slice(0, 3).toLowerCase()) + 1 : 0);
  const iso = (y: string, mo: number, d: string) => (mo > 0 ? `${y}-${String(mo).padStart(2, "0")}-${d.padStart(2, "0")}` : undefined);
  if (m) return { start: iso(m[5], mon(m[2] || m[4]), m[1]), end: iso(m[5], mon(m[4]), m[3]) };
  if (one) return { start: iso(one[3], mon(one[2]), one[1]) };
  return {};
}

// Search engines: breadcrumb, plus an Event when the dates are known.
function showLd(s: ShowT) {
  const crumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE.url}/` },
      { "@type": "ListItem", position: 2, name: "Events", item: `${SITE.url}/events` },
      { "@type": "ListItem", position: 3, name: s.name, item: `${SITE.url}/shows/${s.id}` },
    ],
  };
  const { start, end } = isoRange(s.dates ?? "");
  const employer = p.employers.find((e) => e.id === s.organiser);
  const event = start
    ? {
        "@type": "Event",
        name: s.name,
        description: s.summary,
        startDate: start,
        endDate: end ?? start,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: {
          "@type": "Place",
          name: s.venue || s.city,
          address: { "@type": "PostalAddress", addressLocality: s.city, addressCountry: s.country },
        },
        ...(employer ? { organizer: { "@type": "Organization", name: employer.name, url: employer.url } } : {}),
        ...(s.url ? { url: s.url } : {}),
        ...(s.image ? { image: `${SITE.url}${s.image}` } : {}),
      }
    : null;
  return { "@context": "https://schema.org", "@graph": event ? [crumbs, event] : [crumbs] };
}

export const dynamicParams = false;
export function generateStaticParams() {
  return p.shows.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const show = p.shows.find((s) => s.id === id);
  if (!show) return {};
  return {
    title: `${show.name}${show.city ? `, ${show.city}` : ""}`,
    description: show.summary.slice(0, 180),
    openGraph: { title: show.name, description: show.summary.slice(0, 180), url: `/shows/${show.id}`, ...(show.image ? { images: [show.image] } : {}) },
    alternates: { canonical: `/shows/${show.id}` },
  };
}

const initials = (name: string) =>
  name.replace(/[^A-Za-z0-9 &]/g, "").split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join("").toUpperCase();
const fmtDate = (d: string) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? d
    : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export default async function ShowPage({ params }: Params) {
  const { id } = await params;
  const i = p.shows.findIndex((s) => s.id === id);
  if (i < 0) notFound();
  const show = p.shows[i];
  const employer = p.employers.find((e) => e.id === show.organiser);
  const exp = p.experience.find((x) => employer && x.company.startsWith(employer.name));
  const prev = p.shows[i - 1];
  const next = p.shows[i + 1];
  const related = p.shows.filter((s) => s.organiser === show.organiser && s.id !== show.id).slice(0, 4);
  const where = [show.venue, show.city !== show.venue ? show.city : "", show.country].filter(Boolean).join(", ");
  const when = show.dates || show.years;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(showLd(show)) }} />
      <SiteNav current="/events" />
      <main>
        <section className="showhero">
          <div className="wrap">
            <a href="/events" className="showhero__back">
              ← All events
            </a>
            <div className="showhero__grid">
              <div className="showhero__logo">
                {show.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={show.logo} alt={`${show.name} logo`} />
                ) : (
                  <span className="wordmark">{show.name}</span>
                )}
              </div>
              <div>
                <span className="kicker showhero__kicker">
                  <em className={`evt__side evt__side--${show.side}`}>{SIDE[show.side] ?? show.side}</em>
                  {employer ? `${employer.name}, ` : ""}
                  {show.role}
                </span>
                <h1>{show.name}</h1>
                <p className="showhero__where">
                  {where}
                  {when ? `, ${when}` : ""}
                </p>
                <div className="btns">
                  {show.url && (
                    <a className="btn" href={show.url} target="_blank" rel="noopener">
                      Event website ↗
                    </a>
                  )}
                  {show.press.length > 0 && (
                    <a className="btn btn--o" href="#press">
                      In the press
                    </a>
                  )}
                  <a className="btn btn--o" href="/contact">
                    Get in touch
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="showbody">
          <div className="wrap">
            <div>
              {show.image && (
                <figure className="showbody__figure">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={show.image} alt="" loading="lazy" />
                </figure>
              )}
              <p className="showbody__summary">{show.summary}</p>
              {show.highlights.length > 0 && (
                <ul className="chips" style={{ marginTop: 20 }}>
                  {show.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              {show.responsibilities.length > 0 && (
                <>
                  <h2>What I did</h2>
                  <ul className="points">
                    {show.responsibilities.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </>
              )}
              {show.press.length > 0 && (
                <>
                  <h2 id="press">In the press</h2>
                  <ul className="press">
                    {show.press.map((a) => (
                      <li key={a.url}>
                        <a href={a.url} target="_blank" rel="noopener nofollow">
                          <span>
                            <span className="press__meta">
                              {[a.source, a.date ? fmtDate(a.date) : ""].filter(Boolean).join(", ")}
                            </span>
                            <strong>{a.title}</strong>
                          </span>
                          <span className="press__arr" aria-hidden="true">
                            ↗
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {exp && employer && (
                <>
                  <h2>
                    My role at {employer.name} ({exp.period})
                  </h2>
                  <p className="showbody__role">{exp.summary}</p>
                  <ul className="points">
                    {exp.points.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <aside>
              <dl className="factcard">
                {employer && (
                  <div>
                    <dt>Worked for</dt>
                    <dd>
                      <a href={employer.url} target="_blank" rel="noopener">
                        {employer.name} ↗
                      </a>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>I was there as</dt>
                  <dd>
                    {show.side === "organiser"
                      ? "Organiser (on the team running the show)"
                      : show.side === "sponsor"
                        ? "Sponsor (delivering the office’s sponsorship)"
                        : "Exhibitor (delivering the stand)"}
                  </dd>
                </div>
                <div>
                  <dt>My role</dt>
                  <dd>{show.role}</dd>
                </div>
                {show.venue && (
                  <div>
                    <dt>Venue</dt>
                    <dd>{show.venue}</dd>
                  </div>
                )}
                {show.city && (
                  <div>
                    <dt>Location</dt>
                    <dd>{[show.city, show.country].filter(Boolean).join(", ")}</dd>
                  </div>
                )}
                {when && (
                  <div>
                    <dt>{show.dates ? "Dates" : "Years"}</dt>
                    <dd>{when}</dd>
                  </div>
                )}
                {show.url && (
                  <div>
                    <dt>Website</dt>
                    <dd>
                      <a href={show.url} target="_blank" rel="noopener">
                        {bare(show.url)} ↗
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              <div className="sidecard">
                <strong>{p.name}</strong>
                <span>
                  {p.title}, {p.company}, London
                </span>
                <div className="btns">
                  {SITE.whatsapp && (
                    <a className="btn" href={SITE.whatsapp} target="_blank" rel="noopener">
                      <WaIcon />
                      WhatsApp
                    </a>
                  )}
                  <a className="btn btn--o" href={`mailto:${SITE.email}`}>
                    Email
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="shownav">
          <div className="wrap">
            <div className="shownav__pn">
              {prev ? (
                <a className="shownav__link" href={`/shows/${prev.id}`}>
                  <small>← Newer</small>
                  <strong>{prev.name}</strong>
                </a>
              ) : (
                <span />
              )}
              {next && (
                <a className="shownav__link shownav__link--next" href={`/shows/${next.id}`}>
                  <small>Older →</small>
                  <strong>{next.name}</strong>
                </a>
              )}
            </div>
            {related.length > 0 && (
              <>
                <div className="related__head">
                  <span className="label">More with {employer ? employer.name : "this organiser"}</span>
                  <a href="/events">All events →</a>
                </div>
                <ul className="evt-grid">
                  {related.map((r) => (
                    <li key={r.id}>
                      <a className="evt" href={`/shows/${r.id}`}>
                        <span className="evt__logo">
                          {r.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.logo} alt="" loading="lazy" />
                          ) : (
                            <span className="initials">{initials(r.name)}</span>
                          )}
                        </span>
                        <span>
                          <strong>{r.name}</strong>
                          <span className="evt__where">{[r.venue, r.city].filter(Boolean).join(", ")}</span>
                        </span>
                        <span className="evt__year">{r.years}</span>
                        <span className="evt__arr" aria-hidden="true">
                          →
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
