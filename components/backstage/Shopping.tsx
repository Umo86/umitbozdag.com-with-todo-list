"use client";

// The shared shopping list: whoever's near a shop ticks things off, and the
// other sees it within a minute. Blue/pink edge = who added it.
import { useState } from "react";
import { colorOf, nameOf, type Me } from "./types";
import type { Backstage } from "./useBackstage";

export default function Shopping({ bs, me }: { bs: Backstage; me: Me }) {
  const [v, setV] = useState("");
  const items = bs.us.filter((x) => x.kind === "shopping");
  const open = items.filter((x) => !x.done).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const got = items.filter((x) => x.done).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return (
    <div className="bs-shopping">
      <form
        className="bs-quickline"
        onSubmit={async (e) => {
          e.preventDefault();
          // "milk, bread and eggs" adds three
          const names = v
            .split(/,|\band\b|\n/i)
            .map((x) => x.trim())
            .filter(Boolean);
          if (!names.length) return;
          setV("");
          for (const n of names) await bs.addUs({ kind: "shopping", title: n[0].toUpperCase() + n.slice(1) });
        }}
      >
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add to the shopping list (milk, bread, eggs…)" maxLength={300} aria-label="Add to shopping" enterKeyHint="done" />
      </form>
      {open.length ? (
        <ul className="bs-shoplist">
          {open.map((x) => (
            <li key={x.id} style={{ ["--who" as string]: colorOf(x.added_by) }}>
              <label>
                <input type="checkbox" checked={false} onChange={() => bs.patchUs(x.id, { done: true })} />
                <span>{x.title}</span>
              </label>
              <button className="bs-x" aria-label={`Remove ${x.title}`} onClick={() => bs.deleteUs(x.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bs-empty small">Nothing to buy 🎉</p>
      )}
      {got.length > 0 && (
        <>
          <div className="bs-side-head">
            <h2>In the basket</h2>
            <button className="bs-link" onClick={() => bs.clearUs("ticked-shopping")}>
              Clear
            </button>
          </div>
          <ul className="bs-shoplist done">
            {got.map((x) => (
              <li key={x.id}>
                <label>
                  <input type="checkbox" checked onChange={() => bs.patchUs(x.id, { done: false })} />
                  <span>{x.title}</span>
                </label>
                <small>{x.done_by ? (x.done_by === me.id ? "you" : nameOf(x.done_by)) : ""}</small>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
