import { db } from "./db";

// Files attached to tasks: PDFs, Word and Excel files, photos, anything
// else. Each is uploaded in pieces into Postgres (Neon), the same way the
// one-time videos are, and can be opened by whoever can see the task.
export const FILE_CHUNK = 3 * 1024 * 1024; // each piece (under Vercel's request limit)
export const FILE_MAX = 25 * 1024 * 1024; // one file
export const FILES_TOTAL_MAX = 300 * 1024 * 1024; // all files together (the database has 500 MB in all)
export const FILES_PER_TASK = 20;

export const FILE_COLS = "f.id, f.task_id, f.name, f.mime, f.size::float8 as size, f.added_by, f.created_at";

/** A file name safe to store and hand back: no folders, no control characters. */
export function cleanFileName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .split(/[\\/]/)
    .pop()!
    .trim()
    .slice(-150);
  return name && name !== "." && name !== ".." ? name : null;
}

const BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  zip: "application/zip",
};
/** The type to store: the browser's if it gave a sound one, else by the file's ending. */
export function fileMime(name: string, given: unknown): string {
  if (typeof given === "string" && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(given) && given.length <= 100) return given.toLowerCase();
  return BY_EXT[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

// Only these are ever shown inside the browser; everything else (Word, Excel,
// web pages, SVG…) is handed over as a download, so an uploaded file can
// never run as a page of this site.
const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"]);
export const showsInline = (mime: string) => INLINE.has(mime);

/** Uploads that were started and never finished. */
export async function sweepFiles(): Promise<void> {
  await db()
    .query(`delete from task_files where not ready and created_at < now() - interval '1 day'`)
    .catch(() => {});
}
