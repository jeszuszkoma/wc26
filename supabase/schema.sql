-- WC26 prediction game — run once in Supabase SQL editor.

create table if not exists public.votes (
  id bigint generated always as identity primary key,
  match_num int not null check (match_num between 1 and 104),
  player text not null check (char_length(player) between 1 and 20),
  pick text not null check (pick in ('1', 'X', '2')),
  created_at timestamptz not null default now(),
  unique (match_num, player)
);

alter table public.votes enable row level security;

-- Friends-only app, no auth: anon key may read and write votes.
-- The unique constraint + merge-duplicates upsert keeps one pick per player per match.
create policy "anon read votes"   on public.votes for select to anon using (true);
create policy "anon insert votes" on public.votes for insert to anon with check (true);
create policy "anon update votes" on public.votes for update to anon using (true) with check (true);
