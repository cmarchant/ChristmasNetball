"use strict";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ================= Tournament data ================= */
const TEAMS = {
  JB: { name: "Jingle Ballers", icon: "bell" },
  SS: { name: "Santa's Shooters", icon: "hat" },
  NC: { name: "Nutcrackers", icon: "tree" },
  RR: { name: "Reindeer Rebels", icon: "deer" },
};
const KEYS = ["JB", "SS", "NC", "RR"];

const LEAGUE = [
  { n: 1, round: "1A", a: "JB", b: "SS" },
  { n: 2, round: "1A", a: "NC", b: "RR" },
  { n: 3, round: "1B", a: "JB", b: "NC" },
  { n: 4, round: "1B", a: "SS", b: "RR" },
  { n: 5, round: "1C", a: "JB", b: "RR" },
  { n: 6, round: "1C", a: "SS", b: "NC" },
  { n: 7, round: "2A", a: "RR", b: "NC" },
  { n: 8, round: "2A", a: "SS", b: "JB" },
  { n: 9, round: "2B", a: "RR", b: "SS" },
  { n: 10, round: "2B", a: "NC", b: "JB" },
  { n: 11, round: "2C", a: "NC", b: "SS" },
  { n: 12, round: "2C", a: "RR", b: "JB" },
];
const FINALS = [
  { n: 13, name: "Third-place playoff", seeds: [3, 4] },
  { n: 14, name: "Grand Final", seeds: [1, 2] },
];
const ROUNDS = [...new Set(LEAGUE.map(g => g.round))];

/* ================= Rules ================= */
// Win 5, draw 3, a loss scoring more than half the winner's goals 1, any other loss 0.
function points(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) return 5;
  if (goalsFor === goalsAgainst) return 3;
  return goalsFor * 2 > goalsAgainst ? 1 : 0;
}

/* ================= State ================= */
const STORE_KEY = "festive-netball-v1";
let state = { scores: {}, golden: {} }; // scores[n] = [a, b]; golden[n] = 0 | 1 (finals only)

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      state = { scores: s.scores || {}, golden: s.golden || {} };
    }
  } catch (_) { /* private mode: start empty */ }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
}
const result = n => state.scores[n] || null;
const playedCount = () => [...LEAGUE, ...FINALS].filter(g => result(g.n)).length;
const leagueDone = () => LEAGUE.every(g => result(g.n));

/* ================= Standings ================= */
function standings() {
  const rows = Object.fromEntries(KEYS.map(k => [k, { key: k, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0, form: [], left: 0 }]));
  for (const g of LEAGUE) {
    const r = result(g.n);
    if (!r) { rows[g.a].left++; rows[g.b].left++; continue; }
    [[g.a, r[0], r[1]], [g.b, r[1], r[0]]].forEach(([k, f, a]) => {
      const row = rows[k];
      row.P++; row.GF += f; row.GA += a; row.Pts += points(f, a);
      if (f > a) { row.W++; row.form.push("W"); }
      else if (f === a) { row.D++; row.form.push("D"); }
      else { row.L++; row.form.push("L"); }
    });
  }
  const list = Object.values(rows).map(r => ({ ...r, GD: r.GF - r.GA }));
  list.sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || TEAMS[x.key].name.localeCompare(TEAMS[y.key].name));
  // Positions, sharing a place when level on everything
  list.forEach((r, i) => {
    const prev = list[i - 1];
    r.pos = prev && prev.Pts === r.Pts && prev.GD === r.GD && prev.GF === r.GF ? prev.pos : i + 1;
  });
  list.forEach(r => { r.tied = list.some(o => o !== r && o.pos === r.pos); });
  // Grand Final race on points alone (safe in both directions).
  list.forEach(r => {
    const max = r.Pts + 5 * r.left;
    const couldCatch = list.filter(o => o !== r && o.Pts + 5 * o.left >= r.Pts).length;
    const alreadyAbove = list.filter(o => o !== r && o.Pts > max).length;
    if (leagueDone()) r.race = list.indexOf(r) < 2 ? "in" : "out";
    else if (couldCatch < 2) r.race = "in";
    else if (alreadyAbove >= 2) r.race = "out";
    else r.race = "hunt";
  });
  return list;
}

function finalists() {
  if (!leagueDone()) return null;
  const t = standings();
  return { 13: [t[2].key, t[3].key], 14: [t[0].key, t[1].key] };
}
function finalWinner(n, teams) {
  const r = result(n);
  if (!r || !teams) return null;
  if (r[0] > r[1]) return 0;
  if (r[1] > r[0]) return 1;
  return state.golden[n] ?? null;
}
function placings() {
  const f = finalists();
  if (!f) return [null, null, null, null];
  const out = [null, null, null, null];
  const w14 = finalWinner(14, f[14]);
  if (w14 !== null) { out[0] = f[14][w14]; out[1] = f[14][1 - w14]; }
  const w13 = finalWinner(13, f[13]);
  if (w13 !== null) { out[2] = f[13][w13]; out[3] = f[13][1 - w13]; }
  return out;
}

/* ================= Helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const crest = (k, cls = "crest") => `<svg class="${cls}" aria-hidden="true"><use href="#${TEAMS[k].icon}"/></svg>`;
const ptsLabel = p => (p === 1 ? "1 pt" : `${p} pts`);
function teamsFor(n) {
  const g = LEAGUE.find(x => x.n === n);
  if (g) return [g.a, g.b];
  const f = finalists();
  return f ? f[n] : null;
}
function nextGame() {
  const g = LEAGUE.find(x => !result(x.n));
  if (g) return g.n;
  const f = finalists();
  if (!f) return null;
  return [13, 14].find(n => !result(n)) ?? null;
}

/* ================= Rendering ================= */
function matchCard(n, opts = {}) {
  const teams = teamsFor(n);
  const r = result(n);
  const isNext = nextGame() === n;
  const locked = !teams;
  const fin = FINALS.find(f => f.n === n);
  let lines;
  if (teams) {
    const w = fin ? finalWinner(n, teams) : null;
    lines = teams.map((k, i) => {
      const f = r ? r[i] : null, a = r ? r[1 - i] : null;
      const lost = r && (fin ? w !== null && w !== i : f < a);
      const p = r && !fin ? points(f, a) : null;
      const chip = fin ? "" : `<span class="ptschip ${p === null ? "blank" : "p" + p}">${p === null ? "–" : p}</span>`;
      const seed = fin ? `<span class="seed">${ordinal(fin.seeds[i])} in league</span>` : "";
      return `<div class="line${lost ? " lost" : ""}"${fin ? ' style="grid-template-columns:28px minmax(0,1fr) auto"' : ""}>${crest(k)}<span class="tname">${seed}${esc(TEAMS[k].name)}</span><span class="goals${r ? "" : " empty"}">${r ? f : "–"}</span>${chip}</div>`;
    }).join("");
  } else {
    lines = fin.seeds.map(s => `<div class="line" style="grid-template-columns:28px minmax(0,1fr) auto"><svg class="crest" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#DAD4C4" stroke-width="2" stroke-dasharray="3 3"/></svg><span class="tname" style="color:var(--muted)">${ordinal(s)} in league${opts.provisional ? `<span class="seed">Right now: ${esc(TEAMS[opts.provisional[s - 1]].name)}</span>` : ""}</span><span class="goals empty">–</span></div>`).join("");
  }
  const pill = r ? `<span class="pill played-pill">Final score</span>` : isNext ? `<span class="pill next-pill">Next up</span>` : locked ? `<span class="pill">After the league</span>` : `<span class="pill">To play</span>`;
  const ggNote = fin && r && r[0] === r[1] && state.golden[n] !== undefined ? `<span class="gg-note">Won with a golden goal</span>` : "";
  const hint = locked ? "" : `<span class="tap-hint">${r ? "Tap to change" : "Tap to enter the score"}</span>`;
  const title = fin ? `<span class="final-name">${fin.name}</span>` : "";
  const label = teams ? `Game ${n}: ${TEAMS[teams[0]].name} v ${TEAMS[teams[1]].name}${r ? `, ${r[0]}–${r[1]}` : ""}` : `Game ${n}, ${fin.name}`;
  const tag = locked ? "div" : "button";
  return `<${tag} ${locked ? "" : 'type="button"'} class="match${r ? " played" : ""}${isNext ? " is-next" : ""}${locked ? " locked" : ""}${n === 14 ? " grand" : ""}" data-game="${n}" aria-label="${esc(label)}">
    <div class="match-top"><span class="gno">Game ${n}</span>${pill}</div>${title}${lines}${ggNote}${hint}</${tag}>`;
}
const ordinal = n => ["", "1st", "2nd", "3rd", "4th"][n];

function renderHero() {
  const played = playedCount();
  $("#played-count").textContent = played;
  $("#progress-fill").style.width = `${(played / 14) * 100}%`;
  const btn = $("#next-game");
  const n = nextGame();
  const champ = placings()[0];
  btn.classList.toggle("done", !n);
  if (champ) {
    btn.innerHTML = `<small>Champions</small><b>${esc(TEAMS[champ].name)}</b>`;
    btn.dataset.go = "finals";
  } else if (n) {
    const t = teamsFor(n);
    btn.innerHTML = `<small>Next up · Game ${n}</small><b>${esc(TEAMS[t[0]].name)} v ${esc(TEAMS[t[1]].name)}</b>`;
    btn.dataset.go = "";
  } else {
    btn.innerHTML = `<small>All games scored</small><b>See the finals</b>`;
    btn.dataset.go = "finals";
  }
}

function renderGames() {
  const big = [...new Set(ROUNDS.map(r => r[0]))];
  $("#rounds").innerHTML = big.map(b => {
    const parts = ROUNDS.filter(r => r[0] === b);
    const roundGames = LEAGUE.filter(g => g.round[0] === b);
    const playedHere = roundGames.filter(g => result(g.n)).length;
    return `<section class="round"><div class="round-title"><h2>Round ${b}</h2><span>${playedHere} of ${roundGames.length} played</span></div>
      <div class="parts">${parts.map(part => {
        const games = LEAGUE.filter(g => g.round === part);
        const done = games.every(g => result(g.n));
        return `<div class="part"><div class="round-head"><h3>Round ${part}</h3><span>Games ${games.map(g => g.n).join(" &amp; ")}</span>${done ? '<span class="round-done">✓ Played</span>' : ""}</div>
          <div class="cards">${games.map(g => matchCard(g.n)).join("")}</div></div>`;
      }).join("")}</div></section>`;
  }).join("");
}

function renderTable() {
  const rows = standings();
  const done = leagueDone();
  const statusText = { in: "Grand Final", out: "Playoff", hunt: "In the hunt" };
  $("#league").innerHTML = `<thead><tr><th>Pos</th><th class="left">Team</th><th>P</th><th class="hide-sm">W</th><th class="hide-sm">D</th><th class="hide-sm">L</th><th class="hide-sm">GF</th><th class="hide-sm">GA</th><th>GD</th><th>Pts</th><th class="left hide-sm">Form</th><th class="left hide-sm">${done ? "Into" : "Final race"}</th></tr></thead><tbody>` +
    rows.map((r, i) => `<tr class="${i < 2 ? "zone-final" : "zone-playoff"}">
      <td class="pos">${r.tied ? "=" : ""}${r.pos}</td>
      <td class="left"><div class="teamcell">${crest(r.key)}<span>${esc(TEAMS[r.key].name)}<span class="sm-only sub"><span class="status ${r.race}">${statusText[r.race]}</span> <span class="wdl">W${r.W} D${r.D} L${r.L}</span></span></span></div></td>
      <td>${r.P}</td><td class="hide-sm">${r.W}</td><td class="hide-sm">${r.D}</td><td class="hide-sm">${r.L}</td><td class="hide-sm">${r.GF}</td><td class="hide-sm">${r.GA}</td><td>${r.GD > 0 ? "+" : ""}${r.GD}</td>
      <td class="ptscol">${r.Pts}</td>
      <td class="left hide-sm"><span class="form">${[...r.form.slice(-6), ...Array(Math.max(0, 6 - r.form.length)).fill("N")].map(f => `<i class="${f}" title="${{ W: "Won", D: "Drew", L: "Lost", N: "Not played" }[f]}">${f === "N" ? "" : f}</i>`).join("")}</span></td>
      <td class="left hide-sm"><span class="status ${r.race}">${statusText[r.race]}</span></td></tr>`).join("") + `</tbody>`;
}

function renderVersus() {
  const rows = standings();
  const byKey = Object.fromEntries(rows.map(r => [r.key, r]));
  const head = `<thead><tr><th class="left">Team</th>${KEYS.map(k => `<th class="opp">${crest(k)}<br>v ${esc(TEAMS[k].name)}</th>`).join("")}</tr></thead>`;
  const body = KEYS.map(k => `<tr><td class="rowhead"><div>${crest(k)}${esc(TEAMS[k].name)}</div></td>${KEYS.map(o => {
    if (o === k) return `<td class="self"></td>`;
    const meets = LEAGUE.filter(g => (g.a === k && g.b === o) || (g.a === o && g.b === k));
    let total = 0, any = false;
    const btns = meets.map(g => {
      const r = result(g.n);
      if (!r) return `<button type="button" data-game="${g.n}"><span>–</span><small>G${g.n}</small></button>`;
      any = true;
      const mine = g.a === k ? r[0] : r[1], theirs = g.a === k ? r[1] : r[0];
      total += points(mine, theirs);
      const res = mine > theirs ? "W" : mine === theirs ? "D" : "L";
      return `<button type="button" class="${res}" data-game="${g.n}" aria-label="Game ${g.n}: ${mine}–${theirs}"><span>${mine}–${theirs}</span><small>G${g.n}</small></button>`;
    }).join("");
    return `<td><div class="h2h">${btns}<span class="h2h-total">${any ? `${ptsLabel(total)} from these` : "Not played yet"}</span></div></td>`;
  }).join("")}</tr>`).join("");
  $("#versus").innerHTML = head + `<tbody>${body}</tbody>`;

  $("#team-cards").innerHTML = KEYS.map(k => {
    const r = byKey[k];
    // Best and toughest opponent by points taken from them
    const vs = KEYS.filter(o => o !== k).map(o => {
      let p = 0, n = 0;
      LEAGUE.forEach(g => {
        if (!((g.a === k && g.b === o) || (g.a === o && g.b === k))) return;
        const res = result(g.n); if (!res) return;
        n++; p += g.a === k ? points(res[0], res[1]) : points(res[1], res[0]);
      });
      return { o, p, n };
    });
    const rowsVs = vs.map(({ o, p, n }) => {
      const meets = LEAGUE.filter(g => (g.a === k && g.b === o) || (g.a === o && g.b === k)).map(g => {
        const res = result(g.n);
        if (!res) return `<button type="button" data-game="${g.n}"><span>–</span><small>G${g.n}</small></button>`;
        const mine = g.a === k ? res[0] : res[1], theirs = g.a === k ? res[1] : res[0];
        const c = mine > theirs ? "W" : mine === theirs ? "D" : "L";
        return `<button type="button" class="${c}" data-game="${g.n}" aria-label="Game ${g.n}: ${mine}–${theirs}"><span>${mine}–${theirs}</span><small>G${g.n}</small></button>`;
      }).join("");
      return `<div class="vs-row"><span class="vs-name">v ${crest(o)}${esc(TEAMS[o].name)}</span><span class="h2h">${meets}</span><span class="vs-pts">${n ? ptsLabel(p) : ""}</span></div>`;
    }).join("");
    const played = vs.filter(x => x.n);
    let note = "No games played yet.";
    if (played.length) {
      const best = [...played].sort((a, b) => b.p - a.p)[0];
      const worst = [...played].sort((a, b) => a.p - b.p)[0];
      note = best.o === worst.o ? `${ptsLabel(best.p)} against ${TEAMS[best.o].name} so far.`
        : `Best against ${TEAMS[best.o].name} (${ptsLabel(best.p)}). Toughest: ${TEAMS[worst.o].name} (${ptsLabel(worst.p)}).`;
    }
    return `<article class="team-card"><header>${crest(k)}<div><h3>${esc(TEAMS[k].name)}</h3><p>${r.tied ? "=" : ""}${ordinal(r.pos)} · ${r.P} of 6 played</p></div></header>
      <dl><div><dt>Pts</dt><dd>${r.Pts}</dd></div><div><dt>Goals</dt><dd>${r.GF}</dd></div><div><dt>GD</dt><dd>${r.GD > 0 ? "+" : ""}${r.GD}</dd></div></dl>
      <div class="vs-list sm-only">${rowsVs}</div>
      <p class="best">${esc(note)}</p></article>`;
  }).join("");
}

function renderFinals() {
  const done = leagueDone();
  const provisional = done ? null : standings().map(r => r.key);
  const left = LEAGUE.filter(g => !result(g.n)).length;
  $("#finals-note").textContent = done
    ? "The league is finished, so the finals are set. Level at full time? Golden goal: the next goal wins."
    : `The finals fill in once all 12 league games are scored (${left} to go). Level at full time? Golden goal: the next goal wins.`;
  $("#finals").innerHTML = FINALS.map(f => matchCard(f.n, { provisional })).join("");

  const pl = placings();
  const medals = [
    ["#E2B13C", "#8A6414", "#5A3F0A", "#B3242F"],
    ["#CBD3D0", "#7D8985", "#3E4744", "#1F5A41"],
    ["#C98A5A", "#7A4A26", "#4A2A12", "#B3242F"],
    ["#EEF4F1", "#1F5A41", "#1F5A41", "#1F5A41"],
  ];
  const titles = ["Champions", "Runners-up", "Third place", "Fourth place"];
  const order = [1, 0, 2, 3]; // silver, gold, bronze, fourth on wide screens
  const champ = pl[0] ? `<p class="champ-banner">${esc(TEAMS[pl[0]].name)} are the champions!</p>` : "";
  $("#podium").innerHTML = order.map(i => {
    const [fill, stroke, txt, ribbon] = medals[i];
    const who = pl[i];
    return `<div class="place p${i + 1}"><div class="block">
      <svg class="medal" viewBox="0 0 40 50" aria-hidden="true"><path d="M10 0h8l4 16h-8zM30 0h-8l-4 16h8z" fill="${ribbon}"/><circle cx="20" cy="32" r="15" fill="${fill}" stroke="${stroke}" stroke-width="2"/><text x="20" y="38" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="16" fill="${txt}">${i + 1}</text></svg>
      <b>${titles[i]}</b>
      <div class="who${who ? "" : " tbc"}">${who ? crest(who) + esc(TEAMS[who].name) : "To be decided"}</div></div></div>`;
  }).join("");
  const panel = document.querySelector(".podium-panel");
  panel.querySelector(".champ-banner")?.remove();
  if (champ) panel.querySelector(".panel-head").insertAdjacentHTML("afterend", champ);
}

function render() {
  renderHero();
  renderGames();
  renderTable();
  renderVersus();
  renderFinals();
}

/* ================= Tabs ================= */
const TABS = ["games", "table", "versus", "finals"];
function showTab(name, scroll) {
  if (!TABS.includes(name)) name = "games";
  TABS.forEach(t => {
    $(`#view-${t}`).hidden = t !== name;
    const a = document.querySelector(`.tabs a[data-tab="${t}"]`);
    if (t === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
  if (scroll) {
    const phone = matchMedia("(max-width: 620px)").matches;
    const top = phone ? document.querySelector("main").getBoundingClientRect().top + scrollY - 12 : document.querySelector(".tabs").getBoundingClientRect().top + scrollY - 8;
    if (scrollY > top) scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
  }
}
window.addEventListener("hashchange", () => {
  const h = location.hash.slice(1);
  if (TABS.includes(h)) showTab(h, true);
});

/* ================= Score dialog ================= */
const dlg = $("#score-dialog");
let editing = null; // { n, teams, vals: [a, b], golden }

function openScore(n) {
  const teams = teamsFor(n);
  if (!teams) return;
  const r = result(n);
  const fin = FINALS.find(f => f.n === n);
  editing = { n, teams, fin, vals: r ? [...r] : [0, 0], golden: state.golden[n] };
  $("#sd-round").textContent = fin ? `Game ${n}` : `Round ${LEAGUE.find(g => g.n === n).round} · Game ${n}`;
  $("#sd-title").textContent = fin ? fin.name : "Enter the score";
  dlg.querySelectorAll(".sd-team").forEach((el, i) => {
    const k = teams[i];
    el.innerHTML = `${crest(k)}<span class="nm">${esc(TEAMS[k].name)}</span>
      <div class="stepper"><button type="button" class="minus" data-step="-1" aria-label="One fewer goal for ${esc(TEAMS[k].name)}">−</button>
      <input id="goals-${i}" type="number" inputmode="numeric" min="0" max="199" aria-label="${esc(TEAMS[k].name)} goals">
      <button type="button" class="plus" data-step="1" aria-label="One more goal for ${esc(TEAMS[k].name)}">+</button></div>
      <span class="pts-preview"></span>`;
    el.querySelector("input").value = editing.vals[i];
  });
  $("#sd-clear").hidden = !r;
  $("#sd-golden .gg-buttons").innerHTML = teams.map((k, i) => `<button type="button" data-gg="${i}" aria-pressed="false">${esc(TEAMS[k].name)}</button>`).join("");
  updatePreview();
  dlg.showModal();
}

function updatePreview() {
  const { vals, teams, fin } = editing;
  const [a, b] = vals;
  dlg.querySelectorAll(".sd-team").forEach((el, i) => {
    const pv = el.querySelector(".pts-preview");
    if (fin) { pv.textContent = ""; return; }
    const p = points(vals[i], vals[1 - i]);
    pv.textContent = ptsLabel(p);
    pv.className = `pts-preview p${p}`;
  });
  const level = a === b;
  const golden = $("#sd-golden");
  golden.hidden = !(fin && level);
  golden.querySelectorAll("button").forEach(btn => btn.setAttribute("aria-pressed", String(Number(btn.dataset.gg) === editing.golden)));
  let text;
  if (fin) {
    if (!level) text = `${TEAMS[teams[a > b ? 0 : 1]].name} win${fin.n === 14 ? " the tournament!" : " third place"}`;
    else text = editing.golden === undefined ? "Finals can't end level. Pick the golden goal scorer." : `${TEAMS[teams[editing.golden]].name} win with a golden goal`;
  } else if (level) text = "A draw: 3 points each";
  else {
    const w = a > b ? 0 : 1;
    const lp = points(vals[1 - w], vals[w]);
    text = `${TEAMS[teams[w]].name} win. ${TEAMS[teams[1 - w]].name} ${lp ? "get a bonus point for scoring more than half" : "get no points"}.`;
  }
  $("#sd-outcome").textContent = text;
  $("#sd-save").disabled = Boolean(fin && level && editing.golden === undefined);
}

dlg.addEventListener("click", e => {
  const step = e.target.closest("[data-step]");
  if (step) {
    const i = Number(step.closest(".sd-team").dataset.side);
    editing.vals[i] = Math.max(0, Math.min(199, editing.vals[i] + Number(step.dataset.step)));
    dlg.querySelector(`#goals-${i}`).value = editing.vals[i];
    updatePreview();
    return;
  }
  const gg = e.target.closest("[data-gg]");
  if (gg) { editing.golden = Number(gg.dataset.gg); updatePreview(); return; }
  if (e.target === dlg) dlg.close(); // tap outside
});
dlg.addEventListener("input", e => {
  if (e.target.matches("input[type=number]")) {
    const i = Number(e.target.closest(".sd-team").dataset.side);
    const v = parseInt(e.target.value, 10);
    editing.vals[i] = Number.isFinite(v) ? Math.max(0, Math.min(199, v)) : 0;
    updatePreview();
  }
});
dlg.addEventListener("focusin", e => { if (e.target.matches("input[type=number]")) e.target.select(); });
$("#sd-cancel").addEventListener("click", () => dlg.close());
$("#score-form").addEventListener("submit", e => {
  e.preventDefault();
  const { n, vals, fin } = editing;
  const champBefore = placings()[0];
  state.scores[n] = [...vals];
  if (fin && vals[0] === vals[1]) state.golden[n] = editing.golden; else delete state.golden[n];
  // Changing a league score after the finals were played could change who is in them.
  if (!fin && (result(13) || result(14))) toast("League score changed. Check the finals still have the right teams.");
  save();
  dlg.close();
  render();
  const champ = placings()[0];
  if (champ && champ !== champBefore) { celebrate(); toast(`${TEAMS[champ].name} are the champions!`); showTab("finals", true); }
  else if (!fin && leagueDone() && LEAGUE.filter(g => result(g.n)).length === 12 && !result(13)) { toast("League finished! The finals are set."); }
  else toast(`Game ${n} saved`);
});
$("#sd-clear").addEventListener("click", () => {
  delete state.scores[editing.n];
  delete state.golden[editing.n];
  save(); dlg.close(); render();
  toast(`Game ${editing.n} cleared`);
});

/* ================= Clicks on cards ================= */
document.addEventListener("click", e => {
  const card = e.target.closest("button[data-game]");
  if (card && !dlg.open) { openScore(Number(card.dataset.game)); return; }
});
$("#next-game").addEventListener("click", () => {
  const go = $("#next-game").dataset.go;
  if (go) { location.hash = go; showTab(go, true); return; }
  const n = nextGame();
  if (n) openScore(n);
});

/* ================= Share & reset ================= */
function encode() {
  return [...LEAGUE, ...FINALS].map(g => {
    const r = result(g.n);
    if (!r) return "";
    return `${r[0]}-${r[1]}${state.golden[g.n] !== undefined ? "g" + state.golden[g.n] : ""}`;
  }).join(".").replace(/\.+$/, "");
}
function decode(str) {
  const out = { scores: {}, golden: {} };
  const parts = str.split(".");
  [...LEAGUE, ...FINALS].forEach((g, i) => {
    const m = /^(\d{1,3})-(\d{1,3})(?:g([01]))?$/.exec(parts[i] || "");
    if (!m) return;
    out.scores[g.n] = [Number(m[1]), Number(m[2])];
    if (m[3] !== undefined && m[1] === m[2] && g.n > 12) out.golden[g.n] = Number(m[3]);
  });
  return out;
}
$("#share").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}#r=${encode()}`;
  if (navigator.share) {
    try { await navigator.share({ title: "Festive Netball Tournament", text: "Latest scores", url }); return; } catch (err) { if (err.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); toast("Link copied. Paste it to share the scores."); }
  catch (_) { window.prompt("Copy this link:", url); }
});

const cdlg = $("#confirm-dialog");
$("#reset").addEventListener("click", () => cdlg.showModal());
$("#cd-cancel").addEventListener("click", () => cdlg.close());
$("#cd-ok").addEventListener("click", () => {
  state = { scores: {}, golden: {} };
  save(); cdlg.close(); render(); showTab("games"); toast("All scores cleared");
});

function checkSharedLink() {
  const m = /^#r=([0-9.\-g]*)$/.exec(location.hash);
  if (!m) return false;
  const incoming = decode(m[1]);
  history.replaceState(null, "", location.pathname + location.search);
  const count = Object.keys(incoming.scores).length;
  const mineCount = Object.keys(state.scores).length;
  if (JSON.stringify(incoming) === JSON.stringify(state)) return true;
  if (!mineCount) {
    state = incoming; save(); toast(`Loaded ${count} ${count === 1 ? "score" : "scores"} from the link`);
    return true;
  }
  const banner = $("#banner");
  banner.innerHTML = `<p>This link has ${count} ${count === 1 ? "score" : "scores"}. You have ${mineCount} saved here. Load the link's scores instead?</p>
    <button type="button" class="btn primary" id="bn-load">Load link's scores</button><button type="button" class="btn ghost" id="bn-keep">Keep mine</button>`;
  banner.hidden = false;
  $("#bn-load").onclick = () => { state = incoming; save(); render(); banner.hidden = true; toast("Scores loaded"); };
  $("#bn-keep").onclick = () => { banner.hidden = true; };
  return true;
}

/* ================= Toast ================= */
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ================= Snow & confetti ================= */
function snow() {
  const c = $("#snow"), ctx = c.getContext("2d");
  let w, h, flakes;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    flakes = Array.from({ length: Math.round((w * h) / 14000) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 2.2 + .6, s: Math.random() * .6 + .25, d: Math.random() * Math.PI * 2 }));
  };
  size(); addEventListener("resize", size);
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,.75)";
    for (const f of flakes) {
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      if (!reduceMotion) {
        f.d += .01; f.y += f.s; f.x += Math.sin(f.d) * .35;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
      }
    }
    if (!reduceMotion) requestAnimationFrame(draw);
  };
  draw();
}
function celebrate() {
  if (reduceMotion) return;
  const c = $("#confetti"), ctx = c.getContext("2d");
  const w = c.width = innerWidth, h = c.height = innerHeight;
  const colours = ["#D9A535", "#B3242F", "#2A7352", "#FFFDF7", "#D23A45"];
  const bits = Array.from({ length: 160 }, () => ({ x: w / 2 + (Math.random() - .5) * 120, y: h * .35, vx: (Math.random() - .5) * 14, vy: Math.random() * -14 - 4, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - .5) * .3, c: colours[Math.floor(Math.random() * colours.length)] }));
  let frames = 0;
  const step = () => {
    ctx.clearRect(0, 0, w, h);
    for (const b of bits) {
      b.vy += .35; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.a += b.va;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c; ctx.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2); ctx.restore();
    }
    if (++frames < 200) requestAnimationFrame(step); else ctx.clearRect(0, 0, w, h);
  };
  step();
}

/* ================= Start ================= */
load();
const fromLink = checkSharedLink();
render();
showTab(fromLink ? "table" : location.hash.slice(1));
snow();
