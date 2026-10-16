import { MINES, MILESTONES, MACHINES, TECH, SHIPS, PLANETS, RUNS, RES, RES_ORDER, GEN, FLEET_UPG, GATES, Res } from './data';
export const sector = () => S.warps + 1;
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
  ach: string[]; goal: number; sold: number; lost: number; wins: number; w: number[]; auto: boolean;
  mute: boolean; last: number; mult: number; taps: number; played: number;
};
export const KEY = 'starforge.v2';
export const fresh = (keep?: Partial<State>): State => ({
  v: 2, cash: 5, life: 0, total: 0, dm: 0, warps: 0,
  mines: MINES.map((_, i) => ({ n: i === 0 ? 1 : 0, p: 0, m: false, run: false })),
  tech: [], res: bag(), made: bag(), mach: MACHINES.map(() => 0), on: MACHINES.map(() => true), gen: 1,
  ships: {}, conquered: [], missions: [], fupg: {}, uid: 1, ach: [], goal: 0, sold: 0, lost: 0, wins: 0, w: MACHINES.map(() => 50), auto: false,
  mute: false, last: Date.now(), mult: 0, taps: 0, played: 0, ...keep,
});
export let S: State = fresh();
export let clock = () => Date.now();
export function setClock(f: () => number) { clock = f; }
export function load() { try { const r = localStorage.getItem(KEY); if (r) { const o = JSON.parse(r); const f = fresh(); S = { ...f, ...o, res: { ...f.res, ...o.res }, made: { ...f.made, ...o.made } }; while (S.mach.length < MACHINES.length) { S.mach.push(0); S.on.push(true); } while (S.w.length < MACHINES.length) S.w.push(50); while (S.mines.length < MINES.length) S.mines.push({ n: 0, p: 0, m: false, run: false }); } } catch { S = fresh(); } }
export function save() { S.last = clock(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
export function setS(n: State) { S = n; }

// ---------- mines ----------
export const BUY = [1, 10, 100, -1];
export const costN = (i: number, k: number) => { const d = MINES[i], o = S.mines[i].n; return d.cost * Math.pow(d.g, o) * (Math.pow(d.g, k) - 1) / (d.g - 1); };
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
export const revenue = (i: number) => MINES[i].rev * S.mines[i].n * revMul(i);
export const oreMul = () => (1 + S.conquered.length * 0.5) * (1 + S.dm * 0.01);
export const orePerCycle = (i: number) => MINES[i].ore * S.mines[i].n * oreMul();
export const perSec = () => MINES.reduce((a, _, i) => a + (S.mines[i].m && S.mines[i].n ? revenue(i) / cycle(i) : 0), 0);
export const resPerSec = (r: Res) => MINES.reduce((a, d, i) => a + (d.res === r && S.mines[i].m && S.mines[i].n ? orePerCycle(i) / cycle(i) : 0), 0);
export const prodRate = (r: Res) => resPerSec(r) + MACHINES.reduce((a, d, j) => a + (d.out === r && S.on[j] ? machRate(j) * powerEff() : 0), 0);
export const allTime = () => S.total + S.life;
export const dmGain = () => Math.max(0, Math.floor(50 * Math.sqrt(allTime() / 1e14)) - S.dm);
export const dmNext = () => 1e14 * Math.pow((S.dm + dmGain() + 1) / 50, 2);
export const warpOpen = () => allTime() >= GATES.warp || S.warps > 0;
export function earn(v: number) { S.cash += v; S.life += v; }

// ---------- factory ----------
export const machCost = (j: number) => MACHINES[j].cost * Math.pow(MACHINES[j].g, S.mach[j]);
export const machCostK = (j: number, k: number) => { const g = MACHINES[j].g; return machCost(j) * (Math.pow(g, k) - 1) / (g - 1); };
export const machK = (j: number) => { if (!S.mach[j]) return 1; const m = BUY[S.mult]; if (m !== -1) return m; const g = MACHINES[j].g; return Math.max(1, Math.floor(Math.log(S.cash * (g - 1) / machCost(j) + 1) / Math.log(g))); };
export const machRate = (j: number) => MACHINES[j].rate * S.mach[j] * Math.pow(2, Math.floor(S.mach[j] / 10)) * (1 + S.dm * 0.01);
export const machUnlocked = (j: number) => S.mach[j] > 0 || allTime() >= MACHINES[j].unlock;
export const genCost = (k = 1) => GEN.cost * Math.pow(GEN.g, S.gen) * (Math.pow(GEN.g, k) - 1) / (GEN.g - 1);
export const genK = () => { const m = BUY[S.mult]; if (m !== -1) return m; return Math.max(1, Math.floor(Math.log(S.cash * (GEN.g - 1) / genCost() + 1) / Math.log(GEN.g))); };
export const powerSupply = () => GEN.power * S.gen * Math.pow(2, Math.floor(S.gen / 10));
export const powerDemand = () => MACHINES.reduce((a, d, j) => a + (S.on[j] ? d.power * S.mach[j] : 0), 0);
export const powerEff = () => { const d = powerDemand(); return d ? Math.min(1, powerSupply() / d) : 1; };
export const price = (r: Res) => RES[r].price * MINES.reduce((a, _, i) => Math.max(a, S.mines[i].n ? revMul(i) : 1), 1);
export function sell(r: Res, frac = 1) { const q = S.res[r] * frac; const v = q * price(r); S.res[r] -= q; earn(v); S.sold++; return v; }
export type MachStat = { made: number; eff: number; reason: '' | 'power' | 'starved' | 'off' | 'idle'; need?: Res };
export let machStats: MachStat[] = MACHINES.map(() => ({ made: 0, eff: 0, reason: 'idle' }));
/** Shared inputs are split between machines by their priority weights (S.w). */
export function factoryTick(dt: number) {
  const pe = powerEff();
  const want = MACHINES.map((d, j) => (S.mach[j] && S.on[j] && avail(d) ? machRate(j) * dt * pe : 0));
  const alloc: Partial<Record<Res, number[]>> = {};
  for (const r of RES_ORDER) {
    const users = MACHINES.map((d, j) => (d.inp[r] && want[j] > 0 ? j : -1)).filter(j => j >= 0); if (!users.length) continue;
    const desire = users.map(j => want[j] * MACHINES[j].inp[r]!); const D = desire.reduce((a, b) => a + b, 0), A = S.res[r];
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
    for (const r in d.inp) { const lim = (alloc[r as Res]?.[j] ?? 0) / d.inp[r as Res]!; if (lim < can - 1e-12) { can = lim; need = r as Res; } }
    can = Math.max(0, can);
    for (const r in d.inp) S.res[r as Res] = Math.max(0, S.res[r as Res] - can * d.inp[r as Res]!);
    S.res[d.out] += can; S.made[d.out] += can;
    const eff = max ? can / max : 0;
    return { made: can, eff, reason: eff > 0.97 ? '' : need ? 'starved' : pe < 1 ? 'power' : '', need };
  });
}
export const sharedInputs = (j: number) => (Object.keys(MACHINES[j].inp) as Res[]).filter(r => MACHINES.some((d, k) => k !== j && d.inp[r] && S.mach[k] > 0 && avail(d)));
export function autoSellTick(dt: number) {
  if (!S.auto || S.warps < 2) return;
  for (const r of RES_ORDER) { const used = MACHINES.some((d, j) => d.inp[r] && S.mach[j] && S.on[j]); const keep = used ? Infinity : 0; if (!used && S.res[r] > 1) { const q = S.res[r] * Math.min(1, dt * 0.2); S.res[r] -= q; earn(q * price(r)); } void keep; }
}

// ---------- fleet ----------
export const fleetOpen = () => { const j = MACHINES.findIndex(m => m.id === GATES.fleetMach); return S.mach[j] >= GATES.fleetLvl || S.conquered.length > 0 || Object.values(S.ships).some(Boolean); };
export const away = (id: string) => S.missions.reduce((a, m) => a + (m.ships[id] || 0), 0);
export const idle = (id: string) => (S.ships[id] || 0) - away(id);
export const shipsAvail = () => SHIPS.filter(avail);
export const idlePower = () => SHIPS.reduce((a, s) => a + idle(s.id) * s.power, 0);
export const totalPower = () => SHIPS.reduce((a, s) => a + (S.ships[s.id] || 0) * s.power, 0);
export const fu = (id: string) => S.fupg[id] || 0;
export const docks = () => 1 + fu('docks') + (S.warps >= 3 ? 1 : 0);
export const fuCost = (id: string) => { const u = FLEET_UPG.find(x => x.id === id)!; return Math.ceil(u.base * Math.pow(3, fu(id))); };
export const canAfford = (c: Partial<Record<Res, number>>) => (Object.keys(c) as Res[]).every(r => S.res[r] >= (c[r] || 0));
export const pay = (c: Partial<Record<Res, number>>) => { for (const r in c) S.res[r as Res] -= c[r as Res]!; };
export const shipCost = (id: string) => { const d = SHIPS.find(s => s.id === id)!, f = Math.pow(1.08, S.ships[id] || 0); const c: Partial<Record<Res, number>> = {}; for (const r in d.cost) c[r as Res] = Math.ceil(d.cost[r as Res]! * f); return c; };
export const chanceFor = (sent: number, need: number) => sent < need ? 0 : Math.min(0.97, 0.3 + 0.5 * sent / need);
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
export const missionTime = (base: number) => base * Math.pow(0.85, fu('engines'));
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
    const lossRate = (ok ? 0.05 : 0.35) * (1 - 0.2 * fu('armor'));
    for (const id in m.ships) { const k = Math.floor(m.ships[id] * lossRate + (rng() < (m.ships[id] * lossRate) % 1 ? 1 : 0)); if (k) { lost[id] = k; S.ships[id] -= k; S.lost += k; } }
    let loot: Partial<Bag> | undefined;
    if (ok) {
      S.wins++;
      if (m.kind === 'planet') { if (!S.conquered.includes(m.target)) S.conquered.push(m.target); }
      else { const r = RUNS.find(x => x.id === m.target)!; loot = {}; const f = (1 + S.conquered.length * 0.5) * Math.min(2, m.power / r.need); for (const k in r.loot) { const v = r.loot[k as Res]! * f + prodRate(k as Res) * r.time * 1.5 * Math.min(2, m.power / r.need); loot[k as Res] = v; S.res[k as Res] += v; } }
    }
    out.push({ m, ok, lost, loot });
  }
  return out;
}

// ---------- main tick (shared by game + simulator) ----------
export type MineEvent = { i: number; v: number; ore: number; ct: number };
export function tick(dt: number, autoTap = false): MineEvent[] {
  const ev: MineEvent[] = [];
  for (let i = 0; i < MINES.length; i++) {
    const b = S.mines[i]; if (!b.n || !avail(MINES[i])) continue;
    if (autoTap && !b.m && !b.run) b.run = true;
    if (!(b.run || b.m)) continue;
    const ct = cycle(i); b.p += dt / ct;
    if (b.p >= 1) {
      const times = b.m ? Math.floor(b.p) : 1, v = revenue(i) * times, ore = orePerCycle(i) * times;
      earn(v); S.res[MINES[i].res] += ore; b.p = b.m ? b.p - times : 0; if (!b.m) b.run = false;
      ev.push({ i, v, ore, ct });
    }
  }
  factoryTick(dt); autoSellTick(dt); S.played += dt;
  return ev;
}
export function simulateOffline(secs: number) {
  const before = { ...S.res }, cash0 = S.cash; const steps = Math.min(600, Math.max(20, Math.floor(secs / 5))), dt = secs / steps;
  const saved = S.mines.map(m => m.run); S.mines.forEach(m => { if (!m.m) m.run = false; });
  for (let k = 0; k < steps; k++) tick(dt);
  S.mines.forEach((m, i) => { if (!m.m) m.run = saved[i] && false; });
  const delta = {} as Bag; for (const r of RES_ORDER) delta[r] = S.res[r] - before[r];
  return { cash: S.cash - cash0, delta };
}

export let GOAL_SECTOR = 0; export function setGoalSector(i: number) { GOAL_SECTOR = i; }
export const offlineCap = () => (S.warps >= 4 ? 24 : 8) * 3600;
/** Warp: reset the sector, keep meta-progress, apply perks. */
export function doWarp() {
  const o = S, g = dmGain(), w = o.warps + 1;
  const n = fresh({ dm: o.dm + g, total: o.total + o.life, warps: w, mute: o.mute, taps: o.taps, ach: o.ach, sold: o.sold, played: o.played, lost: o.lost, wins: o.wins, auto: o.auto, w: o.w, mult: o.mult });
  n.goal = GOAL_SECTOR;
  if (w >= 1) { n.mines[0].m = true; n.mines[1].m = true; n.mines[1].n = 1; n.cash = 1e4; }
  if (w >= 2) n.mach = o.mach.map(l => Math.floor(l * 0.25));
  n.gen = Math.max(1, w >= 2 ? Math.floor(o.gen * 0.25) : 1);
  S = n; return g;
}
