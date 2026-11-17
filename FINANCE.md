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

## Production setup (prepared, not applied)

The existing database records and migration script are unchanged. Finance uses two new tables only: `finance_transactions` and `finance_budgets`. Its authenticated API is separate from the existing task/state endpoints, and all queries restrict access to the signed-in owner.

The optional setup is additive and transactional: it creates these tables and their index if missing. It contains no reset, seed data, changes to existing tables, or automatic build/startup hook.

When ready to enable database-backed Finance, run this explicitly from the project root with the existing database environment settings:

```text
node scripts/migrate-finance.mjs
```

This setup has **not** been run against the live database. Before it runs, the live Finance section displays a setup message; the rest of Backstage continues to use its existing tables and routes.

## Checks

```text
node node_modules/typescript/bin/tsc --noEmit
node --test test/finance.test.mjs test/preview.test.mjs
npm run build
```

Tests cover exact amounts, dates, validation, monthly totals, CSV escaping, owner isolation, month isolation, editing/removal/restore, budgets and storage failures. Production database behaviour requires the finance tables and a configured test database; the local preview tests do not substitute for that integration test.
