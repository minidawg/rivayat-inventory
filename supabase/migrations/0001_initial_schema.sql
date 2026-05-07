-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Brands ───────────────────────────────────────────────────────────────────
create table brands (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- ─── Collections ─────────────────────────────────────────────────────────────
create table collections (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  brand_id uuid not null references brands (id) on delete cascade,
  unique (brand_id, name)
);

-- ─── Articles ─────────────────────────────────────────────────────────────────
create table articles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  collection_id uuid not null references collections (id) on delete cascade,
  unique (collection_id, name)
);

-- ─── SKUs ─────────────────────────────────────────────────────────────────────
create table skus (
  id               uuid    primary key default gen_random_uuid(),
  article_id       uuid    not null references articles (id) on delete cascade,
  size             text    not null check (size in ('XS','S','M','L','XL','XXL','XXXL','34','36','38','40','42','44','46')),
  quantity         integer not null default 0 check (quantity >= 0),
  low_stock_buffer integer not null default 2 check (low_stock_buffer >= 0),
  avg_cost_pkr     numeric not null default 0,
  avg_exchange_rate numeric not null default 0,
  unique (article_id, size)
);

-- ─── Purchases ────────────────────────────────────────────────────────────────
create table purchases (
  id             uuid      primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  sku_id         uuid      not null references skus (id) on delete cascade,
  quantity       integer   not null check (quantity > 0),
  cost_pkr       numeric   not null,
  commission_pkr numeric   not null default 0,
  shipping_pkr   numeric   not null default 0,
  exchange_rate  numeric   not null,
  source         text      check (source in ('prebook', 'released')),
  notes          text
);

-- ─── Sales ────────────────────────────────────────────────────────────────────
create table sales (
  id                   uuid      primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  sku_id               uuid      not null references skus (id) on delete cascade,
  quantity             integer   not null check (quantity > 0),
  selling_price        numeric   not null,
  cost_pkr_at_sale     numeric,
  exchange_rate_at_sale numeric,
  channel              text      check (channel in ('Instagram','Walk-in','WhatsApp','Facebook','Website','TikTok')),
  client_name          text
);

-- ─── Settings ─────────────────────────────────────────────────────────────────
create table settings (
  key   text primary key,
  value text not null
);

-- Seed the default exchange rate so getExchangeRate() always finds a row
insert into settings (key, value) values ('usd_rate', '280');

-- ─── Row-Level Security ───────────────────────────────────────────────────────
alter table brands      enable row level security;
alter table collections enable row level security;
alter table articles    enable row level security;
alter table skus        enable row level security;
alter table purchases   enable row level security;
alter table sales       enable row level security;
alter table settings    enable row level security;

-- Authenticated users get full access to all tables
create policy "auth_all" on brands      for all to authenticated using (true) with check (true);
create policy "auth_all" on collections for all to authenticated using (true) with check (true);
create policy "auth_all" on articles    for all to authenticated using (true) with check (true);
create policy "auth_all" on skus        for all to authenticated using (true) with check (true);
create policy "auth_all" on purchases   for all to authenticated using (true) with check (true);
create policy "auth_all" on sales       for all to authenticated using (true) with check (true);
create policy "auth_all" on settings    for all to authenticated using (true) with check (true);
