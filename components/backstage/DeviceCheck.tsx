"use client";
import { useState } from "react";
import { isApp } from "./native";

/** On-device, read-only checks. Nothing is sent to a server or stored. */
export default function DeviceCheck({ exact }: { exact: string }) {
  const [rows, setRows] = useState<Array<[string, string]>>([]);
  const check = async () => {
    const viewport = window.visualViewport;
    const nav = document.querySelector(".bs-bottom")?.getBoundingClientRect();
    const data: Array<[string,string]> = [
      ["Website", process.env.NEXT_PUBLIC_BUILD_ID?.slice(0,7) || "Development"],
      ["Window", `${window.innerWidth} × ${window.innerHeight}`],
      ["Visible screen", `${Math.round(viewport?.width ?? innerWidth)} × ${Math.round(viewport?.height ?? innerHeight)}`],
      ["Page width", `${document.documentElement.scrollWidth}`],
      ["Zoom", `${Math.round((viewport?.scale ?? 1) * 100)}%`],
      ["Navigation", nav?.height && nav.bottom <= (viewport?.height ?? innerHeight) + 2 ? "On screen" : "Hidden or outside screen"],
      ["Exact reminders", exact],
    ];
    if (isApp()) {
      try { const info = await (await import("@capacitor/app")).App.getInfo(); data.unshift(["Installed Android build", info.build]); } catch { data.unshift(["Installed Android build", "Unavailable"]); }
      try { const permission = await (await import("@capacitor/local-notifications")).LocalNotifications.checkPermissions(); data.push(["Notifications", permission.display]); } catch { data.push(["Notifications", "Unavailable"]); }
    }
    setRows(data);
  };
  return <details className="bs-device-check" onToggle={event => { if (event.currentTarget.open) void check(); }}><summary>Check this device</summary><p>Read-only screen and reminder checks. No settings or data are changed.</p><dl>{rows.map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><button type="button" className="btn ghost small" onClick={() => void check()}>Refresh check</button></details>;
}
