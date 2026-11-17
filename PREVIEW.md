# Backstage redesign preview

The changes are uncommitted. This updates the Backstage application; the public portfolio keeps its existing content and design.

## Run it

Install the project dependencies with `npm ci`, then run `npm run dev`.

- Desktop: http://localhost:3000/backstage/preview
- Phone view: http://localhost:3000/backstage/preview/mobile
- Real sign-in: http://localhost:3000/backstage (requires the existing environment settings)

The preview needs no password or database. Its data lives in this browser, separately from real accounts. Attachments stay in the browser's IndexedDB. Use the preview user picker to check the two sample users; Reset preview restores the sample data.

## Changes to try

- Capture a task on Today, Tasks, Joint or Wedding. Type a date and check the recognised details before adding it. Work tasks always stay on Work.
- Choose Today/Tomorrow or set a date, project, priority and repeat. Open All details to add notes, reminders and files.
- Use Add several for one task per line. Successful tasks are removed; any failed tasks stay ready to retry. Unsaved capture text and options survive reloading.
- Search task names and notes, filter by due date/priority, and sort the list. Desktop users can switch to the board and drag tasks in manual order.
- Edit a task, complete it, undo a deletion, or complete a repeating task to create its next occurrence.
- Manage project names, colours and deadlines. Moving a private project moves its tasks; deleting a project keeps the tasks.
- Add/edit calendar events. Try Work and Personal calendars, the shared list and shopping, wedding areas/budgets/guests, and the Us sections.
- Use a keyboard to open and close sheets; focus stays inside a sheet and Escape closes it.

## Preview limits

The preview is a single-browser simulation. Real sign-in, database permissions, two-device collaboration, email delivery, Android notifications, web push and one-time video delivery need the live services and are not validated by this preview. The production authentication and API routes have not been replaced or bypassed. Chat and hearts in the preview only change sample data; they do not contact anyone.

## Checks

Requires Node 24 for the source-level tests (the application retains its existing Node requirement).

```text
node node_modules/typescript/bin/tsc --noEmit
node test/parse.test.mjs
node --test test/preview.test.mjs
npm run build
```

Run date parser tests with the process timezone set to Europe/London.

The calendar helper was renamed to `calendar-utils.ts` to resolve the `Calendar.tsx` / `calendar.ts` filename collision on Windows. No database migration is required.
