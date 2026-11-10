// Display names for the two people (server side).
const NAMES: Record<string, string> = { umit: "Umit", dilfiraz: "Dilfiraz" };
export const nameOf = (id: string) => NAMES[id] ?? id;
