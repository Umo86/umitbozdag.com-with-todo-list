// The site's sections. Each one has its own page (/about, /services,
// /show-cycle, /events, /contact) where its heading is the page's <h1>; the
// home page shows a shorter version of each with a link through.
import ContactBadge from "@/components/ContactBadge";
import EventsList from "@/components/EventsList";
import HallBuild from "@/components/HallBuild";
import Reveal from "@/components/Reveal";
import WorldMap from "@/components/WorldMap";
import { WaIcon } from "@/components/SiteChrome";
import { COUNTRIES, PROFILE as p, SITE } from "@/lib/content";

type Level = "h1" | "h2";
function H({ as: Tag, className = "h2", style, children }: { as: Level; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <Tag className={className} style={style}>
      {children}
    </Tag>
  );
}

export function More({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <p className="more">
      <a href={href}>
        {children} <span aria-hidden="true">→</span>
      </a>
    </p>
  );
}

// ——— where I've worked (map + numbers) ———
export function WorldSection({ as = "h2" }: { as?: Level }) {
  return (
    <section className="world" id="world" aria-label="Where I have worked">
      <div className="wrap">
        <div className="world__head">
          <div>
            <span className="kicker">Where I&rsquo;ve worked</span>
            <H as={as}>From London to {COUNTRIES === 8 ? "eight" : COUNTRIES} countries.</H>
          </div>
          <p className="world__lead">{p.worldLead}</p>
        </div>
        <WorldMap />
        <div className="nums">
          {p.stats.map((s) => (
            <div key={s.label}>
              <strong>
                {s.value}
                {s.suffix}
              </strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ——— about ———
export function AboutSection({ as = "h2", short = false }: { as?: Level; short?: boolean }) {
  return (
    <section id="about" className={`sec${as === "h1" ? " page-first" : ""}`}>
      <div className="wrap">
        <Reveal>
          <div className="about">
            <div>
              <span className="kicker">About</span>
              <H as={as}>{p.statement}</H>
            </div>
            <div className="about__text">
              {(short ? p.intro.slice(0, 1) : p.intro).map((para) => (
                <p key={para.slice(0, 24)}>{para}</p>
              ))}
              {short && <More href="/about">More about me</More>}
            </div>
          </div>
        </Reveal>
        {!short && (
          <>
            <Reveal>
              <dl className="facts">
                {p.facts.map((f) => (
                  <div key={f.label}>
                    <dt className="label">{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="label">Languages</dt>
                  <dd>{p.languages.join(" and ")}</dd>
                </div>
              </dl>
            </Reveal>
            <Reveal>
              <div className="orgs">
                <h2 className="label">Worked with</h2>
                <div className="orgs__grid">
                  {p.employers.map((e) => (
                    <a className="org" key={e.id} href={e.url} target="_blank" rel="noopener">
                      <span className="org__logo">
                        {e.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.logo} alt={`${e.name} logo`} loading="lazy" />
                        )}
                      </span>
                      <strong>{e.name}</strong>
                      <span>{e.role}</span>
                      <span>{e.period}</span>
                    </a>
                  ))}
                </div>
              </div>
            </Reveal>
          </>
        )}
      </div>
    </section>
  );
}

// ——— what I do ———
export function ServicesSection({ as = "h2", short = false }: { as?: Level; short?: boolean }) {
  return (
    <section id="services" className={`sec${as === "h1" ? " page-first" : " flush"}`}>
      <div className="wrap">
        <Reveal>
          <span className="kicker">What I do</span>
          <H as={as} style={{ maxWidth: "18ch" }}>
            {p.servicesIntro}
          </H>
        </Reveal>
        <Reveal>
          <div className="services">
            {p.services.map((s) => (
              <div className="svc" key={s.title}>
                {as === "h1" ? <h2>{s.title}</h2> : <h3>{s.title}</h3>}
                {!short && <p>{s.text}</p>}
              </div>
            ))}
          </div>
        </Reveal>
        {short ? (
          <More href="/services">What I do, in detail</More>
        ) : (
          <>
            <Reveal>
              <div className="skills">
                <h2 className="label">Also</h2>
                <ul>
                  {p.alsoSkills.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal>
              <div className="creds">
                <h2 className="label">Qualifications</h2>
                <dl>
                  {p.credentials.map((c) => (
                    <div key={c.title}>
                      <dt>{c.title}</dt>
                      <dd>{c.text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
          </>
        )}
      </div>
    </section>
  );
}

// ——— the show cycle ———
export function CycleSection({ as = "h2", short = false }: { as?: Level; short?: boolean }) {
  return (
    <section id="cycle" className={`sec${as === "h1" ? " page-first" : " flush"}`}>
      <div className="wrap">
        <Reveal>
          <div className="head">
            <div>
              <span className="kicker">The show cycle</span>
              <H as={as}>Three days on the floor. A year in the diary.</H>
            </div>
            <p className="lead">
              One hall, from an empty floorplan to doors open and back.
              {short ? "" : " Tap a stage to see it."}
            </p>
          </div>
        </Reveal>
        {short ? (
          <More href="/show-cycle">Walk through a show, from floorplan to breakdown</More>
        ) : (
          <div className="blueprint">
            <HallBuild />
          </div>
        )}
      </div>
    </section>
  );
}

// ——— events ———
export function EventsSection({ as = "h2", short = false }: { as?: Level; short?: boolean }) {
  return (
    <section id="events" className={`sec${as === "h1" ? " page-first" : " flush"}`}>
      <div className="wrap">
        <Reveal>
          <div className="head">
            <div>
              <span className="kicker">Events</span>
              <H as={as}>{short ? "Recent shows." : "Every show since 2012."}</H>
            </div>
            <p className="meta">
              {p.shows.length} shows, {COUNTRIES} countries, newest first
            </p>
          </div>
        </Reveal>
        {short ? (
          <>
            <ul className="evt-short">
              {p.shows.slice(0, 6).map((s) => (
                <li key={s.id}>
                  <a href={`/shows/${s.id}`}>
                    <strong>{s.name}</strong>
                    <span>
                      {[s.city, s.country].filter(Boolean).join(", ")} · {s.years}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <More href="/events">All {p.shows.length} events</More>
          </>
        ) : (
          <EventsList shows={p.shows} employers={p.employers} />
        )}
      </div>
    </section>
  );
}

// ——— contact ———
export function ContactSection({ as = "h2" }: { as?: Level }) {
  return (
    <section id="contact" className={`sec contact${as === "h1" ? " page-first" : ""}`}>
      <div className="wrap">
        <div className="contact__text">
          <span className="kicker">Contact</span>
          <H as={as}>Let&rsquo;s talk.</H>
          <p className="contact__lead">
            Planning a show, hiring, or want to compare notes?
            {SITE.whatsapp ? " WhatsApp is the quickest way to reach me." : ""}
          </p>
          <div className="btns">
            {SITE.whatsapp && (
              <a className="btn" href={SITE.whatsapp} target="_blank" rel="noopener">
                <WaIcon />
                Message on WhatsApp
              </a>
            )}
            <a className="btn btn--o" href={`mailto:${SITE.email}`}>
              Email me
            </a>
          </div>
          <p className="contact__small">
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            <a href={SITE.linkedin} target="_blank" rel="noopener">
              LinkedIn
            </a>
          </p>
        </div>
        <ContactBadge />
      </div>
    </section>
  );
}
