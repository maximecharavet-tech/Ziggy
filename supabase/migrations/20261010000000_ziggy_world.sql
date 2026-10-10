-- Ziggy World: world memory, avatars, stories, parental consent, generation
-- capsules (CostGuard) and safety events. Everything belongs to the parent
-- account (auth.uid()); row-level security on every table; deleting the
-- account deletes everything (ON DELETE CASCADE).

-- ── World memory + adaptive learning state (one JSON document per account) ──
create table if not exists public.ziggy_world_state (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint ziggy_world_state_size check (pg_column_size(data) < 200000)
);
alter table public.ziggy_world_state enable row level security;
create policy "own world state" on public.ziggy_world_state
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Parental consent ──
create table if not exists public.ziggy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('photo_avatar', 'ai_content')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists ziggy_consents_user on public.ziggy_consents(user_id, kind);
alter table public.ziggy_consents enable row level security;
create policy "own consents" on public.ziggy_consents
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Avatars (the image lives in the private ziggy-avatars bucket) ──
create table if not exists public.ziggy_avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blueprint jsonb not null,
  style text not null,
  outfit text not null,
  world text not null,
  image_path text,
  from_photo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ziggy_avatars_user on public.ziggy_avatars(user_id, created_at desc);
alter table public.ziggy_avatars enable row level security;
create policy "own avatars" on public.ziggy_avatars
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Stories ──
create table if not exists public.ziggy_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  choices jsonb not null,
  story jsonb not null,
  source text not null check (source in ('ai', 'local')),
  created_at timestamptz not null default now(),
  constraint ziggy_stories_size check (pg_column_size(story) < 60000)
);
create index if not exists ziggy_stories_user on public.ziggy_stories(user_id, created_at desc);
alter table public.ziggy_stories enable row level security;
create policy "own stories" on public.ziggy_stories
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Generation capsules: one row per AI generation, for CostGuard and the parent console ──
create table if not exists public.ziggy_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  operation text not null check (operation in ('analyze_image', 'generate_avatar', 'generate_quest', 'generate_story', 'generate_game_content', 'generate_world_scene')),
  status text not null default 'QUEUED' check (status in ('QUEUED', 'PROCESSING', 'VALIDATING', 'COMPLETED', 'FAILED', 'EXPIRED')),
  provider text not null,
  world text,
  scene text,
  safety_status text not null default 'pending' check (safety_status in ('pending', 'passed', 'blocked', 'not_applicable')),
  estimated_cost numeric(10, 5) not null default 0,
  latency_ms integer,
  error_code text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists ziggy_generations_user on public.ziggy_generations(user_id, created_at desc);
alter table public.ziggy_generations enable row level security;
create policy "read own generations" on public.ziggy_generations for select to authenticated using (user_id = (select auth.uid()));
create policy "insert own generations" on public.ziggy_generations for insert to authenticated with check (user_id = (select auth.uid()));
create policy "update own generations" on public.ziggy_generations for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own generations" on public.ziggy_generations for delete to authenticated using (user_id = (select auth.uid()));
create policy "owner reads all generations" on public.ziggy_generations for select to authenticated using (public.is_owner());

-- ── Safety events: what was blocked (category only, never the content) ──
create table if not exists public.ziggy_safety_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  operation text not null,
  category text not null,
  created_at timestamptz not null default now()
);
alter table public.ziggy_safety_events enable row level security;
create policy "read own safety events" on public.ziggy_safety_events for select to authenticated using (user_id = (select auth.uid()));
create policy "insert own safety events" on public.ziggy_safety_events for insert to authenticated with check (user_id = (select auth.uid()));
create policy "delete own safety events" on public.ziggy_safety_events for delete to authenticated using (user_id = (select auth.uid()));

-- ── Global usage for CostGuard: counts only, no personal data ──
create or replace function public.ziggy_generation_totals()
returns table (day_count bigint, month_count bigint, month_cost numeric)
language sql
security definer
set search_path = ''
stable
as $$
  select
    count(*) filter (where created_at > now() - interval '1 day'),
    count(*) filter (where created_at > date_trunc('month', now())),
    coalesce(sum(estimated_cost) filter (where created_at > date_trunc('month', now())), 0)
  from public.ziggy_generations
  where status <> 'FAILED';
$$;
revoke all on function public.ziggy_generation_totals() from public, anon;
grant execute on function public.ziggy_generation_totals() to authenticated;

-- Capsules past their TTL are marked EXPIRED (called before reads).
create or replace function public.ziggy_expire_generations()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.ziggy_generations set status = 'EXPIRED'
  where user_id = (select auth.uid()) and expires_at < now() and status <> 'EXPIRED';
$$;
grant execute on function public.ziggy_expire_generations() to authenticated;

-- ── Private avatar images: each account sees only its own folder ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ziggy-avatars', 'ziggy-avatars', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "ziggy avatars read own" on storage.objects for select to authenticated
  using (bucket_id = 'ziggy-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "ziggy avatars write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'ziggy-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "ziggy avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'ziggy-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
