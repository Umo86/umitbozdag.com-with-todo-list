import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { CONTACT_TO, contactMail } from "@/lib/contact-mail";
import { mailConfigured, sendMail } from "@/lib/mail";
import { visitorRows } from "@/lib/visitor";

export const dynamic = "force-dynamic";

// Umit only: send a test contact-form email (to check the email set-up).
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  if (!mailConfigured()) return NextResponse.json({ error: "No email service is set up yet." }, { status: 503 });
  const client = ((await req.json().catch(() => ({}))) as { client?: Record<string, unknown> }).client ?? {};
  const r = await sendMail(
    contactMail(
      { name: "Test sender", email: "test@example.com", company: "umitbozdag.com", message: "This is a test message from the contact form set-up." },
      visitorRows(req, client),
      true
    )
  );
  return r.ok ? NextResponse.json({ ok: true, to: CONTACT_TO }) : NextResponse.json({ error: r.error }, { status: 502 });
}
