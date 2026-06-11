-- Player name claims: first use of a name sets its PIN, after that the
-- name only works with the matching PIN. Run in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.players (
  name text primary key check (char_length(name) between 1 and 20),
  pin_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;
-- No anon policies on purpose: the table is reachable only through the
-- security-definer function below, so PIN hashes never leave the server.

create or replace function public.claim_player(p_name text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text;
begin
  p_name := trim(p_name);
  if char_length(p_name) < 1 or char_length(p_name) > 20
     or p_pin !~ '^[0-9]{4,8}$' then
    return false;
  end if;
  select pin_hash into h from players where name = p_name;
  if not found then
    insert into players (name, pin_hash)
    values (p_name, crypt(p_pin, gen_salt('bf')));
    return true;
  end if;
  return crypt(p_pin, h) = h;
end;
$$;

revoke all on function public.claim_player(text, text) from public;
grant execute on function public.claim_player(text, text) to anon, authenticated;
