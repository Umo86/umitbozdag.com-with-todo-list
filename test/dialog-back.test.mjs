import assert from "node:assert/strict";
import { test } from "node:test";
import { dismissTopDialog } from "../components/backstage/useDialogFocus.ts";

test("Back closes only the visible top dialog, leaving the underlying section intact", () => {
  const clicks = [];
  const dialog = (name, visible = true, disabled = false) => ({
    getClientRects: () => visible ? [{}] : [],
    querySelectorAll: () => [{ getAttribute: () => "Close", disabled, click: () => clicks.push(name) }],
  });
  globalThis.document = { querySelectorAll: () => [dialog("underlying"), dialog("top"), dialog("hidden", false)] };
  assert.equal(dismissTopDialog(), true);
  assert.deepEqual(clicks, ["top"]);
});
test("Back is consumed during a save and falls through only when no dialog is open", () => {
  let clicked = false;
  globalThis.document = { querySelectorAll: () => [{ getClientRects: () => [{}], querySelectorAll: () => [{ getAttribute: () => "Close", disabled: true, click: () => { clicked = true; } }] }] };
  assert.equal(dismissTopDialog(), true);
  assert.equal(clicked, false);
  globalThis.document = { querySelectorAll: () => [] };
  assert.equal(dismissTopDialog(), false);
});
