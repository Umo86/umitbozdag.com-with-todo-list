"use client";

// Files on a task: PDFs, Word and Excel files, photos, anything up to 25 MB.
// Attach with the button (several at once) or by dropping them on the list.
// Photos open here; other files open in the browser (website) or are handed
// to the phone's browser to download and open (the Android app).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isApp } from "./native";
import { FILE_MAX_MB, nameOf, type TaskFile } from "./types";
import type { Backstage } from "./useBackstage";

const IMAGE = /^image\/(png|jpeg|gif|webp)$/;
export const isPicture = (f: { mime: string }) => IMAGE.test(f.mime);

/** "PDF", "DOC", "XLS"… and a colour for the little badge. */
export function fileKind(name: string, mime: string): { label: string; tone: string } {
  const ext = (name.includes(".") ? name.split(".").pop()! : "").toLowerCase();
  if (ext === "pdf" || mime === "application/pdf") return { label: "PDF", tone: "red" };
  if (["doc", "docx", "rtf", "odt", "pages"].includes(ext)) return { label: "DOC", tone: "blue" };
  if (["xls", "xlsx", "csv", "ods", "numbers"].includes(ext)) return { label: "XLS", tone: "green" };
  if (["ppt", "pptx", "key", "odp"].includes(ext)) return { label: "PPT", tone: "amber" };
  if (mime.startsWith("image/")) return { label: "IMG", tone: "violet" };
  if (mime.startsWith("video/")) return { label: "VID", tone: "violet" };
  if (mime.startsWith("audio/")) return { label: "AUD", tone: "violet" };
  if (["zip", "rar", "7z"].includes(ext)) return { label: "ZIP", tone: "grey" };
  return { label: (ext || "file").slice(0, 4).toUpperCase(), tone: "grey" };
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1048576).toFixed(bytes < 10 * 1048576 ? 1 : 0)} MB`;
}

export const fileUrl = (id: string, download = false) => `/api/backstage/files/${id}${download ? "?dl=1" : ""}`;

export function KindBadge({ name, mime }: { name: string; mime: string }) {
  const k = fileKind(name, mime);
  return (
    <span className={`bs-fkind ${k.tone}`} aria-hidden="true">
      {k.label}
    </span>
  );
}

export default function TaskFiles({ bs, taskId }: { bs: Backstage; taskId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const files = bs.files.filter((f) => f.task_id === taskId);
  const [going, setGoing] = useState<Array<{ key: string; name: string; pct: number }>>([]);
  const [asking, setAsking] = useState<string | null>(null); // "delete this one?"
  const [viewing, setViewing] = useState<TaskFile | null>(null);
  const [over, setOver] = useState(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    []
  );

  const attach = async (picked: File[]) => {
    let done = 0;
    for (const file of picked) {
      const key = `${file.name}:${file.size}:${Date.now()}`;
      if (alive.current) setGoing((g) => [...g, { key, name: file.name, pct: 0 }]);
      const f = await bs.uploadFile(taskId, file, (pct) => alive.current && setGoing((g) => g.map((x) => (x.key === key ? { ...x, pct } : x))));
      if (alive.current) setGoing((g) => g.filter((x) => x.key !== key));
      if (f) done++;
    }
    if (done) bs.say(done === 1 ? "File attached." : `${done} files attached.`);
    if (input.current) input.current.value = "";
  };

  /** Open a file: photos here; the rest in a new tab, or (in the app) through the phone's browser. */
  const open = async (f: TaskFile, download = false) => {
    if (isPicture(f) && !download) return setViewing(f);
    if (isApp()) {
      const url = await bs.fileLink(f.id);
      if (url) window.location.assign(url); // another address: the app passes it to the phone's browser
      return;
    }
    window.open(fileUrl(f.id, download), "_blank", "noopener");
  };

  return (
    <section
      className={`bs-files${over ? " over" : ""}`}
      aria-label="Files"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setOver(false);
        void attach([...e.dataTransfer.files]);
      }}
    >
      <div className="bs-files-head">
        <label>Files{files.length ? ` (${files.length})` : ""}</label>
        <button type="button" className="bs-attach" onClick={() => input.current?.click()}>
          <ClipIcon /> Attach
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          aria-label="Attach files"
          onChange={(e) => e.target.files?.length && void attach([...e.target.files])}
        />
      </div>

      {(files.length > 0 || going.length > 0) && (
        <ul className="bs-filelist">
          {files.map((f) => (
            <li key={f.id}>
              <button type="button" className="open" onClick={() => void open(f)} title={`Open ${f.name}`}>
                {isPicture(f) && f.size < 4 * 1048576 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="thumb" src={fileUrl(f.id)} alt="" loading="lazy" />
                ) : (
                  <KindBadge name={f.name} mime={f.mime} />
                )}
                <span className="nm">
                  <b>{f.name}</b>
                  <small>
                    {fileSize(f.size)} · {nameOf(f.added_by)} · {new Date(f.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </small>
                </span>
              </button>
              {asking === f.id ? (
                <span className="ask">
                  Delete?
                  <button
                    type="button"
                    className="yes"
                    onClick={() => {
                      bs.deleteFile(f.id);
                      setAsking(null);
                    }}
                  >
                    Yes
                  </button>
                  <button type="button" onClick={() => setAsking(null)}>
                    No
                  </button>
                </span>
              ) : (
                <span className="acts">
                  <button type="button" aria-label={`Download ${f.name}`} title="Download" onClick={() => void open(f, true)}>
                    <DownIcon />
                  </button>
                  <button type="button" aria-label={`Delete ${f.name}`} title="Delete" onClick={() => setAsking(f.id)}>
                    ×
                  </button>
                </span>
              )}
            </li>
          ))}
          {going.map((g) => (
            <li key={g.key} className="going" aria-live="polite">
              <span className="open">
                <KindBadge name={g.name} mime="" />
                <span className="nm">
                  <b>{g.name}</b>
                  <small>Uploading… {g.pct}%</small>
                  <span className="bar" aria-hidden="true">
                    <i style={{ width: `${g.pct}%` }} />
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {!files.length && !going.length && (
        <p className="bs-hint">PDF, Word, Excel, photos or anything else, up to {FILE_MAX_MB} MB each.</p>
      )}

      {viewing &&
        createPortal(
          <div className="bs-lightbox" role="dialog" aria-modal="true" aria-label={viewing.name} onClick={() => setViewing(null)} onMouseDown={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(viewing.id)} alt={viewing.name} onClick={(e) => e.stopPropagation()} />
            <div className="bar" onClick={(e) => e.stopPropagation()}>
              <span>{viewing.name}</span>
              <button type="button" onClick={() => void open(viewing, true)}>
                Download
              </button>
              <button type="button" onClick={() => setViewing(null)}>
                Close
              </button>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}

export function ClipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 11.5 12 20a5.3 5.3 0 0 1-7.5-7.5l8.8-8.8a3.5 3.5 0 0 1 5 5L9.6 17.3a1.8 1.8 0 0 1-2.5-2.5l8-8" />
    </svg>
  );
}
function DownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" />
    </svg>
  );
}
