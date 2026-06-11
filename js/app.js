import { CONFIG } from './config.js';
import { flag } from './teams.js';
import {
  loadSchedule, refreshScores, kickoff, status, votingOpen, placeholder,
  isMatchday, isKnockout, goals, outcome, standings, KO_ROUNDS,
} from './data.js';
import {
  online, playerName, setPlayerName, fetchVotes, castVote, playersFrom,
} from './votes.js';

const $ = sel => document.querySelector(sel);

const state = {
  matches: [],
  votes: {},        // "num:player" -> pick
  view: 'matches',
  now: new Date(),
};

/* ---------- helpers ---------- */

const GROUPS = 'ABCDEFGHIJKL'.split('').map(c => `Group ${c}`);

function slotLabel(slot) {
  let m = slot.match(/^(\d)([A-L])$/);
  if (m) return `${['1st', '2nd', '3rd'][m[1] - 1]} ${m[2]}`;
  m = slot.match(/^W(\d+)$/);
  if (m) return `Winner ${m[1]}`;
  m = slot.match(/^L(\d+)$/);
  if (m) return `Loser ${m[1]}`;
  m = slot.match(/^3([A-L/]+)$/);
  if (m) return `3rd ${m[1]}`;
  return slot;
}

function teamLabel(name) {
  return placeholderName(name) ? slotLabel(name) : name;
}
function placeholderName(name) {
  return /^([WL]\d+|\d[A-L])$|\//.test(name);
}

function fmtTime(m) {
  return kickoff(m).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDay(d) {
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function myPick(m) {
  return state.votes[`${m.num}:${playerName()}`] ?? null;
}

function votesFor(m) {
  const out = { 1: [], X: [], 2: [] };
  const prefix = `${m.num}:`;
  for (const [key, pick] of Object.entries(state.votes)) {
    if (key.startsWith(prefix)) out[pick]?.push(key.slice(prefix.length));
  }
  return out;
}

/* ---------- scoring ---------- */

function leaderboard() {
  const players = playersFrom(state.votes);
  const rows = players.map(p => ({ player: p, pts: 0, hit: 0, played: 0 }));
  const byName = new Map(rows.map(r => [r.player, r]));
  for (const m of state.matches) {
    const res = outcome(m);
    if (!res || m._live) continue;
    for (const p of players) {
      const pick = state.votes[`${m.num}:${p}`];
      if (!pick) continue;
      const row = byName.get(p);
      row.played++;
      if (pick === res) {
        row.hit++;
        row.pts += isKnockout(m) ? CONFIG.POINTS_KO : CONFIG.POINTS_GROUP;
      }
    }
  }
  return rows.sort((a, b) => b.pts - a.pts || b.hit - a.hit || a.player.localeCompare(b.player));
}

/* ---------- rendering ---------- */

function render() {
  state.now = new Date();
  $('#player-chip').textContent = playerName() || 'SET NAME';
  $('#mode-banner').hidden = online();
  const view = {
    matches: renderMatches,
    groups: renderGroups,
    knockout: renderKnockout,
    board: renderBoard,
  }[state.view];
  $('#view').innerHTML = view();
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === state.view));
  if (state.view === 'matches' && !state.autoScrolled) {
    state.autoScrolled = true;
    document.querySelector('.day-today')?.scrollIntoView({ block: 'start' });
  }
}

function matchCard(m) {
  const st = m._live ? 'live' : status(m, state.now);
  const g = goals(m);
  const open = votingOpen(m, state.now);
  const mine = myPick(m);
  const res = outcome(m);
  const ko = isKnockout(m);
  const picks = votesFor(m);
  const locked = !open;

  const opts = ko ? ['1', '2'] : ['1', 'X', '2'];
  const voteBtns = opts.map(o => {
    const names = picks[o];
    const isMine = mine === o;
    const cls = [
      'vote-btn',
      isMine ? 'mine' : '',
      locked && res ? (o === res ? 'hit' : isMine ? 'miss' : '') : '',
    ].join(' ');
    const label = o === '1' ? (ko ? teamShort(m.team1) : '1')
                : o === '2' ? (ko ? teamShort(m.team2) : '2') : 'X';
    // Counts stay hidden until kickoff — fully blind voting.
    const count = locked && names.length ? `<span class="vcount">${names.length}</span>` : '';
    return `<button class="${cls}" data-vote="${o}" data-num="${m.num}"
      ${locked || placeholder(m) ? 'disabled' : ''}>${label}${count}</button>`;
  }).join('');

  // Friends' picks revealed once voting locks.
  const reveal = locked && Object.values(picks).some(a => a.length)
    ? `<div class="picks-line">${opts.filter(o => picks[o].length)
        .map(o => `<span class="pick-tag">${o === 'X' ? 'X' : o === '1' ? teamShort(m.team1) : teamShort(m.team2)}: ${picks[o].map(esc).join(', ')}</span>`)
        .join(' ')}</div>`
    : '';

  const score = g
    ? `<div class="score">${g.home}<span class="sep">:</span>${g.away}${g.pens ? `<span class="pens">(${g.pens[0]}–${g.pens[1]} p)</span>` : ''}</div>`
    : `<div class="score ko-time">${fmtTime(m)}</div>`;

  const badge = st === 'live' || m._live
    ? '<span class="badge live">● LIVE</span>'
    : st === 'finished' && g ? '<span class="badge ft">FT</span>'
    : `<span class="badge num">M${m.num}</span>`;

  // Future matchdays: voting not open yet — show when it unlocks instead of buttons.
  const future = kickoff(m) > state.now && !isMatchday(m, state.now);
  const voteArea = future
    ? `<div class="vote-locked">⏳ VOTING OPENS ${kickoff(m)
        .toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()}</div>`
    : `<div class="vote-row">${voteBtns}</div>${reveal}`;

  return `
  <article class="match ${st}" id="m${m.num}">
    <div class="match-meta">
      ${badge}
      <span class="meta-text">${m.group ? m.group.replace('Group ', 'GRP ') : esc(m.round)} · ${esc(m.ground)}</span>
    </div>
    <div class="match-row">
      <div class="team home"><span class="flag">${flag(m.team1)}</span><span class="tname">${esc(teamLabel(m.team1))}</span></div>
      ${score}
      <div class="team away"><span class="tname">${esc(teamLabel(m.team2))}</span><span class="flag">${flag(m.team2)}</span></div>
    </div>
    ${voteArea}
  </article>`;
}

function teamShort(name) {
  if (placeholderName(name)) return slotLabel(name);
  const map = { 'Bosnia & Herzegovina': 'Bosnia', 'Czech Republic': 'Czechia', 'South Africa': 'S. Africa', 'South Korea': 'S. Korea', 'Saudi Arabia': 'Saudi A.', 'New Zealand': 'N. Zealand', 'Ivory Coast': 'Ivory C.' };
  return map[name] ?? name;
}

function renderMatches() {
  const days = new Map();
  const sorted = [...state.matches].sort((a, b) => kickoff(a) - kickoff(b));
  for (const m of sorted) {
    const key = kickoff(m).toDateString();
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(m);
  }
  const todayKey = state.now.toDateString();
  let html = '';
  for (const [key, ms] of days) {
    const d = new Date(key);
    const isToday = key === todayKey;
    html += `<section class="day ${isToday ? 'day-today' : ''}">
      <h2 class="day-head">${isToday ? '<span class="today-tag">TODAY</span>' : ''}${fmtDay(d)}</h2>
      ${ms.map(matchCard).join('')}
    </section>`;
  }
  return html;
}

function renderGroups() {
  return `<div class="groups-grid">` + GROUPS.map(gr => {
    const rows = standings(state.matches, gr);
    return `<section class="group-card">
      <h2 class="group-head">${gr.toUpperCase()}</h2>
      <table class="gtable">
        <thead><tr><th></th><th class="tl">TEAM</th><th>P</th><th>GD</th><th>PTS</th></tr></thead>
        <tbody>${rows.map((r, i) => `
          <tr class="${i < 2 ? 'qual' : i === 2 ? 'maybe' : ''}">
            <td>${i + 1}</td>
            <td class="tl">${flag(r.team)} ${esc(teamShort(r.team))}</td>
            <td>${r.p}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>
            <td class="pts">${r.pts}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </section>`;
  }).join('') + `</div>`;
}

function renderKnockout() {
  return KO_ROUNDS.map(round => {
    const ms = state.matches.filter(m => m.round === round)
      .sort((a, b) => kickoff(a) - kickoff(b));
    if (!ms.length) return '';
    return `<section class="ko-round">
      <h2 class="day-head">${esc(round.toUpperCase())}</h2>
      ${ms.map(matchCard).join('')}
    </section>`;
  }).join('');
}

function renderBoard() {
  const rows = leaderboard();
  if (!rows.length) {
    return `<div class="empty">No players yet. Vote on a match to enter the arena.</div>`;
  }
  const medals = ['🥇', '🥈', '🥉'];
  return `<table class="board">
    <thead><tr><th>#</th><th class="tl">PLAYER</th><th>HITS</th><th>PTS</th></tr></thead>
    <tbody>${rows.map((r, i) => `
      <tr class="${r.player === playerName() ? 'me' : ''}">
        <td>${medals[i] ?? i + 1}</td>
        <td class="tl">${esc(r.player)}</td>
        <td>${r.hit}/${r.played}</td>
        <td class="pts">${r.pts}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <p class="board-note">${CONFIG.POINTS_GROUP} pts per correct pick · scores settle at full time</p>`;
}

/* ---------- name modal ---------- */

function askName(force = false) {
  if (playerName() && !force) return;
  $('#name-modal').hidden = false;
  const input = $('#name-input');
  input.value = playerName();
  setTimeout(() => input.focus(), 50);
}

function saveName() {
  const v = $('#name-input').value.trim();
  if (!v) return;
  setPlayerName(v);
  $('#name-modal').hidden = true;
  render();
}

/* ---------- events ---------- */

document.addEventListener('click', async e => {
  const tab = e.target.closest('.tab');
  if (tab) { state.view = tab.dataset.view; render(); return; }

  if (e.target.closest('#player-chip')) { askName(true); return; }
  if (e.target.closest('#name-save')) { saveName(); return; }

  const btn = e.target.closest('.vote-btn');
  if (btn && !btn.disabled) {
    if (!playerName()) { askName(); return; }
    const num = Number(btn.dataset.num);
    const pick = btn.dataset.vote;
    const key = `${num}:${playerName()}`;
    const prev = state.votes[key];
    state.votes[key] = pick;          // optimistic
    render();
    try {
      await castVote(num, playerName(), pick);
    } catch (err) {
      console.error(err);
      if (prev) state.votes[key] = prev; else delete state.votes[key];
      render();
      toast('Vote failed — check connection');
    }
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !$('#name-modal').hidden) saveName();
});

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ---------- boot ---------- */

async function boot() {
  state.matches = await loadSchedule();
  render();
  askName();
  try { state.votes = await fetchVotes(); } catch (e) { console.warn(e); }
  refreshScores(state.matches).then(() => render());
  render();
  setInterval(async () => {
    try {
      const [votes] = await Promise.all([fetchVotes(), refreshScores(state.matches)]);
      state.votes = votes;
      render();
    } catch (e) { console.warn('refresh failed', e); }
  }, CONFIG.REFRESH_MS);
}

boot();
