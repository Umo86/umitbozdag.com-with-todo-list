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
