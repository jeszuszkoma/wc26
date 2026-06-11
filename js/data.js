import { CONFIG } from './config.js';
import { fromFdName } from './teams.js';

const OPENFOOTBALL_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

export const KO_ROUNDS = [
  'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final',
  'Match for third place', 'Final',
];

// "13:00 UTC-6" + "2026-06-11" -> Date in the viewer's local timezone.
export function kickoff(match) {
  const m = match.time.match(/^(\d{2}):(\d{2}) UTC([+-]\d+)$/);
  if (!m) return new Date(`${match.date}T${match.time || '00:00'}:00Z`);
  const [, hh, mm, off] = m;
  const sign = off.startsWith('-') ? '+' : '-'; // ISO offset is inverse of "UTC-6" shift
  const pad = String(Math.abs(parseInt(off, 10))).padStart(2, '0');
  return new Date(`${match.date}T${hh}:${mm}:00${off.startsWith('-') ? '-' : '+'}${pad}:00`);
}

export function isKnockout(match) {
  return !match.group;
}

// 'scheduled' | 'live' | 'finished'
export function status(match, now = new Date()) {
  if (match._live) return 'live'; // live feed says in play — score present but not final
  if (match.score?.ft) return 'finished';
  const ko = kickoff(match);
  const liveWindowMs = isKnockout(match) ? 150 * 60_000 : 120 * 60_000; // ET+pens headroom
  if (now >= ko && now - ko < liveWindowMs) return 'live';
  if (now >= ko) return 'finished'; // past, no score yet -> treat as done/awaiting result
  return 'scheduled';
}

// Knockout slots like "1A", "2B", "W73", "L101", "3A/B/C/D/F" are not votable yet.
const SLOT = /^([WL]\d+|\d[A-L])$|\//;
export function placeholder(match) {
  return SLOT.test(match.team1) || SLOT.test(match.team2);
}

const EARLY_OPEN_MS = 12 * 3_600_000;

// Voting unlocks at local midnight of matchday, or 12h before kickoff for
// early-morning matches — whichever comes first.
export function unlockTime(match) {
  const ko = kickoff(match);
  const midnight = new Date(ko);
  midnight.setHours(0, 0, 0, 0);
  const early = new Date(ko.getTime() - EARLY_OPEN_MS);
  return early < midnight ? early : midnight;
}

export function votingOpen(match, now = new Date()) {
  return now >= unlockTime(match) && now < kickoff(match) && !placeholder(match);
}

// Total goals per side incl. extra time (pens excluded — shown separately).
export function goals(match) {
  const s = match.score;
  if (!s?.ft) return null;
  const ft = s.et ?? s.ft; // openfootball: et totals include ft
  return { home: ft[0], away: ft[1], pens: s.p ?? null };
}

// '1' | 'X' | '2' for a finished match; knockout uses pens/et to break ties.
export function outcome(match) {
  const g = goals(match);
  if (!g) return null;
  if (g.home !== g.away) return g.home > g.away ? '1' : '2';
  if (g.pens) return g.pens[0] > g.pens[1] ? '1' : '2';
  return 'X';
}

// openfootball numbers most knockout matches but not group games (nor, today,
// the 3rd-place match and final). Stable ids by kickoff order so votes keep
// pointing at the same match across refreshes:
//   group matches -> 1..72, unnumbered knockout -> after the highest known num.
function assignNums(matches) {
  const byKickoff = (a, b) => kickoff(a) - kickoff(b) || a.team1.localeCompare(b.team1);
  const groups = matches.filter(m => m.num == null && m.group).sort(byKickoff);
  groups.forEach((m, i) => { m.num = i + 1; });
  let next = Math.max(72, ...matches.map(m => m.num ?? 0)) + 1;
  const ko = matches.filter(m => m.num == null).sort(byKickoff);
  ko.forEach(m => { m.num = next++; });
  return matches;
}

export async function loadSchedule() {
  // Bundled copy first (instant paint), then freshen from the network.
  const local = await fetch('./data/worldcup2026.json').then(r => r.json());
  return assignNums(local.matches);
}

const ESPN_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

// yesterday..tomorrow as "YYYYMMDD-YYYYMMDD" — catches venue-timezone drift.
function espnDates(now = new Date()) {
  const fmt = d => d.toISOString().slice(0, 10).replaceAll('-', '');
  return `${fmt(new Date(now - 86_400_000))}-${fmt(new Date(+now + 86_400_000))}`;
}

export async function refreshScores(matches) {
  let updated = false;
  // Optional proxy (football-data.org via Supabase edge function).
  if (CONFIG.SCORES_URL) {
    try {
      const fd = await fetch(CONFIG.SCORES_URL).then(r => r.json());
      updated = mergeFootballData(matches, fd) || updated;
    } catch (e) {
      console.warn('scores proxy failed, falling back to openfootball', e);
    }
  }
  // openfootball — full-tournament history, updated ~daily upstream.
  try {
    const fresh = await fetch(OPENFOOTBALL_URL, { cache: 'no-cache' }).then(r => r.json());
    updated = mergeOpenfootball(matches, fresh.matches) || updated;
  } catch (e) {
    console.warn('openfootball refresh failed', e);
  }
  // ESPN — live scores around today; merged last so the freshest source wins.
  try {
    const espn = await fetch(`${ESPN_URL}?dates=${espnDates()}`).then(r => r.json());
    updated = mergeEspn(matches, espn) || updated;
  } catch (e) {
    console.warn('espn scores failed', e);
  }
  return updated;
}

function mergeOpenfootball(matches, fresh) {
  let changed = false;
  assignNums(fresh);
  const byNum = new Map(matches.map(m => [m.num, m]));
  for (const f of fresh) {
    const m = byNum.get(f.num);
    if (!m) continue;
    if (f.score && JSON.stringify(f.score) !== JSON.stringify(m.score)) {
      m.score = f.score;
      changed = true;
    }
    // Knockout slots fill in as groups finish (e.g. "1A" -> "France").
    if (f.team1 !== m.team1 || f.team2 !== m.team2) {
      m.team1 = f.team1; m.team2 = f.team2;
      changed = true;
    }
  }
  return changed;
}

// football-data.org v4 /competitions/WC/matches payload -> our match list.
function mergeFootballData(matches, fd) {
  if (!fd?.matches) return false;
  let changed = false;
  for (const fm of fd.matches) {
    const home = fromFdName(fm.homeTeam?.name);
    const away = fromFdName(fm.awayTeam?.name);
    if (!home || !away) continue;
    const day = (fm.utcDate || '').slice(0, 10);
    const m = matches.find(x =>
      x.team1 === home && x.team2 === away &&
      Math.abs(new Date(x.date) - new Date(day)) <= 86_400_000); // venue-tz date drift
    if (!m) continue;
    const ft = fm.score?.fullTime;
    if (ft && ft.home != null) {
      const score = { ft: [ft.home, ft.away] };
      const et = fm.score?.extraTime;
      const p = fm.score?.penalties;
      // fd extraTime/penalties are period-only; ft already holds the 120' total
      if (fm.score?.duration === 'EXTRA_TIME' || fm.score?.duration === 'PENALTY_SHOOTOUT') {
        score.et = [ft.home, ft.away];
      }
      if (p && p.home != null) score.p = [p.home, p.away];
      if (JSON.stringify(score) !== JSON.stringify(m.score)) {
        m.score = score;
        changed = true;
      }
      if (fm.status === 'IN_PLAY' || fm.status === 'PAUSED') {
        // live: show running score but don't mark finished
        m._live = true;
      } else {
        delete m._live;
      }
    }
  }
  return changed;
}

// ESPN scoreboard payload -> our match list. Display-only merge: writes
// score + _live flag on in-memory matches, never touches stored votes.
function mergeEspn(matches, espn) {
  if (!espn?.events) return false;
  let changed = false;
  for (const ev of espn.events) {
    const comp = ev.competitions?.[0];
    if (!comp?.competitors) continue;
    const hc = comp.competitors.find(c => c.homeAway === 'home');
    const ac = comp.competitors.find(c => c.homeAway === 'away');
    const home = fromFdName(hc?.team?.displayName);
    const away = fromFdName(ac?.team?.displayName);
    if (!home || !away) continue;
    const day = (ev.date || '').slice(0, 10);
    const m = matches.find(x =>
      x.team1 === home && x.team2 === away &&
      Math.abs(new Date(x.date) - new Date(day)) <= 86_400_000); // venue-tz date drift
    if (!m) continue;
    const st = comp.status?.type?.state; // 'pre' | 'in' | 'post'
    if (st !== 'in' && st !== 'post') continue;
    const h = Number(hc.score), a = Number(ac.score);
    if (!Number.isFinite(h) || !Number.isFinite(a)) continue;
    const score = { ft: [h, a] };
    if ((comp.status?.period ?? 0) > 2) score.et = [h, a]; // periods 3+4 = extra time
    const sh = Number(hc.shootoutScore), sa = Number(ac.shootoutScore);
    if (Number.isFinite(sh) && Number.isFinite(sa) && sh + sa > 0) score.p = [sh, sa];
    if (JSON.stringify(score) !== JSON.stringify(m.score)) {
      m.score = score;
      changed = true;
    }
    const live = st === 'in';
    if (live !== Boolean(m._live)) changed = true;
    if (live) m._live = true; else delete m._live;
  }
  return changed;
}

// Group standings from finished matches. FIFA rules subset: pts, GD, GF.
export function standings(matches, group) {
  const rows = new Map();
  const ensure = t => {
    if (!rows.has(t)) rows.set(t, { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    return rows.get(t);
  };
  for (const m of matches) {
    if (m.group !== group) continue;
    ensure(m.team1); ensure(m.team2);
    const g = goals(m);
    if (!g) continue;
    const a = rows.get(m.team1), b = rows.get(m.team2);
    a.p++; b.p++;
    a.gf += g.home; a.ga += g.away;
    b.gf += g.away; b.ga += g.home;
    if (g.home > g.away)      { a.w++; b.l++; a.pts += 3; }
    else if (g.home < g.away) { b.w++; a.l++; b.pts += 3; }
    else                      { a.d++; b.d++; a.pts++; b.pts++; }
  }
  return [...rows.values()].sort((x, y) =>
    y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.team.localeCompare(y.team));
}
