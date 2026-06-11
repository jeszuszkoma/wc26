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

> Note: no logins. Anyone with the URL can vote under any name — fine for a
> friends game, don't post the link publicly.

## 2. Near-live scores — football-data.org (~5 min, free)

Without this, scores still arrive via openfootball (~once a day).

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

- Voting opens at local midnight on matchday, or 12 h before kickoff for
  early-morning games — future matches show when they unlock.
- Pick `1` / `X` / `2` before kickoff (knockout: winner only). One pick per match, changeable until kickoff.
- Friends' picks are hidden until the match locks, then revealed on the card.
- Correct result = 3 points. Exact score (EXACT row, optional) = +5 — both right
  on one match = 8. Leaderboard under **Board**.
- Knockout picks score on the official result (after pens if needed).
- **Trophy tab:** pick the World Cup champion (10 pts, locks when the knockout
  stage starts) and write your exact final score prediction (free text, locks at
  final kickoff, bragging rights only). Both hidden from others until locked.

Change points or refresh rate in `js/config.js`.
