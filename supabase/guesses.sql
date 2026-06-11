-- Per-match exact score predictions. +5 pts on exact hit, stacks with the 1X2 pick.

create table if not exists public.guesses (
  id bigint generated always as identity primary key,
  match_num int not null check (match_num between 1 and 104),
  player text not null check (char_length(player) between 1 and 20),
  home int not null check (home between 0 and 30),
  away int not null check (away between 0 and 30),
  created_at timestamptz not null default now(),
  unique (match_num, player)
);

alter table public.guesses enable row level security;

create policy "anon read guesses"   on public.guesses for select to anon using (true);
create policy "anon insert guesses" on public.guesses for insert to anon with check (true);
create policy "anon update guesses" on public.guesses for update to anon using (true) with check (true);
