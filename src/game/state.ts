import { MINES, MILESTONES, MACHINES, TECH, SHIPS, PLANETS, RUNS, RES, RES_ORDER, GEN, FLEET_UPG, GATES, Res } from './data';
import { SKILLS, levelOf, LEVEL_GATE } from './skills';
export const sector = () => S.warps + 1;
export const sk = (id: string) => S.skills.includes(id);
export const cmdLevel = () => levelOf(S.xp);
export const skillPoints = () => cmdLevel().lv - 1 - S.skills.length;
export const canLearn = (id: string) => { const d = SKILLS.find(x => x.id === id)!; return !sk(id) && skillPoints() > 0 && cmdLevel().lv >= LEVEL_GATE[d.tier] && (d.tier === 0 || SKILLS.some(x => x.br === d.br && x.tier === d.tier - 1 && sk(x.id))); };
export function learn(id: string) { if (!canLearn(id)) return false; S.skills.push(id); return true; }
export function gainXp(n: number) { const a = cmdLevel().lv; S.xp += n; return cmdLevel().lv - a; }
/** 0 = day … 1 = deep night. 6-minute cycle driven by play time, so the first minutes are always daylight. */
export const nightPhase = () => { const o = (globalThis as { __night?: number }).__night; return o !== undefined ? .5 * o : (S.played / 360 + .8) % 1; };
export const nightness = () => { const o = (globalThis as { __night?: number }).__night; if (o !== undefined) return o; const ph = (S.played / 360 + .8) % 1; return Math.max(0, Math.min(1, (Math.cos(ph * Math.PI * 2) * -1 - .1) * 1.6)); };
export const avail = (d: { sector?: number }) => (d.sector || 1) <= sector();
export const techAvail = (t: { tgt: number; res: Res }) => (t.tgt < 0 || avail(MINES[t.tgt])) && (t.res !== 'exotic' || sector() >= 2);
export type Mine = { n: number; p: number; m: boolean; run: boolean };
export type Mission = { uid: number; kind: 'planet' | 'run'; target: string; end: number; dur: number; ships: Record<string, number>; power: number; chance: number };
type Bag = Record<Res, number>;
const bag = (): Bag => Object.fromEntries(RES_ORDER.map(r => [r, 0])) as Bag;
export type State = {
  v: number; cash: number; life: number; total: number; dm: number; warps: number;
  mines: Mine[]; tech: string[]; res: Bag; made: Bag; mach: number[]; on: boolean[]; gen: number;
  ships: Record<string, number>; conquered: string[]; missions: Mission[]; fupg: Record<string, number>; uid: number;
  ach: string[]; goal: number; gv: number; sold: number; lost: number; wins: number; w: number[]; auto: boolean;
  mute: boolean; last: number; mult: number; taps: number; played: number; seen: string[]; xp: number; skills: string[]; fstock: Bag; lift: number; lifted: number; liftOn: boolean; daily: { day: number; streak: number; at?: number }; meteors: number; hw: number; boost: { kind: 'cash' | 'ore'; m: number; left: number; dur: number } | null; trades: number; wrecks: number;
};
export const KEY = 'starforge.v2';
export const fresh = (keep?: Partial<State>): State => ({
  v: 2, cash: 5, life: 0, total: 0, dm: 0, warps: 0,
  mines: MINES.map((_, i) => ({ n: i === 0 ? 1 : 0, p: 0, m: false, run: false })),
  tech: [], res: bag(), made: bag(), mach: MACHINES.map(() => 0), on: MACHINES.map(() => true), gen: 1,
  ships: {}, conquered: [], missions: [], fupg: {}, uid: 1, ach: [], goal: 0, gv: 3, sold: 0, lost: 0, wins: 0, w: MACHINES.map(() => 50), auto: false,
  mute: false, last: Date.now(), mult: 0, taps: 0, played: 0, seen: [], xp: 0, skills: [], fstock: bag(), lift: 1, lifted: 0, liftOn: true, daily: { day: 0, streak: 0 }, meteors: 0, hw: 0, boost: null, trades: 0, wrecks: 0, ...keep,
});
export let S: State = fresh();
export let clock = () => Date.now();
export function setClock(f: () => number) { clock = f; }
export function load() { try { const r = localStorage.getItem(KEY); if (r) { const o = JSON.parse(r); const f = fresh(); S = { ...f, ...o, res: { ...f.res, ...o.res }, made: { ...f.made, ...o.made }, fstock: { ...f.fstock, ...(o.fstock || {}) } }; if ((o.gv ?? 1) < 3) { const g = o.goal | 0; S.goal = g <= 13 ? g : g <= 16 ? g + 1 : g === 17 ? 20 : g <= 19 ? 21 : g === 20 ? 22 : g + 6; S.gv = 3; } if (!o.fstock && o.ships && Object.keys(o.ships).length) for (const r of FLEET_RES) { S.fstock[r] = S.res[r] * .5; S.res[r] *= .5; } if (!Array.isArray(S.skills)) S.skills = []; if (typeof S.xp !== 'number') S.xp = 0; while (S.mach.length < MACHINES.length) { S.mach.push(0); S.on.push(true); } while (S.w.length < MACHINES.length) S.w.push(50); while (S.mines.length < MINES.length) S.mines.push({ n: 0, p: 0, m: false, run: false }); clockGuard(); } } catch { S = fresh(); } }
export function migrateSeen(raw: string | null) { if (!raw) return; try { const o = JSON.parse(raw); if (!o.seen && (o.life > 0 || o.warps)) { S.seen = ['intro', 'factory', 'power', 'lab', 'export', 'foreman', 'tiers']; if (fleetOpen()) S.seen.push('fleet'); if (warpOpen() || o.warps) S.seen.push('warp'); } } catch {} }
export function save() { S.last = clock(); S.hw = Math.max(S.hw || 0, Date.now()); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
export function setS(n: State) { S = n; }

// ---------- mines ----------
export const BUY = [1, 10, 100, -1];
export const costN = (i: number, k: number) => { const d = MINES[i], o = S.mines[i].n; return (sk('mBulk') ? .75 : 1) * d.cost * Math.pow(d.g, o) * (Math.pow(d.g, k) - 1) / (d.g - 1); };
export const maxBuy = (i: number) => { const d = MINES[i], o = S.mines[i].n; return Math.max(0, Math.floor(Math.log(S.cash * (d.g - 1) / (d.cost * Math.pow(d.g, o)) + 1) / Math.log(d.g))); };
export const buyK = (i: number) => { const m = BUY[S.mult]; return m === -1 ? Math.max(1, maxBuy(i)) : m; };
export const msIdx = (n: number) => MILESTONES.filter(x => n >= x).length;
export const nextMs = (n: number) => MILESTONES.find(x => x > n);
export const prevMs = (n: number) => { const m = msIdx(n); return m ? MILESTONES[m - 1] : 0; };
export const cycle = (i: number) => MINES[i].t / Math.pow(2, Math.min(msIdx(S.mines[i].n), 6));
export const planetMul = () => PLANETS.reduce((a, p) => S.conquered.includes(p.id) ? a * p.bonus : a, 1);
export const achMul = () => 1 + S.ach.length * 0.02;
export const dmMul = () => 1 + 0.1 * Math.pow(S.dm, 0.75);
export const globalMul = () => dmMul() * planetMul() * achMul();
export const revMul = (i: number) => { let m = globalMul() * Math.pow(2, Math.max(0, msIdx(S.mines[i].n) - 6)); for (const t of TECH) if ((t.tgt === i || t.tgt === -1) && S.tech.includes(t.id)) m *= t.x; return m; };
export const revenue = (i: number) => MINES[i].rev * S.mines[i].n * revMul(i) * (sk('mSplit') ? 3 : 1);
export const oreMul = () => (1 + S.conquered.length * 0.5) * (1 + S.dm * 0.01);
export const orePerCycle = (i: number) => MINES[i].ore * S.mines[i].n * oreMul() * (sk('mVein') ? 2 : 1);
export const perSec = () => MINES.reduce((a, _, i) => a + (S.mines[i].m && S.mines[i].n ? revenue(i) / cycle(i) : 0), 0);
export const resPerSec = (r: Res) => MINES.reduce((a, d, i) => a + (d.res === r && S.mines[i].m && S.mines[i].n ? orePerCycle(i) / cycle(i) : 0), 0);
export const prodRate = (r: Res) => resPerSec(r) + MACHINES.reduce((a, d, j) => a + (d.out === r && S.on[j] ? machRate(j) * powerEff() : 0), 0);
export const allTime = () => S.total + S.life;
export const dmGain = () => Math.max(0, Math.floor(50 * Math.pow(allTime() / 1e14, 0.3) * (sk('lBroker') ? 1.15 : 1)) - S.dm);
export const dmNext = () => 1e14 * Math.pow((S.dm + dmGain() + 1) / 50, 1 / 0.3);
export const warpNeed = () => GATES.warp * Math.pow(3, S.warps);
export const warpOpen = () => S.life >= warpNeed();
export function earn(v: number) { S.cash += v; S.life += v; }

// ---------- factory ----------
export const machCost = (j: number) => (sk('iSwap') ? .7 : 1) * MACHINES[j].cost * Math.pow(MACHINES[j].g, S.mach[j]);
export const machCostK = (j: number, k: number) => { const g = MACHINES[j].g; return machCost(j) * (Math.pow(g, k) - 1) / (g - 1); };
export const machK = (j: number) => { if (!S.mach[j]) return 1; const m = BUY[S.mult]; if (m !== -1) return m; const g = MACHINES[j].g; return Math.max(1, Math.floor(Math.log(S.cash * (g - 1) / machCost(j) + 1) / Math.log(g))); };
export const machRate = (j: number) => MACHINES[j].rate * S.mach[j] * Math.pow(2, Math.floor(S.mach[j] / 10)) * (1 + S.dm * 0.01) * (sk('iOver') ? 1.5 : 1) * (sk('iNight') ? 1 + nightness() : 1);
export const machUnlocked = (j: number) => S.mach[j] > 0 || allTime() >= MACHINES[j].unlock;
export const genCost = (k = 1) => GEN.cost * Math.pow(GEN.g, S.gen) * (Math.pow(GEN.g, k) - 1) / (GEN.g - 1);
export const genK = () => { const m = BUY[S.mult]; if (m !== -1) return m; return Math.max(1, Math.floor(Math.log(S.cash * (GEN.g - 1) / genCost() + 1) / Math.log(GEN.g))); };
export const powerSupply = () => GEN.power * S.gen * Math.pow(2, Math.floor(S.gen / 10)) * (sk('iCore') ? 2 : 1);
export const powerDemand = () => MACHINES.reduce((a, d, j) => a + (S.on[j] ? d.power * S.mach[j] : 0), 0);
export const powerEff = () => { const d = powerDemand(); const e = d ? Math.min(1, powerSupply() / d) : 1; return sk('iGrid') ? Math.max(.75, e) : e; };
export const autoOK = () => S.warps >= 2 || sk("lAuto");
export const inMul = () => sk('iLean') ? .75 : 1;
export const price = (r: Res) => (sk('lTrade') ? 1.5 : 1) * RES[r].price * MINES.reduce((a, _, i) => Math.max(a, S.mines[i].n ? revMul(i) : 1), 1);
/** Sell surplus only: keeps ~30s of factory input + whatever upcoming research/ships need. */
export const sellable = (r: Res) => { const use = MACHINES.reduce((a, d, j) => a + (d.inp[r] && S.mach[j] && S.on[j] && avail(d) ? machRate(j) * d.inp[r]! * 30 : 0), 0); return Math.max(0, S.res[r] - use - reserveFor(r)); };
export function sell(r: Res, frac = 1) { const q = sellable(r) * frac; const v = q * price(r); S.res[r] -= q; earn(v); S.sold++; return v; }
export type MachStat = { made: number; eff: number; reason: '' | 'power' | 'starved' | 'off' | 'idle'; need?: Res };
export let machStats: MachStat[] = MACHINES.map(() => ({ made: 0, eff: 0, reason: 'idle' }));
/** Shared inputs are split between machines by their priority weights (S.w). */
export function factoryTick(dt: number) {
  const pe = powerEff();
  const want = MACHINES.map((d, j) => (S.mach[j] && S.on[j] && avail(d) ? machRate(j) * dt * pe : 0));
  const alloc: Partial<Record<Res, number[]>> = {};
  for (const r of RES_ORDER) {
    const users = MACHINES.map((d, j) => (d.inp[r] && want[j] > 0 ? j : -1)).filter(j => j >= 0); if (!users.length) continue;
    const desire = users.map(j => want[j] * MACHINES[j].inp[r]! * inMul()); const D = desire.reduce((a, b) => a + b, 0), A = S.res[r];
    const out = MACHINES.map(() => 0);
    if (D <= A) users.forEach((j, k) => out[j] = desire[k]);
    else { // weighted water-filling
      let left = A, act = users.map((_, k) => k);
      for (let it = 0; it < 4 && left > 1e-12 && act.length; it++) {
        const W = act.reduce((a, k) => a + Math.max(1, S.w[users[k]]), 0); const next: number[] = []; let used = 0;
        for (const k of act) { const j = users[k], give = left * Math.max(1, S.w[j]) / W, room = desire[k] - out[j]; if (give >= room) { out[j] += room; used += room; } else { out[j] += give; used += give; next.push(k); } }
        left -= used; act = next; if (!next.length) break;
      }
    }
    alloc[r] = out;
  }
  machStats = MACHINES.map((d, j) => {
    if (!S.mach[j] || !avail(d)) return { made: 0, eff: 0, reason: 'idle' };
    if (!S.on[j]) return { made: 0, eff: 0, reason: 'off' };
    const max = machRate(j) * dt; let can = want[j], need: Res | undefined;
    for (const r in d.inp) { const lim = (alloc[r as Res]?.[j] ?? 0) / (d.inp[r as Res]! * inMul()); if (lim < can - 1e-12) { can = lim; need = r as Res; } }
    can = Math.max(0, can);
    for (const r in d.inp) S.res[r as Res] = Math.max(0, S.res[r as Res] - can * d.inp[r as Res]! * inMul());
    S.res[d.out] += can; S.made[d.out] += can;
    const eff = max ? can / max : 0;
    return { made: can, eff, reason: eff > 0.97 ? '' : need ? 'starved' : pe < 1 ? 'power' : '', need };
  });
}
export const sharedInputs = (j: number) => (Object.keys(MACHINES[j].inp) as Res[]).filter(r => MACHINES.some((d, k) => k !== j && d.inp[r] && S.mach[k] > 0 && avail(d)));
/** Goods worth keeping for upcoming research, ships and fleet upgrades. */
export function reserveFor(r: Res, fleet = false) {
  let need = 0; for (const t of TECH.filter(t => techAvail(t) && !S.tech.includes(t.id)).slice(0, 4)) if (t.res === r) need = Math.max(need, t.amt);
  if (fleet && fleetOpen()) { for (const sh of SHIPS) if (avail(sh)) { const c = shipCost(sh.id)[r]; if (c) need = Math.max(need, c * 3); } for (const u of FLEET_UPG) if (u.res === r && fu(u.id) < u.max) need = Math.max(need, fuCost(u.id)); }
  return need;
}
export function autoSellTick(dt: number) {
  if (!S.auto || !autoOK()) return;
  for (const r of RES_ORDER) { const used = MACHINES.some((d, j) => d.inp[r] && S.mach[j] && S.on[j]); if (used || (fleetOpen() && S.liftOn && FLEET_RES.includes(r))) continue; const keep = reserveFor(r) * 1.2; if (S.res[r] > keep + 1) { const q = (S.res[r] - keep) * Math.min(1, dt * 0.2); S.res[r] -= q; earn(q * price(r)); } }
}

// ---------- fleet ----------
export const fleetOpen = () => { const j = MACHINES.findIndex(m => m.id === GATES.fleetMach); return S.mach[j] >= GATES.fleetLvl || S.conquered.length > 0 || Object.values(S.ships).some(Boolean); };
export const away = (id: string) => S.missions.reduce((a, m) => a + (m.ships[id] || 0), 0);
export const idle = (id: string) => (S.ships[id] || 0) - away(id);
export const shipsAvail = () => SHIPS.filter(avail);
export const idlePower = () => SHIPS.reduce((a, s) => a + idle(s.id) * s.power, 0);
export const totalPower = () => SHIPS.reduce((a, s) => a + (S.ships[s.id] || 0) * s.power, 0);
export const fu = (id: string) => S.fupg[id] || 0;
export const docks = () => 1 + fu('docks') + (S.warps >= 3 ? 1 : 0) + (sk('fDock') ? 1 : 0);
export const fuCost = (id: string) => { const u = FLEET_UPG.find(x => x.id === id)!; return Math.ceil(u.base * Math.pow(3, fu(id))); };
// Fleet goods live on the fleet rock: they only get there via the Cargo Lift.
export const FLEET_RES: Res[] = ['part', 'alloy', 'chip', 'hull', 'exotic'];
export const canAfford = (c: Partial<Record<Res, number>>) => (Object.keys(c) as Res[]).every(r => S.fstock[r] >= (c[r] || 0));
export const pay = (c: Partial<Record<Res, number>>) => { for (const r in c) S.fstock[r as Res] -= c[r as Res]!; };
/** share of spare stock the lift hauls up per second */
export const liftFrac = () => Math.min(.3, .02 * S.lift * (sk('lBelt') ? 2 : 1));
export const liftCost = () => 2e5 * Math.pow(5, S.lift - 1);
const spare = (r: Res) => { const use = MACHINES.reduce((a, d, j) => a + (d.inp[r] && S.mach[j] && S.on[j] && avail(d) ? machRate(j) * d.inp[r]! * 30 : 0), 0); return Math.max(0, S.res[r] - use - reserveFor(r)); };
export const liftRate = (r: Res) => fleetOpen() && S.liftOn ? spare(r) * liftFrac() : 0;
export function liftTick(dt: number) { if (!fleetOpen() || !S.liftOn) return; for (const r of FLEET_RES) { const sp = spare(r), q = Math.min(sp, sp * liftFrac() * dt + .05 * dt); if (q > 0) { S.res[r] -= q; S.fstock[r] += q; S.lifted += q; } } }
export const shipCost = (id: string) => { const d = SHIPS.find(s => s.id === id)!, f = Math.pow(1.08, S.ships[id] || 0); const c: Partial<Record<Res, number>> = {}; for (const r in d.cost) c[r as Res] = Math.ceil(d.cost[r as Res]! * f); return c; };
export const chanceFor = (sent: number, need: number) => sent < need ? 0 : sk('fVet') && sent >= need * 2 ? 1 : Math.min(sk('fEsc') ? .99 : 0.97, 0.3 + 0.5 * sent / need + (sk('fEsc') ? .1 : 0));
/** Pick idle ships to reach `want` power, big ships first, minimal overshoot. */
export function pickShips(want: number) {
  const pick: Record<string, number> = {}; let rem = want;
  const desc = [...SHIPS].sort((a, b) => b.power - a.power);
  for (const s of desc) { const k = Math.min(idle(s.id), Math.floor(rem / s.power)); if (k > 0) { pick[s.id] = k; rem -= k * s.power; } }
  if (rem > 0) for (const s of [...SHIPS].sort((a, b) => a.power - b.power)) if (idle(s.id) - (pick[s.id] || 0) > 0 && s.power >= rem) { pick[s.id] = (pick[s.id] || 0) + 1; rem -= s.power; break; }
  if (rem > 0) for (const s of desc) { while (rem > 0 && idle(s.id) - (pick[s.id] || 0) > 0) { pick[s.id] = (pick[s.id] || 0) + 1; rem -= s.power; } }
  const power = SHIPS.reduce((a, s) => a + (pick[s.id] || 0) * s.power, 0);
  return { pick, power };
}
export const missionTime = (base: number) => base * Math.pow(0.85, fu('engines')) * (sk('fBurn') ? .75 : 1);
export function launch(kind: 'planet' | 'run', target: string, greed: number, manual?: Record<string, number>) {
  const def = kind === 'planet' ? PLANETS.find(p => p.id === target)! : RUNS.find(r => r.id === target)!;
  if (S.missions.length >= docks() || S.missions.some(m => m.target === target)) return null;
  let { pick, power } = pickShips(Math.ceil(def.need * greed));
  if (manual) { pick = {}; for (const id in manual) if (manual[id] > 0) pick[id] = Math.min(manual[id], idle(id)); power = SHIPS.reduce((a, s) => a + (pick[s.id] || 0) * s.power, 0); }
  if (power < def.need) return null;
  const dur = missionTime(def.time); const m: Mission = { uid: S.uid++, kind, target, end: clock() + dur * 1000, dur, ships: pick, power, chance: chanceFor(power, def.need) };
  S.missions.push(m); return m;
}
export type Outcome = { m: Mission; ok: boolean; lost: Record<string, number>; loot?: Partial<Bag> };
export function resolveMissions(rng = Math.random): Outcome[] {
  const out: Outcome[] = [];
  for (const m of [...S.missions]) {
    if (clock() < m.end) continue;
    S.missions = S.missions.filter(x => x !== m);
    const ok = rng() < m.chance, lost: Record<string, number> = {};
    const lossRate = (ok ? 0.05 : 0.35) * (1 - 0.2 * fu('armor')) * (sk('fLife') ? .5 : 1);
    for (const id in m.ships) { const k = Math.floor(m.ships[id] * lossRate + (rng() < (m.ships[id] * lossRate) % 1 ? 1 : 0)); if (k) { lost[id] = k; S.ships[id] -= k; S.lost += k; } }
    let loot: Partial<Bag> | undefined;
    if (ok) {
      S.wins++;
      if (m.kind === 'planet') { if (!S.conquered.includes(m.target)) S.conquered.push(m.target); }
      else { const r = RUNS.find(x => x.id === m.target)!; loot = {}; const f = (sk('fLoot') ? 2 : 1) * (1 + S.conquered.length * 0.5) * Math.min(2, m.power / r.need); for (const k in r.loot) { const v = r.loot[k as Res]! * f + prodRate(k as Res) * r.time * 1.5 * Math.min(2, m.power / r.need); loot[k as Res] = v; S.res[k as Res] += v; } }
    }
    if (sk('lDrop')) earn(perSec() * 120);
    out.push({ m, ok, lost, loot });
  }
  return out;
}

// ---------- main tick (shared by game + simulator) ----------
export type MineEvent = { i: number; v: number; ore: number; ct: number; lode?: boolean };
/** Tap-rush multiplier set by the UI while the player keeps a tap combo going (1 = off). Never on in sims/offline. */
export let rush = 1; export const setRush = (m: number) => { rush = m; };
// ---------- daily supply crate (clock-robust as far as an offline game can be) ----------
// `hw` is the high-water mark of the wall clock (stamped on every save). Turning the device clock BACK can never
// re-open a claim: the crate, its streak and offline earnings all run on max(now, hw). Jumping the clock forward
// buys at most one early crate, after which nothing pays out until real time catches up; a clock that was far in
// the future (>2 days, e.g. a fixed device clock) is accepted, but today's crate counts as taken and the streak resets.
export const trusted = () => Math.max(Date.now(), S.hw || 0);
const dayKey = (ms: number) => { const d = new Date(ms); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
export function clockGuard() { const now = Date.now(); if ((S.hw || 0) - now > 2 * 864e5) { S.hw = now; S.last = Math.min(S.last, now); S.daily = { day: dayKey(now), streak: 0, at: now }; } }
export const today = () => dayKey(trusted());
const dayNum = (k: number) => Math.floor(new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100).getTime() / 864e5);
/** New calendar day (by the trusted clock) AND ≥ 4h since the last claim, so a 23:59 / 00:01 double-dip or a zone hop can't stack crates. */
export const dailyReady = () => today() > S.daily.day && trusted() - (S.daily.at || 0) >= 4 * 3600e3;
/** Streak continues if the last claim was yesterday, otherwise restarts at day 1. 7-day ladder. */
export function dailyNext() { const t = today(), cont = S.daily.day && dayNum(t) - dayNum(S.daily.day) === 1; const streak = cont ? S.daily.streak % 7 + 1 : 1; const secs = [60, 90, 120, 180, 240, 300, 600][streak - 1]; return { streak, cash: Math.max(300 * streak, perSec() * secs), xp: 10 + streak * 5 }; }
export function claimDaily() { const n = dailyNext(); S.hw = trusted(); S.daily = { day: today(), streak: n.streak, at: S.hw }; earn(n.cash); return n; }
/** Offline seconds since the last save, measured from the high-water mark so a rewound clock earns nothing. */
export const awaySecs = () => (Date.now() - Math.max(S.last, S.hw || 0)) / 1000;
// ---------- timed boosts (trader deals) ----------
// Counted in played seconds, not wall time: immune to clock changes and never applied to offline catch-up.
let simming = false;
export const boostM = (k: 'cash' | 'ore') => S.boost && S.boost.kind === k && S.boost.left > 0 ? S.boost.m : 1;
export function addBoost(kind: 'cash' | 'ore', m: number, secs: number) { if (S.boost && S.boost.kind === kind && S.boost.m === m && S.boost.left > 0) { S.boost.left += secs; S.boost.dur = S.boost.left; } else S.boost = { kind, m, left: secs, dur: secs }; }
export function tick(dt: number, autoTap = false): MineEvent[] {
  const ev: MineEvent[] = [];
  for (let i = 0; i < MINES.length; i++) {
    const b = S.mines[i]; if (!b.n || !avail(MINES[i])) continue;
    if ((autoTap || sk('mAuto')) && !b.m && !b.run) b.run = true;
    if (!(b.run || b.m)) continue;
    const ct = cycle(i); b.p += dt / ct;
    if (b.p >= 1) {
      const times = b.m ? Math.floor(b.p) : 1, lode = sk('mLode') && Math.random() < .04, v = revenue(i) * times * (lode ? 10 : 1) * rush * boostM('cash'), ore = orePerCycle(i) * times * boostM('ore');
      earn(v); S.res[MINES[i].res] += ore; b.p = b.m ? b.p - times : 0; if (!b.m) b.run = false;
      ev.push({ i, v, ore, ct, lode });
    }
  }
  factoryTick(dt); liftTick(dt); autoSellTick(dt); S.played += dt;
  if (S.boost && !simming) { S.boost.left -= dt; if (S.boost.left <= 0) S.boost = null; }
  return ev;
}
export function simulateOffline(secs: number) {
  const before = { ...S.res }, cash0 = S.cash; const steps = Math.min(600, Math.max(20, Math.floor(secs / 5))), dt = secs / steps;
  const saved = S.mines.map(m => m.run); S.mines.forEach(m => { if (!m.m) m.run = false; });
  const bo = S.boost; S.boost = null; simming = true; for (let k = 0; k < steps; k++) tick(dt); simming = false; S.boost = bo;
  S.mines.forEach((m, i) => { if (!m.m) m.run = saved[i] && false; });
  const delta = {} as Bag; for (const r of RES_ORDER) delta[r] = S.res[r] - before[r];
  return { cash: S.cash - cash0, delta };
}

export let GOAL_SECTOR = 0; export function setGoalSector(i: number) { GOAL_SECTOR = i; }
export const offlineCap = () => ((S.warps >= 4 ? 24 : 8) + (sk('lCold') ? 8 : 0)) * 3600;
/** Warp: reset the sector, keep meta-progress, apply perks. */
export function doWarp() {
  const o = S, g = dmGain(), w = o.warps + 1;
  const n = fresh({ dm: o.dm + g, total: o.total + o.life, warps: w, mute: o.mute, taps: o.taps, ach: o.ach, sold: o.sold, played: o.played, lost: o.lost, wins: o.wins, auto: o.auto, w: o.w, mult: o.mult, seen: o.seen, xp: o.xp, skills: o.skills, lifted: o.lifted, liftOn: o.liftOn, daily: o.daily, meteors: o.meteors, hw: o.hw, trades: o.trades, wrecks: o.wrecks });
  n.goal = GOAL_SECTOR;
  if (w >= 1) { n.mines[0].m = true; n.mines[1].m = true; n.mines[1].n = 1; n.cash = 1e4; }
  if (w >= 2) n.mach = o.mach.map(l => Math.floor(l * 0.25));
  n.gen = Math.max(1, w >= 2 ? Math.floor(o.gen * 0.25) : 1);
  S = n; return g;
}
