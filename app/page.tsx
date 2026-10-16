import Floorplan from "@/components/Floorplan";
import Reveal from "@/components/Reveal";
import Ticker from "@/components/Ticker";

const ROLES = [
  {
    org: "Media 10",
    now: true,
    title: "Senior Operations Manager",
    body: "Operational lead for UK Construction Week in Birmingham and London — build and breakdown schedules, contractor and supplier management, signage and stand sign-off, and on-site delivery. Supports the sales team on stand space and sponsorship, turning commercial packages into features that work on the floor.",
  },
  {
    org: "DMG Events",
    title: "Operations Manager",
    body: "Delivered Gastech, one of the world's leading energy exhibitions and conferences, and supported operations across DMG's international portfolio.",
  },
  {
    org: "Hyve Group",
    title: "Event Operations",
    body: "Operations across Breakbulk Europe and Breakbulk Americas, Spring Fair and Pure London — project cargo, retail and fashion shows at international scale.",
  },
  {
    org: "Turkish Embassy, London",
    title: "Culture & Information Office",
    body: "Early career delivering cultural programmes and events for the Embassy in London.",
  },
];

const SHOWS = [
  ["UK Construction Week", "Construction, NEC Birmingham & ExCeL London"],
  ["Gastech", "Energy, international"],
  ["Breakbulk Europe", "Project cargo & logistics"],
  ["Breakbulk Americas", "Project cargo & logistics"],
  ["Spring Fair", "Retail, NEC Birmingham"],
  ["Pure London", "Fashion, London"],
];

const CRAFT = [
  "Venue & floor planning",
  "Contractor & supplier management",
  "Build & breakdown scheduling",
  "Health, safety & CDM compliance",
  "Signage, graphics & wayfinding",
  "Operations budgets",
  "Sponsorship & feature delivery",
  "Exhibitor experience",
];

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <a className="wordmark" href="#top">
            Umit Bozdag
          </a>
          <nav className="topnav" aria-label="Site">
            <a href="#profile">Profile</a>
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
        <Floorplan />
        <div className="hero-content">
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
                    <tr>
                      <th>Currently</th>
                      <td>Senior Operations Manager, Media 10</td>
                    </tr>
                    <tr>
                      <th>Based</th>
                      <td>London, United Kingdom</td>
                    </tr>
                    <tr>
                      <th>Home venues</th>
                      <td>NEC Birmingham, ExCeL London</td>
                    </tr>
                    <tr>
                      <th>Delivered across</th>
                      <td>UK, Europe, North America, Asia</td>
                    </tr>
                    <tr>
                      <th>Languages</th>
                      <td>English, Turkish</td>
                    </tr>
                    <tr>
                      <th>Beyond the floor</th>
                      <td>
                        Builds digital tools for the events industry, including
                        a signage and sponsorship sign-off platform
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Reveal>
            </div>
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
                    <p>{r.body}</p>
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
            {SHOWS.map(([name, meta], i) => (
              <Reveal key={name} delay={i * 0.07} y={18}>
                <div className={`show${i === 0 ? " first" : ""}`}>
                  <span className="name">{name}</span>
                  <span className="meta">{meta}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="capabilities" className="block">
          <div className="wrap">
            <Reveal>
              <h2 className="sec">The craft</h2>
              <p className="craft-intro">
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

        <div className="dim" aria-hidden="true">
          <span>first floorplan</span>
          <span style={{ color: "var(--carmine)" }}>●</span>
          <span>final breakdown</span>
        </div>

        <section id="contact" className="contact">
          <div className="wrap">
            <Reveal>
              <h2 className="sec">Contact</h2>
              <p className="big">
                Planning a show? Let&rsquo;s make it run like clockwork.
              </p>
              <p>
                <a href="mailto:umitbozdag@googlemail.com">
                  umitbozdag@googlemail.com
                </a>
                &nbsp;or&nbsp;<a href="/cv">read the CV</a>
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <span>© 2026 Umit Bozdag, London</span>
          <a href="/backstage">Backstage</a>
        </div>
      </footer>
    </>
  );
}
