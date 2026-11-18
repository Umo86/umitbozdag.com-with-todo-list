// Where the Backstage Android app is published (GitHub builds it on every
// push to main, using the same signing key as the published app).
export const APK_URL =
  "https://github.com/Umo86/umitbozdag.com-with-todo-list/releases/download/android-latest/Backstage.apk";

export type AppRelease = { build: number | null; published: string | null; size: number | null; compatibleFromBuild: number | null };

/** The newest app build GitHub has published (checked every 5 minutes). */
export async function latestRelease(): Promise<AppRelease> {
  try {
    const r = await fetch(
      "https://api.github.com/repos/Umo86/umitbozdag.com-with-todo-list/releases/tags/android-latest",
      { headers: { Accept: "application/vnd.github+json" }, next: { revalidate: 300 } }
    );
    if (!r.ok) throw new Error(String(r.status));
    const d = (await r.json()) as { name?: string; body?: string; published_at?: string; assets?: Array<{ name?: string; size?: number; state?: string }> };
    const apk = d.assets?.find((asset) => asset.name === "Backstage.apk" && asset.state === "uploaded");
    if (!apk) throw new Error("No published APK");
    const m = /build (\d+)/i.exec(`${d.name ?? ""} ${d.body ?? ""}`);
    const compatible = /Compatible updates from build (\d+)/.exec(d.body ?? "");
    return { build: m ? Number(m[1]) : null, published: d.published_at ?? null, size: apk.size ?? null, compatibleFromBuild: compatible ? Number(compatible[1]) : null };
  } catch {
    return { build: null, published: null, size: null, compatibleFromBuild: null };
  }
}
