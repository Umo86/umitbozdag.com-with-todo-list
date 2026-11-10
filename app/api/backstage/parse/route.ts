import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { DATE, REPEATS, UUID } from "@/lib/backstage";
import type { Draft } from "@/lib/parse";

export const dynamic = "force-dynamic";

// Reads spoken or typed text as task drafts with Claude, when the server has
// an ANTHROPIC_API_KEY. Without one this answers 501 and the page reads the
// text with the built-in rules instead (lib/parse.ts), so nothing breaks.
//
// Body: { text, now_local: "YYYY-MM-DDTHH:MM", weekday, projects: [{id,name}] }
// Reply: { drafts: Draft[] } with dates and times in the caller's own clock.

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const TOOL = {
  name: "add_tasks",
  description: "Add the to-do items found in the person's words.",
  input_schema: {
    type: "object",
    properties: {
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short imperative title in English, e.g. 'Chase the signage quote'. No dates, times or list names in it." },
            list: { type: ["string", "null"], enum: ["work", "personal", null] },
            project_id: { type: ["string", "null"], description: "id of the matching project, or null" },
            priority: { type: "string", enum: ["low", "normal", "high"] },
            due_date: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
            remind_local: { type: ["string", "null"], description: "YYYY-MM-DDTHH:MM in the person's clock, or null" },
            repeat: { type: ["string", "null"], enum: [...REPEATS, null] },
          },
          required: ["title", "list", "project_id", "priority", "due_date", "remind_local", "repeat"],
        },
      },
    },
    required: ["tasks"],
  },
};

export async function POST(req: Request) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.res;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "AI reading is off." }, { status: 501 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
  const nowLocal = typeof body.now_local === "string" && LOCAL.test(body.now_local) ? body.now_local : null;
  if (!text || !nowLocal) {
    return NextResponse.json({ error: "Send the text and the time on your device." }, { status: 400 });
  }
  const weekday = typeof body.weekday === "string" ? body.weekday.slice(0, 12) : "";
  const projects = Array.isArray(body.projects)
    ? (body.projects as Array<Record<string, unknown>>)
        .filter((p) => typeof p.id === "string" && UUID.test(p.id) && typeof p.name === "string")
        .slice(0, 60)
        .map((p) => ({ id: p.id as string, name: (p.name as string).slice(0, 120) }))
    : [];

  const system = [
    "You turn what an events operations manager in London says into to-do items for his task board.",
    `It is now ${weekday} ${nowLocal} on his device. Weeks run Monday to Sunday; 'next Friday' means Friday of next week.`,
    "Split the words into separate tasks. Keep titles short and imperative, in English even if he spoke Turkish.",
    "list: 'work' or 'personal' only if he says so or it is obvious (e.g. dentist, family = personal); otherwise null.",
    "Set remind_local when he asks to be reminded or gives a clock time; a reminder with a day but no time is 09:00.",
    "due_date is the day the task is for. Use repeat only when he says it repeats.",
    "priority 'high' for urgent/ASAP/important, 'low' for no rush; otherwise 'normal'.",
    `Projects (match by name, abbreviation or obvious reference): ${JSON.stringify(projects)}`,
  ].join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
        max_tokens: 2000,
        system,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: text }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error("backstage parse: Anthropic API", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ error: "The AI couldn't read that just now." }, { status: 502 });
    }
    const data = (await res.json()) as { content?: Array<{ type: string; input?: { tasks?: unknown } }> };
    const raw = data.content?.find((c) => c.type === "tool_use")?.input?.tasks;
    const ids = new Set(projects.map((p) => p.id));
    const drafts: Draft[] = (Array.isArray(raw) ? raw : [])
      .map((t: Record<string, unknown>): Draft => ({
        title: typeof t.title === "string" ? t.title.trim().slice(0, 200) : "",
        list: t.list === "work" ? "work" : t.list === "personal" ? "personal" : null,
        project_id: typeof t.project_id === "string" && ids.has(t.project_id) ? t.project_id : null,
        priority: t.priority === "high" ? "high" : t.priority === "low" ? "low" : "normal",
        due_date: typeof t.due_date === "string" && DATE.test(t.due_date) ? t.due_date : null,
        remind_local: typeof t.remind_local === "string" && LOCAL.test(t.remind_local) ? t.remind_local : null,
        repeat: typeof t.repeat === "string" && REPEATS.has(t.repeat) ? (t.repeat as Draft["repeat"]) : null,
      }))
      .filter((d) => d.title);
    return NextResponse.json({ drafts });
  } catch (err) {
    console.error("backstage parse error:", err);
    return NextResponse.json({ error: "The AI couldn't read that just now." }, { status: 502 });
  }
}
