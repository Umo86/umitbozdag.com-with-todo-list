/** Keep Android's navigation targets usable even on a narrow phone. */
export function mobileNavigation<T extends { id: string }>(items: T[]): { primary: T[]; more: T[] } {
  if (items.length <= 5) return { primary: items, more: [] };
  const preferred = new Set(["today", "mine", "calendar", "us"]);
  return { primary: items.filter(item => preferred.has(item.id)), more: items.filter(item => !preferred.has(item.id)) };
}

export function keyboardIsOpen(baseline: number, visibleHeight: number, editing: boolean): boolean {
  return editing && baseline - visibleHeight > 120;
}
