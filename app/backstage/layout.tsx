import type { Metadata, Viewport } from "next";
import "./backstage.css";

export const metadata: Metadata = {
  title: "Backstage",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f5f6fb" };

export default function BackstageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="bs">{children}</div>;
}
