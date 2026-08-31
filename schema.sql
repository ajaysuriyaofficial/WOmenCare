-- ============================================================
-- Period Tracker — Supabase schema
-- Run this once in your project's SQL Editor
-- (Supabase Dashboard → SQL Editor → New Query → paste → Run).
-- ============================================================

-- 1. One-time setup in the Dashboard (cannot be done via SQL):
--    Authentication → Providers → Anonymous Sign-Ins → Enable.
--    api.js signs each device up as an anonymous user on first
--    load, so this must be on or every save/load will fail.

-- 2. The table itself: one row per user, the whole app's data
--    for that user stored as a single JSON blob in `data`.
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Keep updated_at current on every write.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_data_updated_at on public.user_data;
create trigger trg_user_data_updated_at
  before update on public.user_data
  for each row execute function public.set_updated_at();

-- 3. Row Level Security: each user can only ever see/change their
--    own row. This is what actually protects the data — not the
--    anon key, which is safe to ship in client code.
alter table public.user_data enable row level security;

drop policy if exists "select own row" on public.user_data;
create policy "select own row"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "insert own row" on public.user_data;
create policy "insert own row"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own row" on public.user_data;
create policy "update own row"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No delete policy is defined on purpose — rows are never deleted by
-- the app. If you want to support "delete my data", add:
--   create policy "delete own row" on public.user_data for delete
--     using (auth.uid() = user_id);

-- ============================================================
-- Optional: aggregate/anonymous view for a future admin dashboard.
-- Returns counts only — never touches an individual user's `data`
-- blob — so it's safe to expose to an admin-only role.
-- ============================================================
create or replace view public.admin_stats as
select
  count(*)                                            as total_users,
  count(*) filter (where (data->>'onboarded')::boolean) as onboarded_users,
  sum(jsonb_array_length(coalesce(data->'cycles', '[]'::jsonb)))       as total_cycles_recorded,
  sum(jsonb_array_length(coalesce(data->'symptomLogs', '[]'::jsonb)))  as total_symptom_logs,
  sum(jsonb_array_length(coalesce(data->'lifestyleLogs', '[]'::jsonb))) as total_lifestyle_logs
from public.user_data;

-- Lock the view down to a specific admin role/user before using it in
-- production — it is NOT covered by the RLS policies above and reading
-- it should never be exposed to regular signed-in users. Example:
--   revoke all on public.admin_stats from anon, authenticated;
--   grant select on public.admin_stats to service_role;
