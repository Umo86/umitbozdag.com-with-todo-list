"use client";
import { useEffect, useState } from "react";
import { keyboardIsOpen } from "@/lib/mobile-layout";

/** Account for both Android resize modes: the layout viewport or only the visual viewport. */
export function useMobileViewport() {
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    let baseline = window.innerHeight;
    let width = window.innerWidth;
    const root = document.documentElement;
    const update = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const active = document.activeElement;
      const editing = !!active?.matches('textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), [contenteditable=true]');
      if (Math.abs(width - window.innerWidth) > 80) { baseline = window.innerHeight; width = window.innerWidth; }
      if (!editing) baseline = Math.max(baseline, window.innerHeight, height);
      const open = keyboardIsOpen(baseline, height, editing);
      setKeyboard(open);
      root.style.setProperty("--bs-visible-height", `${height}px`);
      root.style.setProperty("--bs-visible-top", `${viewport?.offsetTop ?? 0}px`);
    };
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      root.style.removeProperty("--bs-visible-height");
      root.style.removeProperty("--bs-visible-top");
    };
  }, []);
  return keyboard;
}
