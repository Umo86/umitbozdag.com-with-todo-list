import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Backstage",
  robots: { index: false, follow: false },
};

export default function BackstageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="bs">{children}</div>;
}
