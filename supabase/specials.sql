-- Tournament-level predictions: champion pick + exact final score (free text).
-- One row per player, upserted.

create table if not exists public.specials (
  player text primary key check (char_length(player) between 1 and 20),
  champion text check (champion is null or char_length(champion) <= 30),
  final_score text check (final_score is null or char_length(final_score) <= 40),
  updated_at timestamptz not null default now()
);

alter table public.specials enable row level security;

create policy "anon read specials"   on public.specials for select to anon using (true);
create policy "anon insert specials" on public.specials for insert to anon with check (true);
create policy "anon update specials" on public.specials for update to anon using (true) with check (true);
