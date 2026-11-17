import assert from "node:assert/strict";
import { test } from "node:test";
import { keyboardIsOpen, mobileNavigation } from "../lib/mobile-layout.ts";

test("personal navigation has five usable targets and retains every section", () => {
  const all = ["today", "mine", "finance", "joint", "wedding", "calendar", "us"].map(id => ({ id }));
  const { primary, more } = mobileNavigation(all);
  assert.deepEqual(primary.map(item => item.id), ["today", "mine", "calendar", "us"]);
  assert.equal(primary.length + 1, 5);
  assert.deepEqual(more.map(item => item.id), ["finance", "joint", "wedding"]);
  assert.deepEqual([...primary, ...more].map(item => item.id).sort(), all.map(item => item.id).sort());
});
test("work keeps direct navigation without exposing personal sections", () => {
  const all = ["today", "mine", "calendar"].map(id => ({ id }));
  assert.deepEqual(mobileNavigation(all), { primary: all, more: [] });
});
test("keyboard detection ignores browser chrome changes and window resizing without an editor", () => {
  assert.ok(keyboardIsOpen(851, 480, true));
  assert.equal(keyboardIsOpen(851, 790, true), false);
  assert.equal(keyboardIsOpen(851, 480, false), false);
  assert.equal(keyboardIsOpen(480, 480, true), false);
});
