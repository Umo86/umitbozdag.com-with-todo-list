"use client";

// Speak (or type) several to-dos at once, check what was understood, then
// add them all. Built-in rules read the words instantly; when the server has
// an AI key, the words are read again by AI after you stop speaking.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseTasks, REPEAT_LABEL, REPEATS, type Draft, type Repeat } from "@/lib/parse";
import { MicIcon } from "./Dashboard";
import { listenForSpeech, speechSupport } from "./native";
import { fmtDay, type ListName, type Project } from "./types";
import type { Backstage } from "./useBackstage";

const LANG_KEY = "backstage:speech-lang";
const LANGS = [
  { id: "en-GB", label: "English" },
  { id: "tr-TR", label: "Türkçe" },
];

const p2 = (n: number) => String(n).padStart(2, "0");
const localNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

export default function Capture({
  bs,
  projects,
  defaultList,
  autoListen,
  onClose,
}: {
  bs: Backstage;
  projects: Project[];
  defaultList: ListName;
  autoListen: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [edited, setEdited] = useState(false); // drafts changed by hand: stop re-reading
  const [listening, setListening] = useState(false);
  const [heardBefore, setHeardBefore] = useState(""); // text kept when listening again
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "ai" | "saving">("");
  const [engine, setEngine] = useState<"rules" | "ai">("rules");
  const [lang, setLang] = useState("en-GB");
  const stopRef = useRef<(() => void) | null>(null);
  const support = useMemo(() => speechSupport(), []);
  const projList = useMemo(() => projects.map((p) => ({ id: p.id, name: p.name })), [projects]);

  useEffect(() => {
    try {
      const l = localStorage.getItem(LANG_KEY);
      if (l && LANGS.some((x) => x.id === l)) setLang(l);
    } catch {
      /* fine */
    }
  }, []);

  // rules: instant, as the words come in
  useEffect(() => {
    if (edited) return;
    setDrafts(parseTasks(text, { projects: projList }));
    setEngine("rules");
  }, [text, projList, edited]);

  const readWithAi = useCallback(
    async (words: string) => {
      if (!bs.ai || !words.trim()) return;
      setBusy("ai");
      try {
        const r = await bs.api<{ drafts: Draft[] }>("/parse", {
          method: "POST",
          body: {
            text: words,
            now_local: localNow(),
            weekday: new Date().toLocaleDateString("en-GB", { weekday: "long" }),
            projects: projList,
          },
        });
        if (r.drafts.length) {
          setDrafts(r.drafts);
          setEdited(true);
          setEngine("ai");
        }
      } catch {
        // keep the rules' reading
      } finally {
        setBusy("");
      }
    },
    [bs, projList]
  );

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError("");
    setEdited(false);
    const kept = text.trim();
    setHeardBefore(kept);
    setListening(true);
    let latest = kept;
    stopRef.current = await listenForSpeech({
      lang,
      onText: (heard) => {
        latest = (kept ? kept + ". " : "") + heard;
        setText(latest);
      },
      onEnd: (err) => {
        setListening(false);
        stopRef.current = null;
        if (err) setError(err);
        else void readWithAi(latest);
      },
    });
  }, [lang, text, readWithAi]);

  useEffect(() => {
    if (autoListen && support !== "none") void start();
    return () => stopRef.current?.();
    // only when opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const change = (i: number, patch: Partial<Draft>) => {
    setEdited(true);
    setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };

  const save = async () => {
    const good = drafts.filter((d) => d.title.trim());
    if (!good.length) return;
    stop();
    setBusy("saving");
    const n = await bs.addDrafts(good.map((d) => ({ ...d, title: d.title.trim() })), defaultList);
    setBusy("");
    if (n) {
      bs.say(n === 1 ? "Task added." : `${n} tasks added.`);
      onClose();
    }
  };

  return (
    <div className="bs-scrim center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bs-capture" role="dialog" aria-modal="true" aria-labelledby="cap-h">
        <div className="bs-drawer-head">
          <h2 id="cap-h">Add tasks</h2>
          <button className="bs-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="bs-cap-mic">
          {support !== "none" && (
            <button
              className={`bs-mic${listening ? " on" : ""}`}
              onClick={() => (listening ? stop() : void start())}
              aria-pressed={listening}
              aria-label={listening ? "Stop listening" : "Start speaking"}
            >
              <MicIcon size={30} />
            </button>
          )}
          <div className="bs-cap-status" aria-live="polite">
            <strong>
              {listening
                ? "Listening… tap to stop"
                : support === "none"
                  ? "Type your to-dos"
                  : text
                    ? "Tap to add more"
                    : "Tap and say your to-dos"}
            </strong>
            <span className="quiet">
              Say several at once. Add &ldquo;tomorrow at 10&rdquo;, &ldquo;remind me Friday&rdquo;, &ldquo;for UKCW&rdquo;, &ldquo;urgent&rdquo;, &ldquo;every Monday&rdquo;.
            </span>
          </div>
          {support !== "none" && (
            <div className="bs-lang" role="group" aria-label="Speech language">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  aria-pressed={lang === l.id}
                  onClick={() => {
                    setLang(l.id);
                    try {
                      localStorage.setItem(LANG_KEY, l.id);
                    } catch {
                      /* fine */
                    }
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <label htmlFor="cap-text">{listening ? "Heard so far" : "Words"}</label>
        <textarea
          id="cap-text"
          rows={3}
          value={text}
          placeholder="e.g. call the venue tomorrow at 10 and chase the signage quote for UKCW, book the dentist Friday"
          onChange={(e) => {
            setText(e.target.value);
            setEdited(false);
          }}
          onBlur={() => !listening && !edited && text !== heardBefore && void readWithAi(text)}
        />
        {error && <p className="error-line" role="alert">{error}</p>}

        {drafts.length > 0 && (
          <>
            <div className="bs-cap-sub">
              <span>
                {drafts.length === 1 ? "1 task" : `${drafts.length} tasks`}
                <span className="quiet"> · {busy === "ai" ? "reading with AI…" : engine === "ai" ? "read by AI" : "check before adding"}</span>
              </span>
              {edited && engine === "rules" && (
                <button className="bs-link" onClick={() => setEdited(false)}>
                  Read the words again
                </button>
              )}
            </div>
            <ol className="bs-drafts">
              {drafts.map((d, i) => (
                <li key={i}>
                  <div className="top">
                    <input
                      value={d.title}
                      aria-label={`Task ${i + 1}`}
                      maxLength={200}
                      onChange={(e) => change(i, { title: e.target.value })}
                    />
                    <button
                      className="bs-x"
                      aria-label={`Remove task ${i + 1}`}
                      onClick={() => {
                        setEdited(true);
                        setDrafts((x) => x.filter((_, j) => j !== i));
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="opts">
                    <select
                      aria-label="List"
                      value={d.list ?? defaultList}
                      onChange={(e) => change(i, { list: e.target.value as ListName })}
                    >
                      <option value="work">Work</option>
                      <option value="personal">Personal</option>
                    </select>
                    <select
                      aria-label="Project"
                      value={d.project_id ?? ""}
                      onChange={(e) => change(i, { project_id: e.target.value || null })}
                    >
                      <option value="">No project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <label className="mini">
                      <span>Due</span>
                      <input
                        type="date"
                        value={d.due_date ?? ""}
                        onChange={(e) => change(i, { due_date: e.target.value || null })}
                      />
                    </label>
                    <label className="mini">
                      <span>Remind</span>
                      <input
                        type="datetime-local"
                        value={d.remind_local ?? ""}
                        onChange={(e) => change(i, { remind_local: e.target.value || null })}
                      />
                    </label>
                    <select
                      aria-label="Priority"
                      value={d.priority}
                      onChange={(e) => change(i, { priority: e.target.value as Draft["priority"] })}
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="low">Low</option>
                    </select>
                    <select
                      aria-label="Repeat"
                      value={d.repeat ?? ""}
                      onChange={(e) => change(i, { repeat: (e.target.value || null) as Repeat | null })}
                    >
                      <option value="">No repeat</option>
                      {REPEATS.map((r) => (
                        <option key={r} value={r}>
                          {REPEAT_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="sum">
                    {summary(d, projects, defaultList)}
                  </p>
                </li>
              ))}
            </ol>
          </>
        )}

        <div className="bs-drawer-foot">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={!drafts.some((d) => d.title.trim()) || busy === "saving"} onClick={save}>
            {busy === "saving"
              ? "Adding…"
              : drafts.length > 1
                ? `Add ${drafts.length} tasks`
                : "Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function summary(d: Draft, projects: Project[], fallback: ListName): string {
  const bits: string[] = [(d.list ?? fallback) === "work" ? "Work" : "Personal"];
  const p = projects.find((x) => x.id === d.project_id);
  if (p) bits.push(p.name);
  if (d.due_date) bits.push(`due ${fmtDay(d.due_date)}`);
  if (d.remind_local) {
    const r = new Date(d.remind_local);
    bits.push(
      `reminder ${r.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
    );
  }
  if (d.repeat) bits.push(REPEAT_LABEL[d.repeat].toLowerCase());
  if (d.priority !== "normal") bits.push(`${d.priority} priority`);
  return bits.join(" · ");
}
