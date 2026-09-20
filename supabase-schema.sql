-- Ask Wifey / PAW production-oriented Supabase schema draft
-- Run only when moving V1.4 from LocalStorage to Supabase.

create extension if not exists pgcrypto;

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  strictness smallint not null default 2 check (strictness between 1 and 3),
  currency text not null default 'LKR',
  brain jsonb not null default '{"businessName":"LOMOS","ownerPayPercent":20,"emergencyPercent":10,"paymentPlan":{"advance":50,"approval":20,"deployment":30}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('personal','business','project','reserve')),
  balance numeric(14,2) not null default 0,
  reserved numeric(14,2) not null default 0 check (reserved >= 0),
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client text,
  contract_value numeric(14,2) not null default 0 check (contract_value >= 0),
  status text not null default 'active' check (status in ('active','completed','archived')),
  service_type text,
  last_payment_stage text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric(14,2) not null check (amount > 0),
  wallet_id uuid references wallets(id) on delete restrict,
  from_wallet_id uuid references wallets(id) on delete restrict,
  to_wallet_id uuid references wallets(id) on delete restrict,
  project_id uuid references projects(id) on delete set null,
  source_type text,
  category text,
  description text,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),
  constraint transaction_wallet_shape check (
    (type in ('income','expense') and wallet_id is not null and from_wallet_id is null and to_wallet_id is null)
    or
    (type = 'transfer' and wallet_id is null and from_wallet_id is not null and to_wallet_id is not null and from_wallet_id <> to_wallet_id)
  )
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  monthly_limit numeric(14,2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  unique(user_id, category)
);

create table if not exists commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references wallets(id) on delete restrict,
  name text not null,
  amount numeric(14,2) not null check (amount > 0),
  category text,
  due_date date not null,
  frequency text not null default 'one-off' check (frequency in ('one-off','monthly','annual')),
  project_id uuid references projects(id) on delete set null,
  kind text not null default 'general',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists smart_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  kind text not null default 'general',
  status text not null default 'open' check (status in ('open','done')),
  due_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx on transactions(user_id, transaction_date desc);
create index if not exists transactions_project_idx on transactions(project_id) where project_id is not null;
create index if not exists commitments_user_due_idx on commitments(user_id, due_date) where active = true;

alter table user_settings enable row level security;
alter table wallets enable row level security;
alter table projects enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table commitments enable row level security;
alter table smart_tasks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['user_settings','wallets','projects','transactions','budgets','commitments','smart_tasks'] loop
    execute format('drop policy if exists "Users manage own %s" on %I', t, t);
    execute format('create policy "Users manage own %s" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- V1.4 teachable Wifey brain
create table if not exists wifey_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('min_balance','purchase_limit','monthly_category_cap','require_project','debt_first','income_split','transfer_limit','custom_reminder')),
  severity text not null default 'warn' check (severity in ('warn','ask','strict')),
  active boolean not null default true,
  wallet_scope text not null default 'any',
  category text not null default 'any',
  amount numeric(14,2) not null default 0,
  source_type text not null default 'any',
  target_wallet_id uuid references wallets(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wifey_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area text not null default 'general' check (area in ('general','lomos','tappy','personal','projects')),
  label text not null,
  value text,
  note text,
  keywords text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table wifey_rules enable row level security;
alter table wifey_memories enable row level security;

drop policy if exists "Users manage own wifey_rules" on wifey_rules;
create policy "Users manage own wifey_rules" on wifey_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own wifey_memories" on wifey_memories;
create policy "Users manage own wifey_memories" on wifey_memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
