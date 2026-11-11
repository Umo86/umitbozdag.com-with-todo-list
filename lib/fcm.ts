import { importPKCS8, SignJWT } from "jose";
import type { Note } from "./notify";

// Push notifications to the Android app, through Firebase Cloud Messaging
// (HTTP v1). This is what makes a heart, a message or a ticked-off to-do
// reach the phone while Backstage is closed.
//
// One setting: FCM_SERVICE_ACCOUNT, the service-account JSON downloaded from
// Firebase (Project settings › Service accounts › Generate new private key),
// pasted whole. Without it nothing is sent and nothing breaks.

type Account = { project_id: string; client_email: string; private_key: string };
let account: Account | null | undefined;
function serviceAccount(): Account | null {
  if (account !== undefined) return account;
  const raw = (process.env.FCM_SERVICE_ACCOUNT ?? "").trim();
  account = null;
  if (!raw) return account;
  for (const text of [raw, Buffer.from(raw, "base64").toString("utf8")]) {
    try {
      const j = JSON.parse(text) as Partial<Account>;
      if (j.project_id && j.client_email && j.private_key) {
        account = { project_id: j.project_id, client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n") };
        break;
      }
    } catch {
      /* try the next reading */
    }
  }
  if (!account) console.error("FCM_SERVICE_ACCOUNT is set but isn't a service-account JSON (project_id, client_email, private_key).");
  return account;
}
export const fcmReady = () => !!serviceAccount();

// Google hands out an access token for an hour in exchange for a signed note.
let token: { value: string; until: number } | null = null;
async function accessToken(a: Account): Promise<string> {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const key = await importPKCS8(a.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(a.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!r.ok || !j.access_token) throw new Error(`Google sign-in for push failed (${r.status}): ${j.error_description ?? "no token"}`);
  token = { value: j.access_token, until: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return token.value;
}

/**
 * Send one note to these phones. Hands back the tokens Firebase says are no
 * longer valid (app uninstalled, token replaced), so they can be forgotten.
 * Never throws.
 */
export async function sendFcm(tokens: string[], note: Note): Promise<string[]> {
  const a = serviceAccount();
  if (!a || !tokens.length) return [];
  const dead: string[] = [];
  try {
    const bearer = await accessToken(a);
    await Promise.all(
      tokens.map(async (t) => {
        try {
          const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
            method: "POST",
            headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              message: {
                token: t,
                notification: { title: note.title, body: note.body },
                data: { url: note.url ?? "/backstage" },
                android: {
                  priority: "HIGH",
                  ttl: "86400s",
                  notification: {
                    channel_id: "backstage",
                    icon: "ic_stat_backstage",
                    color: "#1a47ff",
                    ...(note.tag ? { tag: note.tag } : {}),
                  },
                },
              },
            }),
          });
          if (r.ok) return;
          const j = (await r.json().catch(() => ({}))) as { error?: { status?: string; message?: string; details?: Array<{ errorCode?: string }> } };
          const code = j.error?.details?.find((d) => d.errorCode)?.errorCode ?? j.error?.status;
          if (r.status === 404 || code === "UNREGISTERED" || (r.status === 400 && /registration token/i.test(j.error?.message ?? ""))) dead.push(t);
          else console.error("fcm push failed:", r.status, code, j.error?.message);
        } catch (err) {
          console.error("fcm push error:", (err as Error).message);
        }
      })
    );
  } catch (err) {
    console.error("fcm error:", (err as Error).message);
  }
  return dead;
}
