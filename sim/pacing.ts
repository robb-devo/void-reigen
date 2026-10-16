// Headless pacing simulator: plays from a fresh save to the first Warp with a sensible greedy strategy.
import { MINES, MACHINES, TECH, SHIPS, PLANETS, RUNS, RES_ORDER, FLEET_UPG, Res } from '../src/game/data';
import * as G from '../src/game/state';
import { GOALS, goalReward, ACHS } from '../src/game/progress';
let T = 0; G.setClock(() => T * 1000); G.setS(G.fresh()); G.S.last = 0;
const S = () => G.S;
const SRC = { goal: 0, sell: 0 };
const events: { t: number; what: string; notable: boolean }[] = [];
const log = (what: string, notable = true) => events.push({ t: T, what, notable });
const TAP_EFF = +(process.env.TAP ?? 0.7); // fraction of time an active player keeps unmanaged mines running
let rng = 42; const rand = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
const unitIncome = (i: number) => MINES[i].rev * G.revMul(i) / G.cycle(i) * (S().mines[i].m ? 1 : TAP_EFF);
function reserveFor(r: Res) { // goods we want to keep for upcoming research/ships
  let need = 0; for (const t of TECH.filter(t => !S().tech.includes(t.id)).slice(0, 4)) if (t.res === r) need = Math.max(need, t.amt);
  if (G.fleetOpen()) for (const sh of SHIPS) { const c = G.shipCost(sh.id)[r]; if (c) need = Math.max(need, c * 2); }
  return need;
}
function step() {
  const s = S();
  // claim goals
  while (s.goal < GOALS.length && GOALS[s.goal].done()) { const r = goalReward(GOALS[s.goal]); G.earn(r); SRC.goal += r; log(`goal ${s.goal + 1}: ${GOALS[s.goal].text}`); s.goal++; }
  for (const a of ACHS) if (!s.ach.includes(a.id) && a.check(s)) { s.ach.push(a.id); log(`trophy ${a.name}`, false); }
  // managers
  MINES.forEach((d, i) => { if (s.mines[i].n && !s.mines[i].m && s.cash >= d.mgr) { s.cash -= d.mgr; s.mines[i].m = true; log(`hire ${d.mname}`); } });
  // power
  while (G.powerDemand() > G.powerSupply() && s.cash >= G.genCost()) { s.cash -= G.genCost(); s.gen++; }
  // new machines
  MACHINES.forEach((d, j) => { if (G.machUnlocked(j) && !s.mach[j] && s.cash >= G.machCost(j)) { s.cash -= G.machCost(j); s.mach[j] = 1; log(`build ${d.name}`); } });
  // research
  for (const t of TECH) if (!s.tech.includes(t.id) && s.cash >= t.cash && s.res[t.res] >= t.amt) { s.cash -= t.cash; s.res[t.res] -= t.amt; s.tech.push(t.id); log(`research ${t.name}`); }
  // machine upgrades when inputs pile up (machine efficiency high) and cheap relative to cash
  MACHINES.forEach((d, j) => { if (!s.mach[j]) return; const st = G.machStats[j]; let k = 0; while (st.reason === '' && G.machCost(j) < s.cash * 0.25 && k++ < 5) { s.cash -= G.machCost(j); s.mach[j]++; if (s.mach[j] % 10 === 0) log(`${d.name} Lv ${s.mach[j]}`, true); } });
  // sell surplus goods
  if (Math.floor(T) % 10 === 0) for (const r of RES_ORDER) { const keep = reserveFor(r) * 1.2; const consumed = MACHINES.some((m, j) => s.mach[j] && m.inp[r]); if (!consumed && s.res[r] > keep + 1) { SRC.sell += (s.res[r] - keep) * G.price(r); s.cash += (s.res[r] - keep) * G.price(r); s.life += (s.res[r] - keep) * G.price(r); s.res[r] = keep; s.sold++; } }
  // fleet
  if (G.fleetOpen()) {
    for (const sh of [...SHIPS].reverse()) { const c = G.shipCost(sh.id); const ok = (Object.keys(c) as Res[]).every(r => s.res[r] >= c[r]! * 1.5); if (ok) { G.pay(c); s.ships[sh.id] = (s.ships[sh.id] || 0) + 1; log(`ship ${sh.name}`, false); } }
    for (const u of FLEET_UPG) if (G.fu(u.id) < u.max && s.res[u.res] >= G.fuCost(u.id) * 1.5) { s.res[u.res] -= G.fuCost(u.id); s.fupg[u.id] = G.fu(u.id) + 1; log(`fleet ${u.name}`); }
    const next = PLANETS.find(p => !s.conquered.includes(p.id));
    if (next && G.idlePower() >= next.need * 1.4) { if (G.launch('planet', next.id, 1.4)) log(`launch invade ${next.name}`, false); }
    for (const r of [...RUNS].reverse()) if (G.idlePower() >= r.need * 1.4 && s.missions.length < G.docks()) G.launch('run', r.id, 1.4);
    for (const o of G.resolveMissions(rand)) { if (o.m.kind === 'planet') log(`${o.ok ? 'CONQUER' : 'FAILED'} ${o.m.target}`, o.ok); }
  }
  // mines: buy best marginal ROI repeatedly
  for (let guard = 0; guard < 200; guard++) {
    let best = -1, bestScore = 0;
    for (let i = 0; i < MINES.length; i++) {
      if (i > 0 && !s.mines[i - 1].n) break;
      const c = G.costN(i, 1); const n = s.mines[i].n; let gain = unitIncome(i);
      const nm = G.nextMs(n); if (nm && nm - n <= 5) gain *= 1 + 4 / (nm - n); // milestone lure
      if (!n) gain = MINES[i].rev * G.globalMul() / MINES[i].t * 3; // new mine bonus
      const score = gain / c; if (c <= s.cash && score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) break;
    const before = G.msIdx(s.mines[best].n); const was = s.mines[best].n;
    s.cash -= G.costN(best, 1); s.mines[best].n++;
    if (!was) log(`NEW MINE ${MINES[best].name}`);
    if (G.msIdx(s.mines[best].n) > before) log(`${MINES[best].name} ${s.mines[best].n} milestone`, s.mines[best].n <= 400);
  }
}
S().taps = 1;
const DT = 0.25; let warpAt = 0;
while (T < 12 * 3600) {
  for (let k = 0; k < 4; k++) { // active tapping: keep unmanaged mines running TAP_EFF of the time
    G.S.mines.forEach(m => { if (!m.m && !m.run && rand() < TAP_EFF) m.run = true; });
    G.tick(DT); T += DT;
  }
  step(); if (Math.floor(T) % 30 === 0 && process.env.P) console.log(fmtT(T), 'cash/s', G.perSec().toExponential(2), 'all', G.allTime().toExponential(2), 'mines', S().mines.map(m=>m.n).join(','), 'tech', S().tech.length, 'mach', S().mach.join(','), 'sold$', S().sold, 'goal%', (SRC.goal/G.allTime()*100).toFixed(1), 'sell%', (SRC.sell/G.allTime()*100).toFixed(1), 'drillMul', G.revMul(0).toFixed(0), 'glob', G.globalMul().toFixed(2));
  if (!warpAt && G.allTime() >= +(process.env.WARP ?? 1e14)) { warpAt = T; log('*** WARP AVAILABLE ***'); break; }
}
function fmtT(t: number) { return `${Math.floor(t / 3600)}h${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}m${String(Math.floor(t % 60)).padStart(2, '0')}s`; }
const _f = (t: number) => `${Math.floor(t / 3600)}h${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}m${String(Math.floor(t % 60)).padStart(2, '0')}s`;
const notable = events.filter(e => e.notable);
console.log(`\n=== Pacing (TAP=${TAP_EFF}) ===  warp at ${warpAt ? fmtT(warpAt) : 'NOT REACHED'}  · goals ${S().goal}/${GOALS.length} · trophies ${S().ach.length}`);
const buckets: [string, number, number, number][] = [['0-5m', 0, 300, 90], ['5-30m', 300, 1800, 120], ['30-90m', 1800, 5400, 300], ['90m+', 5400, 1e9, 600]];
for (const [n, a, b, target] of buckets) { let mx = 0, at = 0; for (let k = 1; k < notable.length; k++) { const e = notable[k], p = notable[k - 1]; if (e.t >= a && e.t < b && e.t - p.t > mx) { mx = e.t - p.t; at = p.t; } } console.log(`${n.padEnd(7)} longest gap between notable events: ${Math.round(mx)}s (target ≤${target}s) ${mx > target ? '❌' : '✅'} ${mx ? 'after ' + fmtT(at) : ''}`); }
if (process.env.V) for (const e of notable) console.log(fmtT(e.t), e.what);
else for (const e of notable.filter(e => /goal|NEW MINE|build|CONQUER|WARP/.test(e.what))) console.log(fmtT(e.t), e.what);
