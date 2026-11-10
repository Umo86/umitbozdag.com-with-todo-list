import type { Metadata } from "next";
import PrintButton from "@/components/PrintButton";
import { CRAFT, ROLES, SHOWS, SITE } from "@/lib/content";

export const metadata: Metadata = {
  title: "CV",
  description:
    "Curriculum vitae of Umit Bozdag, Senior Operations Manager — events and exhibitions, London.",
  alternates: { canonical: "/cv" },
};

export default function CvPage() {
  return (
    <div className="cv-page">
      <div className="cv-toolbar">
        <a className="back" href="/">
          Back to the site
        </a>
        <PrintButton />
      </div>

      <header className="cv-head">
        <h1>{SITE.name}</h1>
        <p className="role-line">{SITE.role} — events &amp; exhibitions</p>
        <p className="contact-line">
          London, United Kingdom —{" "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        </p>
      </header>

      <h2>Profile</h2>
      <p className="cv-summary">
        Events operations manager with fifteen years across flagship trade
        exhibitions in the UK, Europe, North America and Asia. Leads the full
        operational lifecycle — floorplans, contractors, health and safety,
        build and breakdown — and works closely with commercial teams so that
        what is sold is what gets built. Currently responsible for UK
        Construction Week across the NEC Birmingham and ExCeL London.
      </p>

      <h2>Experience</h2>
      {ROLES.map((r, i) => (
        <div className={`cv-entry${i === 0 ? " first" : ""}`} key={r.org}>
          <div className="when">{r.when ?? ""}</div>
          <div>
            <h3>{r.title}</h3>
            <p className="org">
              {r.org}
              {r.place && !r.org.includes(r.place) ? `, ${r.place}` : ""}
            </p>
            <ul>
              {r.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}

      <h2>Selected shows</h2>
      <p className="cv-shows">{SHOWS.map((s) => s.name).join(" — ")}</p>

      <h2>Capabilities</h2>
      <ul className="cv-skills">
        {CRAFT.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <h2>Languages</h2>
      <p>English — Turkish</p>

      <p className="cv-note">
        Beyond the show floor: builds digital tools for the events industry,
        including an in-house signage and sponsorship sign-off platform used on
        UK Construction Week. Full dates and references on request.
      </p>
    </div>
  );
}
