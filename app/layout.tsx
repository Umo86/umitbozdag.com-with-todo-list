import type { Metadata, Viewport } from "next";
// Fonts are bundled with the site (no request to Google, no flash of the
// wrong typeface).
import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource-variable/bodoni-moda/opsz-italic.css";
import "@fontsource-variable/jost/wght.css";
import "./globals.css";
import { SITE } from "@/lib/content";

const FAVICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="white"/><text x="32" y="46" font-family="Didot,Bodoni MT,serif" font-size="44" text-anchor="middle" fill="black">B</text><rect y="58" width="64" height="6" fill="%23A61C2B"/></svg>';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    template: "%s — Umit Bozdag",
  },
  description: SITE.description,
  alternates: { canonical: "/" },
  icons: { icon: FAVICON },
  openGraph: {
    type: "profile",
    url: "/",
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
