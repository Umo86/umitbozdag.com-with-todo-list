import type { Metadata, Viewport } from "next";
import "./backstage.css";

export const metadata: Metadata = {
  title: "Backstage",
  robots: { index: false, follow: false },
  manifest: "/backstage.webmanifest",
  icons: { apple: "/img/backstage-apple.png" },
  appleWebApp: { capable: true, title: "Backstage", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#f5f6fb", viewportFit: "cover" };

export default function BackstageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="bs">{children}</div>;
}
