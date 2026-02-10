-- ============================================================
-- Translation Manager — Supabase Setup
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- ============================================================

-- Enable pgcrypto for password hashing
create extension if not exists pgcrypto;

-- ============================================================
-- 1. projects table
-- ============================================================
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- 2. translations table
-- ============================================================
create table if not exists translations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key_path text not null,
  az_value text,
  en_value text,
  ru_value text,
  token_type text,
  figma_variable_id text,
  original_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, key_path)
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists translations_updated_at on translations;
create trigger translations_updated_at
  before update on translations
  for each row execute function update_updated_at();

-- Index for fast lookups
create index if not exists idx_translations_project_key on translations (project_id, key_path);

-- ============================================================
-- 3. group_extensions table
-- ============================================================
create table if not exists group_extensions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  group_path text not null,
  extensions jsonb not null default '{}',
  unique (project_id, group_path)
);

-- ============================================================
-- 4. app_settings table (for shared password)
-- ============================================================
create table if not exists app_settings (
  key text primary key,
  value text not null
);

-- Set initial password (change 'your-password-here' to your actual password)
insert into app_settings (key, value)
values ('access_password', crypt('your-password-here', gen_salt('bf')))
on conflict (key) do update set value = excluded.value;

-- ============================================================
-- 5. RPC function to verify password
-- ============================================================
create or replace function verify_password(input_password text)
returns boolean as $$
declare
  stored_hash text;
begin
  select value into stored_hash from app_settings where key = 'access_password';
  if stored_hash is null then return false; end if;
  return stored_hash = crypt(input_password, stored_hash);
end;
$$ language plpgsql security definer;

-- ============================================================
-- 6. Row Level Security
-- ============================================================

-- projects: allow all operations for anon
alter table projects enable row level security;

create policy "Allow all on projects"
  on projects for all
  using (true)
  with check (true);

-- translations: allow all operations for anon
alter table translations enable row level security;

create policy "Allow all on translations"
  on translations for all
  using (true)
  with check (true);

-- group_extensions: allow all operations for anon
alter table group_extensions enable row level security;

create policy "Allow all on group_extensions"
  on group_extensions for all
  using (true)
  with check (true);

-- app_settings: no direct access (only through RPC)
alter table app_settings enable row level security;

-- No policy = no direct access. The verify_password function uses SECURITY DEFINER
-- to bypass RLS and read the table.

-- ============================================================
-- 7. Enable Realtime on translations
-- ============================================================
alter publication supabase_realtime add table translations;
