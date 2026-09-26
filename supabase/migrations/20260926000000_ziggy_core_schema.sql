-- ─────────────────────────────────────────────────────────────
-- Ziggy core schema
-- Parents own the account; the profile row describes their child.
-- The owner role lives in auth app_metadata, which users cannot
-- edit themselves, so policies can trust it.
--
-- The owner account itself is NOT created here: its credentials
-- must never live in a public repository. Grant the role with:
--   update auth.users
--      set raw_app_meta_data = raw_app_meta_data || '{"role":"owner"}'
--    where email = '<owner email>';
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'owner', false);
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── Profiles ────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  child_name  text not null check (char_length(btrim(child_name)) between 1 and 24),
  avatar      text not null default 'sales'
              check (avatar in ('sales', 'marketing', 'finance', 'accounting', 'advertising')),
  age_group   text check (age_group in ('5-7', '8-10', '11-12')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── Game results: one row per finished round ────────────────
create table public.game_results (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game_id     text not null check (game_id ~ '^[a-z]{2,20}$'),
  score       integer not null check (score between 0 and 100000),
  stars       smallint not null check (stars between 0 and 3),
  created_at  timestamptz not null default now()
);

create index game_results_user_game_idx on public.game_results (user_id, game_id);
create index game_results_created_idx   on public.game_results (created_at desc);

-- ── Site settings: a single owner-editable row ──────────────
create table public.site_settings (
  id          smallint primary key default 1 check (id = 1),
  stats       jsonb not null default
              '{"children":"50K+","sessions":"2M+","countries":"45+","rating":"4.9/5"}'
              check (jsonb_typeof(stats) = 'object' and pg_column_size(stats) < 2000),
  sections    jsonb not null default
              '{"showcase":true,"agents":true,"games":true,"reviews":true,"pricing":true}'
              check (jsonb_typeof(sections) = 'object' and pg_column_size(sections) < 2000),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

insert into public.site_settings (id) values (1);

create or replace function public.stamp_site_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger site_settings_stamp
  before update on public.site_settings
  for each row execute function public.stamp_site_settings();

-- ── Create the profile when a parent signs up ───────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name   text  := left(btrim(coalesce(meta ->> 'child_name', '')), 24);
  avatar text  := meta ->> 'avatar';
  age    text  := meta ->> 'age_group';
begin
  if name = '' then
    name := 'Ziggy';
  end if;
  if avatar is null or avatar not in ('sales', 'marketing', 'finance', 'accounting', 'advertising') then
    avatar := 'sales';
  end if;
  if age is not null and age not in ('5-7', '8-10', '11-12') then
    age := null;
  end if;

  insert into public.profiles (id, child_name, avatar, age_group)
  values (new.id, name, avatar, age);
  return new;
end;
$$;

-- Only the trigger may run it; never expose it over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Owner analytics (runs as the caller, so RLS still applies) ──
create or replace function public.owner_game_stats()
returns table (game_id text, plays bigint, players bigint, avg_score numeric, total_stars bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.game_id,
         count(*),
         count(distinct r.user_id),
         round(avg(r.score), 1),
         coalesce(sum(r.stars), 0)
  from public.game_results r
  group by r.game_id
  order by count(*) desc;
$$;

-- ── Row level security ──────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.game_results  enable row level security;
alter table public.site_settings enable row level security;

create policy "profiles: read own, owner reads all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_owner()));

create policy "profiles: insert own"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "results: read own, owner reads all"
  on public.game_results for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_owner()));

create policy "results: insert own"
  on public.game_results for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "settings: anyone can read"
  on public.site_settings for select to anon, authenticated
  using (true);

create policy "settings: owner updates"
  on public.site_settings for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- ── Column-level grants: only the fields a client may set ───
revoke all on public.profiles, public.game_results, public.site_settings from anon, authenticated;

grant select on public.site_settings to anon, authenticated;
grant update (stats, sections) on public.site_settings to authenticated;

grant select on public.profiles to authenticated;
grant insert (id, child_name, avatar, age_group) on public.profiles to authenticated;
grant update (child_name, avatar, age_group) on public.profiles to authenticated;

grant select on public.game_results to authenticated;
grant insert (game_id, score, stars) on public.game_results to authenticated;
