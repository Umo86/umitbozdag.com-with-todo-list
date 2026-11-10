/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
};

export default nextConfig;
