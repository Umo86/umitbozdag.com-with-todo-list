/** @type {import("next").NextConfig} */
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`;

const nextConfig = {
  reactStrictMode: true,
  // Baked into the page so it can tell when a newer version is live.
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // The Android app (mobile/) opens the site's address; send it straight to
  // Backstage rather than the public home page.
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "header", key: "user-agent", value: ".*BackstageApp.*" }],
        destination: "/backstage",
        permanent: false,
      },
    ];
  },
  // Never keep an old copy of Backstage (browsers, the app's WebView, proxies).
  async headers() {
    const fresh = [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" }];
    return [
      { source: "/backstage", headers: fresh },
      { source: "/backstage/:path*", headers: fresh },
      { source: "/backstage-sw.js", headers: [...fresh, { key: "Service-Worker-Allowed", value: "/backstage" }] },
      { source: "/backstage.webmanifest", headers: fresh },
    ];
  },
};

export default nextConfig;
