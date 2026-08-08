-- ============================================================
-- LUCKY DRAW PRO — SUPABASE SCHEMA
-- Copy this entire file into the Supabase SQL Editor and click Run.
-- Safe to run once on a fresh project.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES
-- One row per user, created automatically when someone signs up.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

-- ------------------------------------------------------------
-- 2. DRAWS
-- A "draw" is one lucky-draw session created by a user.
-- ------------------------------------------------------------
create table if not exists public.draws (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  draw_name text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  remove_winner_after_draw boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_draws_user_id on public.draws(user_id);
create index if not exists idx_draws_created_at on public.draws(created_at desc);

-- ------------------------------------------------------------
-- 3. PARTICIPANTS
-- Names entered into a specific draw.
-- ------------------------------------------------------------
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  name text not null,
  is_winner boolean not null default false,
  removed_after_draw boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_participants_draw_id on public.participants(draw_id);

-- ------------------------------------------------------------
-- 4. DRAW_RESULTS
-- One row per winner selection (a draw can be run more than once
-- if "remove winner after draw" allows repeat draws).
-- ------------------------------------------------------------
create table if not exists public.draw_results (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  winner_name text not null,
  participant_count int not null default 0,
  drawn_at timestamptz not null default now()
);

create index if not exists idx_draw_results_draw_id on public.draw_results(draw_id);
create index if not exists idx_draw_results_user_id on public.draw_results(user_id);
create index if not exists idx_draw_results_drawn_at on public.draw_results(drawn_at desc);

-- ------------------------------------------------------------
-- 5. ACTIVITY_LOGS
-- Lightweight audit trail.
-- ------------------------------------------------------------
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at desc);

-- ============================================================
-- 6. AUTO-CREATE A PROFILE ROW WHEN SOMEONE SIGNS UP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_draws_updated_at on public.draws;
create trigger set_draws_updated_at before update on public.draws
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- 7. HELPER: is the current user an admin?
-- SECURITY DEFINER so it can read profiles without recursive RLS issues.
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- 8. ENABLE ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.draws enable row level security;
alter table public.participants enable row level security;
alter table public.draw_results enable row level security;
alter table public.activity_logs enable row level security;

-- ------------------------------------------------------------
-- PROFILES policies
-- ------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() and (select role from public.profiles where id = auth.uid()) = role)
  with check (id = auth.uid());

-- Only admins can change roles/status on other profiles
drop policy if exists "profiles_admin_update_any" on public.profiles;
create policy "profiles_admin_update_any" on public.profiles
  for update using (public.is_admin());

-- ------------------------------------------------------------
-- DRAWS policies
-- ------------------------------------------------------------
drop policy if exists "draws_select_own_or_admin" on public.draws;
create policy "draws_select_own_or_admin" on public.draws
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "draws_insert_own" on public.draws;
create policy "draws_insert_own" on public.draws
  for insert with check (user_id = auth.uid());

drop policy if exists "draws_update_own_or_admin" on public.draws;
create policy "draws_update_own_or_admin" on public.draws
  for update using (user_id = auth.uid() or public.is_admin());

drop policy if exists "draws_delete_own_or_admin" on public.draws;
create policy "draws_delete_own_or_admin" on public.draws
  for delete using (user_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- PARTICIPANTS policies (scoped through the parent draw's owner)
-- ------------------------------------------------------------
drop policy if exists "participants_select_own_or_admin" on public.participants;
create policy "participants_select_own_or_admin" on public.participants
  for select using (
    public.is_admin() or
    exists (select 1 from public.draws d where d.id = draw_id and d.user_id = auth.uid())
  );

drop policy if exists "participants_insert_own" on public.participants;
create policy "participants_insert_own" on public.participants
  for insert with check (
    exists (select 1 from public.draws d where d.id = draw_id and d.user_id = auth.uid())
  );

drop policy if exists "participants_update_own_or_admin" on public.participants;
create policy "participants_update_own_or_admin" on public.participants
  for update using (
    public.is_admin() or
    exists (select 1 from public.draws d where d.id = draw_id and d.user_id = auth.uid())
  );

drop policy if exists "participants_delete_own_or_admin" on public.participants;
create policy "participants_delete_own_or_admin" on public.participants
  for delete using (
    public.is_admin() or
    exists (select 1 from public.draws d where d.id = draw_id and d.user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- DRAW_RESULTS policies
-- ------------------------------------------------------------
drop policy if exists "draw_results_select_own_or_admin" on public.draw_results;
create policy "draw_results_select_own_or_admin" on public.draw_results
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "draw_results_insert_own" on public.draw_results;
create policy "draw_results_insert_own" on public.draw_results
  for insert with check (user_id = auth.uid());

drop policy if exists "draw_results_delete_own_or_admin" on public.draw_results;
create policy "draw_results_delete_own_or_admin" on public.draw_results
  for delete using (user_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- ACTIVITY_LOGS policies
-- Any signed-in user can insert their own log rows.
-- Only admins can read the full log; users can read their own.
-- ------------------------------------------------------------
drop policy if exists "activity_logs_select_own_or_admin" on public.activity_logs;
create policy "activity_logs_select_own_or_admin" on public.activity_logs
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "activity_logs_insert_own" on public.activity_logs;
create policy "activity_logs_insert_own" on public.activity_logs
  for insert with check (user_id = auth.uid());

-- ============================================================
-- DONE.
-- Next step: create your account on the live website, then follow
-- the README section "Make your account an Admin" to run one more
-- SQL command that promotes your specific account.
-- ============================================================
