// Base view: camera (pan / pinch / wheel zoom), layout, conveyors, drones, labels, hit-testing.
import { MINES, MACHINES, RES, Res } from '../game/data';
import * as G from '../game/state';
import { drawBuilding, drawPlot, iso, TW, TH, Kind, hsl, scaffold, ship, glow, INK } from './render';

export type Slot = { key: string; kind: Kind; idx: number; gx: number; gy: number; s: number; rock?: number };
export const ALL_SLOTS: Slot[] = [
  { key: 'hq', kind: 'hq', idx: 0, gx: 0, gy: 0, s: 2 },
  { key: 'gen', kind: 'gen', idx: 0, gx: 3, gy: -3, s: 2 },
  ...([[-3, 0], [3, 0], [-3, 3], [-6, 0], [0, -6], [-3, -6], [-6, -3], [3, -6], [0, 6]] as const).map(([gx, gy], i) => ({ key: 'm' + i, kind: 'mine' as Kind, idx: i, gx, gy, s: 2 })),
  ...([[0, -3], [0, 3], [3, 3], [-6, 3], [3, 6], [6, 0], [-3, 6]] as const).map(([gx, gy], j) => ({ key: 'f' + j, kind: 'mach' as Kind, idx: j, gx, gy, s: 2 })),
  { key: 'lift', kind: 'lift', idx: 0, gx: 6, gy: 3, s: 2 },
  // fleet asteroid
  { key: 'yard', kind: 'yard', idx: 0, gx: 0, gy: 0, s: 2, rock: 1 },
  { key: 'hangar', kind: 'hangar', idx: 0, gx: -3, gy: 0, s: 2, rock: 1 },
  { key: 'dock', kind: 'dock', idx: 0, gx: 3, gy: 0, s: 2, rock: 1 },
  { key: 'turret', kind: 'turret', idx: 0, gx: 0, gy: -3, s: 2, rock: 1 },
  { key: 'fuel', kind: 'fuel', idx: 0, gx: 0, gy: 3, s: 2, rock: 1 },
  { key: 'gate', kind: 'gate', idx: 0, gx: 6, gy: -3, s: 2 },
  { key: 'lab', kind: 'lab', idx: 0, gx: -3, gy: -3, s: 2 },
];
const tierOf = (n: number, steps: number[]) => Math.max(0, steps.filter(v => n >= v).length - 1);
export let SLOTS: Slot[] = ALL_SLOTS.filter(s => !s.rock);
export const slotByKey = (k: string) => ALL_SLOTS.find(s => s.key === k);
export const TIER_STEPS: Record<string, number[]> = { mine: [1, 25, 100, 300, 1000], mach: [1, 10, 25, 50, 100], gen: [1, 5, 15, 30, 60], lab: [0, 3, 10, 25, 50], hangar: [1, 5, 15, 40, 100] };
export function level(sl: Slot): number {
  const S = G.S;
  switch (sl.kind) { case 'mine': return S.mines[sl.idx].n; case 'mach': return S.mach[sl.idx]; case 'gen': return S.gen; case 'yard': return G.fleetOpen() ? 1 + Object.values(S.fupg).reduce((a, b) => a + b, 0) : 0; case 'hangar': return Object.values(S.ships).reduce((a, b) => a + b, 0); case 'dock': return G.docks(); case 'turret': return 1 + G.fu('armor'); case 'fuel': return 1 + G.fu('engines'); case 'lift': return G.fleetOpen() ? 1 + Math.floor(S.conquered.length / 2) : 0; case 'gate': return G.warpOpen() ? S.warps + 1 : S.warps; case 'lab': return S.tech.length; default: return G.sector(); }
}
export function tier(sl: Slot) { const n = level(sl); return sl.kind in TIER_STEPS ? tierOf(n, TIER_STEPS[sl.kind]) : Math.min(4, Math.max(0, n - 1)); }
export function nextTierAt(sl: Slot): number | null { const st = TIER_STEPS[sl.kind]; if (!st) return null; const n = level(sl); return st.find(v => v > n) ?? null; }
/** visible = available in this sector and unlocked enough to show (built, or buildable plot) */
export function visible(sl: Slot): 'built' | 'plot' | 'hidden' {
  const S = G.S;
  if (sl.kind === 'mine') { const d = MINES[sl.idx]; if (!G.avail(d)) return 'hidden'; if (S.mines[sl.idx].n) return 'built'; const prev = sl.idx === 0 || S.mines[sl.idx - 1].n > 0; return prev ? 'plot' : 'hidden'; }
  if (sl.kind === 'mach') { const d = MACHINES[sl.idx]; if (!G.avail(d)) return 'hidden'; if (S.mach[sl.idx]) return 'built'; return G.machUnlocked(sl.idx) && (sl.idx === 0 || S.mach[sl.idx - 1] > 0 || G.machUnlocked(sl.idx)) ? 'plot' : 'hidden'; }
  if (sl.kind === 'lift') return G.fleetOpen() ? 'built' : S.mach[4] ? 'plot' : 'hidden';
  if (sl.rock) return G.fleetOpen() ? 'built' : 'hidden';
  if (sl.kind === 'lab') return S.mach[0] > 0 || S.tech.length ? 'built' : 'hidden';
  if (sl.kind === 'gate') return G.warpOpen() || S.warps ? 'built' : S.life > 1e9 ? 'plot' : 'hidden';
  if (sl.kind === 'gen') return S.mach[0] > 0 || S.gen > 1 || S.warps ? 'built' : 'hidden';
  return 'built';
}
export let guideKey: string | null = null; export const setGuideKey = (k: string | null) => { guideKey = k; };
function relevantPlot(sl: Slot) { if (sl.key === guideKey) return true; const k = cost(sl); return k !== null && G.S.cash >= k * .5; }
export function cost(sl: Slot): number | null {
  if (sl.kind === 'mine') return G.costN(sl.idx, G.S.mines[sl.idx].n ? G.buyK(sl.idx) : 1);
  if (sl.kind === 'mach') return G.machCostK(sl.idx, G.machK(sl.idx));
  if (sl.kind === 'gen') return G.genCost(G.genK());
  return null;
}
const accentOf = (sl: Slot) => sl.kind === 'mine' ? RES[MINES[sl.idx].res].color : sl.kind === 'mach' ? RES[MACHINES[sl.idx].out].color : '#ffe066';
const hueOf = (sl: Slot) => sl.kind === 'mine' ? MINES[sl.idx].hue : sl.kind === 'mach' ? [20, 195, 215, 0, 140, 250, 290][sl.idx] : 210;
export const idOf = (sl: Slot) => sl.kind === 'mine' ? MINES[sl.idx].id : sl.kind === 'mach' ? MACHINES[sl.idx].id : sl.kind;
const activeOf = (sl: Slot) => sl.kind === 'mine' ? (G.S.mines[sl.idx].m || G.S.mines[sl.idx].run) : sl.kind === 'mach' ? G.machStats[sl.idx].eff > 0.01 : sl.kind === 'gen' ? G.powerDemand() > 0 : sl.kind === 'gate' ? G.warpOpen() : sl.kind === 'yard' ? G.fleetOpen() : sl.kind === 'lab' ? G.S.tech.length > 0 : true;

type Drone = { a: [number, number]; b: [number, number]; t: number; col: string; done?: () => void };
type Puff = { x: number; y: number; t: number; c: string };
type Ship = { x: number; y: number; vy: number; t: number; dir: 1 | -1; sc: number };
type Sprite = { cv: HTMLCanvasElement; k: number };
export class BaseView {
  cv: HTMLCanvasElement; c: CanvasRenderingContext2D; z = 0.66; ox = 0; oy = 0; dpr = Math.min(1.5, devicePixelRatio || 1);
  w = 0; h = 0; sel: string | null = null; guide: string | null = null; drones: Drone[] = []; puffs: Puff[] = []; t = 0;
  ships: Ship[] = []; cons = new Map<string, number>(); sprites = new Map<string, Sprite>(); cam: { x: number; y: number; z: number } | null = null; warpT = -1; warpCb: (() => void) | null = null; shake = 0;
  onTap: (sl: Slot | null, x: number, y: number) => void = () => {};
  onConstruct: () => void = () => {};
  private lastTier = new Map<string, number>(); private workers: { a: number; b: number; f: number; sp: number; c: string }[] = [];
  night = 0; rock = 0; travelT = -1; private travelTo = 0; onTravel: (r: number) => void = () => {};
  /** fly the camera between asteroids */
  travel(r: number) { if (this.travelT >= 0 || r === this.rock) return; this.travelTo = r; this.travelT = 0; this.cam = null; }
  setRock(r: number) { this.rock = r; SLOTS = ALL_SLOTS.filter(s => (s.rock || 0) === r); this.workers = []; this.drones = []; this.gcache = null; this.sel = null; this.cam = null; this.ox = this.w / 2; this.oy = this.h * .52; if (r) { this.zMain = this.z; this.z = Math.max(this.z, .95); } else this.z = this.zMain || this.z; this.onTravel(r); }
  private zMain = 0;
  pad(): [number, number] { return this.rock ? iso(0, 0) : iso(6, 3); }
  private ptrs = new Map<number, { x: number; y: number }>(); private moved = 0; private pinch0 = 0; private z0 = 1; private craters: number[][] = [];
  constructor(parent: HTMLElement) {
    this.cv = document.createElement('canvas'); this.cv.id = 'base'; parent.appendChild(this.cv); this.c = this.cv.getContext('2d')!;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 26; k++) { const a = rnd() * 7, r = 3 + rnd() * 7.5; this.craters.push([Math.cos(a) * r, Math.sin(a) * r, .5 + rnd() * 1.3]); }
    this.resize(); new ResizeObserver(() => this.resize()).observe(parent);
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => { this.cam = null; cv.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.moved = 0; if (this.ptrs.size === 2) { this.pinch0 = this.pdist(); this.z0 = this.z; } });
    cv.addEventListener('pointermove', e => {
      const p = this.ptrs.get(e.pointerId); if (!p) return;
      if (this.ptrs.size === 1) { this.ox += e.clientX - p.x; this.oy += e.clientY - p.y; this.moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y); }
      p.x = e.clientX; p.y = e.clientY;
      if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.zoomAt(this.z0 * this.pdist() / this.pinch0, (a.x + b.x) / 2, (a.y + b.y) / 2); this.moved = 99; }
      this.clamp();
    });
    const up = (e: PointerEvent) => { const had = this.ptrs.delete(e.pointerId); if (had && this.ptrs.size === 0 && this.moved < 10) this.tap(e.clientX, e.clientY); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => this.ptrs.delete(e.pointerId));
    cv.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(this.z * Math.exp(-e.deltaY * .0015), e.clientX, e.clientY); this.clamp(); }, { passive: false });
  }
  private pdist() { const [a, b] = [...this.ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
  zoomAt(nz: number, cx: number, cy: number) { nz = Math.max(.45, Math.min(1.8, nz)); const r = this.cv.getBoundingClientRect(), lx = cx - r.left, ly = cy - r.top; this.ox = lx - (lx - this.ox) * nz / this.z; this.oy = ly - (ly - this.oy) * nz / this.z; this.z = nz; }
  clamp() { const lx = 330 * this.z, ly = 200 * this.z; this.ox = Math.max(this.w / 2 - lx, Math.min(this.w / 2 + lx, this.ox)); this.oy = Math.max(this.h / 2 - ly, Math.min(this.h / 2 + ly, this.oy)); }
  resize() { const host = this.cv.parentElement!.parentElement || this.cv.parentElement!; const r = host.getBoundingClientRect(); if (!r.width) return; const first = !this.w; this.w = r.width; this.h = r.height; this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr; this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px'; if (first || !this.ox) { this.ox = this.w / 2; this.oy = this.h * .5; } this.gcache = null; }
  private gcache: HTMLCanvasElement | null = null; private gz = 0;
  /** world → client(page) coords */
  screen(gx: number, gy: number): [number, number] { const [x, y] = iso(gx, gy); const r = this.cv.getBoundingClientRect(); return [r.left + this.ox + x * this.z, r.top + this.oy + y * this.z]; }
  slotScreen(key: string): [number, number] { const sl = SLOTS.find(s => s.key === key)!; const [x, y] = this.screen(sl.gx, sl.gy); return [x, y - 40 * this.z]; }
  focus(key: string, z = this.z, yf = .45, with2?: string) { if (!with2 && !this.rock && G.S.warps === 0 && G.S.goal < 14 && key !== 'm0' && key !== 'hq') with2 = 'm0'; const sl = SLOTS.find(s => s.key === key); if (!sl) return; let [x, y] = iso(sl.gx, sl.gy); const s2 = with2 && SLOTS.find(s => s.key === with2); if (s2) { const [x2, y2] = iso(s2.gx, s2.gy); x = (x + x2) / 2; y = (y + y2) / 2; } const lx = 330 * z, ly = 200 * z; this.cam = { x: Math.max(this.w / 2 - lx, Math.min(this.w / 2 + lx, this.w / 2 - x * z)), y: Math.max(this.h / 2 - ly, Math.min(this.h / 2 + ly, this.h * yf - y * z)), z }; }
  construct(key: string) { this.cons.set(key, this.t); }
  launch(n: number) { const [x, y] = this.pad(); for (let k = 0; k < Math.min(8, n); k++) this.ships.push({ x: x + (k % 3 - 1) * 26, y: y - 14, vy: 0, t: -k * .18, dir: 1, sc: .7 + Math.random() * .3 }); this.shake = .25; }
  land(n: number) { const [x, y] = this.pad(); for (let k = 0; k < Math.min(6, n); k++) this.ships.push({ x: x + (k % 3 - 1) * 26, y: y - 700, vy: 0, t: -k * .25, dir: -1, sc: .8 }); }
  warp(cb: () => void) { if (this.rock) this.setRock(0); this.warpT = 0; this.warpCb = cb; this.focus('gate', .8); }
  private tap(cx: number, cy: number) {
    if (this.travelT >= 0) return;
    const r = this.cv.getBoundingClientRect(); const lx = (cx - r.left - this.ox) / this.z, ly = (cy - r.top - this.oy) / this.z;
    let best: Slot | null = null, bd = -1e9;
    for (const sl of SLOTS) {
      if (visible(sl) === 'hidden') continue;
      const [x, y] = iso(sl.gx, sl.gy), hw = sl.s * TW / 2, hh = sl.s * TH / 2;
      const inBase = Math.abs(lx - x) / hw + Math.abs(ly - y) / hh <= 1, inBody = Math.abs(lx - x) < hw * .6 && ly < y && ly > y - 70 - tier(sl) * 12;
      if ((inBase || inBody) && sl.gx + sl.gy > bd) { bd = sl.gx + sl.gy; best = sl; }
    }
    this.sel = best?.key ?? null; this.onTap(best, cx, cy);
  }
  drone(fromKey: string, toKey: string, col: string, done?: () => void) {
    if (this.drones.length > 40) return; const a = SLOTS.find(s => s.key === fromKey)!, b = SLOTS.find(s => s.key === toKey)!;
    this.drones.push({ a: iso(a.gx, a.gy), b: iso(b.gx, b.gy), t: 0, col, done });
  }
  puff(key: string, col = 'rgba(255,255,255,.8)') { const sl = SLOTS.find(s => s.key === key)!; const [x, y] = iso(sl.gx, sl.gy); for (let k = 0; k < 10; k++) this.puffs.push({ x: x + (Math.random() - .5) * 70, y: y + (Math.random() - .5) * 30, t: -Math.random() * .2, c: col }); }

  /** links: [fromSlot, toSlot, res, flowing] */
  links(): [Slot, Slot, Res, boolean][] {
    const out: [Slot, Slot, Res, boolean][] = []; const S = G.S; if (this.rock) return out;
    MACHINES.forEach((d, j) => {
      const to = SLOTS.find(s => s.key === 'f' + j)!; if (!S.mach[j] || visible(to) !== 'built') return;
      (Object.keys(d.inp) as Res[]).forEach(r => {
        const srcs = SLOTS.filter(sl => visible(sl) === 'built' && ((sl.kind === 'mine' && MINES[sl.idx].res === r) || (sl.kind === 'mach' && MACHINES[sl.idx].out === r)));
        srcs.sort((a, b) => Math.hypot(a.gx - to.gx, a.gy - to.gy) - Math.hypot(b.gx - to.gx, b.gy - to.gy));
        srcs.slice(0, 2).forEach(sv => out.push([sv, to, r, G.machStats[j].eff > 0.01]));
      });
    });
    return out;
  }

  draw(dt: number) {
    this.t += dt; const { c, t } = this;
    if (this.cam) { const k = 1 - Math.pow(.0008, dt); this.ox += (this.cam.x - this.ox) * k; this.oy += (this.cam.y - this.oy) * k; this.z += (this.cam.z - this.z) * k; if (Math.abs(this.cam.x - this.ox) + Math.abs(this.cam.y - this.oy) < .5 && Math.abs(this.cam.z - this.z) < .002) { this.z = this.cam.z; this.cam = null; } }
    for (const sl of SLOTS) { const v = visible(sl), tv = v === 'built' ? tier(sl) : -1, prev = this.lastTier.get(sl.key); if (prev !== undefined && tv > prev && this.t > 1 && this.warpT < 0) { this.cons.set(sl.key, this.t); this.onConstruct(); } this.lastTier.set(sl.key, tv); }
    // day/night: 6-minute cycle, nights are short and pretty
    this.night = G.nightness();
    const fn = (window as unknown as { __night?: number }).__night; if (fn !== undefined) this.night = fn;
    let sx = 0, sy = 0; if (this.shake > 0) { this.shake -= dt; sx = (Math.random() - .5) * 8 * this.shake * 4; sy = (Math.random() - .5) * 8 * this.shake * 4; }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.w, this.h);
    let tx = 0, tz = 1;
    if (this.travelT >= 0) { this.travelT += dt; const T = this.travelT, D = .55; if (T < D) { const f = T / D, e = f * f * f; tx = (this.travelTo ? -1 : 1) * e * this.w * 1.6; tz = 1 - e * .35; } else { if (this.rock !== this.travelTo) this.setRock(this.travelTo); const f = Math.min(1, (T - D) / (D * 1.4)), e = 1 - Math.pow(1 - f, 3); tx = (this.travelTo ? 1 : -1) * (1 - e) * this.w * 1.6; tz = .65 + e * .35; if (f >= 1) this.travelT = -1; } }
    c.translate(this.ox + sx + tx, this.oy + sy); c.scale(this.z * tz, this.z * tz);
    this.groundCached();
    // conveyors
    const L = this.links();
    for (const [a, b, r, on] of L) this.belt(a, b, RES[r].color, on);
    this.drawWorkers(dt);
    // buildings back-to-front
    guideKey = this.guide; const order = SLOTS.filter(sl => visible(sl) === 'built' || (visible(sl) === 'plot' && relevantPlot(sl))).sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    for (const sl of order) {
      const [x, y] = iso(sl.gx, sl.gy), v = visible(sl);
      if (sl.key === this.sel) { const hw = sl.s * TW / 2, hh = sl.s * TH / 2, p = 1 + Math.sin(t * 6) * .04; c.beginPath(); c.moveTo(x - hw * p, y); c.lineTo(x, y - hh * p); c.lineTo(x + hw * p, y); c.lineTo(x, y + hh * p); c.closePath(); c.fillStyle = 'rgba(255,255,255,.15)'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); }
      if (v === 'plot') { const k = cost(sl); drawPlot(c, x, y, sl.s, t + sl.gx, k !== null && G.S.cash >= k); continue; }
      const ct = this.cons.get(sl.key), ce = ct === undefined ? 9 : t - ct;
      if (ce < .9) { scaffold(c, x, y, sl.s, ce / .9, t); continue; }
      const pop = ce < 1.5 ? 1 + Math.sin((ce - .9) / .6 * Math.PI) * .18 * (1 - (ce - .9) / .6) : 1; if (ce >= 1.5 && ct !== undefined) this.cons.delete(sl.key);
      let wsc = 1; if (this.warpT >= 0 && sl.key !== 'gate') { const f = Math.max(0, (this.warpT - .8) / 1.4); wsc = Math.max(0, 1 - f * f); }
      const scl = pop * wsc;
      if (scl !== 1) { c.save(); c.translate(x, y); c.scale((2 - pop) * wsc, pop * pop * wsc); c.translate(-x, -y); }
      this.building(sl, x, y);
      if (scl !== 1) c.restore();
    }
    // drones
    this.drones = this.drones.filter(d => {
      d.t += dt / 1.1; const f = Math.min(1, d.t), e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      const x = d.a[0] + (d.b[0] - d.a[0]) * e, y = d.a[1] + (d.b[1] - d.a[1]) * e - Math.sin(f * Math.PI) * 70 - 30;
      c.beginPath(); c.ellipse(x, d.a[1] + (d.b[1] - d.a[1]) * e, 8, 4, 0, 0, 7); c.fillStyle = 'rgba(20,8,40,.25)'; c.fill();
      c.fillStyle = d.col; c.strokeStyle = '#24163a'; c.lineWidth = 2; c.fillRect(x - 5, y + 2, 10, 8); c.strokeRect(x - 5, y + 2, 10, 8);
      c.beginPath(); c.ellipse(x, y - 1, 12, 4, 0, 0, 7); c.fillStyle = '#dfe6ff'; c.fill(); c.stroke();
      const sp = t * 40; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * 10 - Math.cos(sp) * 5, y - 4); c.lineTo(x + s * 10 + Math.cos(sp) * 5, y - 4); c.stroke(); }
      if (d.t >= 1) { d.done?.(); return false; } return true;
    });
    this.puffs = this.puffs.filter(p => { p.t += dt; if (p.t < 0) return true; const f = p.t / .8; c.globalAlpha = Math.max(0, 1 - f); c.beginPath(); c.arc(p.x, p.y - f * 30, 6 + f * 14, 0, 7); c.fillStyle = p.c; c.fill(); c.globalAlpha = 1; return f < 1; });
    // ships
    this.ships = this.ships.filter(s => { s.t += dt; if (s.t < 0) return true; if (s.dir > 0) { s.vy -= dt * 900; s.y += s.vy * dt; ship(c, s.x, s.y, s.sc, 1); if (s.t < .4) for (let k = 0; k < 2; k++) this.puffs.push({ x: s.x + (Math.random() - .5) * 40, y: s.y + 10, t: 0, c: 'rgba(230,220,255,.8)' }); return s.y > -1200; } const ty = this.pad()[1] - 14, f = Math.min(1, s.t / 1.6), e = 1 - Math.pow(1 - f, 3); const yy = ty - 700 * (1 - e); ship(c, s.x, yy, s.sc, 1 - e * .8); return f < 1; });
    // warp sequence
    if (this.warpT >= 0) { this.warpT += dt; const [gx, gy] = iso(6, -3); const f = Math.min(1, this.warpT / 2.2); glow(c, gx, gy - 50, 120 + f * 900, '#b06bff', .4 + f * .6); c.save(); c.translate(gx, gy - 50); c.rotate(this.warpT * 4 * f); for (let k = 0; k < 6; k++) { c.rotate(1.047); c.beginPath(); c.ellipse(0, 0, 60 + f * 500, 20 + f * 160, 0, 0, Math.PI); c.strokeStyle = `hsla(${270 + k * 15},100%,75%,${.6 * f})`; c.lineWidth = 6 + f * 10; c.stroke(); } c.restore(); this.shake = Math.max(this.shake, f * .2); if (this.warpT > 2.2 && this.warpCb) { const cb = this.warpCb; this.warpCb = null; cb(); } if (this.warpT > 3.2) { this.warpT = -1; this.sprites.clear(); } }
    // labels on top
    if (this.night > .01) {
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(10,4,48,${.7 * this.night})`; c.fillRect(0, 0, this.cv.width, this.cv.height); c.restore();
      c.globalCompositeOperation = 'lighter';
      for (const sl of order) { if (visible(sl) !== 'built') continue; const [x, y] = iso(sl.gx, sl.gy), on = activeOf(sl); glow(c, x, y - 4, 90, on ? accentOf(sl) : '#5a6aff', this.night * (on ? .5 : .2)); glow(c, x - 10, y - 30 - tier(sl) * 6, 40, '#ffe9a0', this.night * .65); glow(c, x + 14, y - 12, 18, '#ffd28a', this.night * .5); }
      { const [hx, hy] = iso(0, 0), ang = this.t * .35, len = 520; c.save(); c.translate(hx + 8, hy - 70); c.rotate(ang); const g = c.createLinearGradient(0, 0, len, 0); g.addColorStop(0, `rgba(255,240,190,${.28 * this.night})`); g.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(len, -70); c.lineTo(len, 70); c.closePath(); c.fill(); c.restore(); }
      for (const [a, b, r, on] of L) if (on) { const [x1, y1] = iso(b.gx, a.gy); glow(c, x1, y1, 26, RES[r].color, this.night * .3); }
      c.globalCompositeOperation = 'source-over';
    }
    if (this.warpT < 0) for (const sl of order) this.label(sl);
    if (this.guide) { const sl = SLOTS.find(s => s.key === this.guide); if (sl && visible(sl) !== 'hidden') { const [x, y] = iso(sl.gx, sl.gy), b = Math.abs(Math.sin(t * 5)) * 14, ay = y - 120 - tier(sl) * 12 - b;
      c.beginPath(); c.moveTo(x, ay + 34); c.lineTo(x - 20, ay + 10); c.lineTo(x - 9, ay + 10); c.lineTo(x - 9, ay - 14); c.lineTo(x + 9, ay - 14); c.lineTo(x + 9, ay + 10); c.lineTo(x + 20, ay + 10); c.closePath(); c.fillStyle = '#ffd23f'; c.fill(); c.strokeStyle = '#24163a'; c.lineWidth = 4; c.stroke();
      c.beginPath(); c.ellipse(x, y, sl.s * TW / 2 * (1 + b / 60), sl.s * TH / 2 * (1 + b / 60), 0, 0, 7); c.strokeStyle = 'rgba(255,210,63,.8)'; c.lineWidth = 3; c.stroke(); } }
    // ambient lighting: cool vignette + warm key light (screen space)
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this.vig || this.vig.width !== this.cv.width) { const v = document.createElement('canvas'); v.width = this.cv.width; v.height = this.cv.height; const g = v.getContext('2d')!; const W = v.width, H = v.height; let gr = g.createRadialGradient(W * .5, H * .45, H * .2, W * .5, H * .5, H * .75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(8,2,30,.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); gr = g.createRadialGradient(W * .15, H * .1, 0, W * .15, H * .1, H * .6); gr.addColorStop(0, 'rgba(255,190,120,.16)'); gr.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); this.vig = v; }
    if (this.travelT >= 0) { const f = Math.sin(Math.min(1, this.travelT / 1.32) * Math.PI); c.strokeStyle = `rgba(200,230,255,${.5 * f})`; c.lineWidth = 2; let sd = 3; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647; for (let k = 0; k < 40; k++) { const yy = r() * this.h, xx = ((r() * this.w * 2 - this.travelT * 2600 * (this.travelTo ? 1 : -1)) % (this.w * 1.2) + this.w * 1.2) % (this.w * 1.2) - this.w * .1, L = 60 + r() * 140; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + L * f, yy); c.stroke(); } }
    c.drawImage(this.vig, 0, 0, this.w, this.h);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  private vig: HTMLCanvasElement | null = null;
  private groundCached() {
    const c = this.c, k = this.z * this.dpr, W = 1700, H = 1000;
    if (!this.gcache || Math.abs(this.gz - this.z) > .001) {
      const g = this.gcache || document.createElement('canvas'); g.width = Math.ceil(W * k); g.height = Math.ceil(H * k);
      const save = this.c; const gc = g.getContext('2d')!; gc.setTransform(k, 0, 0, k, W / 2 * k, 420 * k); this.c = gc; this.ground(); this.c = save; this.gcache = g; this.gz = this.z;
    }
    c.save(); c.scale(1 / k, 1 / k); c.drawImage(this.gcache, -W / 2 * k, -420 * k); c.restore();
  }
  private drawWorkers(dt: number) {
    const c = this.c, built = SLOTS.filter(s => visible(s) === 'built');
    const want = Math.min(10, 2 + Math.floor(built.length / 2));
    while (this.workers.length < want && built.length > 1) { const a = Math.floor(Math.random() * built.length); let b = Math.floor(Math.random() * built.length); if (b === a) b = (a + 1) % built.length; this.workers.push({ a: SLOTS.indexOf(built[a]), b: SLOTS.indexOf(built[b]), f: 0, sp: .12 + Math.random() * .1, c: ['#ffd23f', '#ff9f43', '#5cf2ff', '#ff7bd5'][Math.floor(Math.random() * 4)] }); }
    this.workers = this.workers.filter(w => {
      w.f += dt * w.sp; const A = SLOTS[w.a], B = SLOTS[w.b]; if (!A || !B) return false;
      // walk an L path just off the building corners
      const f = Math.min(1, w.f), mx = B.gx, my = A.gy, l1 = Math.abs(mx - A.gx), l2 = Math.abs(B.gy - my), L = l1 + l2 || 1, d = f * L;
      const gx = d < l1 ? A.gx + Math.sign(mx - A.gx) * d : mx, gy = d < l1 ? A.gy : my + Math.sign(B.gy - my) * (d - l1);
      const [x, y] = iso(gx + 1.15, gy + 1.15), bob = Math.abs(Math.sin(this.t * 10 + w.a)) * 2.5;
      c.beginPath(); c.ellipse(x, y + 1, 5, 2.5, 0, 0, 7); c.fillStyle = 'rgba(20,8,40,.35)'; c.fill();
      c.fillStyle = '#3a4a8a'; c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.roundRect(x - 3.5, y - 11 - bob, 7, 9, 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(x, y - 14 - bob, 3.6, 0, 7); c.fillStyle = w.c; c.fill(); c.stroke(); c.fillStyle = '#9af3ff'; c.fillRect(x - 2, y - 15 - bob, 4, 2);
      if (this.night > .3) glow(c, x, y - 15 - bob, 10, '#fff3b0', this.night * .6);
      return w.f < 1;
    });
  }
  private building(sl: Slot, x: number, y: number) {
    const c = this.c, tr = tier(sl), act = !!activeOf(sl), id = idOf(sl), k = Math.max(.5, Math.round(this.z * this.dpr * 4) / 4);
    const key = `${id}|${tr}|${k}`; let sp = this.sprites.get(key);
    if (!sp) { const W = 240, H = 300, cv = document.createElement('canvas'); cv.width = Math.ceil(W * k); cv.height = Math.ceil(H * k); const g = cv.getContext('2d')!; g.setTransform(k, 0, 0, k, W / 2 * k, 240 * k); bakeShadow(g, sl.s); drawBuilding(g, 0, sl.kind, id, hueOf(sl), tr, 0, 0, sl.s, 0, act, accentOf(sl)); sp = { cv, k }; if (this.sprites.size > 120) this.sprites.clear(); this.sprites.set(key, sp); }
    c.drawImage(sp.cv, x - 120, y - 240, 240, 300);
    drawBuilding(c, 1, sl.kind, id, hueOf(sl), tr, x, y, sl.s, this.t + sl.gx * .37, act, accentOf(sl));
  }
  private ground() {
    const c = this.c, R = this.rock ? 7 : 10.2, ice = this.rock === 1;
    // rim thickness (asteroid side)
    const pts: [number, number][] = []; for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, r = R * (1 + Math.sin(a * 3) * .05 + Math.sin(a * 7 + 1) * .03); pts.push(iso(Math.cos(a) * r, Math.sin(a) * r)); }
    c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y + 60) : c.moveTo(x, y + 60)); c.closePath();
    let g = c.createLinearGradient(0, -200, 0, 500); g.addColorStop(0, ice ? '#3b5a7e' : '#5a3b6e'); g.addColorStop(1, ice ? '#182a48' : '#2a1838'); c.fillStyle = g; c.fill(); c.strokeStyle = '#140a22'; c.lineWidth = 4; c.stroke();
    // strata lines
    c.save(); c.clip(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; for (let k = 1; k < 3; k++) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y + k * 20) : c.moveTo(x, y + k * 20)); c.stroke(); } c.restore();
    // top surface
    c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
    g = c.createRadialGradient(-60, -80, 40, 0, 0, 760); g.addColorStop(0, ice ? '#9cc4e0' : '#a77ab8'); g.addColorStop(.6, ice ? '#6a90b8' : '#7d5397'); g.addColorStop(1, ice ? '#4a6890' : '#5c3a75'); c.fillStyle = g; c.fill(); c.strokeStyle = '#140a22'; c.lineWidth = 4; c.stroke();
    c.save(); c.clip();
    // subtle tile grid
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
    for (let k = -11; k <= 11; k++) { let [a, b] = iso(k, -11), [d, e] = iso(k, 11); c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); [a, b] = iso(-11, k); [d, e] = iso(11, k); c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }
    // craters
    for (const [cx, cy, r] of this.craters) { if (Math.hypot(cx, cy) > R - 1) continue; const [x, y] = iso(cx, cy); c.beginPath(); c.ellipse(x, y, r * TW / 2, r * TH / 2, 0, 0, 7); c.fillStyle = 'rgba(40,16,60,.35)'; c.fill(); c.beginPath(); c.ellipse(x, y + 2, r * TW / 2, r * TH / 2, 0, .2, Math.PI - .2); c.strokeStyle = 'rgba(255,220,255,.18)'; c.lineWidth = 3; c.stroke(); }
    // surface details: boulders, crystal clusters, beacon posts (kept off building plots)
    let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647; const taken = (gx: number, gy: number) => SLOTS.some(s => Math.abs(s.gx - gx) < 1.7 && Math.abs(s.gy - gy) < 1.7);
    for (let k = 0; k < 70; k++) { const a = rnd() * 7, r = 2 + rnd() * (R - 2.4), gx = Math.cos(a) * r, gy = Math.sin(a) * r; if (taken(gx, gy)) continue; const [x, y] = iso(gx, gy), kind = rnd();
      if (kind < .55) { const s2 = 4 + rnd() * 9; c.beginPath(); c.ellipse(x + 2, y + 2, s2 * 1.2, s2 * .5, 0, 0, 7); c.fillStyle = 'rgba(30,10,50,.35)'; c.fill(); c.beginPath(); c.moveTo(x - s2, y); c.quadraticCurveTo(x - s2 * .8, y - s2 * 1.1, x, y - s2); c.quadraticCurveTo(x + s2, y - s2 * .9, x + s2, y); c.quadraticCurveTo(x, y + s2 * .4, x - s2, y); c.fillStyle = '#6e4a86'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); c.beginPath(); c.moveTo(x - s2 * .6, y - s2 * .6); c.quadraticCurveTo(x - s2 * .2, y - s2 * .95, x + s2 * .2, y - s2 * .85); c.strokeStyle = 'rgba(255,230,255,.35)'; c.lineWidth = 2; c.stroke(); }
      else if (kind < .85) { const hue = rnd() < .5 ? 190 : 290; for (let j = 0; j < 3; j++) { const cx = x + (j - 1) * 5, h2 = 8 + rnd() * 10; c.beginPath(); c.moveTo(cx - 3, y); c.lineTo(cx - 1, y - h2); c.lineTo(cx + 2, y - h2 - 3); c.lineTo(cx + 3, y); c.closePath(); c.fillStyle = hsl(hue, 90, 70); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); } }
      else { c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 18); c.stroke(); c.beginPath(); c.arc(x, y - 20, 3, 0, 7); c.fillStyle = '#ffd23f'; c.fill(); c.stroke(); }
    }
    if (ice) { c.strokeStyle = 'rgba(255,210,63,.55)'; c.lineWidth = 4; c.setLineDash([14, 10]); for (const [a, b] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) { const [x1, y1] = iso(0, 0), [x2, y2] = iso(a, b); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); } c.setLineDash([]); }
    c.restore();
  }
  private belt(a: Slot, b: Slot, col: string, on: boolean) {
    const c = this.c; const mid: [number, number] = [b.gx, a.gy];
    const P = [iso(a.gx, a.gy), iso(...mid), iso(b.gx, b.gy)];
    c.lineCap = 'round'; c.lineJoin = 'round';
    const path = () => { c.beginPath(); c.moveTo(P[0][0], P[0][1]); c.lineTo(P[1][0], P[1][1]); c.lineTo(P[2][0], P[2][1]); };
    path(); c.strokeStyle = '#24163a'; c.lineWidth = 15; c.stroke(); path(); c.strokeStyle = '#4a4470'; c.lineWidth = 10; c.stroke();
    path(); c.setLineDash([4, 8]); c.lineDashOffset = on ? -this.t * 30 : 0; c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 8; c.stroke(); c.setLineDash([]);
    if (!on) return;
    const l1 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), l2 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]), L = l1 + l2;
    for (let d = (this.t * 40) % 34; d < L; d += 34) {
      const [x, y] = d < l1 ? [P[0][0] + (P[1][0] - P[0][0]) * d / l1, P[0][1] + (P[1][1] - P[0][1]) * d / l1] : [P[1][0] + (P[2][0] - P[1][0]) * (d - l1) / l2, P[1][1] + (P[2][1] - P[1][1]) * (d - l1) / l2];
      c.fillStyle = col; c.strokeStyle = '#24163a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 6, y - 4); c.lineTo(x, y - 1); c.lineTo(x - 6, y - 4); c.closePath(); c.fill(); c.stroke();
    }
  }
  private label(sl: Slot) {
    const v = visible(sl); if (v === 'hidden' || sl.kind === 'hq') return;
    const c = this.c, [x, y0] = iso(sl.gx, sl.gy), y = y0 + sl.s * TH / 2 + 14, S = G.S;
    if (v === 'plot') { const k = cost(sl); if (k === null) return; this.pill(x, y, '$' + short(k), S.cash >= k ? '#5cff9d' : '#ffffff', 'rgba(36,22,58,.85)'); return; }
    const n = level(sl);
    const showLv = sl.key === this.sel || sl.key === this.guide || this.z > .95; if (showLv && (sl.kind === 'mine' || sl.kind === 'mach' || sl.kind === 'gen')) this.pill(x, y, 'Lv ' + n, '#fff', 'rgba(36,22,58,.85)');
    if (sl.kind === 'mine') {
      const m = S.mines[sl.idx]; const p = m.m || m.run ? Math.min(1, m.p) : 0;
      c.fillStyle = '#24163a'; rr(c, x - 26, y + 11, 52, 8, 4); c.fill(); c.fillStyle = hsl(MINES[sl.idx].hue, 95, 60); if (p > 0) { rr(c, x - 25, y + 12, 50 * (G.cycle(sl.idx) < .3 ? 1 : p), 6, 3); c.fill(); }
      if (!m.m && !m.run && this.guide !== sl.key) { const b = Math.abs(Math.sin(this.t * 4)) * 8; this.bubble(x, y0 - 92 - tier(sl) * 12 - b, 'TAP!'); }
    }
    if (sl.kind === 'mach') { const ms = G.machStats[sl.idx]; if (ms.reason === 'starved' || ms.reason === 'power') this.bubble(x, y0 - 90 - tier(sl) * 8, ms.reason === 'power' ? '⚡' : '!', '#ff5b5b'); }
    const k = cost(sl); if (k !== null && S.cash >= k) { const b = Math.sin(this.t * 5) * 3; c.beginPath(); const ax = x + 34, ay = y - 2 + b; c.moveTo(ax, ay - 10); c.lineTo(ax + 8, ay); c.lineTo(ax + 3, ay); c.lineTo(ax + 3, ay + 7); c.lineTo(ax - 3, ay + 7); c.lineTo(ax - 3, ay); c.lineTo(ax - 8, ay); c.closePath(); c.fillStyle = '#5cff9d'; c.fill(); c.strokeStyle = '#24163a'; c.lineWidth = 2; c.stroke(); }
  }
  private pill(x: number, y: number, txt: string, fg: string, bg: string) {
    const c = this.c; c.font = '700 15px Fredoka, sans-serif'; const w = c.measureText(txt).width + 16;
    c.fillStyle = bg; rr(c, x - w / 2, y - 10, w, 20, 10); c.fill(); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y + 1);
  }
  private bubble(x: number, y: number, txt: string, bg = '#ffd23f') {
    const c = this.c; c.font = '700 14px Fredoka, sans-serif'; const w = c.measureText(txt).width + 18;
    c.fillStyle = bg; c.strokeStyle = '#24163a'; c.lineWidth = 3; rr(c, x - w / 2, y - 13, w, 24, 12); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 6, y + 10); c.lineTo(x, y + 18); c.lineTo(x + 6, y + 10); c.fill(); c.stroke(); c.fillRect(x - 5, y + 8, 10, 3);
    c.fillStyle = '#24163a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y);
  }
}
function bakeShadow(g: CanvasRenderingContext2D, s: number) {
  // soft cast shadow (toward bottom-right, away from the warm key light) + contact ambient occlusion
  const hw = s * TW / 2, hh = s * TH / 2;
  g.save(); g.filter = 'blur(7px)'; g.fillStyle = 'rgba(16,4,36,.42)'; g.beginPath(); g.ellipse(18, 14, hw * 1.05, hh * 1.1, 0, 0, 7); g.fill(); g.restore();
  const ao = g.createRadialGradient(0, 0, hw * .5, 0, 0, hw * 1.15); ao.addColorStop(0, 'rgba(16,4,36,.35)'); ao.addColorStop(1, 'rgba(16,4,36,0)'); g.save(); g.scale(1, .5); g.fillStyle = ao; g.beginPath(); g.arc(0, 0, hw * 1.15, 0, 7); g.fill(); g.restore();
}
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function short(v: number) { const s = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx']; let e = 0; while (v >= 1000 && e < s.length - 1) { v /= 1000; e++; } return (v >= 100 || e === 0 ? Math.floor(v).toString() : v.toFixed(1)) + s[e]; }
