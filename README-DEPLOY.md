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
| `BACKSTAGE_PASSWORD` | the password for `/backstage` | keep it secret; changing it signs every device out |
| `BACKSTAGE_SECRET` | optional | extra random text mixed into the session signature |

Until these are set, the public site works fully and `/backstage` shows a
notice naming the missing setting instead of the password field.

## One-time database step (already done on the Neon project)

Run the schema: `npm install && npm run migrate` (needs `DATABASE_URL` or
`DATABASE_URL_UNPOOLED` in `.env.local`).

## Signing in

Open `/backstage` and enter the password (the `BACKSTAGE_PASSWORD` setting). A
correct password keeps that browser signed in for 30 days. Ten wrong guesses
from one address in fifteen minutes lock that address out for the rest of the
fifteen minutes. The password is never stored in this repository.

## Backstage in brief

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
```
