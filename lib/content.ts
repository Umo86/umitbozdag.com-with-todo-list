// Single source for the public site's content. The home page, the CV and the
// search/link metadata all read from here, so a fact is edited in one place.

export const SITE = {
  name: "Umit Bozdag",
  url: "https://umitbozdag.com",
  role: "Senior Operations Manager",
  employer: "Media 10",
  city: "London",
  email: "umitbozdag@googlemail.com",
  title: "Umit Bozdag — Event Operations, London",
  description:
    "Umit Bozdag is a Senior Operations Manager in London with fifteen years of flagship exhibitions — UK Construction Week, Gastech, Breakbulk, Spring Fair and Pure London.",
};

export type Role = {
  org: string;
  place?: string;
  title: string;
  when?: string;
  now?: boolean;
  summary: string;
  points: string[];
};

export const ROLES: Role[] = [
  {
    org: "Media 10",
    place: "London",
    title: "Senior Operations Manager",
    when: "2026 — present",
    now: true,
    summary:
      "Operational lead for UK Construction Week in Birmingham and London — build and breakdown schedules, contractor and supplier management, signage and stand sign-off, and on-site delivery. Supports the sales team on stand space and sponsorship, turning commercial packages into features that work on the floor.",
    points: [
      "Operational lead for UK Construction Week, delivered across NEC Birmingham and ExCeL London",
      "Owns build and breakdown schedules, contractor and supplier management, and on-site delivery",
      "Runs signage, graphics and stand-design sign-off across the show",
      "Supports sales of stand space and sponsorship, shaping commercial packages into deliverable features",
      "Works across the wider portfolio, including Futurebuild and the Stone & Surface Show",
    ],
  },
  {
    org: "DMG Events",
    title: "Operations Manager",
    when: "to 2026",
    summary:
      "Delivered Gastech, one of the world's leading energy exhibitions and conferences, and supported operations across DMG's international portfolio.",
    points: [
      "Delivered Gastech, one of the world's leading energy exhibitions and conferences",
      "Supported operations across DMG's international events portfolio",
    ],
  },
  {
    org: "Hyve Group",
    title: "Event Operations",
    summary:
      "Operations across Breakbulk Europe and Breakbulk Americas, Spring Fair and Pure London — project cargo, retail and fashion shows at international scale.",
    points: [
      "Operations across Breakbulk Europe and Breakbulk Americas — project cargo and logistics exhibitions",
      "Delivered Spring Fair at the NEC Birmingham and Pure London — large-scale retail and fashion shows",
    ],
  },
  {
    org: "Turkish Embassy, London",
    title: "Culture & Information Office",
    summary:
      "Early career delivering cultural programmes and events for the Embassy in London.",
    points: [
      "Early career delivering cultural programmes and events for the Embassy in London",
    ],
  },
];

export const SHOWS: Array<{ name: string; meta: string }> = [
  { name: "UK Construction Week", meta: "Construction, NEC Birmingham & ExCeL London" },
  { name: "Futurebuild", meta: "Built environment, London" },
  { name: "Stone & Surface Show", meta: "Stone and surfaces, London & Birmingham" },
  { name: "Gastech", meta: "Energy, international" },
  { name: "Breakbulk Europe", meta: "Project cargo & logistics" },
  { name: "Breakbulk Americas", meta: "Project cargo & logistics" },
  { name: "Spring Fair", meta: "Retail, NEC Birmingham" },
  { name: "Pure London", meta: "Fashion, London" },
];

export const CRAFT = [
  "Venue & floor planning",
  "Contractor & supplier management",
  "Build & breakdown scheduling",
  "Health, safety & CDM compliance",
  "Signage, graphics & wayfinding",
  "Operations budgets",
  "Sponsorship & feature delivery",
  "Exhibitor experience",
];

export const FACTS: Array<[string, string]> = [
  ["Currently", "Senior Operations Manager, Media 10"],
  ["Based", "London, United Kingdom"],
  ["Home venues", "NEC Birmingham, ExCeL London"],
  ["Delivered across", "UK, Europe, North America, Asia"],
  ["Languages", "English, Turkish"],
  [
    "Beyond the floor",
    "Builds digital tools for the events industry, including a signage and sponsorship sign-off platform",
  ],
];

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
