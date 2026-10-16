import type { Metadata } from "next";
import PrintButton from "@/components/PrintButton";

export const metadata: Metadata = {
  title: "CV",
  description:
    "Curriculum vitae of Umit Bozdag, Senior Operations Manager — events and exhibitions, London.",
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
        <h1>Umit Bozdag</h1>
        <p className="role-line">
          Senior Operations Manager — events &amp; exhibitions
        </p>
        <p className="contact-line">
          London, United Kingdom —{" "}
          <a href="mailto:umitbozdag@googlemail.com">
            umitbozdag@googlemail.com
          </a>
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

      <div className="cv-entry first">
        <div className="when">
          2026 — <span className="now">present</span>
        </div>
        <div>
          <h3>Senior Operations Manager</h3>
          <p className="org">Media 10, London</p>
          <ul>
            <li>
              Operational lead for UK Construction Week, delivered across NEC
              Birmingham and ExCeL London
            </li>
            <li>
              Owns build and breakdown schedules, contractor and supplier
              management, and on-site delivery
            </li>
            <li>Runs signage, graphics and stand-design sign-off across the show</li>
            <li>
              Supports sales of stand space and sponsorship, shaping commercial
              packages into deliverable features
            </li>
          </ul>
        </div>
      </div>

      <div className="cv-entry">
        <div className="when">to 2026</div>
        <div>
          <h3>Operations Manager</h3>
          <p className="org">DMG Events</p>
          <ul>
            <li>
              Delivered Gastech, one of the world&rsquo;s leading energy
              exhibitions and conferences
            </li>
            <li>Supported operations across DMG&rsquo;s international events portfolio</li>
          </ul>
        </div>
      </div>

      <div className="cv-entry">
        <div className="when" />
        <div>
          <h3>Event Operations</h3>
          <p className="org">Hyve Group</p>
          <ul>
            <li>
              Operations across Breakbulk Europe and Breakbulk Americas —
              project cargo and logistics exhibitions
            </li>
            <li>
              Delivered Spring Fair at the NEC Birmingham and Pure London —
              large-scale retail and fashion shows
            </li>
          </ul>
        </div>
      </div>

      <div className="cv-entry">
        <div className="when" />
        <div>
          <h3>Culture &amp; Information Office</h3>
          <p className="org">Turkish Embassy, London</p>
          <ul>
            <li>
              Early career delivering cultural programmes and events for the
              Embassy in London
            </li>
          </ul>
        </div>
      </div>

      <h2>Selected shows</h2>
      <p className="cv-shows">
        UK Construction Week — Gastech — Breakbulk Europe — Breakbulk Americas —
        Spring Fair — Pure London
      </p>

      <h2>Capabilities</h2>
      <ul className="cv-skills">
        <li>Venue &amp; floor planning</li>
        <li>Contractor &amp; supplier management</li>
        <li>Build &amp; breakdown scheduling</li>
        <li>Health, safety &amp; CDM compliance</li>
        <li>Signage, graphics &amp; wayfinding</li>
        <li>Operations budgets</li>
        <li>Sponsorship &amp; feature delivery</li>
        <li>Exhibitor experience</li>
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
