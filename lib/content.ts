// Single source for the public site's content. profile.json holds the facts
// (roles, dates, shows, contact details); the home page, the CV and the
// search/link metadata all read from here.
import profile from "./profile.json";

export const PROFILE = profile;

export const SITE = {
  name: profile.name,
  url: "https://umitbozdag.com",
  role: profile.title,
  employer: profile.company,
  city: "London",
  email: profile.email,
  linkedin: profile.linkedin,
  whatsapp: profile.whatsapp
    ? `https://wa.me/${profile.whatsapp}?text=${encodeURIComponent(profile.whatsappText ?? "")}`
    : null,
  title: `${profile.name} — ${profile.title} · Exhibitions & Events, London`,
  description: `${profile.name}, ${profile.title} at ${profile.company}. ${profile.statement}`,
};

export type Show = (typeof profile.shows)[number];
export type Employer = (typeof profile.employers)[number];

export const COUNTRIES = (() => {
  const stat = profile.stats.find((s) => /countr/i.test(s.label));
  return stat ? stat.value : 0;
})();

// The show cycle drawn on the home page: a typical large trade exhibition,
// from the first floorplan to the last truck out. Positions are fractions of
// the chart width; the last quarter is the on-site fortnight, drawn larger
// than scale so build, open days and breakdown can be read.
export type CycleRow = {
  label: string;
  start: number;
  end: number;
  onSite?: "build" | "open" | "out";
};

export const CYCLE_TICKS: Array<{ at: number; label: string }> = [
  { at: 0, label: "12 months out" },
  { at: 0.36, label: "6 months" },
  { at: 0.58, label: "3 months" },
  { at: 0.72, label: "Build-up" },
  { at: 0.86, label: "Open" },
  { at: 0.95, label: "Out" },
];

export const CYCLE: CycleRow[] = [
  { label: "Floorplan & stand sales", start: 0, end: 0.7 },
  { label: "Venue, tenancy & licensing", start: 0.04, end: 0.66 },
  { label: "Contractors & suppliers appointed", start: 0.3, end: 0.62 },
  { label: "Exhibitor manual & service orders", start: 0.4, end: 0.72 },
  { label: "Stand plans, RAMS & sign-off", start: 0.5, end: 0.76 },
  { label: "Signage, graphics & wayfinding", start: 0.58, end: 0.85 },
  { label: "Build-up", start: 0.72, end: 0.86, onSite: "build" },
  { label: "Show open", start: 0.86, end: 0.95, onSite: "open" },
  { label: "Breakdown", start: 0.95, end: 1, onSite: "out" },
];
