import type { Metadata, Viewport } from "next";
import "./backstage.css";

export const metadata: Metadata = {
  title: "Backstage",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#151210" };

export default function BackstageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="bs">{children}</div>;
}
