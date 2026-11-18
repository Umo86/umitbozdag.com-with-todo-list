# Personal finance tracker

Finance is on the Personal side of Backstage, with the same desktop and mobile navigation. Each signed-in person has a separate, private ledger and budgets. There are no joint or Work finances in this version.

## Try it without touching live data

- Desktop: http://localhost:3000/backstage/preview?view=finance
- Phone: http://localhost:3000/backstage/preview/mobile?view=finance

The preview contains clearly marked sample transactions and budgets. Changes stay in this browser, in the separate `backstage:preview:finance:v1` storage key. Switching sample users lets you check privacy. Reset preview clears sample finance data along with other sample data.

## Features

- Income and expense entries with an amount, date, category, description and optional notes.
- Monthly income, spending, net change and budget remaining, all in GBP.
- Category budgets, over-budget warnings, and copying the previous month’s limits into a draft for review.
- Search descriptions and notes, filter by transaction type/category, and export the selected month as CSV.
- Edit entries and remove them with Undo. Production removal is a soft delete, preserving the row for restoration.
- Integer-pence amounts and shared validation prevent floating-point rounding and invalid dates/categories.

Net is the month’s recorded income minus expenses. There are no account opening balances, bank connections, automatic recurring transactions or investment calculations.

## Production setup

The existing database records and migration script are unchanged. Finance uses two new tables only: `finance_transactions` and `finance_budgets`. Its authenticated API is separate from the existing task/state endpoints, and all queries restrict access to the signed-in owner.

The setup is additive and transactional: it creates these tables and their index if missing. It contains no reset, seed data, changes to existing tables, or automatic build/startup hook. In Finance, a signed-in administrator can press **Enable Finance** once. The authenticated setup endpoint takes a transaction lock, creates only the separate Finance tables, and commits atomically. Other users cannot run setup, and the setup does not grant anyone access to another person's records.

When ready to enable database-backed Finance, run this explicitly from the project root with the existing database environment settings:

```text
node scripts/migrate-finance.mjs
```

Deploying the code does not run setup. Before an administrator enables it (or runs the optional command), Finance displays its setup message and the rest of Backstage continues to use its existing tables and routes.

## Checks

```text
node node_modules/typescript/bin/tsc --noEmit
node --test test/finance.test.mjs test/preview.test.mjs
npm run build
```

Tests cover exact amounts, dates, validation, monthly totals, CSV escaping, owner isolation, month isolation, editing/removal/restore, budgets and storage failures. Production database behaviour requires the finance tables and a configured test database; the local preview tests do not substitute for that integration test.

The production route handlers are also tested against an isolated in-memory PostgreSQL engine. Install `@electric-sql/pglite` in a scratch directory, set `FINANCE_TEST_PGLITE` to its `dist/index.js` path, and run `node --test test/finance-api.test.mjs`. These tests verify additive/repeatable setup, owner filtering, invalid input, month moves, soft delete/restore and atomic budget saves without using live credentials or live records.

## Entry and export

Expense and Income open directly with the decimal amount field focused. A name is optional in the form; its category becomes the stored description if blank. Date and notes expand on demand. Add another keeps the selected date/category and clears the saved amount/name/notes only after success. Failed saves keep the form values. Moving a dated entry to another month switches to that month so it stays visible.

Desktop Export month downloads CSV for the entire selected month, regardless of search filters. Android opens a CSV sheet with Copy CSV; if clipboard access is unavailable it selects the text for manual copying. Exporting an empty month produces the CSV header. This avoids relying on unsupported WebView blob downloads.
