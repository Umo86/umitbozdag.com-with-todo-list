import ContactBadge from "@/components/ContactBadge";
import EventsList from "@/components/EventsList";
import HallBuild from "@/components/HallBuild";
import HeroFilm from "@/components/HeroFilm";
import Reveal from "@/components/Reveal";
import ShowCycle from "@/components/ShowCycle";
import WorldMap from "@/components/WorldMap";
import { SiteFooter, SiteNav, WaIcon } from "@/components/SiteChrome";
import { COUNTRIES, PROFILE as p, SITE } from "@/lib/content";

const personLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE.name,
  url: SITE.url,
  jobTitle: SITE.role,
  worksFor: { "@type": "Organization", name: SITE.employer },
  address: { "@type": "PostalAddress", addressLocality: SITE.city, addressCountry: "GB" },
  knowsLanguage: p.languages,
  sameAs: [SITE.linkedin],
};

export default function Home() {
  return (
    <>
      <a className="skip" href="#about">
        Skip to content
      </a>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
      />

      <SiteNav home />

      <main id="top">
        <HeroFilm />

        <section className="world" id="world" aria-label="Where I have worked">
          <div className="wrap">
            <div className="world__head">
              <div>
                <span className="kicker">Where I&rsquo;ve worked</span>
                <h2 className="h2">
                  From London to {COUNTRIES === 8 ? "eight" : COUNTRIES} countries.
                </h2>
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

        <section id="about" className="sec">
          <div className="wrap">
            <Reveal>
              <div className="about">
                <div>
                  <span className="kicker">About</span>
                  <h2 className="h2">{p.statement}</h2>
                </div>
                <div className="about__text">
                  {p.intro.map((para) => (
                    <p key={para.slice(0, 24)}>{para}</p>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal>
              <dl className="facts">
                {p.facts.map((f) => (
                  <div key={f.label}>
                    <dt className="label">{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
            <Reveal>
              <div className="orgs">
                <span className="label">Worked with</span>
                <div className="orgs__grid">
                  {p.employers.map((e) => (
                    <a className="org" key={e.id} href={e.url} target="_blank" rel="noopener">
                      <span className="org__logo">
                        {e.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.logo} alt="" loading="lazy" />
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
          </div>
        </section>

        <section id="services" className="sec flush">
          <div className="wrap">
            <Reveal>
              <span className="kicker">What I do</span>
              <h2 className="h2" style={{ maxWidth: "18ch" }}>
                {p.servicesIntro}
              </h2>
            </Reveal>
            <Reveal>
              <div className="services">
                {p.services.map((s) => (
                  <div className="svc" key={s.title}>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="cycle" className="sec flush">
          <div className="wrap">
            <Reveal>
              <div className="head">
                <div>
                  <span className="kicker">The show cycle</span>
                  <h2 className="h2">Three days on the floor. A year in the diary.</h2>
                </div>
                <p className="lead">
                  One hall from empty floorplan to doors open, and the
                  workstreams that have to land, in order, to get it there.
                </p>
              </div>
            </Reveal>
            <div className="blueprint">
              <HallBuild />
            </div>
            <ShowCycle />
          </div>
        </section>

        <section id="events" className="sec flush">
          <div className="wrap">
            <Reveal>
              <div className="head">
                <div>
                  <span className="kicker">Events</span>
                  <h2 className="h2">Every show since 2012.</h2>
                </div>
                <p className="meta">
                  {p.shows.length} shows, {COUNTRIES} countries, newest first
                </p>
              </div>
            </Reveal>
            <EventsList shows={p.shows} employers={p.employers} />
          </div>
        </section>

        <section id="contact" className="sec contact">
          <div className="wrap">
            <div className="contact__text">
              <span className="kicker">Contact</span>
              <h2 className="h2">Let&rsquo;s talk.</h2>
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
      </main>

      <SiteFooter />
    </>
  );
}
