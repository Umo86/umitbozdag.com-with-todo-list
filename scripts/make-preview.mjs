// Generates self-contained, animated HTML previews of the site so the pages
// can be reviewed in the chat panel. Same CSS and content as the Next.js app;
// React-driven motion (floorplan draw, reveals, parallax) is reproduced with
// CSS keyframes + a few lines of vanilla JS. Progressive enhancement: with
// scripts disabled everything is simply visible.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");

const FONTS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=Jost:ital,wght@0,300..600;1,300..600&display=swap" rel="stylesheet">`;

// ——— floorplan data (same as components/Floorplan.tsx) ———
const STANDS = [
  { x: 80, y: 70, w: 180, h: 90, label: "A10" },
  { x: 80, y: 180, w: 85, h: 80, label: "A12" },
  { x: 175, y: 180, w: 85, h: 80 },
  { x: 340, y: 70, w: 120, h: 90, label: "B20" },
  { x: 470, y: 70, w: 100, h: 90, label: "B24", sold: true },
  { x: 340, y: 180, w: 230, h: 80, label: "B30", sold: true },
  { x: 660, y: 70, w: 100, h: 190, label: "C10" },
  { x: 770, y: 70, w: 110, h: 90, label: "C14" },
  { x: 770, y: 180, w: 110, h: 80 },
  { x: 940, y: 70, w: 180, h: 90, label: "D10" },
  { x: 940, y: 180, w: 180, h: 80, label: "D16", sold: true },
  { x: 80, y: 320, w: 180, h: 80, label: "A40" },
  { x: 80, y: 410, w: 180, h: 80, label: "A44", sold: true },
  { x: 340, y: 320, w: 230, h: 80, label: "B44" },
  { x: 340, y: 410, w: 100, h: 80, label: "B48" },
  { x: 470, y: 410, w: 100, h: 80 },
  { x: 660, y: 320, w: 110, h: 170, label: "C40", sold: true },
  { x: 780, y: 320, w: 100, h: 80, label: "C44" },
  { x: 780, y: 410, w: 100, h: 80 },
  { x: 940, y: 320, w: 180, h: 80, label: "D40" },
  { x: 940, y: 410, w: 85, h: 80 },
  { x: 1035, y: 410, w: 85, h: 80, label: "D46" },
];
const AISLES = [
  { x1: 300, y1: 60, x2: 300, y2: 500 },
  { x1: 620, y1: 60, x2: 620, y2: 500 },
  { x1: 910, y1: 60, x2: 910, y2: 500 },
  { x1: 50, y1: 290, x2: 1150, y2: 290 },
];

const d = (i) => (0.25 + i * 0.045).toFixed(2);
let soldN = 0;
const planSvg = `
<svg viewBox="0 0 1200 560" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g stroke="var(--plan-line)" stroke-width="1.25" vector-effect="non-scaling-stroke">
    <rect class="pl" pathLength="1" x="40" y="30" width="1120" height="500" style="animation-delay:${d(0)}s"/>
    ${AISLES.map(
      (a, i) =>
        `<line class="pl" pathLength="1" x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke-dasharray="3 6" style="animation-delay:${d(1 + i)}s"/>`
    ).join("\n    ")}
    ${STANDS.map(
      (s, i) =>
        `<rect class="pl" pathLength="1" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" style="animation-delay:${d(5 + i)}s"/>`
    ).join("\n    ")}
  </g>
  ${STANDS.filter((s) => s.sold)
    .map(
      (s) =>
        `<rect class="sold" x="${s.x + 3}" y="${s.y + 3}" width="${s.w - 6}" height="${s.h - 6}" fill="var(--carmine)" style="animation-delay:${(2.1 + soldN++ * 0.4).toFixed(2)}s"/>`
    )
    .join("\n  ")}
  <g class="plan-labels" font-family="Jost, sans-serif" font-size="12" fill="#9a948a">
    ${STANDS.filter((s) => s.label)
      .map(
        (s) =>
          `<text x="${s.x + s.w / 2}" y="${s.y + s.h / 2 + 4}" text-anchor="middle">${s.label}</text>`
      )
      .join("\n    ")}
  </g>
</svg>`;

const PREVIEW_CSS = `
/* preview-only: CSS stand-ins for the React-driven motion */
@media (prefers-reduced-motion: no-preference){
  .pl{stroke-dasharray:1;stroke-dashoffset:1;animation:plandraw .9s ease-in-out forwards}
  @keyframes plandraw{to{stroke-dashoffset:0}}
  .sold{opacity:0;animation:soldin .6s ease forwards}
  @keyframes soldin{to{opacity:.16}}
  .plan-labels{opacity:0;animation:labelin .8s ease 1.9s forwards}
  @keyframes labelin{to{opacity:1}}
  .rv-prep .rv{opacity:0;transform:translateY(26px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
  .rv-prep .rv.rv-in{opacity:1;transform:none}
}
.sold{opacity:.16}
@media (prefers-reduced-motion: reduce){.sold{animation:none}}
.preview-tag{position:fixed;right:14px;bottom:14px;z-index:50;background:#000;color:#fff;font:400 12px/1 Jost,sans-serif;padding:7px 12px;letter-spacing:.04em;opacity:.85}
`;

const PREVIEW_JS = `
<script>
(function(){
  // scroll reveals (progressive enhancement)
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window){
    document.documentElement.classList.add('rv-prep');
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('rv-in'); io.unobserve(e.target); } });
    }, { rootMargin: '-60px' });
    document.querySelectorAll('.rv').forEach(function(el, i){ el.style.transitionDelay = (i % 6) * 0.06 + 's'; io.observe(el); });
    // gentle pointer parallax on the floorplan
    var plan = document.querySelector('.hero-plan');
    if (plan){
      window.addEventListener('mousemove', function(e){
        var x = (e.clientX / innerWidth) * 2 - 1, y = (e.clientY / innerHeight) * 2 - 1;
        plan.style.transform = 'translate(' + (x * 10).toFixed(1) + 'px,' + (y * 7).toFixed(1) + 'px)';
      });
    }
  }
})();
</script>`;

const tickerRun = [
  "UK Construction Week",
  "Gastech",
  "Breakbulk Europe",
  "Breakbulk Americas",
  "Spring Fair",
  "Pure London",
]
  .map(
    (s) =>
      `<span><span class="ticker-item">${s}</span><span class="ticker-sep" aria-hidden="true">●</span></span>`
  )
  .join("");

const ROLES = [
  ["Media 10", true, "Senior Operations Manager", "Operational lead for UK Construction Week in Birmingham and London — build and breakdown schedules, contractor and supplier management, signage and stand sign-off, and on-site delivery. Supports the sales team on stand space and sponsorship, turning commercial packages into features that work on the floor."],
  ["DMG Events", false, "Operations Manager", "Delivered Gastech, one of the world's leading energy exhibitions and conferences, and supported operations across DMG's international portfolio."],
  ["Hyve Group", false, "Event Operations", "Operations across Breakbulk Europe and Breakbulk Americas, Spring Fair and Pure London — project cargo, retail and fashion shows at international scale."],
  ["Turkish Embassy, London", false, "Culture & Information Office", "Early career delivering cultural programmes and events for the Embassy in London."],
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
  "Venue & floor planning","Contractor & supplier management","Build & breakdown scheduling","Health, safety & CDM compliance","Signage, graphics & wayfinding","Operations budgets","Sponsorship & feature delivery","Exhibitor experience",
];

const home = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview — umitbozdag.com</title>${FONTS}
<style>${css}\n${PREVIEW_CSS}</style></head>
<body>
<header class="topbar"><div class="wrap">
  <a class="wordmark" href="#top">Umit Bozdag</a>
  <nav class="topnav"><a href="#profile">Profile</a><a href="#experience">Experience</a><a href="#productions">Productions</a><a href="#contact">Contact</a><a class="cta" href="#">Read the CV</a></nav>
</div></header>

<section class="hero" id="top">
  <div class="hero-plan" aria-hidden="true">${planSvg}</div>
  <div class="hero-content">
    <p class="kicker">Event operations, London</p>
    <h1 class="masthead"><span class="forename">UMIT</span>BOZDAG</h1>
    <div class="cover-rule"></div><div class="cover-rule thin"></div>
    <div class="coverlines">
      <p class="line"><em>Fifteen years of flagship exhibitions</em> — from the first floorplan to the final breakdown.</p>
      <p class="line">Now running <em>UK Construction Week</em><br>NEC Birmingham &amp; ExCeL London</p>
    </div>
  </div>
</section>

<div class="ticker" aria-label="Selected productions"><div class="ticker-track"><span>${tickerRun}</span><span aria-hidden="true">${tickerRun}</span></div></div>

<main>
<section id="profile" class="block"><div class="wrap">
  <h2 class="sec rv">The profile</h2>
  <div class="profile-grid">
    <div class="rv">
      <p class="lede">Big shows look effortless when the operations behind them are exact.</p>
      <p class="after">That is the work: schedules, contractors, compliance and a thousand moving parts resolved before doors open. I am a Senior Operations Manager at Media 10, leading operations for UK Construction Week across the NEC in Birmingham and ExCeL London, and working alongside the commercial team so that every stand and sponsorship sold is one we can build. Before Media 10 I delivered Gastech with DMG Events and international exhibitions across logistics, fashion and retail with Hyve Group.</p>
    </div>
    <div class="rv"><table class="facts"><tbody>
      <tr><th>Currently</th><td>Senior Operations Manager, Media 10</td></tr>
      <tr><th>Based</th><td>London, United Kingdom</td></tr>
      <tr><th>Home venues</th><td>NEC Birmingham, ExCeL London</td></tr>
      <tr><th>Delivered across</th><td>UK, Europe, North America, Asia</td></tr>
      <tr><th>Languages</th><td>English, Turkish</td></tr>
      <tr><th>Beyond the floor</th><td>Builds digital tools for the events industry, including a signage and sponsorship sign-off platform</td></tr>
    </tbody></table></div>
  </div>
</div></section>

<section id="experience" class="block"><div class="wrap">
  <h2 class="sec rv">Experience</h2>
  ${ROLES.map(([org, now, title, body], i) => `<div class="rv"><div class="role${i === 0 ? " first" : ""}">
    <div class="org">${org}${now ? '<br><span class="now">Now</span>' : ""}</div>
    <div><h3>${title}</h3><p>${body}</p></div>
  </div></div>`).join("\n  ")}
</div></section>

<section id="productions" class="block"><div class="wrap">
  <h2 class="sec rv">Selected productions</h2>
  ${SHOWS.map(([n, m], i) => `<div class="rv"><div class="show${i === 0 ? " first" : ""}"><span class="name">${n}</span><span class="meta">${m}</span></div></div>`).join("\n  ")}
</div></section>

<section id="capabilities" class="block"><div class="wrap">
  <h2 class="sec rv">The craft</h2>
  <p class="craft-intro rv">Everything an exhibition needs between the sales deck and the show floor, owned end to end.</p>
  <ul class="craft rv">${CRAFT.map((c) => `<li>${c}</li>`).join("")}</ul>
</div></section>

<div class="dim" aria-hidden="true"><span>first floorplan</span><span style="color:var(--carmine)">●</span><span>final breakdown</span></div>

<section id="contact" class="contact"><div class="wrap"><div class="rv">
  <h2 class="sec">Contact</h2>
  <p class="big">Planning a show? Let’s make it run like clockwork.</p>
  <p><a href="mailto:umitbozdag@googlemail.com">umitbozdag@googlemail.com</a>&nbsp;or&nbsp;<a href="#">read the CV</a></p>
</div></div></section>
</main>

<footer class="site-footer"><div class="wrap"><span>© 2026 Umit Bozdag, London</span><a href="#">Backstage</a></div></footer>
<div class="preview-tag">Design preview — real site is the Next.js app</div>
${PREVIEW_JS}
</body></html>`;

// ——— Backstage preview (sample data, no sign-in) ———
const P = [
  ["UK Construction Week", "#a61c2b"],
  ["umitbozdag.com", "#f2efe9"],
  ["Event Delivery", "#1f6f6b"],
  ["Gezelim", "#b3741f"],
  ["Bizim Event", "#3f5fae"],
  ["ATESP", "#6d3b8e"],
];
const T = [
  // [title, project idx, status, due, priority]
  ["Chase NEC rigging quote", 0, "doing", "21 Oct", "high"],
  ["Signage schedule v2 to print", 2, "doing", "20 Oct", "normal"],
  ["Confirm sponsor feature build — Stand B30", 0, "todo", "24 Oct", "high"],
  ["Book breakdown crew — ExCeL", 0, "todo", "", "normal"],
  ["Point umitbozdag.com DNS at Hostinger", 1, "todo", "17 Oct", "normal"],
  ["ATESP logo shortlist to committee", 5, "todo", "", "low"],
  ["Send floorplan pack to ops team", 0, "done", "", "normal"],
  ["Gezelim venue list — first 20 entries", 3, "done", "", "normal"],
];
const dot = (i) => `<span class="bs-dot" style="background:${P[i][1]}"></span>`;
const open = (i) => T.filter((t) => t[2] !== "done" && t[1] === i).length;
const row = ([title, pi, status, due, pr]) => `
  <div class="bs-task${status === "done" ? " done" : ""}">
    <input type="checkbox" ${status === "done" ? "checked" : ""} aria-label="Mark done">
    <div class="body"><div class="title">${title}</div>
      <div class="meta"><span class="proj">${dot(pi)}${P[pi][0]}</span>${due ? `<span class="due">Due ${due}</span>` : ""}${pr === "high" ? '<span class="high">High</span>' : ""}${pr === "low" ? "<span>Low priority</span>" : ""}</div>
    </div>
    <div class="ops">${status === "todo" ? "<button>Start</button>" : ""}${status === "doing" ? "<button>Back to list</button>" : ""}<button>Edit</button><button aria-label="Delete task">×</button></div>
  </div>`;
const group = (title, status) => {
  const items = T.filter((t) => t[2] === status);
  if (!items.length) return "";
  return `<div class="bs-group rv"><h2>${title} <span class="n">${items.length}</span></h2>${items.map(row).join("")}</div>`;
};

const backstage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview — Backstage</title>${FONTS}
<style>${css}\n${PREVIEW_CSS}\nbody{background:#151210}</style></head>
<body><div class="bs"><div class="bs-app">
  <header class="bs-head">
    <div><h1 style="display:inline">Backstage</h1><span class="today">Friday 16 October 2026</span></div>
    <div class="who"><span>umitbozdag@googlemail.com</span><button>Sign out</button></div>
  </header>
  <div class="bs-cols">
    <aside class="bs-rail">
      <h2>Projects</h2>
      <ul>
        <li class="active"><span class="bs-dot" style="background:var(--muted)"></span>Everything<span class="count">${T.filter((t) => t[2] !== "done").length}</span></li>
        ${P.map((p, i) => `<li>${dot(i)}${p[0]}<span class="count">${open(i)}</span><button class="del" aria-label="Delete">×</button></li>`).join("\n        ")}
      </ul>
      <button class="addproj">+ New project</button>
    </aside>
    <main>
      <form class="bs-quickadd" onsubmit="return false">
        <input name="title" placeholder="Add a task — what needs doing?">
        <select><option>UK Construction Week</option></select>
        <input type="date" aria-label="Due date">
        <select aria-label="Priority"><option>Normal</option><option>High</option><option>Low</option></select>
        <button class="btn">Add task</button>
      </form>
      ${group("In progress", "doing")}
      ${group("To do", "todo")}
      <details class="bs-done" open><summary>Done — ${T.filter((t) => t[2] === "done").length}</summary>${T.filter((t) => t[2] === "done").map(row).join("")}</details>
    </main>
  </div>
</div></div>
<div class="preview-tag">Design preview — sample data, sign-in skipped</div>
${PREVIEW_JS}
</body></html>`;

mkdirSync("preview", { recursive: true });
writeFileSync("preview/home-preview.html", home);
writeFileSync("preview/backstage-preview.html", backstage);
console.log("wrote preview/home-preview.html and preview/backstage-preview.html");
