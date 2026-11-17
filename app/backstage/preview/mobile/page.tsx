import Link from "next/link";

export default async function MobilePreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <div style={{ padding: "24px 12px", display: "grid", justifyItems: "center", gap: 16, background: "#eef1f7", minHeight: "100vh" }}>
    <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", justifyContent: "center", fontSize: 13 }}><strong>Backstage · Mobile preview</strong><Link href="/backstage/preview" style={{ color: "#1a47ff" }}>Open desktop version ↗</Link></div>
    <iframe src={view === "finance" ? "/backstage/preview?view=finance" : "/backstage/preview"} title="Interactive Backstage mobile preview" style={{ display: "block", width: "100%", maxWidth: 390, height: 844, border: "1px solid #ccd4e4", borderRadius: 24, background: "#f5f6fb", boxShadow: "0 16px 60px #152b5412" }} />
    <p style={{ fontSize: 12, color: "#626d80", textAlign: "center", maxWidth: 390 }}>Same app and sample data, in a phone sized view. Changes stay in this browser.</p>
  </div>;
}
