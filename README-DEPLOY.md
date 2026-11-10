# umitbozdag.com — deploy guide

## Testing on Vercel

Import this repo as a new Vercel project — Next.js is auto-detected, no
settings needed. The public site works with zero configuration; add the
environment variables below (Project → Settings → Environment Variables)
to activate Backstage, then redeploy.

## Production on Hostinger (Node.js app)

A Next.js 16 site: editorial portfolio + CV, with **Backstage** (`/backstage`),
a private task manager behind one password, storing its data in Neon Postgres.

## What's in here

| Path | What it is |
| --- | --- |
| `app/` | Pages: `/` (home), `/cv`, `/backstage`, plus the API under `/api/backstage/*` |
| `components/` | cities film hero (rendered by `scripts/hero-film/render.py`), hall blueprint animation, show-cycle chart, badge contact form, events list |
| `components/backstage/` | The Backstage board: sign-in gate, columns with drag and drop, task drawer, projects |
| `lib/profile.json` | All public-page content: roles, dates, the 24 shows, press links, contact details. Edit this to change what the site says |
| `app/shows/[id]/` | One page per show, generated from `profile.json` |
| `lib/` | Postgres pool, the password gate and session cookie, task queries |
| `scripts/migrate.mjs` | Creates the database tables (run once; safe to re-run) |
| `test/e2e.mjs` | End-to-end test: password gate, tasks, projects, contact messages |

## Deploy on Hostinger (Business or Cloud plan)

1. In hPanel, add a **Node.js web app** on the domain (an existing website on
   the domain must be removed first — Hostinger's rule, and it's irreversible,
   so only do it when you're ready to switch).
2. Deploy by **uploading this project as a .zip** or by connecting a **GitHub
   repo** containing it. Hostinger auto-detects Next.js and runs the build.
3. Pick **Node 22** (18/20/24 also work).
4. Set the **environment variables** below, then deploy/restart.

## Environment variables

| Name | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | from Neon | pooled connection string (`-pooler` host) — keep it secret |
| `BACKSTAGE_PASSWORD` | Umit's Backstage password | keep it secret; changing it signs Umit out everywhere |
| `BACKSTAGE_SECRET` | optional | extra random text mixed into the session signature |
| `ANTHROPIC_API_KEY` | optional | turns on AI reading of spoken tasks (better with rambling speech and Turkish). Without it, built-in rules read them |
| `ANTHROPIC_MODEL` | optional | model for that, default `claude-haiku-5-5` |

Until these are set, the public site works fully and `/backstage` shows a
notice naming the missing setting instead of the password field.

## One-time database step (already done on the Neon project)

Run the schema: `npm install && npm run migrate` (needs `DATABASE_URL` or
`DATABASE_URL_UNPOOLED` in `.env.local`).

## Signing in (two people)

Backstage has two people, **Umit** and **Dilfiraz**. Open `/backstage`, pick
your name and enter your password. Umit's is the `BACKSTAGE_PASSWORD`
setting; Dilfiraz's is stored hashed in the `users` table. To set or change
either one (it signs that person out everywhere):

```bash
DATABASE_URL=... node scripts/set-password.mjs dilfiraz 'new password'
```

A correct password keeps that browser signed in for 30 days. Ten wrong guesses
from one address in fifteen minutes lock that address out for the rest of the
fifteen minutes. The password is never stored in this repository.

## Backstage in brief

- **Who sees what:** each person has their own Work and Personal lists and
  projects (private), plus a **joint** list and **joint** calendar for both.
  Things Umit adds are blue, things Dilfiraz adds are pink. A private event
  shows to the other person as a grey "Busy" block with no details.
- **Calendar:** month view and the day's agenda; events (timed or all day,
  with place, reminder and repeat), plus to-dos with a due date and project
  deadlines. Each person gets a private calendar link (You → Copy link) to add
  to Google or Samsung Calendar.

- Two lists, **Work** and **Personal**, each a board of To do / In progress / Done.
- Drag cards between columns or reorder them (mouse, touch or keyboard); open a
  card to edit notes, project, priority, due date and reminder.
- Reminders show on the page (and as a browser alert if you allow it) while
  Backstage is open. **Add to calendar** downloads an `.ics` file so your phone
  can alert you when it is not.
- Deleting a project keeps its tasks.
- **Messages**: anything sent through the contact form on the home page is saved
  to the `messages` table and listed here, with a reply link. If the database is
  unreachable the form opens the visitor's own email app instead.

## Local commands

```bash
npm install
npm run build     # production build
npm start         # serve on $PORT (default 3000)
npm run migrate   # apply the database schema
npm run test:e2e  # node test/e2e.mjs <siteUrl> <backstagePassword>
TZ=Europe/London node test/parse.test.mjs   # how spoken tasks are read
```

## Database changes (November 2026)

`npm run migrate` adds `tasks.repeat`, `tasks.next_id` and `projects.due_date`
(already applied to the Neon project).

## The Android app (`mobile/`)

A small Capacitor app that opens Backstage at the address in
`mobile/capacitor.config.json` (`server.url`) and adds what a web page can't:

- the phone's own speech recogniser for **Add tasks**
- reminders scheduled **on the phone**, so they go off with the app closed,
  each with **Done** and **Snooze 1h** buttons, plus an 8am summary
- a **Speak a task** shortcut (long-press the app icon)
- an offline page when there's no signal

Reminders added on a computer reach the phone the next time the app is
opened (it refreshes whenever it comes to the front).

**Getting the app:** every push that touches `mobile/` makes GitHub build it
(`.github/workflows/android.yml`) and publish it as the `android-latest`
release: open
https://github.com/Umo86/umitbozdag.com-with-todo-list/releases/download/android-latest/Backstage.apk
on the phone and install it (Android asks once to allow installs from the
browser).

**Updates install over the old app** only if every build is signed with the
same key. Add two repository secrets (GitHub → Settings → Secrets and
variables → Actions): `ANDROID_KEYSTORE_B64` (the keystore file, base64) and
`ANDROID_KEYSTORE_PASSWORD`. Without them each build uses a throwaway key and
the old app has to be uninstalled before installing a new one.

**Changing the address** the app opens: edit `server.url` in
`mobile/capacitor.config.json` and push; the next APK uses it. The address
must open without any login wall (Vercel preview protection blocks the app).
