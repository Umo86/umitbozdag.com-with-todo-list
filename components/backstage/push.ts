"use client";

// Browser notifications (Web Push): switch on/off for this browser. Not
// available inside the Android app's WebView; there, messages pop up while
// the app is open.
import { isApp } from "./native";

export type PushState = "unsupported" | "off" | "on" | "blocked";

const b64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function pushSupported(): boolean {
  return typeof window !== "undefined" && !isApp() && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration() {
  return navigator.serviceWorker.register("/backstage-sw.js", { scope: "/backstage" });
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration("/backstage");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** Ask permission, subscribe and register with the server. Returns an error message or "". */
export async function enablePush(
  key: string,
  api: (path: string, init: { method: string; body: unknown }) => Promise<unknown>
): Promise<string> {
  if (!pushSupported()) return "This browser can't show notifications.";
  if (!key) return "Notifications aren't set up on the server yet.";
  const perm = await Notification.requestPermission();
  if (perm !== "granted")
    return perm === "denied"
      ? "Notifications are blocked for this site. Click the lock icon by the address, allow Notifications, then try again."
      : "Notifications weren't allowed.";
  try {
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
    await api("/push", { method: "POST", body: { ...sub.toJSON(), test: true } });
    return "";
  } catch (e) {
    return `Couldn't switch notifications on: ${(e as Error).message}`;
  }
}

export async function disablePush(api: (path: string, init: { method: string; body: unknown }) => Promise<unknown>) {
  const reg = await navigator.serviceWorker.getRegistration("/backstage");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api("/push", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
