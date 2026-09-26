-- Lets the API embed the child's profile next to each result
-- (profiles.id is the same uuid as auth.users.id, and a profile always
-- exists before any result thanks to the signup trigger).
alter table public.game_results
  add constraint game_results_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
