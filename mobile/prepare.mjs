// Writes the two local pages the app ships with, using the Backstage address
// from capacitor.config.json: a start page that hands over to the site, and
// the page Android shows when the site can't be reached.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const { server } = JSON.parse(readFileSync(new URL("./capacitor.config.json", import.meta.url)));
const site = server.url.replace(/\/$/, "");
const www = new URL("./www/", import.meta.url);
mkdirSync(www, { recursive: true });

const page = (body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Backstage</title>
<style>
  html,body{margin:0;height:100%;background:#f5f6fb;color:#0b0d12;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  main{min-height:100%;display:grid;place-items:center;padding:24px;box-sizing:border-box;text-align:center}
  .card{max-width:340px}
  h1{font-size:26px;letter-spacing:-.02em;margin:18px 0 8px}
  p{color:#5b6070;margin:0 0 22px}
  a{display:inline-block;background:#0b0d12;color:#fff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:999px}
  svg{width:64px;height:64px}
</style></head>
<body><main><div class="card">${body}</div></main></body></html>
`;
const icon = `<svg viewBox="0 0 108 108" aria-hidden="true"><rect width="108" height="108" rx="24" fill="#1a47ff"/><g transform="translate(0 -2)"><path d="M41 14 L52 37 M67 14 L56 37" stroke="#fff" stroke-opacity=".55" stroke-width="4" stroke-linecap="round" fill="none"/><rect x="48" y="33" width="12" height="9" rx="2.5" fill="#fff"/><rect x="35" y="39" width="38" height="50" rx="7" fill="#fff"/><path d="M44 67 l7 7 l13 -15" stroke="#1a47ff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>`;

writeFileSync(new URL("index.html", www), page(`${icon}<h1>Backstage</h1><p>Opening…</p><script>location.replace(${JSON.stringify(site + "/backstage")})</script>`));
writeFileSync(new URL("offline.html", www), page(`${icon}<h1>No connection</h1><p>Backstage needs the internet to load your tasks. Reminders already set on this phone will still go off.</p><a href="${site}/backstage">Try again</a>`));
console.log("prepared app pages for", site);

// Push notifications (Firebase Cloud Messaging). The Firebase config is kept
// out of the public repo: the build gets it from the GOOGLE_SERVICES_JSON
// secret. When it is there, the app is marked "BackstageFCM" in its user agent
// so the page knows it is safe to register for push; without it the app
// builds and runs exactly as before, just without push.
const fcm = (process.env.GOOGLE_SERVICES_JSON ?? "").trim();
if (fcm) {
  let ok = false;
  try {
    const cfg = JSON.parse(fcm);
    const config = JSON.parse(readFileSync(new URL("./capacitor.config.json", import.meta.url)));
    ok = (cfg.client ?? []).some((c) => c?.client_info?.android_client_info?.package_name === config.appId);
    if (ok) {
      writeFileSync(new URL("./android/app/google-services.json", import.meta.url), JSON.stringify(cfg));
      if (!/BackstageFCM\//.test(config.android.appendUserAgent)) config.android.appendUserAgent += " BackstageFCM/1";
      writeFileSync(new URL("./capacitor.config.json", import.meta.url), JSON.stringify(config, null, 2) + "\n");
      console.log("push notifications: on (Firebase project", cfg.project_info?.project_id + ")");
    } else {
      console.warn(`push notifications: OFF. GOOGLE_SERVICES_JSON has no Android app with the package name ${config.appId}.`);
    }
  } catch (e) {
    console.warn("push notifications: OFF. GOOGLE_SERVICES_JSON is not valid JSON:", e.message);
  }
} else {
  console.log("push notifications: off (no GOOGLE_SERVICES_JSON secret set)");
}
