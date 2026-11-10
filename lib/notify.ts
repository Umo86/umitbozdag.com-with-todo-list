import webpush from "web-push";
import { db } from "./db";
import { nameOf } from "./names";

// Tells the other person something happened, without Firebase:
// - browsers that switched notifications on get a Web Push at once
//   (keys in VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY; subscriptions in push_subs)
// - inside the Android app, new messages pop up while it's open (polling)

let ready: boolean | null = null;
function setup(): boolean {
  if (ready !== null) return ready;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  ready = !!(pub && priv);
  if (ready) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@umitbozdag.com", pub!, priv!);
  return ready;
}
export const pushKey = () => process.env.VAPID_PUBLIC_KEY ?? "";

export type Note = { title: string; body: string; url?: string; tag?: string };

/** Push a note to every browser the person switched notifications on in. Never throws. */
export async function notify(userId: string, note: Note): Promise<void> {
  if (!setup()) return;
  try {
    const subs = await db().query(`select id, endpoint, p256dh, auth from push_subs where user_id = $1`, [userId]);
    await Promise.all(
      subs.rows.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ ...note, url: note.url ?? "/backstage" }),
            { TTL: 60 * 60 * 24, urgency: "high" }
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await db().query(`delete from push_subs where id = $1`, [s.id]);
          else console.error("push failed:", code, (err as Error).message);
        }
      })
    );
  } catch (err) {
    console.error("notify error:", err);
  }
}

/** The other person in the planner. */
export const otherOf = (id: string) => (id === "umit" ? "dilfiraz" : "umit");
export const who = nameOf;
