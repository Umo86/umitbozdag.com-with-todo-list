/** Shared by the guest list and the local preview. */
export function readGuestLine(line: string): { name: string; people: number } | null {
  let name = line.replace(/^\s*(?:[-*•–]|\d{1,4}[.)])\s+/, "").replace(/\s+/g, " ").replace(/[,;.]+$/, "").trim();
  if (!name) return null;
  let people = 1;
  const plus = /\s*\+\s*(\d{1,2})$/.exec(name);
  const times = /(?:\s+[x×]\s*(\d{1,2})|\s*\((\d{1,2})\)|\s+(\d{1,2}))$/i.exec(name);
  if (plus) { people = 1 + Number(plus[1]); name = name.slice(0, plus.index).trim(); }
  else if (times) { people = Number(times[1] ?? times[2] ?? times[3]); name = name.slice(0, times.index).trim(); }
  return name ? { name, people: Math.min(50, Math.max(1, people)) } : null;
}
