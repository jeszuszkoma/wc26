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

-- Name lookup is case-insensitive ("jozkanya" finds "JozKanya"), and the
-- canonical stored spelling is returned so every device uses the same name.
-- Returns null when the PIN doesn't match.
--
-- REGISTRATION IS FROZEN (2026-06-12): unknown names are rejected instead of
-- created. To let one new person in, insert their row manually:
--   insert into public.players (name, pin_hash)
--   values ('NewName', extensions.crypt('1234', extensions.gen_salt('bf')));
-- (tell them name + PIN, they log in normally). To reopen registration,
-- replace the `return null; -- registration closed` branch with the insert.
drop function if exists public.claim_player(text, text);
create function public.claim_player(p_name text, p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cname text;
  h text;
begin
  p_name := trim(p_name);
  if char_length(p_name) < 1 or char_length(p_name) > 20
     or p_pin !~ '^[0-9]{4,8}$' then
    return null;
  end if;
  select name, pin_hash into cname, h
    from players where lower(name) = lower(p_name);
  if not found then
    return null; -- registration closed
  end if;
  if crypt(p_pin, h) = h then
    return cname;
  end if;
  return null;
end;
$$;

revoke all on function public.claim_player(text, text) from public;
grant execute on function public.claim_player(text, text) to anon, authenticated;
