# umitbozdag.com — deploy guide

## Testing on Vercel

Import this repo as a new Vercel project — Next.js is auto-detected, no
settings needed. The public site works with zero configuration; add the
environment variables below (Project → Settings → Environment Variables)
to activate Backstage, then redeploy.

## Production on Hostinger (Node.js app)

A Next.js 16 site: editorial portfolio + CV, with **Backstage** (`/backstage`),
a private task manager backed by Neon Postgres and Neon Auth.

## What's in here

| Path | What it is |
| --- | --- |
| `app/` | Pages: `/` (home), `/cv`, `/backstage`, plus the API under `/api/backstage/*` |
| `components/` | London film hero, hall blueprint animation, show-cycle chart, badge contact form, events list |
| `components/backstage/` | The Backstage board: sign-in gate, columns with drag and drop, task drawer, projects |
| `lib/profile.json` | All public-page content: roles, dates, the 24 shows, press links, contact details. Edit this to change what the site says |
| `app/shows/[id]/` | One page per show, generated from `profile.json` |
| `lib/` | Postgres pool, Neon Auth token check + owner/helper roles (verified emails only), task queries |
| `scripts/migrate.mjs` | Creates the `settings` / `projects` / `tasks` tables (run once) |
| `test/e2e.mjs` | End-to-end test: sign-in → JWT → task CRUD |

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
| `NEON_AUTH_BASE_URL` | `https://ep-shy-unit-zaoq9skj.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth` | this project's Neon Auth URL (public) |
| `NEON_AUTH_JWKS_URL` | `https://ep-shy-unit-zaoq9skj.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth/.well-known/jwks.json` | verified live |
| `ALLOWED_EMAILS` | optional | comma-separated owner emails; defaults to `umitbozdag@googlemail.com` |
| `HELPER_EMAILS` | optional | comma-separated emails of helpers (e.g. a partner). A helper signs up at `/backstage` with that email and can see the **Personal** list and add tasks to it — nothing else |

**Trusted origins (required for sign-in):** in the Neon console → this project →
Auth, add every origin the site runs on — e.g. your `https://….vercel.app` test
URL, `https://umitbozdag.com` and `https://www.umitbozdag.com`. Localhost is
allowed by default. Without this, the browser's sign-in request is rejected
("Missing or null Origin" / untrusted origin).

Until these are set, the public site works fully and `/backstage` shows a
"not connected yet" notice instead of the sign-in.

## One-time Neon steps (done for you if Claude ran them)

1. Enable **Postgres + Neon Auth** on the project.
2. Run the schema: `npm install && npm run migrate` (needs `DATABASE_URL` or
   `DATABASE_URL_UNPOOLED` in `.env.local`).
3. Add the site to Neon Auth's **trusted domains**:
   `https://umitbozdag.com` and `https://www.umitbozdag.com`.

## First sign-in

Open `/backstage` and either **Continue with Google** (using the address in
`ALLOWED_EMAILS`) or **Create account** with a password and enter the 6-digit
code Neon emails you. Backstage only admits **verified** email addresses, so
nobody can get in by registering your address with their own password. Any
other verified account is refused ("limited to its owner") unless it is listed
in `HELPER_EMAILS`.

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
npm run test:e2e  # node test/e2e.mjs <siteUrl> <authUrl> <email> <password>
                  # set E2E_DATABASE_URL (direct connection) so the test can
                  # verify and afterwards remove its own test account
```
