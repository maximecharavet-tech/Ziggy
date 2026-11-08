-- L'appli du Père Noël: live AI call minutes per Pack magique pass.
--
-- The server (publishable key, no service role) only ever calls
-- public.santa_use_seconds(). The table has RLS on and NO policies, so
-- anon/authenticated can neither read nor write it directly; the function
-- (SECURITY DEFINER) is the only way in.
-- pass_hash = sha256(Stripe Checkout Session id + SANTA_PASS_SECRET), hex:
-- unguessable without the server secret, and nothing about the family.

create table if not exists public.santa_ai_usage (
  pass_hash text primary key check (pass_hash ~ '^[0-9a-f]{64}$'),
  seconds int not null default 0 check (seconds >= 0),
  updated_at timestamptz not null default now()
);

alter table public.santa_ai_usage enable row level security;
revoke all on table public.santa_ai_usage from anon, authenticated;

-- Adds p_seconds (0–120) to the pass while it is under p_cap and returns the
-- seconds used (capped at p_cap). p_seconds = 0 only reads (no row created).
create or replace function public.santa_use_seconds(p_pass_hash text, p_seconds int, p_cap int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  used int;
begin
  if p_pass_hash is null or p_pass_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid pass hash' using errcode = '22023';
  end if;
  if p_seconds is null or p_seconds < 0 or p_seconds > 120 then
    raise exception 'invalid seconds' using errcode = '22023';
  end if;
  if p_cap is null or p_cap < 0 or p_cap > 7200 then
    raise exception 'invalid cap' using errcode = '22023';
  end if;

  if p_seconds = 0 then
    select u.seconds into used from public.santa_ai_usage u where u.pass_hash = p_pass_hash;
    return coalesce(used, 0);
  end if;

  insert into public.santa_ai_usage as u (pass_hash, seconds)
  values (p_pass_hash, least(p_seconds, p_cap))
  on conflict (pass_hash) do update
    set seconds = least(u.seconds + p_seconds, p_cap), updated_at = now()
    where u.seconds < p_cap
  returning u.seconds into used;

  if used is null then
    -- Already at (or over) the cap: nothing added.
    select u.seconds into used from public.santa_ai_usage u where u.pass_hash = p_pass_hash;
  end if;
  return coalesce(used, 0);
end;
$$;

revoke all on function public.santa_use_seconds(text, int, int) from public;
grant execute on function public.santa_use_seconds(text, int, int) to anon, authenticated;
