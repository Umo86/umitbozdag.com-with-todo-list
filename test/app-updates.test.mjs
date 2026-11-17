import assert from "node:assert/strict";
import { test } from "node:test";
import { canRefreshApp, newerAppBuild } from "../lib/app-updates.ts";

test("native update prompts require a known, higher integer build", () => {
  assert.ok(newerAppBuild("50", 51));
  for (const available of [null, 0, -1, 49, 50, "51", 51.2, Infinity]) assert.equal(newerAppBuild("50", available), false);
  for (const installed of [undefined, "", "1.0.50", "50x", null, 0]) assert.equal(newerAppBuild(installed, 51), false);
});
test("automatic updates wait for editing, saving, dragging and background activity to end", () => {
  const idle = { hidden: false, editing: false, saving: false, dragging: false };
  assert.ok(canRefreshApp(idle));
  for (const key of Object.keys(idle)) assert.equal(canRefreshApp({ ...idle, [key]: true }), false, key);
});
