// Run: TZ=Europe/London node test/parse.test.mjs
import assert from "node:assert/strict";
import { parseTasks, nextOccurrence } from "../lib/parse.ts";

// Tuesday 10 November 2026, 20:30
const now = new Date(2026, 10, 10, 20, 30);
const projects = [
  { id: "p-ukcw", name: "UKCW" },
  { id: "p-ss", name: "Stone & Surface" },
  { id: "p-site", name: "Website" },
];
const P = (t) => parseTasks(t, { now, projects });
let n = 0;
const check = (text, want) => {
  const got = P(text);
  try {
    assert.equal(got.length, want.length, "number of tasks");
    want.forEach((w, i) => {
      for (const [k, v] of Object.entries(w)) assert.deepEqual(got[i][k], v, `task ${i + 1} ${k}`);
    });
    n++;
  } catch (e) {
    console.error(`\n✗ ${text}\n  ${e.message}\n  got: ${JSON.stringify(got, null, 1)}`);
    process.exitCode = 1;
  }
};

check("call the venue tomorrow at 10 and chase the signage quote for UKCW and book the dentist Friday, remind me Thursday at 6pm", [
  { title: "Call the venue", due_date: "2026-11-11", remind_local: "2026-11-11T10:00", project_id: null },
  { title: "Chase the signage quote", project_id: "p-ukcw", due_date: null, remind_local: null },
  { title: "Book the dentist", due_date: "2026-11-13", remind_local: "2026-11-12T18:00" },
]);
check("Email Sarah the floorplan", [{ title: "Email Sarah the floorplan", due_date: null, remind_local: null, priority: "normal", list: null }]);
check("remind me to call mum", [{ title: "Call mum", remind_local: "2026-11-11T09:00", due_date: "2026-11-11" }]);
check("send the invoices by end of the week urgent", [{ title: "Send the invoices", due_date: "2026-11-13", priority: "high" }]);
check("renew car insurance next Monday personal", [{ title: "Renew car insurance", due_date: "2026-11-16", list: "personal" }]);
check("next Friday review stand plans", [{ title: "Review stand plans", due_date: "2026-11-20" }]);
check("weekly ops report every Monday at 9am for work", [
  { title: "Weekly ops report", repeat: "weekly", due_date: "2026-11-16", remind_local: "2026-11-16T09:00", list: "work" },
]);
check("pay rent every month", [{ title: "Pay rent", repeat: "monthly", due_date: "2026-11-10" }]);
check("check the exhibitor list in 2 hours", [{ title: "Check the exhibitor list", remind_local: "2026-11-10T22:30" }]);
check("Book flights to Istanbul on 5th December", [{ title: "Book flights to Istanbul", due_date: "2026-12-05" }]);
check("Submit RAMS 3/2", [{ title: "Submit RAMS", due_date: "2027-02-03" }]);
check("Stone & Surface floorplan update in 3 days low priority", [
  { title: "Floorplan update", project_id: "p-ss", due_date: "2026-11-13", priority: "low" },
]);
check("ring the printers at half 2 tomorrow", [{ title: "Ring the printers", remind_local: "2026-11-11T14:30" }]);
check("buy milk tonight", [{ title: "Buy milk", due_date: "2026-11-10", remind_local: "2026-11-10T19:00" }]);
check("Update the U K C W signage copy", [{ title: "Update signage copy", project_id: "p-ukcw" }]);
check("I need to finish the work on the deck", [{ title: "Finish the work on the deck", list: null }]);
check("call Tom and Jerry tomorrow", [{ title: "Call Tom and Jerry", due_date: "2026-11-11" }]);
check("Buy a gift. Book the restaurant for Saturday. Then confirm the photographer", [
  { title: "Buy a gift" },
  { title: "Book the restaurant", due_date: "2026-11-14" },
  { title: "Confirm the photographer" },
]);
check("draft the sponsorship deck at 3", [{ title: "Draft the sponsorship deck", remind_local: "2026-11-11T15:00" }]);
check("um okay so add a task to call the venue", [{ title: "Call the venue" }]);
check("book the dentist friday and chase the stand plans", [{ title: "Book the dentist", list: "personal" }, { title: "Chase the stand plans", list: null }]);
check("", []);

assert.equal(nextOccurrence("2026-11-13", "weekdays"), "2026-11-16");
assert.equal(nextOccurrence("2026-01-31", "monthly"), "2026-02-28");
assert.equal(nextOccurrence("2026-11-10", "fortnightly"), "2026-11-24");
console.log(`${n} parse checks passed${process.exitCode ? " (some failed)" : ""}`);

// ——— events and joint (two people) ———
const P2 = (t) => parseTasks(t, { now, projects, others: [{ id: "dilfiraz", name: "Dilfiraz" }] });
const check2 = (text, want) => {
  const got = P2(text);
  try {
    assert.equal(got.length, want.length, "number of items");
    want.forEach((w, i) => { for (const [k, v] of Object.entries(w)) assert.deepEqual(got[i][k], v, `item ${i + 1} ${k}`); });
    n++;
  } catch (e) {
    console.error(`\n✗ ${text}\n  ${e.message}\n  got: ${JSON.stringify(got, null, 1)}`);
    process.exitCode = 1;
  }
};
check2("dinner with the family Saturday at 7 joint", [{ kind: "event", title: "Dinner with the family", joint: true, assignee: "both", due_date: "2026-11-14", start_local: "2026-11-14T19:00", remind_minutes: 30 }]);
check2("Dilfiraz to book the vet on Monday", [{ kind: "task", title: "Book the vet", joint: true, assignee: "dilfiraz", due_date: "2026-11-16" }]);
check2("pay the council tax by Friday", [{ kind: "task", joint: false, due_date: "2026-11-13", list: "personal" }]);
check2("meeting with the NEC team on Thursday at 2pm and chase the quote", [
  { kind: "event", title: "Meeting with the NEC team", start_local: "2026-11-12T14:00", joint: false },
  { kind: "task", title: "Chase the quote" },
]);
check2("Ayşe's birthday on 3rd December add to calendar every year", [{ kind: "event", title: "Ayşe's birthday", due_date: "2026-12-03", start_local: null, repeat: "yearly" }]);
check2("buy a present for the wedding together", [{ kind: "task", joint: true, title: "Buy a present for the wedding" }]);
console.log(`${n} parse checks passed in total${process.exitCode ? " (some failed)" : ""}`);
check2("dinner with the family Saturday at 7 joint and Dilfiraz to book the vet on Monday and chase the stand plans for UKCW", [
  { kind: "event", joint: true, start_local: "2026-11-14T19:00" },
  { kind: "task", title: "Book the vet", assignee: "dilfiraz", due_date: "2026-11-16" },
  { kind: "task", title: "Chase the stand plans", project_id: "p-ukcw", joint: false },
]);
console.log(`${n} checks after split test`);
