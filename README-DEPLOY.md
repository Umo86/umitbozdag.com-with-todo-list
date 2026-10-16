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
| `components/` | Floorplan hero animation, scroll reveals, ticker, print button |
| `lib/` | Postgres pool, Neon Auth JWT verification + owner lock, task queries |
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

Open `/backstage` → **Create the owner account** with the email in
`ALLOWED_EMAILS`. Any other account can sign in to Neon Auth but is refused by
Backstage ("limited to its owner").

## Local commands

```bash
npm install
npm run build     # production build
npm start         # serve on $PORT (default 3000)
npm run migrate   # apply the database schema
npm run test:e2e  # node test/e2e.mjs <siteUrl> <authUrl> <email> <password>
```
