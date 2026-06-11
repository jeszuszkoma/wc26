# WC26 // PREDICTION ARENA — Setup

The app works immediately after deploy in **local mode** (votes stay per device,
scores from openfootball, updated ~daily). Two optional upgrades below.

## 1. Shared voting — Supabase (~5 min, free)

1. Go to [supabase.com](https://supabase.com) → New project (free tier, any region — `eu-central` closest to HU).
2. In the project: **SQL Editor** → paste the contents of [`supabase/schema.sql`](supabase/schema.sql) → Run.
3. **Project Settings → API**: copy `Project URL` and `anon public` key.
4. Edit [`js/config.js`](js/config.js):
   ```js
   SUPABASE_URL: 'https://YOURREF.supabase.co',
   SUPABASE_ANON_KEY: 'eyJ...',
   ```
5. Commit + push. Done — everyone's votes sync, leaderboard goes live.

> Note: no logins, but names are PIN-protected. The first device to use a name
> sets a 4–8 digit PIN (run [`supabase/players.sql`](supabase/players.sql) in the
> SQL editor to enable). Same name + PIN on another device = same player.
> Still a trust-based friends game — don't post the link publicly.

## 2. Live scores

Built in — no setup. The app reads ESPN's public scoreboard JSON directly
(no key, CORS-open) and refreshes every minute, with openfootball as the
~daily fallback. ESPN's feed is unofficial; if it ever changes shape, the
football-data.org proxy below is the stable backup.

### Optional fallback — football-data.org (~5 min, free)

1. Register at [football-data.org](https://www.football-data.org/client/register) → free key by email.
2. Install Supabase CLI (`brew install supabase/tap/supabase`), then:
   ```sh
   supabase login
   supabase link --project-ref YOURREF
   supabase secrets set FOOTBALL_DATA_KEY=your_key_here
   supabase functions deploy scores --no-verify-jwt
   ```
3. Edit `js/config.js`:
   ```js
   SCORES_URL: 'https://YOURREF.supabase.co/functions/v1/scores',
   ```
4. Commit + push. Scores now refresh every minute (few minutes behind real time —
   free tier delay).

## Game rules (current)

- Your name is your account: first use sets a PIN (4–8 digits), and the
  name only works with that PIN afterwards — on any device.
- Voting opens at local midnight on matchday, or 12 h before kickoff for
  early-morning games — future matches show when they unlock.
- Pick `1` / `X` / `2` before kickoff (knockout: winner only). One pick per match, changeable until kickoff.
- Friends' picks are hidden until the match locks, then revealed on the card.
- Correct result = 3 points. Exact score (EXACT row, optional) = +5 — both right
  on one match = 8. Leaderboard under **Board**.
- The EXACT score is judged on the **90-minute result** (betting style) — extra
  time and shootout goals don't count. An exact guess can't contradict your
  1/X/2 pick; knockout draw guesses are fine (pens pick the winner).
- Knockout picks score on the official result (after pens if needed).
- **Trophy tab:** pick the World Cup champion — 10 pts. **One shot:** select a
  team, press OK, and the pick is permanent (no changes). Latest at knockout
  start. Hidden from others until the knockout stage begins.
- The free-text exact final score section is disabled for now
  (`SHOW_FINAL_SCORE` in `js/config.js` re-enables it).

Change points or refresh rate in `js/config.js`.
