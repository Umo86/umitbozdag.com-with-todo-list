// Additive only: these names are separate from every existing Backstage table.
export const FINANCE_SCHEMA = `
create table if not exists finance_transactions (
 id uuid primary key default gen_random_uuid(),
 owner text not null references users(id),
 kind text not null check (kind in ('income','expense')),
 amount_pence bigint not null check (amount_pence > 0 and amount_pence <= 10000000000),
 description text not null check (length(description) between 1 and 200),
 category text not null,
 occurred_on date not null,
 notes text,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists finance_transactions_owner_date_idx on finance_transactions(owner, occurred_on desc) where deleted_at is null;
create table if not exists finance_budgets (
 owner text not null references users(id),
 month date not null check (extract(day from month) = 1),
 category text not null,
 amount_pence bigint not null check (amount_pence >= 0 and amount_pence <= 10000000000),
 updated_at timestamptz not null default now(),
 primary key (owner, month, category)
);
`;
