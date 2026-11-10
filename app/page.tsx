import Badge from "@/components/Badge";
import HallBuild from "@/components/HallBuild";
import Reveal from "@/components/Reveal";
import ShowCycle from "@/components/ShowCycle";
import Ticker from "@/components/Ticker";
import { CRAFT, FACTS, ROLES, SHOWS, SITE } from "@/lib/content";

const personLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE.name,
  url: SITE.url,
  jobTitle: SITE.role,
  worksFor: { "@type": "Organization", name: SITE.employer },
  address: { "@type": "PostalAddress", addressLocality: SITE.city, addressCountry: "GB" },
  knowsLanguage: ["English", "Turkish"],
  knowsAbout: CRAFT,
};

export default function Home() {
  return (
    <>
      <a className="skip" href="#profile">
        Skip to content
      </a>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
      />

      <header className="topbar">
        <div className="wrap">
          <a className="wordmark" href="#top">
            Umit Bozdag
          </a>
          <nav className="topnav" aria-label="Site">
            <a href="#profile">Profile</a>
            <a href="#cycle">Show cycle</a>
            <a href="#experience">Experience</a>
            <a href="#productions">Productions</a>
            <a href="#contact">Contact</a>
            <a className="cta" href="/cv">
              Read the CV
            </a>
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="wrap hero-content">
          <p className="kicker">Event operations, London</p>
          <h1 className="masthead">
            <span className="forename">UMIT</span>BOZDAG
          </h1>
          <div className="cover-rule" />
          <div className="cover-rule thin" />
          <div className="coverlines">
            <p className="line">
              <em>Fifteen years of flagship exhibitions</em> — from the first
              floorplan to the final breakdown.
            </p>
            <p className="line">
              Now running <em>UK Construction Week</em>
              <br />
              NEC Birmingham &amp; ExCeL London
            </p>
          </div>
        </div>
        <div className="wrap">
          <HallBuild />
        </div>
      </section>

      <Ticker />

      <main>
        <section id="profile" className="block">
          <div className="wrap">
            <Reveal>
              <h2 className="sec">The profile</h2>
            </Reveal>
            <div className="profile-grid">
              <Reveal>
                <p className="lede">
                  Big shows look effortless when the operations behind them are
                  exact.
                </p>
                <p className="after">
                  That is the work: schedules, contractors, compliance and a
                  thousand moving parts resolved before doors open. I am a
                  Senior Operations Manager at Media 10, leading operations for
                  UK Construction Week across the NEC in Birmingham and ExCeL
                  London, and working alongside the commercial team so that
                  every stand and sponsorship sold is one we can build. Before
                  Media 10 I delivered Gastech with DMG Events and international
                  exhibitions across logistics, fashion and retail with Hyve
                  Group.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <table className="facts">
                  <tbody>
                    {FACTS.map(([k, v]) => (
                      <tr key={k}>
                        <th scope="row">{k}</th>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="cycle" className="block">
          <div className="wrap">
            <Reveal>
              <h2 className="sec tight">The show cycle</h2>
              <p className="sec-intro">
                A show is on the floor for three days and in the diary for a
                year. This is the year: the workstreams that have to land, in
                order, for the doors to open on time.
              </p>
            </Reveal>
            <ShowCycle />
          </div>
        </section>

        <section id="experience" className="block">
          <div className="wrap">
            <Reveal>
              <h2 className="sec">Experience</h2>
            </Reveal>
            {ROLES.map((r, i) => (
              <Reveal key={r.org} delay={i * 0.06}>
                <div className={`role${i === 0 ? " first" : ""}`}>
                  <div className="org">
                    {r.org}
                    {r.now && (
                      <>
                        <br />
                        <span className="now">Now</span>
                      </>
                    )}
                  </div>
                  <div>
                    <h3>{r.title}</h3>
                    <p>{r.summary}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="productions" className="block">
          <div className="wrap">
            <Reveal>
              <h2 className="sec">Selected productions</h2>
            </Reveal>
            {SHOWS.map((s, i) => (
              <Reveal key={s.name} delay={Math.min(i, 5) * 0.06} y={18}>
                <div className={`show${i === 0 ? " first" : ""}`}>
                  <span className="name">{s.name}</span>
                  <span className="meta">{s.meta}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="capabilities" className="block">
          <div className="wrap">
            <Reveal>
              <h2 className="sec tight">The craft</h2>
              <p className="sec-intro">
                Everything an exhibition needs between the sales deck and the
                show floor, owned end to end.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <ul className="craft">
                {CRAFT.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section id="contact" className="contact">
          <div className="wrap contact-grid">
            <div className="contact-text">
              <h2 className="sec tight">Contact</h2>
              <p className="big">
                Planning a show? Let&rsquo;s make it run like clockwork.
              </p>
              <p className="reach">
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
                &nbsp;or&nbsp;<a href="/cv">read the CV</a>
              </p>
            </div>
            <Badge />
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <span>© {new Date().getFullYear()} Umit Bozdag, London</span>
          <a href="/backstage">Backstage</a>
        </div>
      </footer>
    </>
  );
}
