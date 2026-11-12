import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { GUESTS_MAX, parseGuestLine, readWedding } from "@/lib/wedding";

export const dynamic = "force-dynamic";

// Add guests to one side's list: one line each ("Ali Demir", "Ali Demir +1",
// "Kaya family x4"). Either of you can add to either list; each line keeps
// who added it. A name already on that side's list is left out.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const side = body.side === "umit" || body.side === "dilfiraz" ? body.side : null;
  if (!side) return NextResponse.json({ error: "Choose whose list the guest goes on." }, { status: 400 });
  const raw = Array.isArray(body.lines) ? body.lines : typeof body.text === "string" ? body.text.split(/\r?\n/) : [];
  const lines = raw
    .filter((l): l is string => typeof l === "string")
    .slice(0, 1000)
    .map(parseGuestLine)
    .filter((g): g is { name: string; people: number } => !!g);
  if (!lines.length) return NextResponse.json({ error: "Type a guest's name." }, { status: 400 });
  try {
    await readWedding();
    const have = await db().query(`select lower(name) as n from wedding_guests where side = $1`, [side]);
    const all = await db().query(`select count(*)::int as n from wedding_guests`);
    const seen = new Set<string>(have.rows.map((r) => r.n));
    const fresh = lines.filter((g) => {
      const k = g.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (all.rows[0].n + fresh.length > GUESTS_MAX) {
      return NextResponse.json({ error: `The guest lists hold up to ${GUESTS_MAX} lines.` }, { status: 409 });
    }
    if (fresh.length) {
      const values = fresh.map((_, i) => `($1, $${i * 2 + 3}, $${i * 2 + 4}, $2)`).join(", ");
      await db().query(`insert into wedding_guests (side, name, people, added_by) values ${values}`, [side, auth.me.id, ...fresh.flatMap((g) => [g.name, g.people])]);
    }
    return NextResponse.json({ ...(await readWedding()), added: fresh.length, skipped: lines.length - fresh.length }, { status: 201 });
  } catch (err) {
    console.error("wedding guest add error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
