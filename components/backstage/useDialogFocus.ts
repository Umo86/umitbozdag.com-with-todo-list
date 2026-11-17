"use client";
import { useEffect } from "react";

/** Android Back and Escape close the topmost sheet, including nested Finance forms. */
export function dismissTopDialog(): boolean {
  const dialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(el => el.getClientRects().length).at(-1);
  if (!dialog) return false;
  const close = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find(button => button.getAttribute("aria-label") === "Close" || button.textContent?.trim() === "Close");
  // A disabled close means a save is in progress. Consume Back without leaving the form.
  if (close && !close.disabled) close.click();
  return true;
}

/** Keep keyboard focus inside the top sheet, then return it to its opener. */
export function useDialogFocus() {
  useEffect(() => {
    let previous: HTMLElement | null = null;
    let current: HTMLElement | null = null;
    let overflow = "";
    const visible = (el: HTMLElement) => !!el.getClientRects().length;
    const controls = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')).filter(visible);
    const sync = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(visible);
      const next = dialogs.at(-1) ?? null;
      if (next === current) return;
      if (next && !current) { previous = document.activeElement as HTMLElement; overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
      if (!next && current) { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); previous = null; }
      current = next;
      if (current && !current.contains(document.activeElement)) (controls(current)[0] || current).focus();
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    const onKey = (event: KeyboardEvent) => {
      if (!current) return;
      if (event.key === "Escape") {
        if (dismissTopDialog()) { event.preventDefault(); event.stopImmediatePropagation(); }
      }
      if (event.key !== "Tab") return;
      const items = controls(current), first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true); sync();
    return () => { observer.disconnect(); document.removeEventListener("keydown", onKey, true); if (current) document.body.style.overflow = overflow; };
  }, []);
}
