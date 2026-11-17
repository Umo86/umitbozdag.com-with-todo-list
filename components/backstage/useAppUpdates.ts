"use client";

import { useEffect, useRef, useState } from "react";
import { canRefreshApp, newerAppBuild } from "@/lib/app-updates";
import { isApp } from "./native";

export function useAppUpdates(options: { preview: boolean; saving: () => boolean; dragging: () => boolean; sheet: boolean; say: (message: string) => void }) {
  const live = useRef(options);
  live.current = options;
  const [webReady, setWebReady] = useState(false);
  const [appBuild, setAppBuild] = useState<number | null>(null);
  const pendingBuild = useRef("");
  const dirtyForms = useRef(new Set<HTMLFormElement>());

  const safe = () => {
    // A changed inline form may still contain a draft after focus has left it.
    for (const form of dirtyForms.current) {
      const text = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea, input:not([type]), input[type=text], input[type=number], input[type=date], input[type=datetime-local], input[type=password], input[type=email]")];
      if (!form.isConnected || !text.some((input) => input.value.trim())) dirtyForms.current.delete(form);
    }
    return canRefreshApp({
      hidden: document.hidden,
      editing: live.current.sheet || dirtyForms.current.size > 0 || !!document.querySelector('[role="dialog"], dialog[open]') || !!document.activeElement?.closest("form, [contenteditable=true]"),
      saving: live.current.saving() || !!document.querySelector('[aria-busy="true"]'),
      dragging: live.current.dragging(),
    });
  };
  const applyUpdate = () => {
    if (!safe()) { live.current.say("Save or close what you’re editing, then tap Update now."); return; }
    try { sessionStorage.setItem("backstage:reloaded-for", pendingBuild.current); } catch { /* optional loop guard */ }
    window.location.reload();
  };

  useEffect(() => {
    if (options.preview) return;
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    let stopped = false;
    let checking = false;
    let installed: string | undefined;
    const changed = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const form = target.closest("form");
        if (form) dirtyForms.current.add(form);
      }
    };
    const check = async () => {
      if (stopped || checking || !navigator.onLine || document.hidden) return;
      checking = true;
      try {
        const response = await fetch("/api/backstage/version", { cache: "no-store" });
        if (response.ok) {
          const version = await response.json() as { build?: string };
          if (!stopped && mine && version.build && version.build !== mine) {
            pendingBuild.current = version.build;
            setWebReady(true);
            let attempted = false;
            try { attempted = sessionStorage.getItem("backstage:reloaded-for") === version.build; } catch { /* optional */ }
            // Mark the attempt only when actually reloading. A draft never consumes it.
            if (!attempted && safe()) { applyUpdate(); return; }
          }
        }
      } catch { /* keep working offline; retry on resume or reconnect */ }
      try {
        if (isApp()) {
          if (!installed) installed = (await (await import("@capacitor/app")).App.getInfo()).build;
          const response = await fetch("/api/backstage/app-release", { cache: "no-store" });
          if (response.ok && !stopped) {
            const release = await response.json() as { build: number | null };
            setAppBuild(newerAppBuild(installed, release.build) ? release.build : null);
          }
        }
      } catch { /* release service unavailable: leave the installed app working */ }
      finally { checking = false; }
    };
    const onVisible = () => { if (!document.hidden) void check(); };
    document.addEventListener("input", changed);
    document.addEventListener("change", changed);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("backstage:resume", onVisible);
    const timer = setInterval(check, 60_000);
    void check();
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("input", changed);
      document.removeEventListener("change", changed);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("backstage:resume", onVisible);
    };
    // The live ref reads the latest saving, sheet and drag state without restarting listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.preview]);
  return { webReady, applyUpdate, appBuild };
}
