import { APK_URL } from "@/lib/app-download";
import { appAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

// umitbozdag.com/app/download gives the newest Android app, once you're in.
export async function GET(req: Request) {
  const ok = await appAccess(req.headers.get("cookie") ?? "");
  return new Response(null, {
    status: 302,
    headers: { Location: ok ? APK_URL : new URL("/app", req.url).pathname, "Cache-Control": "no-store" },
  });
}
