// Supabase Edge Function: proxy football-data.org World Cup matches.
// Keeps the API key server-side and adds CORS for the browser app.
//
// Deploy:  supabase functions deploy scores --no-verify-jwt
// Secret:  supabase secrets set FOOTBALL_DATA_KEY=<your key>

const FD_URL = 'https://api.football-data.org/v4/competitions/WC/matches';

let cache: { body: string; at: number } | null = null;
const TTL_MS = 60_000; // free tier = 10 req/min; one upstream call per minute max

Deno.serve(async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60',
  };

  if (cache && Date.now() - cache.at < TTL_MS) {
    return new Response(cache.body, { headers });
  }

  const key = Deno.env.get('FOOTBALL_DATA_KEY');
  if (!key) {
    return new Response(JSON.stringify({ error: 'FOOTBALL_DATA_KEY not set' }), {
      status: 500, headers,
    });
  }

  const upstream = await fetch(FD_URL, { headers: { 'X-Auth-Token': key } });
  if (!upstream.ok) {
    // Serve stale cache over an upstream error if we have it.
    if (cache) return new Response(cache.body, { headers });
    return new Response(JSON.stringify({ error: `upstream ${upstream.status}` }), {
      status: 502, headers,
    });
  }

  const body = await upstream.text();
  cache = { body, at: Date.now() };
  return new Response(body, { headers });
});
