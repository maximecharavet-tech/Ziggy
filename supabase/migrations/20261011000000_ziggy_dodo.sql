-- Mode dodo: illustrations and Ziggy's narration, generated once and shared
-- by everyone (no child data at all). Public read; only the owner account
-- (public.is_owner()) can generate, replace or delete them.

create table if not exists public.ziggy_dodo_assets (
  story_id text not null check (story_id ~ '^[a-z0-9_]{1,20}$'),
  scene smallint not null check (scene between 0 and 12),
  kind text not null check (kind in ('image', 'audio')),
  locale text not null default '-' check (locale in ('-', 'fr', 'en')),
  path text not null check (char_length(path) < 200),
  provider text not null check (char_length(provider) < 60),
  created_at timestamptz not null default now(),
  primary key (story_id, scene, kind, locale)
);
alter table public.ziggy_dodo_assets enable row level security;
create policy "dodo assets are public" on public.ziggy_dodo_assets for select to anon, authenticated using (true);
create policy "owner writes dodo assets" on public.ziggy_dodo_assets for insert to authenticated with check (public.is_owner());
create policy "owner updates dodo assets" on public.ziggy_dodo_assets for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "owner deletes dodo assets" on public.ziggy_dodo_assets for delete to authenticated using (public.is_owner());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ziggy-dodo', 'ziggy-dodo', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'audio/wav', 'audio/x-wav'])
on conflict (id) do nothing;

create policy "owner uploads dodo files" on storage.objects for insert to authenticated
  with check (bucket_id = 'ziggy-dodo' and public.is_owner());
create policy "owner replaces dodo files" on storage.objects for update to authenticated
  using (bucket_id = 'ziggy-dodo' and public.is_owner()) with check (bucket_id = 'ziggy-dodo' and public.is_owner());
create policy "owner deletes dodo files" on storage.objects for delete to authenticated
  using (bucket_id = 'ziggy-dodo' and public.is_owner());
