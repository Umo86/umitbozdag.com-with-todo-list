import type { Metadata, Viewport } from "next";
import "./backstage.css";
import "./refresh.css";
import "./finance.css";
import "./mobile.css";

export const metadata: Metadata = {
  title: "Backstage",
  robots: { index: false, follow: false },
  manifest: "/backstage.webmanifest",
  icons: { apple: "/img/backstage-apple.png" },
  appleWebApp: { capable: true, title: "Backstage", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f6fb", viewportFit: "cover", interactiveWidget: "resizes-content" };

export default function BackstageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="bs">{children}</div>;
}
