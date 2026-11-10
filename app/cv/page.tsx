import type { Metadata } from "next";
import PrintButton from "@/components/PrintButton";
import { PROFILE as p, SITE } from "@/lib/content";

export const metadata: Metadata = {
  title: "CV",
  description: `Curriculum vitae of ${p.name}, ${p.title} — exhibitions and events, London.`,
  alternates: { canonical: "/cv" },
};

export default function CvPage() {
  return (
    <div className="cv">
      <div className="cv__bar">
        <a href="/">← Back to the site</a>
        <PrintButton />
      </div>

      <header className="cv__head">
        <h1>{p.name}</h1>
        <p className="cv__role">
          {p.title}, {p.company}
        </p>
        <p className="cv__reach">
          <span>{p.location}</span>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          <a href={SITE.linkedin}>LinkedIn</a>
        </p>
      </header>

      <h2>Profile</h2>
      <p className="cv__summary">{p.intro[0]}</p>

      <h2>Experience</h2>
      {p.experience.map((x) => (
        <div className="cv__job" key={`${x.company}-${x.period}`}>
          <div className="cv__when">{x.period}</div>
          <div>
            <h3>{x.role}</h3>
            <p className="cv__co">
              {x.company}, {x.place}
            </p>
            <p>{x.summary}</p>
            <ul className="points">
              {x.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
            {x.events.length > 0 && <p className="cv__events">{x.events.join(" / ")}</p>}
          </div>
        </div>
      ))}

      <h2>Qualifications</h2>
      <dl className="cv__grid">
        {p.credentials
          .filter((c) => !/off duty/i.test(c.title))
          .map((c) => (
            <div key={c.title}>
              <dt className="label">{c.title}</dt>
              <dd>{c.text}</dd>
            </div>
          ))}
        <div>
          <dt className="label">Languages</dt>
          <dd>{p.languages.join(" and ")}, fluent</dd>
        </div>
      </dl>

      <h2>Skills</h2>
      <ul className="chips">
        {p.alsoSkills.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
