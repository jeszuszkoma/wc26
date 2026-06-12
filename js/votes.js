import { CONFIG } from './config.js';

// Shared votes live in Supabase (plain PostgREST, no SDK needed).
// Without config, votes fall back to localStorage — single-device mode.

const LS_VOTES = 'wc26.votes';   // { "<matchNum>:<player>": "1"|"X"|"2" }
const LS_NAME = 'wc26.player';
const LS_CLAIMED = 'wc26.claimed'; // '1' once this device passed the PIN check

export const online = () => Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

export function playerName() {
  return localStorage.getItem(LS_NAME) || '';
}
export function setPlayerName(name) {
  localStorage.setItem(LS_NAME, name.trim());
}
export function isClaimed() {
  return localStorage.getItem(LS_CLAIMED) === '1';
}
export function setClaimed() {
  localStorage.setItem(LS_CLAIMED, '1');
}

// First call with a new name claims it (PIN stored hashed, server-side).
// Name matching is case-insensitive; returns the canonical stored name
// (capitalization as first claimed) or null when the PIN doesn't match.
// Local mode: name as typed.
export async function claimPlayer(name, pin) {
  if (!online()) return name;
  const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/claim_player`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ p_name: name, p_pin: pin }),
  });
  if (!res.ok) throw new Error(`claim failed ${res.status}: ${await res.text()}`);
  const r = await res.json();
  if (r === true) return name; // older boolean-returning function
  return r || null;
}

function headers() {
  return {
    apikey: CONFIG.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

// -> { "<matchNum>:<player>": pick }
export async function fetchVotes() {
  if (!online()) {
    return JSON.parse(localStorage.getItem(LS_VOTES) || '{}');
  }
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/votes?select=match_num,player,pick`;
  const rows = await fetch(url, { headers: headers() }).then(r => {
    if (!r.ok) throw new Error(`votes fetch ${r.status}`);
    return r.json();
  });
  const map = {};
  for (const row of rows) map[`${row.match_num}:${row.player}`] = row.pick;
  return map;
}

export async function castVote(matchNum, player, pick) {
  if (!online()) {
    const map = JSON.parse(localStorage.getItem(LS_VOTES) || '{}');
    map[`${matchNum}:${player}`] = pick;
    localStorage.setItem(LS_VOTES, JSON.stringify(map));
    return;
  }
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/votes?on_conflict=match_num,player`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ match_num: matchNum, player, pick }),
  });
  if (!res.ok) throw new Error(`vote failed ${res.status}: ${await res.text()}`);
}

// Distinct player list from the vote map (for leaderboard even before anyone scores).
export function playersFrom(votes) {
  const set = new Set();
  for (const key of Object.keys(votes)) set.add(key.slice(key.indexOf(':') + 1));
  const me = playerName();
  if (me) set.add(me);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/* ---- per-match exact score guesses ---- */

const LS_GUESSES = 'wc26.guesses'; // { "<matchNum>:<player>": [home, away] }

// -> { "<matchNum>:<player>": [home, away] }
export async function fetchGuesses() {
  if (!online()) return JSON.parse(localStorage.getItem(LS_GUESSES) || '{}');
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/guesses?select=match_num,player,home,away`;
  const rows = await fetch(url, { headers: headers() }).then(r => {
    if (!r.ok) throw new Error(`guesses fetch ${r.status}`);
    return r.json();
  });
  const map = {};
  for (const row of rows) map[`${row.match_num}:${row.player}`] = [row.home, row.away];
  return map;
}

export async function castGuess(matchNum, player, home, away) {
  if (!online()) {
    const map = JSON.parse(localStorage.getItem(LS_GUESSES) || '{}');
    map[`${matchNum}:${player}`] = [home, away];
    localStorage.setItem(LS_GUESSES, JSON.stringify(map));
    return;
  }
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/guesses?on_conflict=match_num,player`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ match_num: matchNum, player, home, away }),
  });
  if (!res.ok) throw new Error(`guess failed ${res.status}: ${await res.text()}`);
}

/* ---- tournament-level predictions: champion + exact final score ---- */

const LS_SPECIALS = 'wc26.specials'; // { "<player>": { champion, final_score, top_scorer } }

// -> { "<player>": { champion, final_score, top_scorer } }
export async function fetchSpecials() {
  if (!online()) return JSON.parse(localStorage.getItem(LS_SPECIALS) || '{}');
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/specials?select=player,champion,final_score,top_scorer`;
  const rows = await fetch(url, { headers: headers() }).then(r => {
    if (!r.ok) throw new Error(`specials fetch ${r.status}`);
    return r.json();
  });
  const map = {};
  for (const row of rows) {
    map[row.player] = {
      champion: row.champion,
      final_score: row.final_score,
      top_scorer: row.top_scorer,
    };
  }
  return map;
}

// Send the FULL row — PostgREST upsert overwrites omitted columns with defaults.
export async function saveSpecial(player, { champion = null, final_score = null, top_scorer = null }) {
  if (!online()) {
    const map = JSON.parse(localStorage.getItem(LS_SPECIALS) || '{}');
    map[player] = { champion, final_score, top_scorer };
    localStorage.setItem(LS_SPECIALS, JSON.stringify(map));
    return;
  }
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/specials?on_conflict=player`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ player, champion, final_score, top_scorer }),
  });
  if (!res.ok) throw new Error(`special save failed ${res.status}: ${await res.text()}`);
}
