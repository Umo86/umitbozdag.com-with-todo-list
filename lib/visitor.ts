// Everything we can tell about who sent a contact-form message: what the
// network and Vercel tell the server, plus what their browser reported.

const h = (req: Request, k: string) => req.headers.get(k) ?? "";
const dec = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function browserOf(ua: string): string {
  const m =
    /Edg\/([\d.]+)/.exec(ua) ? `Edge ${/Edg\/([\d]+)/.exec(ua)![1]}` :
    /OPR\/([\d]+)/.exec(ua) ? `Opera ${/OPR\/([\d]+)/.exec(ua)![1]}` :
    /SamsungBrowser\/([\d]+)/.exec(ua) ? `Samsung Internet ${/SamsungBrowser\/([\d]+)/.exec(ua)![1]}` :
    /Firefox\/([\d]+)/.exec(ua) ? `Firefox ${/Firefox\/([\d]+)/.exec(ua)![1]}` :
    /Chrome\/([\d]+)/.exec(ua) ? `Chrome ${/Chrome\/([\d]+)/.exec(ua)![1]}` :
    /Version\/([\d.]+).*Safari/.exec(ua) ? `Safari ${/Version\/([\d.]+)/.exec(ua)![1]}` : "";
  return m || "Unknown";
}
function osOf(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return `iOS ${(/OS ([\d_]+)/.exec(ua)?.[1] ?? "").replace(/_/g, ".")}`.trim();
  if (/Android ([\d.]+)/.test(ua)) return `Android ${/Android ([\d.]+)/.exec(ua)![1]}`;
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Mac OS X ([\d_]+)/.test(ua)) return `macOS ${/Mac OS X ([\d_]+)/.exec(ua)![1].replace(/_/g, ".")}`;
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}
function deviceOf(ua: string): string {
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return "Tablet";
  if (/Mobi|iPhone|Android/.test(ua)) {
    const model = /Android [\d.]+; ([^;)]+?)(?: Build|\))/.exec(ua)?.[1];
    return model && model !== "K" ? `Phone (${model})` : "Phone";
  }
  if (/bot|crawl|spider|curl|python|wget/i.test(ua)) return "Bot / script";
  return "Computer";
}

export type Row = [string, string];

export function visitorRows(req: Request, client: Record<string, unknown>): { server: Row[]; device: Row[] } {
  const ua = h(req, "user-agent");
  const city = dec(h(req, "x-vercel-ip-city"));
  const region = h(req, "x-vercel-ip-country-region");
  const country = h(req, "x-vercel-ip-country");
  const lat = h(req, "x-vercel-ip-latitude");
  const lon = h(req, "x-vercel-ip-longitude");
  const c = (k: string) => (client[k] === undefined || client[k] === null || client[k] === "" ? "" : String(client[k]).slice(0, 300));
  const server: Row[] = [
    ["IP address", (h(req, "x-forwarded-for").split(",")[0] || h(req, "x-real-ip") || "unknown").trim()],
    ["Location (from IP)", [city, region, country].filter(Boolean).join(", ")],
    ["Map", lat && lon ? `https://www.google.com/maps?q=${lat},${lon}` : ""],
    ["IP time zone", h(req, "x-vercel-ip-timezone")],
    ["Browser", browserOf(ua)],
    ["Operating system", osOf(ua)],
    ["Device", deviceOf(ua)],
    ["Languages", h(req, "accept-language")],
    ["Came from", c("referrer") || h(req, "referer")],
    ["User agent", ua],
  ];
  const device: Row[] = [
    ["Page", c("page")],
    ["Their local time", c("localTime")],
    ["Their time zone", c("timeZone")],
    ["Screen", c("screen")],
    ["Window", c("viewport")],
    ["Pixel ratio", c("pixelRatio")],
    ["Touch screen", c("touch")],
    ["Platform", c("platform")],
    ["Browser languages", c("languages")],
    ["CPU cores", c("cores")],
    ["Memory (GB, approx.)", c("memory")],
    ["Connection", c("connection")],
    ["Dark mode", c("darkMode")],
    ["Cookies enabled", c("cookies")],
    ["Do Not Track", c("dnt")],
    ["Time on page before sending", c("timeOnPage")],
  ];
  const keep = (rows: Row[]) => rows.filter(([, v]) => v);
  return { server: keep(server), device: keep(device) };
}
