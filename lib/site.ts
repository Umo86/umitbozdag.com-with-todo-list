// The site's public address. Every link we hand out (calendar feed, app
// download, QR codes) uses this, whichever address the request came in on.
export const SITE_URL = (process.env.SITE_URL || "https://umitbozdag.com").replace(/\/$/, "");
