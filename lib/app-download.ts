// Where the Backstage Android app is published (GitHub builds it on every
// change to mobile/ and replaces this file).
export const APK_URL =
  "https://github.com/Umo86/umitbozdag.com-with-todo-list/releases/download/android-latest/Backstage.apk";

export type AppRelease = { build: number | null; published: string | null; size: number | null };

/** The newest app build GitHub has published (checked every 5 minutes). */
export async function latestRelease(): Promise<AppRelease> {
  try {
    const r = await fetch(
      "https://api.github.com/repos/Umo86/umitbozdag.com-with-todo-list/releases/tags/android-latest",
      { headers: { Accept: "application/vnd.github+json" }, next: { revalidate: 300 } }
    );
    if (!r.ok) throw new Error(String(r.status));
    const d = (await r.json()) as { name?: string; body?: string; published_at?: string; assets?: Array<{ size?: number }> };
    const m = /build (\d+)/i.exec(`${d.name ?? ""} ${d.body ?? ""}`);
    return { build: m ? Number(m[1]) : null, published: d.published_at ?? null, size: d.assets?.[0]?.size ?? null };
  } catch {
    return { build: null, published: null, size: null };
  }
}
