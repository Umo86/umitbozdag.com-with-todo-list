import { APK_URL } from "@/lib/app-download";

// umitbozdag.com/app/download always gives the newest Android app.
export function GET() {
  return new Response(null, { status: 302, headers: { Location: APK_URL, "Cache-Control": "no-store" } });
}
