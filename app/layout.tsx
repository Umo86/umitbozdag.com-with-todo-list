import type { Metadata, Viewport } from "next";
import "./globals.css";

const FAVICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="white"/><text x="32" y="46" font-family="Didot,Bodoni MT,serif" font-size="44" text-anchor="middle" fill="black">B</text><rect y="58" width="64" height="6" fill="%23A61C2B"/></svg>';

export const metadata: Metadata = {
  title: {
    default: "Umit Bozdag — Event Operations, London",
    template: "%s — Umit Bozdag",
  },
  description:
    "Umit Bozdag is a Senior Operations Manager in London with fifteen years of flagship exhibitions — UK Construction Week, Gastech, Breakbulk, Spring Fair and Pure London.",
  icons: { icon: FAVICON },
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
    <html lang="en">
      <body>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=Jost:ital,wght@0,300..600;1,300..600&display=swap"
          rel="stylesheet"
        />
        {children}
      </body>
    </html>
  );
}
