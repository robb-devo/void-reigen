// Base view: camera (pan / pinch / wheel zoom), layout, conveyors, drones, labels, hit-testing.
import { MINES, MACHINES, RES, Res } from '../game/data';
import * as G from '../game/state';
import { outlinedText } from '../design';
import { route, along, polyLen, Pt } from './route';
import { drawBuilding, drawPlot, iso, TW, TH, Kind, hsl, scaffold, ship, glow, INK, box, traderShip, wreck } from './render';

/** Vertical framing: the playfield visible between the HUD (cash + goal bar, ~top 24%) and the bottom hint sits centred at ~57%. */
const FRAME_Y = .57;
export type Slot = { key: string; kind: Kind; idx: number; gx: number; gy: number; s: number; rock?: number; dx?: number; dy?: number };
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
for (const s of ALL_SLOTS) { s.dx = s.gx; s.dy = s.gy; }
// ---- free building: main-rock buildings live wherever the player put them (S.pos), on an integer grid ----
export const MAIN_R = 10.2;
const posOf = (k: string) => G.S.pos?.[k];
/** apply saved positions (defaults = the old fixed layout) */
export function syncPos() { for (const s of ALL_SLOTS) if (!s.rock) { const p = posOf(s.key); s.gx = p ? p[0] : s.dx!; s.gy = p ? p[1] : s.dy!; } }
/** built and standing on the map */
export const onMap = (sl: Slot) => visible(sl) === 'built' && (!!sl.rock || !!posOf(sl.key));
let moveKey: string | null = null;
/** can building `key` stand with its centre at (gx, gy)? 3×3 pad incl. lane ring must not overlap another pad, and stay on the rock */
export function canPlace(key: string, gx: number, gy: number) {
  for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) if (Math.hypot(gx + a, gy + b) > MAIN_R - 1.25) return false;
  return !ALL_SLOTS.some(o => !o.rock && o.key !== key && onMap(o) && Math.max(Math.abs(o.gx - gx), Math.abs(o.gy - gy)) < 3);
}
/** nearest valid spot to `pref` (spiral over integer cells) */
export function findSpot(key: string, pref: [number, number]): [number, number] | null {
  let best: [number, number] | null = null, bd = 1e9; const px = Math.round(pref[0]), py = Math.round(pref[1]);
  for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) { const d = Math.hypot(x - px, y - py) + Math.hypot(x, y) * .15; if (d < bd && canPlace(key, x, y)) { bd = d; best = [x, y]; } }
  return best;
}
/** buildings that became 'built' without being placed (auto-unlocks like the generator, old saves, list buys) get a spot */
export function autoPlace(): string[] {
  const out: string[] = []; G.S.pos ||= {}; syncPos();
  for (const s of ALL_SLOTS) { if (s.rock || posOf(s.key) || visible(s) !== 'built') continue; const p = findSpot(s.key, [s.dx!, s.dy!]); if (p) { G.S.pos[s.key] = p; s.gx = p[0]; s.gy = p[1]; out.push(s.key); } }
  return out;
}
export function setPos(key: string, gx: number, gy: number) { (G.S.pos ||= {})[key] = [gx, gy]; syncPos(); }
const tierOf = (n: number, steps: number[]) => Math.max(0, steps.filter(v => n >= v).length - 1);
const TRADER_SC = 1.35, WRECK_SC = 1.45;
export let SLOTS: Slot[] = ALL_SLOTS.filter(s => !s.rock);
export const slotByKey = (k: string) => ALL_SLOTS.find(s => s.key === k);
export const TIER_STEPS: Record<string, number[]> = { mine: [1, 25, 100, 300, 1000], mach: [1, 10, 25, 50, 100], gen: [1, 5, 15, 30, 60], lab: [0, 3, 10, 25, 50], hangar: [1, 5, 15, 40, 100], yard: [1, 3, 6, 10, 15], lift: [1, 3, 6, 10, 15] };
export function level(sl: Slot): number {
  const S = G.S;
  switch (sl.kind) { case 'mine': return S.mines[sl.idx].n; case 'mach': return S.mach[sl.idx]; case 'gen': return S.gen; case 'yard': return G.fleetOpen() ? 1 + Object.values(S.fupg).reduce((a, b) => a + b, 0) + Math.floor(Object.values(S.ships).reduce((a, b) => a + b, 0) / 5) : 0; case 'hangar': return Object.values(S.ships).reduce((a, b) => a + b, 0); case 'dock': return G.docks(); case 'turret': return 1 + G.fu('armor'); case 'fuel': return 1 + G.fu('engines'); case 'lift': return G.fleetOpen() ? S.lift : 0; case 'gate': return G.warpOpen() ? S.warps + 1 : S.warps; case 'lab': return S.tech.length; default: return G.sector(); }
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
export function cost(sl: Slot): number | null {
  if (sl.kind === 'mine') return G.costN(sl.idx, G.S.mines[sl.idx].n ? G.buyK(sl.idx) : 1);
  if (sl.kind === 'mach') return G.machCostK(sl.idx, G.machK(sl.idx));
  if (sl.kind === 'gen') return G.genCost(G.genK());
  if (sl.kind === 'lift') return G.fleetOpen() ? G.liftCost() : null;
  return null;
}
const accentOf = (sl: Slot) => sl.kind === 'mine' ? RES[MINES[sl.idx].res].color : sl.kind === 'mach' ? RES[MACHINES[sl.idx].out].color : '#ffe066';
const hueOf = (sl: Slot) => sl.kind === 'mine' ? MINES[sl.idx].hue : sl.kind === 'mach' ? [20, 195, 215, 0, 140, 250, 290][sl.idx] : 210;
export const idOf = (sl: Slot) => sl.kind === 'mine' ? MINES[sl.idx].id : sl.kind === 'mach' ? MACHINES[sl.idx].id : sl.kind;
const activeOf = (sl: Slot) => sl.kind === 'mine' ? (G.S.mines[sl.idx].m || G.S.mines[sl.idx].run) : sl.kind === 'mach' ? G.machStats[sl.idx].eff > 0.01 : sl.kind === 'gen' ? G.powerDemand() > 0 : sl.kind === 'gate' ? G.warpOpen() : sl.kind === 'yard' ? G.fleetOpen() : sl.kind === 'lift' ? G.fleetOpen() && G.S.liftOn : sl.kind === 'lab' ? G.S.tech.length > 0 : true;

type Drone = { a: [number, number]; b: [number, number]; t: number; col: string; done?: () => void };
type Puff = { x: number; y: number; t: number; c: string };
type Ship = { x: number; y: number; vy: number; t: number; dir: 1 | -1; sc: number };
type Sprite = { cv: HTMLCanvasElement; k: number; bx: number; by: number };
/** Crop a baked sprite to its opaque bounds: most of the 240×300 bake box is empty, and blitting empty pixels isn't free. */
function trim(cv: HTMLCanvasElement): [HTMLCanvasElement, number, number] {
  const g = cv.getContext('2d')!, { width: W, height: H } = cv, d = g.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return [cv, 0, 0]; x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); const w = Math.min(W, x1 + 2) - x0, h = Math.min(H, y1 + 2) - y0;
  const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d')!.drawImage(cv, x0, y0, w, h, 0, 0, w, h); return [o, x0, y0];
}
export class BaseView {
  cv: HTMLCanvasElement; c: CanvasRenderingContext2D; z = 0.66; ox = 0; oy = 0; dpr = Math.min(1.5, devicePixelRatio || 1);
  w = 0; h = 0; sel: string | null = null; guide: string | null = null; drones: Drone[] = []; puffs: Puff[] = []; t = 0;
  ships: Ship[] = []; cons = new Map<string, number>(); sprites = new Map<string, Sprite>(); cam: { x: number; y: number; z: number } | null = null; warpT = -1; warpCb: (() => void) | null = null; shake = 0;
  onTap: (sl: Slot | null, x: number, y: number) => void = () => {};
  onConstruct: () => void = () => {};
  private lastTier = new Map<string, number>(); private workers: { a: number; b: number; f: number; sp: number; c: string }[] = [];
  night = 0; private pods: { t: number; x: number }[] = []; private podT = 1; rock = 0; travelT = -1; private travelTo = 0; onTravel: (r: number) => void = () => {};
  /** fly the camera between asteroids */
  travel(r: number) { if (this.travelT >= 0 || r === this.rock) return; this.travelTo = r; this.travelT = 0; this.cam = null; }
  setRock(r: number) { this.rock = r; SLOTS = ALL_SLOTS.filter(s => (s.rock || 0) === r); this.workers = []; this.drones = []; this.gcache = null; this.sel = null; this.cam = null; this.ox = this.w / 2; this.oy = this.h * .52; if (r) { this.zMain = this.z; this.z = Math.max(this.z, .95); } else this.z = this.zMain || this.z; this.onTravel(r); }
  private zMain = 0; private lsig = '';
  // ---- placement mode (Build menu / Move): a ghost that snaps to the grid, green when it fits ----
  place: { key: string; gx: number; gy: number; mode: 'new' | 'move'; ok: boolean; from?: [number, number]; t: number } | null = null;
  onPlace: (moved: boolean) => void = () => {};
  private drag: { dx: number; dy: number } | null = null;
  gridAt(cx: number, cy: number, raw = false): [number, number] { const r = this.cv.getBoundingClientRect(), lx = (cx - r.left - this.ox) / this.z, ly = (cy - r.top - this.oy) / this.z; const gx = (lx / (TW / 2) + ly / (TH / 2)) / 2, gy = (ly / (TH / 2) - lx / (TW / 2)) / 2; return raw ? [gx, gy] : [Math.round(gx), Math.round(gy)]; }
  startPlace(key: string, mode: 'new' | 'move', at: [number, number]) {
    const sl = slotByKey(key)!; moveKey = mode === 'move' ? key : null; this.lsig = ''; this.sel = null;
    this.place = { key, gx: at[0], gy: at[1], mode, ok: false, from: mode === 'move' ? [sl.gx, sl.gy] : undefined, t: this.t };
    sl.gx = at[0]; sl.gy = at[1]; this.place.ok = canPlace(key, at[0], at[1]); this.focusAt(at[0], at[1]); this.onPlace(false);
  }
  placeAt(gx: number, gy: number) { const p = this.place; if (!p || (p.gx === gx && p.gy === gy)) return; const sl = slotByKey(p.key)!; p.gx = gx; p.gy = gy; sl.gx = gx; sl.gy = gy; p.ok = canPlace(p.key, gx, gy); p.t = this.t; this.onPlace(true); }
  endPlace() { const p = this.place; this.place = null; moveKey = null; this.drag = null; this.lsig = ''; syncPos(); return p; }
  focusAt(gx: number, gy: number) { const [x, y] = iso(gx, gy), z = Math.max(this.z, .75), lx = 330 * z, ly = 200 * z; this.cam = { x: Math.max(this.w / 2 - lx, Math.min(this.w / 2 + lx, this.w / 2 - x * z)), y: Math.max(this.h / 2 - ly, Math.min(this.h / 2 + ly, this.h * .52 - y * z)), z }; }
  private onGhost(cx: number, cy: number) { const p = this.place; if (!p) return false; const [gx, gy] = this.gridAt(cx, cy, true); return Math.abs(gx - p.gx) + Math.abs(gy - p.gy) < 2.6 || (() => { const r = this.cv.getBoundingClientRect(), lx = (cx - r.left - this.ox) / this.z, ly = (cy - r.top - this.oy) / this.z, [x, y] = iso(p.gx, p.gy); return Math.abs(lx - x) < 50 && ly < y && ly > y - 110; })(); }
  private drawGhost() {
    const p = this.place!, c = this.c, sl = slotByKey(p.key)!, [x, y] = iso(p.gx, p.gy), t = this.t, hop = Math.max(0, 1 - (t - p.t) / .18);
    const col = p.ok ? '92,255,157' : '255,91,91', q = (h: number) => { const a = iso(p.gx - h, p.gy - h), b = iso(p.gx + h, p.gy - h), d = iso(p.gx + h, p.gy + h), e = iso(p.gx - h, p.gy + h); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.closePath(); };
    q(1.5); c.fillStyle = `rgba(${col},.28)`; c.fill(); c.lineWidth = 3; c.strokeStyle = `rgba(${col},.95)`; c.setLineDash([10, 6]); c.lineDashOffset = -t * 20; c.stroke(); c.setLineDash([]);
    // tile grid inside the footprint
    c.strokeStyle = `rgba(${col},.45)`; c.lineWidth = 1.5; for (const k of [-.5, .5]) { let [a, b] = iso(p.gx + k, p.gy - 1.5), [d, e] = iso(p.gx + k, p.gy + 1.5); c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); [a, b] = iso(p.gx - 1.5, p.gy + k); [d, e] = iso(p.gx + 1.5, p.gy + k); c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }
    // the building itself, lifted and see-through
    c.save(); c.globalAlpha = p.ok ? .88 : .6; c.translate(0, -10 - Math.sin(t * 4) * 3 - hop * 10); this.building(sl, x, y); c.restore();
    // move arrows on the four sides
    const b = Math.sin(t * 5) * 3; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const [px, py] = iso(p.gx + ax * (2.25 + b * .03), p.gy + ay * (2.25 + b * .03)), [qx, qy] = iso(p.gx + ax * 3, p.gy + ay * 3), ang = Math.atan2(qy - py, qx - px);
      c.save(); c.translate(px, py); c.rotate(ang); c.beginPath(); c.moveTo(10, 0); c.lineTo(-3, -9); c.lineTo(-3, -4); c.lineTo(-10, -4); c.lineTo(-10, 4); c.lineTo(-3, 4); c.lineTo(-3, 9); c.closePath(); c.fillStyle = p.ok ? '#5cff9d' : '#ff7a7a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke(); c.restore(); }
  }
  pad(): [number, number] { const l = slotByKey('lift')!; return this.rock ? iso(0, 0) : iso(l.gx, l.gy); }
  private ptrs = new Map<number, { x: number; y: number }>(); private moved = 0; private pinch0 = 0; private z0 = 1; private craters: number[][] = [];
  constructor(parent: HTMLElement) {
    this.gcv = document.createElement('canvas'); this.gcv.className = 'bground'; parent.appendChild(this.gcv); this.cv = document.createElement('canvas'); this.cv.id = 'base'; parent.appendChild(this.cv); { const v = document.createElement('div'); v.className = 'bvig'; parent.appendChild(v); } this.c = this.cv.getContext('2d')!;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 26; k++) { const a = rnd() * 7, r = 3 + rnd() * 7.5; this.craters.push([Math.cos(a) * r, Math.sin(a) * r, .5 + rnd() * 1.3]); }
    this.resize(); new ResizeObserver(() => this.resize()).observe(parent);
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => { this.cam = null; cv.setPointerCapture(e.pointerId);
      if (this.place && this.ptrs.size === 0 && this.onGhost(e.clientX, e.clientY)) { const [gx, gy] = this.gridAt(e.clientX, e.clientY, true); this.drag = { dx: this.place.gx - gx, dy: this.place.gy - gy }; } this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.moved = 0; if (this.ptrs.size === 2) { this.pinch0 = this.pdist(); this.z0 = this.z; } });
    cv.addEventListener('pointermove', e => {
      const p = this.ptrs.get(e.pointerId); if (!p) return;
      if (this.drag && this.ptrs.size === 1) { const [gx, gy] = this.gridAt(e.clientX, e.clientY, true); this.placeAt(Math.round(gx + this.drag.dx), Math.round(gy + this.drag.dy)); this.moved = 99; p.x = e.clientX; p.y = e.clientY;
        // nudge the camera when dragging near an edge
        const r = this.cv.getBoundingClientRect(), m = 40; if (e.clientX < r.left + m) this.ox += 6; else if (e.clientX > r.right - m) this.ox -= 6; if (e.clientY < r.top + m + 60) this.oy += 6; else if (e.clientY > r.bottom - m - 90) this.oy -= 6; this.clamp(); return; }
      if (this.ptrs.size === 2) this.drag = null;
      if (this.ptrs.size === 1) { this.ox += e.clientX - p.x; this.oy += e.clientY - p.y; this.moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y); }
      p.x = e.clientX; p.y = e.clientY;
      if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.zoomAt(this.z0 * this.pdist() / this.pinch0, (a.x + b.x) / 2, (a.y + b.y) / 2); this.moved = 99; }
      this.clamp();
    });
    const up = (e: PointerEvent) => { if (this.drag) { this.drag = null; this.ptrs.delete(e.pointerId); return; } const had = this.ptrs.delete(e.pointerId); if (had && this.ptrs.size === 0 && this.moved < 10) this.tap(e.clientX, e.clientY); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => this.ptrs.delete(e.pointerId));
    cv.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(this.z * Math.exp(-e.deltaY * .0015), e.clientX, e.clientY); this.clamp(); }, { passive: false });
  }
  private pdist() { const [a, b] = [...this.ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
  zoomAt(nz: number, cx: number, cy: number) { nz = Math.max(.45, Math.min(1.8, nz)); const r = this.cv.getBoundingClientRect(), lx = cx - r.left, ly = cy - r.top; this.ox = lx - (lx - this.ox) * nz / this.z; this.oy = ly - (ly - this.oy) * nz / this.z; this.z = nz; }
  clamp() { const lx = 330 * this.z, ly = 200 * this.z; this.ox = Math.max(this.w / 2 - lx, Math.min(this.w / 2 + lx, this.ox)); this.oy = Math.max(this.h / 2 - ly, Math.min(this.h / 2 + ly, this.oy)); }
  resize() { const host = this.cv.parentElement!.parentElement || this.cv.parentElement!; const r = host.getBoundingClientRect(); if (!r.width) return; const first = !this.w; this.w = r.width; this.h = r.height; this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr; this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px'; this.gcv.width = this.cv.width; this.gcv.height = this.cv.height; this.gcv.style.width = this.w + 'px'; this.gcv.style.height = this.h + 'px'; this.gkey = ''; if (first || !this.ox) { this.ox = this.w / 2; this.oy = this.h * FRAME_Y; } this.gcache = null; }
  private camT: [number, number, number] = [0, 0, 1]; private nl: HTMLCanvasElement | null = null; private nlKey = '';
  private gcache: HTMLCanvasElement | null = null; private gz = 0; private gcv!: HTMLCanvasElement; private gkey = ''; private ggen = 0;
  /** world → client(page) coords */
  screen(gx: number, gy: number): [number, number] { const [x, y] = iso(gx, gy); const r = this.cv.getBoundingClientRect(); return [r.left + this.ox + x * this.z, r.top + this.oy + y * this.z]; }
  slotScreen(key: string): [number, number] { const sl = SLOTS.find(s => s.key === key)!; const [x, y] = this.screen(sl.gx, sl.gy); return [x, y - 40 * this.z]; }
  focus(key: string, z = this.z, yf = FRAME_Y, with2?: string) { if (!with2 && !this.rock && G.S.warps === 0 && G.S.goal < 14 && key !== 'm0' && key !== 'hq') with2 = 'm0'; const sl = SLOTS.find(s => s.key === key); if (!sl) return; let [x, y] = iso(sl.gx, sl.gy); const s2 = with2 && SLOTS.find(s => s.key === with2); if (s2) { const [x2, y2] = iso(s2.gx, s2.gy); x = (x + x2) / 2; y = (y + y2) / 2; } const lx = 330 * z, ly = 200 * z; this.cam = { x: Math.max(this.w / 2 - lx, Math.min(this.w / 2 + lx, this.w / 2 - x * z)), y: Math.max(this.h / 2 - ly, Math.min(this.h / 2 + ly, this.h * yf - y * z)), z }; }
  construct(key: string) { this.cons.set(key, this.t); }
  // ---- meteor shower (mid-game random event): rocks streak in, land glowing, tap to crack for a payout ----
  meteors: { gx: number; gy: number; t: number; st: 0 | 1 | 2; ct: number; rock: number }[] = []; onMeteor: (x: number, y: number) => void = () => {};
  shower(n: number) { const R = this.rock ? 6 : 9; let tries = 0; while (n > 0 && tries++ < 200) { const a = Math.random() * 6.283, r = 2 + Math.random() * (R - 2.5), gx = Math.cos(a) * r, gy = Math.sin(a) * r; if (SLOTS.some(s2 => Math.abs(s2.gx - gx) < 1.3 && Math.abs(s2.gy - gy) < 1.3) || this.meteors.some(m => Math.hypot(m.gx - gx, m.gy - gy) < 1.2)) continue; const [sx, sy] = iso(gx, gy); if (Math.abs(this.ox + sx * this.z - this.w / 2) > this.w * .45 || this.oy + sy * this.z < 220 || this.oy + sy * this.z > this.h - 120) continue; this.meteors.push({ gx, gy, t: this.t + n * .55 + Math.random() * .3, st: 0, ct: 0, rock: this.rock }); n--; } }
  private meteorAt(lx: number, ly: number) { return this.meteors.find(m => { if (m.st !== 1 || m.rock !== this.rock) return false; const [x, y] = iso(m.gx, m.gy); return Math.abs(lx - x) < 22 && ly < y + 10 && ly > y - 30; }); }
  private drawMeteors(front: boolean) {
    const c = this.c, t = this.t;
    this.meteors = this.meteors.filter(m => { const [x, y] = iso(m.gx, m.gy), age = t - m.t;
      if (age < 0) return true; if (m.rock !== this.rock) return t - m.t < 30; // other rock: keep it (briefly) without drawing
      if (m.st === 0) { if (!front) return true; const f = Math.min(1, age / .8), e = f * f, px = x + 300 * (1 - e), py = y - 560 * (1 - e);
        const g = c.createLinearGradient(px, py, px + 90, py - 170); g.addColorStop(0, 'rgba(255,240,180,.95)'); g.addColorStop(.3, 'rgba(255,140,40,.7)'); g.addColorStop(1, 'rgba(255,80,40,0)'); c.strokeStyle = g; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 90, py - 170); c.stroke();
        glow(c, px, py, 30, '#ffb347', .9); c.beginPath(); c.arc(px, py, 8, 0, 7); c.fillStyle = '#ffe9a0'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
        if (f >= 1) { m.st = 1; m.ct = t; this.shake = Math.max(this.shake, .14); this.onImpact(); } return true; }
      if (m.st === 1) { if (!front) return true; { const k = t - m.ct; if (k < .4) { const f = k / .4; c.beginPath(); c.ellipse(x, y, 20 + f * 60, (20 + f * 60) * .5, 0, 0, 7); c.strokeStyle = `rgba(255,190,90,${1 - f})`; c.lineWidth = 6 * (1 - f) + 1; c.stroke(); } const ph = (t * 1.4 + m.gx) % 1; c.beginPath(); c.ellipse(x, y - 2, 18 + ph * 22, (18 + ph * 22) * .5, 0, 0, 7); c.strokeStyle = `rgba(255,170,60,${(1 - ph) * .9})`; c.lineWidth = 3; c.stroke(); for (let q = 0; q < 3; q++) { const a2 = t * 2 + q * 2.1 + m.gy; star(c, x + Math.cos(a2) * 20, y - 14 + Math.sin(a2) * 9, 3.5 + Math.sin(t * 6 + q) * 1.5); } }
        const k = t - m.ct, life = 16, cool = Math.max(0, (k - life + 3) / 3); if (k > life) return false; const S2 = 1.35; c.save(); c.translate(x, y); c.scale(S2, S2); c.translate(-x, -y);
        c.beginPath(); c.ellipse(x, y + 2, 20, 9, 0, 0, 7); c.fillStyle = 'rgba(20,8,40,.45)'; c.fill(); c.globalAlpha = 1 - cool;
        glow(c, x, y - 8, 34, '#ff8a2e', (.45 + Math.sin(t * 5) * .15) * (1 - cool));
        c.beginPath(); c.moveTo(x - 15, y); c.quadraticCurveTo(x - 16, y - 16, x - 2, y - 19); c.quadraticCurveTo(x + 15, y - 17, x + 15, y - 2); c.quadraticCurveTo(x, y + 5, x - 15, y); c.fillStyle = '#4a3a5e'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
        c.strokeStyle = `rgba(255,${150 + Math.sin(t * 6) * 60},60,1)`; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 8, y - 4); c.lineTo(x - 3, y - 11); c.lineTo(x + 3, y - 8); c.lineTo(x + 8, y - 14); c.moveTo(x - 3, y - 11); c.lineTo(x - 5, y - 16); c.stroke(); c.globalAlpha = 1; c.restore(); return true; }
      // cracked: shards fly out, then gone
      if (!front) return true; const k = (t - m.ct) / .5; if (k >= 1) return false; for (let q = 0; q < 7; q++) { const a = q / 7 * 6.283, d = 10 + k * 46; c.globalAlpha = 1 - k; c.fillStyle = q % 2 ? '#ffb347' : '#6a5a7e'; c.beginPath(); c.arc(x + Math.cos(a) * d, y - 10 + Math.sin(a) * d * .6 - k * 20, 5 * (1 - k) + 1, 0, 7); c.fill(); } c.globalAlpha = 1; return true; });
  }
  onImpact: () => void = () => {};
  // ---- shared: a free, on-screen patch of ground for an event to land on ----
  private freeSpot(clear: number, minR: number, maxR: number): [number, number] | null {
    let best: [number, number] | null = null, bs = -1e9;
    for (let k = 0; k < 160; k++) { const a = Math.random() * 6.283, r = minR + Math.random() * (maxR - minR), gx = Math.cos(a) * r, gy = Math.sin(a) * r;
      const d = Math.min(99, ...SLOTS.filter(s2 => onMap(s2)).map(s2 => Math.max(Math.abs(s2.gx - gx), Math.abs(s2.gy - gy)) - s2.s / 2)); if (d < clear) continue;
      if (this.meteors.some(m => Math.hypot(m.gx - gx, m.gy - gy) < 2)) continue;
      const [sx, sy] = iso(gx, gy), X = this.ox + sx * this.z, Y = this.oy + sy * this.z; if (Math.abs(X - this.w / 2) > this.w * .3 || Y < this.h * .38 || Y > this.h * .72) continue;
      const sc = Math.min(d, 1.6) - Math.abs(X - this.w / 2) / 140 - Math.abs(Y - this.h * .58) / 220; if (sc > bs) { bs = sc; best = [gx, gy]; } }
    return best;
  }
  // ---- visiting trader (mining rock): lands, opens its ramp, waits, lifts off ----
  trader: { gx: number; gy: number; t: number; st: 0 | 1 | 2; lt: number; left: number } | null = null; onTrader: () => void = () => {}; onTraderLand: () => void = () => {};
  traderCome(pan = true) { if (this.trader || this.rock) return false; const p = this.freeSpot(.7, 1.5, 7.5) || this.freeSpot(.35, 1, 8); if (!p) return false; if (pan) { const [x, y] = iso(p[0], p[1]); this.cam = { x: this.w / 2 - x * this.z, y: this.h * .6 - y * this.z, z: this.z }; } this.trader = { gx: p[0], gy: p[1], t: this.t, st: 0, lt: 0, left: 1 }; return true; }
  traderGo() { if (this.trader && this.trader.st !== 2) { this.trader.st = 2; this.trader.lt = this.t; } }
  private traderPose() { const tr = this.trader!, [x, y] = iso(tr.gx, tr.gy), t = this.t;
    if (tr.st === 0) { const f = Math.min(1, (t - tr.t) / 2.4), e = 1 - Math.pow(1 - f, 3); return { x: x + 170 * (1 - e), y, alt: 540 * (1 - e), flame: 1, legs: Math.max(0, (f - .55) / .45), ramp: 0, f }; }
    if (tr.st === 1) return { x, y, alt: Math.sin(t * 2) * .8 + .8, flame: 0, legs: 1, ramp: Math.min(1, (t - tr.lt) / .5), f: 1 };
    const k = t - tr.lt, a = Math.max(0, k - .45); return { x: x - a * a * 120, y, alt: a * a * 520, flame: k > .3 ? 1 : 0, legs: Math.max(0, 1 - (k - .15) / .3), ramp: Math.max(0, 1 - k / .25), f: 1 };
  }
  private traderAt(lx: number, ly: number) { if (!this.trader || this.trader.st !== 1 || this.rock) return false; const p = this.traderPose(); return Math.abs(lx - p.x) < 50 * TRADER_SC && ly < p.y + 24 * TRADER_SC && ly > p.y - 150 * TRADER_SC; }
  private drawTrader() {
    const tr = this.trader; if (!tr || this.rock) return; const c = this.c, t = this.t, p = this.traderPose();
    if (tr.st === 0 && p.f >= 1) { tr.st = 1; tr.lt = t; this.shake = Math.max(this.shake, .12); for (let k = 0; k < 16; k++) this.puffs.push({ x: p.x + (Math.random() - .5) * 110, y: p.y + (Math.random() - .5) * 40, t: -Math.random() * .15, c: 'rgba(235,225,255,.85)' }); this.onTraderLand(); }
    if (tr.st === 2 && p.alt > 1100) { this.trader = null; return; }
    if (p.flame && p.alt < 90 && Math.random() < .5) this.puffs.push({ x: p.x + (Math.random() - .5) * 70, y: p.y + (Math.random() - .5) * 20, t: 0, c: 'rgba(235,225,255,.7)' });
    { const K = TRADER_SC; c.save(); c.translate(p.x, p.y); c.scale(K, K); c.translate(-p.x, -p.y); traderShip(c, p.x, p.y, p.alt / K, t, p.flame, p.legs, p.ramp); c.restore(); }
    if (tr.st === 1) { // holo shop sign with a countdown ring
      const b = Math.sin(t * 3) * 4, sx = p.x, sy = p.y - 92 * TRADER_SC + b, k = Math.min(1, (t - tr.lt) / .35), r = 19 * (k < 1 ? 1 - Math.pow(1 - k, 3) * (1 - k) : 1);
      c.beginPath(); c.moveTo(sx, sy + r + 9); c.lineTo(sx - 7, sy + r - 1); c.lineTo(sx + 7, sy + r - 1); c.closePath(); c.fillStyle = INK; c.fill();
      c.beginPath(); c.arc(sx, sy, r + 4, 0, 7); c.fillStyle = INK; c.fill(); c.beginPath(); c.arc(sx, sy, r, 0, 7); c.fillStyle = '#ffd23f'; c.fill();
      c.beginPath(); c.arc(sx, sy, r + 1.5, -Math.PI / 2, -Math.PI / 2 + 6.283 * tr.left); c.strokeStyle = tr.left < .25 ? '#ff5b5b' : '#5cff8a'; c.lineWidth = 3.5; c.stroke();
      c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round'; const s = r / 19; // ⇄ arrows
      c.beginPath(); c.moveTo(sx - 9 * s, sy - 4 * s); c.lineTo(sx + 9 * s, sy - 4 * s); c.lineTo(sx + 4 * s, sy - 9 * s); c.moveTo(sx + 9 * s, sy + 4 * s); c.lineTo(sx - 9 * s, sy + 4 * s); c.lineTo(sx - 4 * s, sy + 9 * s); c.stroke();
    }
  }
  // ---- derelict wreck (fleet rock): crashes into the ice, tap it apart for salvage ----
  wreckE: { gx: number; gy: number; t: number; st: 0 | 1 | 2; hits: number; ht: number; ct: number } | null = null; onWreck: (final: boolean, x: number, y: number) => void = () => {};
  wreckCome(landed = false) { if (this.wreckE) return false; let p = this.rock === 1 ? this.freeSpot(.8, 1.6, 4.6) : null; if (!p) { const a = Math.random() * 6.283; p = [Math.cos(a) * 3.2, Math.sin(a) * 3.2]; } this.wreckE = { gx: p[0], gy: p[1], t: this.t - (landed ? 9 : 0), st: landed ? 1 : 0, hits: 0, ht: -9, ct: 0 }; return true; }
  private wreckAt(lx: number, ly: number) { const w = this.wreckE; if (!w || w.st !== 1 || this.rock !== 1) return false; const [x, y] = iso(w.gx, w.gy); return Math.abs(lx - x) < 50 * WRECK_SC && ly < y + 22 * WRECK_SC && ly > y - 70 * WRECK_SC; }
  private drawWreck() {
    const w = this.wreckE; if (!w || this.rock !== 1) return; const c = this.c, t = this.t, [x, y] = iso(w.gx, w.gy), age = t - w.t;
    if (w.st === 0) { const f = Math.min(1, age / 1.3), e = f * f, px = x - 380 * (1 - e), py = y - 600 * (1 - e);
      for (let k = 0; k < 6; k++) { const q = k / 6; glow(c, px - 380 * q * .25, py - 600 * q * .25, 26 - k * 3, k ? '#8a8fa8' : '#ffb347', .5 - q * .4); }
      c.save(); c.translate(px, py); c.scale(.9, .9); c.translate(-px, -py); wreck(c, px, py, t, 0); c.restore(); glow(c, px, py - 10, 40, '#ff7a2e', .7);
      if (f >= 1) { w.st = 1; w.ct = t; this.shake = Math.max(this.shake, .22); for (let k = 0; k < 18; k++) this.puffs.push({ x: x + (Math.random() - .5) * 120, y: y + (Math.random() - .5) * 40, t: -Math.random() * .2, c: 'rgba(225,240,255,.9)' }); this.onImpact(); }
      return; }
    if (w.st === 1) { const k = t - w.ct; if (k < .5) { const f = k / .5; c.beginPath(); c.ellipse(x, y, 30 + f * 90, (30 + f * 90) * .5, 0, 0, 7); c.strokeStyle = `rgba(200,235,255,${1 - f})`; c.lineWidth = 7 * (1 - f) + 1; c.stroke(); }
      const hk = (t - w.ht) / .25, jig = hk < 1 ? Math.sin(hk * Math.PI * 3) * (1 - hk) * 5 : 0;
      if (Math.random() < .06) this.puffs.push({ x: x + 8 + (Math.random() - .5) * 20, y: y - 26, t: 0, c: 'rgba(110,105,130,.55)' }); // smoulder
      c.save(); c.translate(x + jig, y); c.scale(WRECK_SC, WRECK_SC); c.translate(-x, -y); wreck(c, x, y, t, w.hits / this.wreckHits); c.restore();
      // salvage pips + pulsing "tap me" ring
      const ph = (t * 1.2) % 1; c.beginPath(); c.ellipse(x, y + 2, (40 + ph * 26) * WRECK_SC, (40 + ph * 26) * .45 * WRECK_SC, 0, 0, 7); c.strokeStyle = `rgba(122,232,255,${(1 - ph) * .8})`; c.lineWidth = 3; c.stroke();
      for (let q = 0; q < this.wreckHits; q++) { const px = x - (this.wreckHits - 1) * 8 + q * 16, py = y - 70 * WRECK_SC; c.beginPath(); c.arc(px, py, 6.5, 0, 7); c.fillStyle = q < w.hits ? '#5cff8a' : 'rgba(36,22,58,.75)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); }
      return; }
    const k = (t - w.ct) / .7; if (k >= 1) { this.wreckE = null; return; } // final crack: plates + sparks scatter
    for (let q = 0; q < 12; q++) { const a = q / 12 * 6.283, d = 14 + k * 80; c.globalAlpha = 1 - k; c.fillStyle = q % 3 ? '#8f9ab8' : '#ffb347'; c.save(); c.translate(x + Math.cos(a) * d, y - 20 + Math.sin(a) * d * .6 - k * 30); c.rotate(k * 6 + q); c.fillRect(-5, -3, 10, 6); c.restore(); } c.globalAlpha = 1; glow(c, x, y - 20, 90 * (1 - k) + 20, '#fff0a0', 1 - k);
  }
  /** game decides how many hits a wreck takes */
  wreckHits = 5;
  punches = new Map<string, number>(); punch(key: string) { this.punches.set(key, this.t); }
  private portraits = new Map<string, string>();
  /** Building portrait for panels — the real in-world art at its current tier. */
  portrait(key: string): string | null { const sl = slotByKey(key); if (!sl || visible(sl) !== 'built') return null; const tr = tier(sl), id = idOf(sl), k = `${id}|${tr}`; let u = this.portraits.get(k); if (u) return u;
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200; const g = cv.getContext('2d')!; g.setTransform(.95, 0, 0, .95, 100, 150); drawBuilding(g, 0, sl.kind, id, hueOf(sl), tr, 0, 0, sl.s, 0, true, accentOf(sl)); drawBuilding(g, 1, sl.kind, id, hueOf(sl), tr, 0, 0, sl.s, 1.3, true, accentOf(sl)); u = cv.toDataURL(); this.portraits.set(k, u); return u; }
  launch(n: number) { const [x, y] = this.pad(); for (let k = 0; k < Math.min(8, n); k++) this.ships.push({ x: x + (k % 3 - 1) * 26, y: y - 14, vy: 0, t: -k * .18, dir: 1, sc: .7 + Math.random() * .3 }); this.shake = .25; }
  land(n: number) { const [x, y] = this.pad(); for (let k = 0; k < Math.min(6, n); k++) this.ships.push({ x: x + (k % 3 - 1) * 26, y: y - 700, vy: 0, t: -k * .25, dir: -1, sc: .8 }); }
  warp(cb: () => void) { if (this.rock) this.setRock(0); this.warpT = 0; this.warpCb = cb; this.focus('gate', .8); }
  private tap(cx: number, cy: number) {
    if (this.travelT >= 0) return;
    const r = this.cv.getBoundingClientRect(); const lx = (cx - r.left - this.ox) / this.z, ly = (cy - r.top - this.oy) / this.z;
    { const m = this.meteorAt(lx, ly); if (m) { m.st = 2; m.ct = this.t; this.shake = Math.max(this.shake, .1); this.onMeteor(cx, cy); return; } }
    if (this.traderAt(lx, ly)) { this.onTrader(); return; }
    if (this.wreckAt(lx, ly)) { const w = this.wreckE!; w.hits++; w.ht = this.t; const fin = w.hits >= this.wreckHits; this.shake = Math.max(this.shake, fin ? .25 : .08); if (fin) { w.st = 2; w.ct = this.t; } this.onWreck(fin, cx, cy); return; }
    let best: Slot | null = null, bd = -1e9, onPad = false;
    if (this.place) { const p = this.gridAt(cx, cy); this.placeAt(p[0], p[1]); return; }
    for (const sl of SLOTS) {
      if (!onMap(sl) || sl.key === moveKey) continue;
      const [x, y] = iso(sl.gx, sl.gy), hw = sl.s * TW / 2, hh = sl.s * TH / 2;
      const inBase = Math.abs(lx - x) / hw + Math.abs(ly - y) / hh <= 1, inBody = Math.abs(lx - x) < hw * .6 && ly < y && ly > y - 70 - tier(sl) * 12;
      if (inBase) onPad = true; if ((inBase || inBody) && sl.gx + sl.gy > bd) { bd = sl.gx + sl.gy; best = sl; }
    }
    // props win over the generous building body box, but never over a tap on the building's own pad
    if (!onPad) { const d = this.propAt(lx, ly); if (d) { this.bounces.set(d[0] + ',' + d[1], this.t); this.onProp(d[2], this.rock); return; } }
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
      const to = SLOTS.find(s => s.key === 'f' + j)!; if (!S.mach[j] || !onMap(to) || to.key === moveKey) return;
      (Object.keys(d.inp) as Res[]).forEach(r => {
        const srcs = SLOTS.filter(sl => onMap(sl) && sl.key !== moveKey && ((sl.kind === 'mine' && MINES[sl.idx].res === r) || (sl.kind === 'mach' && MACHINES[sl.idx].out === r)));
        srcs.sort((a, b) => Math.hypot(a.gx - to.gx, a.gy - to.gy) - Math.hypot(b.gx - to.gx, b.gy - to.gy));
        srcs.slice(0, 2).forEach(sv => out.push([sv, to, r, G.machStats[j].eff > 0.01]));
      });
    });
    return out;
  }

  draw(dt: number) {
    this.t += dt; const { c, t } = this;
    if (!this.rock) { const fresh = autoPlace(); if (this.t > 1) for (const k of fresh) this.cons.set(k, this.t); }
    { const sig = this.rock + '|' + (moveKey || '') + '|' + SLOTS.filter(onMap).map(s => s.key + ':' + s.gx + ',' + s.gy).join(';'); if (sig !== this.lsig) { this.lsig = sig; this.routes.clear(); this.gcache = null; this.gkey = ''; this.decorKey = ''; } }
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
    this.camT = [this.ox + sx + tx, this.oy + sy, this.z * tz]; this.groundLayer(...this.camT);
    // conveyors
    const L = this.links();
    for (const [a, b, r, on] of L) this.belt(a, b, RES[r].color, on);
    this.drawWorkers(dt);
    // buildings back-to-front
    guideKey = this.guide; const order = SLOTS.filter(sl => onMap(sl) && sl.key !== moveKey).sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    this.drawMeteors(false);
    const dec = this.decor(); let di = 0; const dings: number[][] = [];
    for (const sl of order) {
      while (di < dec.length && dec[di][0] + dec[di][1] < sl.gx + sl.gy + 1.4) this.prop(dec[di++], t);
      const [x, y] = iso(sl.gx, sl.gy), v = visible(sl);
      if (sl.key === this.sel) { const hw = sl.s * TW / 2, hh = sl.s * TH / 2, p = 1 + Math.sin(t * 6) * .04; c.beginPath(); c.moveTo(x - hw * p, y); c.lineTo(x, y - hh * p); c.lineTo(x + hw * p, y); c.lineTo(x, y + hh * p); c.closePath(); c.fillStyle = 'rgba(255,255,255,.15)'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); }
      if (v === 'plot') { const k = cost(sl); drawPlot(c, x, y, sl.s, t + sl.gx, k !== null && G.S.cash >= k); continue; }
      const ct = this.cons.get(sl.key), ce = ct === undefined ? 9 : t - ct;
      if (ce < .9) { scaffold(c, x, y, sl.s, ce / .9, t); continue; }
      if (ce >= .9 && ce < 1.6) dings.push([x, y, (ce - .9) / .7, sl.s]);
      const pop = ce < 1.5 ? 1 + Math.sin((ce - .9) / .6 * Math.PI) * .18 * (1 - (ce - .9) / .6) : 1; if (ce >= 1.5 && ct !== undefined) this.cons.delete(sl.key);
      let wsc = 1; if (this.warpT >= 0 && sl.key !== 'gate') { const f = Math.max(0, (this.warpT - .8) / 1.4); wsc = Math.max(0, 1 - f * f); }
      const scl = pop * wsc;
      if (scl !== 1) { c.save(); c.translate(x, y); c.scale((2 - pop) * wsc, pop * pop * wsc); c.translate(-x, -y); }
      const pt = this.punches.get(sl.key); let pk = 0; if (pt !== undefined) { const f = (t - pt) / .28; if (f >= 1) this.punches.delete(sl.key); else pk = Math.sin(f * Math.PI * 2) * (1 - f) * .13; }
      if (pk) { c.save(); c.translate(x, y); c.scale(1 + pk * .6, 1 - pk); c.translate(-x, -y); }
      this.building(sl, x, y);
      if (pk) c.restore();
      if (scl !== 1) c.restore();
    }
    while (di < dec.length) this.prop(dec[di++], t);
    this.drawMeteors(true);
    this.drawWreck(); this.drawTrader();
    // completion "ding": light pillar, double shock ring, star burst — drawn above every building
    for (const [x, y, f, sz] of dings) { const e = 1 - Math.pow(1 - f, 3), a = 1 - f, R = sz * TW * .5;
      c.save(); c.globalCompositeOperation = 'lighter'; const gp = c.createLinearGradient(0, y - 220, 0, y); gp.addColorStop(0, 'rgba(255,240,170,0)'); gp.addColorStop(1, `rgba(255,236,150,${.75 * a})`); c.fillStyle = gp; c.fillRect(x - R * .55 * (1 - f * .6), y - 220, R * 1.1 * (1 - f * .6), 220); glow(c, x, y - 30, 120, '#fff0a0', a * .9); c.restore();
      for (const [k, w] of [[1, 9], [.7, 4]]) { c.beginPath(); c.ellipse(x, y, R * (.6 + e * 1.3 * k), R * .5 * (.6 + e * 1.3 * k), 0, 0, 7); c.strokeStyle = `rgba(36,22,58,${a * .8})`; c.lineWidth = w * a + 4; c.stroke(); c.strokeStyle = `rgba(255,222,90,${a})`; c.lineWidth = w * a + 1.5; c.stroke(); }
      for (let q = 0; q < 10; q++) { const ang = q / 10 * 6.283 + .3, r = R * (.4 + e * 1.4), sx2 = x + Math.cos(ang) * r, sy2 = y - 50 + Math.sin(ang) * r * .6 - e * 40; star(c, sx2, sy2, 11 * a + 2); } }
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
    // cargo pods arriving from the lift on the fleet rock
    if (this.rock && G.fleetOpen() && G.S.liftOn) { this.podT -= dt; if (this.podT <= 0) { this.podT = 2.2 + Math.random() * 1.5; this.pods.push({ t: 0, x: (Math.random() - .5) * 60 }); } }
    this.pods = this.pods.filter(pd => { pd.t += dt; const [hx, hy] = iso(-3, 0), f = Math.min(1, pd.t / 1.2), e = f * f, py = hy - 30 - 520 * (1 - e), px = hx + 40 + pd.x * (1 - e); if (f < 1) { glow(c, px, py + 10, 16, '#7ae8ff', .6); box(c, px, py, 8, 4, 10, 30, 90, 58); } else if (pd.t < 1.25) { this.puff('hangar', 'rgba(200,240,255,.8)'); } return pd.t < 1.3; });
    // ships
    this.ships = this.ships.filter(s => { s.t += dt; if (s.t < 0) return true; if (s.dir > 0) { s.vy -= dt * 900; s.y += s.vy * dt; ship(c, s.x, s.y, s.sc, 1); if (s.t < .4) for (let k = 0; k < 2; k++) this.puffs.push({ x: s.x + (Math.random() - .5) * 40, y: s.y + 10, t: 0, c: 'rgba(230,220,255,.8)' }); return s.y > -1200; } const ty = this.pad()[1] - 14, f = Math.min(1, s.t / 1.6), e = 1 - Math.pow(1 - f, 3); const yy = ty - 700 * (1 - e); ship(c, s.x, yy, s.sc, 1 - e * .8); return f < 1; });
    // warp sequence
    if (this.warpT >= 0) { this.warpT += dt; const gs = slotByKey('gate')!, [gx, gy] = iso(gs.gx, gs.gy); const f = Math.min(1, this.warpT / 2.2); glow(c, gx, gy - 50, 120 + f * 900, '#b06bff', .4 + f * .6); c.save(); c.translate(gx, gy - 50); c.rotate(this.warpT * 4 * f); for (let k = 0; k < 6; k++) { c.rotate(1.047); c.beginPath(); c.ellipse(0, 0, 60 + f * 500, 20 + f * 160, 0, 0, Math.PI); c.strokeStyle = `hsla(${270 + k * 15},100%,75%,${.6 * f})`; c.lineWidth = 6 + f * 10; c.stroke(); } c.restore(); this.shake = Math.max(this.shake, f * .2); if (this.warpT > 2.2 && this.warpCb) { const cb = this.warpCb; this.warpCb = null; cb(); } if (this.warpT > 3.2) { this.warpT = -1; this.sprites.clear(); } }
    // labels on top
    if (this.night > .01) {
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(10,4,48,${.52 * this.night})`; c.fillRect(0, 0, this.cv.width, this.cv.height); c.restore();
      c.globalCompositeOperation = 'lighter';
      { const g0 = this.guide ? slotByKey(this.guide) : null; if (g0 && (g0.rock || 0) === this.rock) { const [x, y] = iso(g0.gx, g0.gy); glow(c, x, y - 30, 110, '#fff4d0', this.night * .32); } } // keep the goal target readable after dark
      // static night glows (props, buildings, belts) are baked into one layer, re-baked only when the camera, night level or activity changes
      { const [cx0, cy0, cz0] = this.camT, nk = `${cx0.toFixed(1)},${cy0.toFixed(1)},${cz0.toFixed(3)},${Math.round(this.night * 40)},${this.rock},${order.map(sl => visible(sl) === 'built' ? (activeOf(sl) ? 'a' : 'i') + tier(sl) : '-').join('')},${L.map(l => l[3] ? 1 : 0).join('')}`;
        if (!this.nl || this.nl.width !== this.cv.width || this.nl.height !== this.cv.height) { this.nl = document.createElement('canvas'); this.nl.width = this.cv.width; this.nl.height = this.cv.height; this.nlKey = ''; }
        if (nk !== this.nlKey) { this.nlKey = nk; const main = c, g = this.nl.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.nl.width, this.nl.height); g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.translate(cx0, cy0); g.scale(cz0, cz0); g.globalCompositeOperation = 'lighter';
          { const c = g; void main;
      for (const d of dec) if (d[2] === 0) { const [x, y] = iso(d[0], d[1]), ice = this.rock === 1, col = ice ? '#dff2ff' : '#ffcf6a'; glow(c, x, y - (ice ? 32 : 28), ice ? 30 : 26, col, this.night * .55); glow(c, x + (ice ? 14 : 0), y + (ice ? 8 : 2), ice ? 38 : 26, col, this.night * (ice ? .3 : .2)); }
      for (const sl of order) { if (visible(sl) !== 'built') continue; const [x, y] = iso(sl.gx, sl.gy), on = activeOf(sl); glow(c, x, y - 4, 90, on ? accentOf(sl) : '#5a6aff', this.night * (on ? .3 : .12)); glow(c, x - 10, y - 30 - tier(sl) * 6, 26, '#ffe9a0', this.night * .38); glow(c, x + 14, y - 12, 14, '#ffd28a', this.night * .32); }
      for (const [a, b, r, on] of L) if (on) { const rp = this.routeOf(a, b), [x1, y1] = iso(...rp[Math.min(1, rp.length - 1)]); glow(c, x1, y1, 26, RES[r].color, this.night * .3); }
          } }
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(this.nl, 0, 0); c.restore(); }
      { const hs = slotByKey('hq')!, [hx, hy] = iso(hs.gx, hs.gy), ang = this.t * .35, len = 520; c.save(); c.translate(hx + 8, hy - 70); c.rotate(ang); const g = c.createLinearGradient(0, 0, len, 0); g.addColorStop(0, `rgba(255,240,190,${.28 * this.night})`); g.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(len, -70); c.lineTo(len, 70); c.closePath(); c.fill(); c.restore(); }
      c.globalCompositeOperation = 'source-over';
    }
    if (this.warpT < 0) for (const sl of order) this.label(sl);
    if (this.place) this.drawGhost();
    if (this.guide && !this.place) { const sl = SLOTS.find(s => s.key === this.guide); if (sl && onMap(sl)) { const [x, y] = iso(sl.gx, sl.gy), b = Math.abs(Math.sin(t * 5)) * 14, ay = y - 120 - tier(sl) * 12 - b;
      c.beginPath(); c.moveTo(x, ay + 34); c.lineTo(x - 20, ay + 10); c.lineTo(x - 9, ay + 10); c.lineTo(x - 9, ay - 14); c.lineTo(x + 9, ay - 14); c.lineTo(x + 9, ay + 10); c.lineTo(x + 20, ay + 10); c.closePath(); c.fillStyle = '#ffd23f'; c.fill(); c.strokeStyle = '#24163a'; c.lineWidth = 4; c.stroke();
      c.beginPath(); c.ellipse(x, y, sl.s * TW / 2 * (1 + b / 60), sl.s * TH / 2 * (1 + b / 60), 0, 0, 7); c.strokeStyle = 'rgba(255,210,63,.8)'; c.lineWidth = 3; c.stroke(); } }
    // ambient lighting: cool vignette + warm key light (screen space)
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // (vignette + warm key light live in a static CSS layer .bvig: no full-screen blit per frame)
    if (this.travelT >= 0) { const f = Math.sin(Math.min(1, this.travelT / 1.32) * Math.PI); c.strokeStyle = `rgba(200,230,255,${.5 * f})`; c.lineWidth = 2; let sd = 3; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647; for (let k = 0; k < 40; k++) { const yy = r() * this.h, xx = ((r() * this.w * 2 - this.travelT * 2600 * (this.travelTo ? 1 : -1)) % (this.w * 1.2) + this.w * 1.2) % (this.w * 1.2) - this.w * .1, L = 60 + r() * 140; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + L * f, yy); c.stroke(); } }
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  /** The ground lives on its own canvas under the main one and is only repainted when the camera moves:
   *  a still camera (most frames) skips the biggest blit of the frame. */
  private groundLayer(x: number, y: number, z: number) {
    if (!this.gcache || Math.abs(this.gz - this.z) > .001) { this.gcache = null; }
    const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(4)},${this.ggen},${this.gcache ? 1 : 0}`; if (key === this.gkey) return;
    const main = this.c, g = this.gcv.getContext('2d')!; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.clearRect(0, 0, this.w, this.h); g.translate(x, y); g.scale(z, z);
    this.c = g; try { this.groundCached(); } finally { this.c = main; } this.gkey = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(4)},${this.ggen},1`;
  }
  private groundCached() {
    const c = this.c, k = this.z * this.dpr, W = 1700, H = 1000;
    if (!this.gcache || Math.abs(this.gz - this.z) > .001) {
      const g = this.gcache || document.createElement('canvas'); g.width = Math.ceil(W * k); g.height = Math.ceil(H * k);
      const save = this.c; const gc = g.getContext('2d')!; gc.setTransform(k, 0, 0, k, W / 2 * k, 420 * k); this.c = gc; this.ground(); this.c = save; this.gcache = g; this.gz = this.z; this.ggen++;
    }
    c.save(); c.scale(1 / k, 1 / k); c.drawImage(this.gcache, -W / 2 * k, -420 * k); c.restore();
  }
  private drawWorkers(dt: number) {
    const c = this.c, built = SLOTS.filter(s => onMap(s) && s.key !== moveKey);
    const want = Math.min(10, 2 + Math.floor(built.length / 2));
    while (this.workers.length < want && built.length > 1) { const a = Math.floor(Math.random() * built.length); let b = Math.floor(Math.random() * built.length); if (b === a) b = (a + 1) % built.length; this.workers.push({ a: SLOTS.indexOf(built[a]), b: SLOTS.indexOf(built[b]), f: 0, sp: .12 + Math.random() * .1, c: ['#ffd23f', '#ff9f43', '#5cf2ff', '#ff7bd5'][Math.floor(Math.random() * 4)] }); }
    this.workers = this.workers.filter(w => {
      const A = SLOTS[w.a], B = SLOTS[w.b]; if (!A || !B || !onMap(A) || !onMap(B) || A.key === moveKey || B.key === moveKey) return false;
      // walk the routed lanes between the two pads (same router as the conveyors)
      const P = this.rock ? [[A.gx, A.gy], [B.gx, A.gy], [B.gx, B.gy]] as Pt[] : this.routeOf(A, B), L = polyLen(P) || 1; w.f += dt * w.sp * 6 / Math.max(3, L);
      const [gx, gy] = along(P, Math.min(1, w.f) * L), off = this.rock ? 1.15 : .22;
      const [x, y] = iso(gx + off, gy + off), bob = Math.abs(Math.sin(this.t * 10 + w.a)) * 2.5;
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
    if (!sp) { const W = 240, H = 300, cv = document.createElement('canvas'); cv.width = Math.ceil(W * k); cv.height = Math.ceil(H * k); const g = cv.getContext('2d')!; g.setTransform(k, 0, 0, k, W / 2 * k, 240 * k); bakeShadow(g, sl.s); drawBuilding(g, 0, sl.kind, id, hueOf(sl), tr, 0, 0, sl.s, 0, act, accentOf(sl)); const [tc, bx, by] = trim(cv); sp = { cv: tc, k, bx, by }; if (this.sprites.size > 120) this.sprites.clear(); this.sprites.set(key, sp); }
    c.drawImage(sp.cv, x - 120 + sp.bx / sp.k, y - 240 + sp.by / sp.k, sp.cv.width / sp.k, sp.cv.height / sp.k);
    drawBuilding(c, 1, sl.kind, id, hueOf(sl), tr, x, y, sl.s, this.t + sl.gx * .37, act, accentOf(sl));
  }
  private decorKey = ''; private decorList: [number, number, number][] = [];
  /** Props at lane intersections next to built plots: 0 lamp, 1 crystal planter, 2 banner, 3 barrels. Sorted back-to-front. */
  private decor() {
    const built = SLOTS.filter(sl => onMap(sl) && sl.key !== moveKey), key = this.rock + ':' + built.map(b => b.key + b.gx + ',' + b.gy).join();
    if (key === this.decorKey) return this.decorList; this.decorKey = key;
    const R = this.rock ? 7 : 10.2, m = new Map<string, [number, number, number]>();
    for (const sl of built) for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const gx = sl.gx + a, gy = sl.gy + b, k = gx + ',' + gy; if (m.has(k) || Math.hypot(gx, gy) > R - 1.2) continue; const h = Math.abs(Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453) % 1; m.set(k, [gx, gy, h < .42 ? 0 : h < .66 ? 1 : h < .8 ? 2 : 3]); }
    return this.decorList = [...m.values()].sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
  }
  bounces = new Map<string, number>(); onProp: (kind: number, rock: number) => void = () => {};
  /** Tap hit-test for props (only when no building was hit). */
  private propAt(lx: number, ly: number) { let best: [number, number, number] | null = null, bd = 1e9; for (const d of this.decorList) { const [x, y] = iso(d[0], d[1]), dx = Math.abs(lx - x), dy = ly - y; if (dx < 13 && dy < 7 && dy > -40) { const dd = dx + Math.abs(dy + 16) * .5; if (dd < bd) { bd = dd; best = d; } } } return best; }
  private padSlots() { return this.rock ? SLOTS : SLOTS.filter(sl => onMap(sl) && sl.key !== moveKey); }
  private deck(q: (gx: number, gy: number, a: number, b: number) => void) {
    const c = this.c, seen = new Set<string>();
    for (const sl of this.padSlots()) for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const u = sl.gx + i * .5, w = sl.gy + j * .5; if (Math.max(Math.abs(u - sl.gx), Math.abs(w - sl.gy)) < 1.2) continue; const k2 = `${u},${w}`; if (seen.has(k2)) continue; seen.add(k2);
      const L = ((u * 7 + w * 13) % 3 + 3) % 3; c.beginPath(); q(u, w, .23, .23); c.fillStyle = ['#5d7898', '#6a86a8', '#557090'][L]; c.fill(); c.strokeStyle = 'rgba(16,24,48,.55)'; c.lineWidth = 1.4; c.stroke();
      c.fillStyle = 'rgba(220,240,255,.55)'; for (const [a, b] of [[-.16, -.16], [.16, -.16], [.16, .16], [-.16, .16]]) { const [px, py] = iso(u + a, w + b); c.fillRect(px - .8, py - .8, 1.6, 1.6); } }
    // hazard stripes framing each pad
    for (const sl of this.padSlots()) { c.beginPath(); q(sl.gx, sl.gy, 1.15, 1.15); c.setLineDash([7, 7]); c.strokeStyle = '#ffcc33'; c.lineWidth = 3; c.stroke(); c.lineDashOffset = 7; c.strokeStyle = '#1c2236'; c.stroke(); c.setLineDash([]); c.lineDashOffset = 0; }
  }
  /** Icy terrain: snow drifts + frost cracks on the fleet rock. */
  private frost(R: number) {
    const c = this.c; let sd = 29; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647; const free = (gx: number, gy: number) => !this.padSlots().some(s2 => Math.abs(s2.gx - gx) < 1.8 && Math.abs(s2.gy - gy) < 1.8);
    for (let k = 0; k < 40; k++) { const a = r() * 6.28, rr = 1 + r() * (R - 1.6), gx = Math.cos(a) * rr, gy = Math.sin(a) * rr; if (!free(gx, gy)) continue; const [x, y] = iso(gx, gy);
      if (k % 3) { const w = 14 + r() * 26; c.beginPath(); c.ellipse(x, y, w, w * .42, 0, 0, 7); c.fillStyle = 'rgba(236,248,255,.75)'; c.fill(); c.beginPath(); c.ellipse(x - w * .2, y - w * .1, w * .55, w * .2, 0, 0, 7); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill(); c.beginPath(); c.ellipse(x, y + 2, w, w * .42, 0, .3, Math.PI - .3); c.strokeStyle = 'rgba(70,110,160,.45)'; c.lineWidth = 2; c.stroke(); }
      else { c.beginPath(); let px = x, py = y; c.moveTo(px, py); for (let j = 0; j < 5; j++) { px += (r() - .3) * 22; py += (r() - .5) * 10; c.lineTo(px, py); } c.strokeStyle = 'rgba(20,40,80,.5)'; c.lineWidth = 2.5; c.stroke(); c.strokeStyle = 'rgba(200,240,255,.7)'; c.lineWidth = 1; c.stroke(); } }
  }
  private propIce(d: [number, number, number], t: number, x: number, y: number) {
    const c = this.c;
    if (d[2] === 0) { // floodlight tower
      c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x - 1, y - 30); c.moveTo(x + 6, y); c.lineTo(x + 1, y - 30); c.moveTo(x - 4, y - 10); c.lineTo(x + 4, y - 18); c.stroke(); c.strokeStyle = '#9fb4cc'; c.lineWidth = 1.4; c.stroke();
      box(c, x, y - 30, 8, 4, 6, 215, 20, 40); c.beginPath(); c.ellipse(x + 3, y - 32, 5, 3, 0, 0, 7); c.fillStyle = this.night > .25 ? '#f4fbff' : '#cfe6ff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke(); }
    else if (d[2] === 1) { // hesco barrier: three stuffed wire baskets
      for (const [ox, oy] of [[-8, -3], [0, 0], [8, 3]]) { box(c, x + ox, y + oy, 5, 2.5, 10, 40, 30, 62); c.strokeStyle = 'rgba(40,40,60,.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + ox - 5, y + oy - 5); c.lineTo(x + ox, y + oy - 2.5); c.lineTo(x + ox + 5, y + oy - 5); c.stroke(); }
      c.beginPath(); c.ellipse(x, y - 10, 13, 3.5, .45, 0, 7); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill(); }
    else if (d[2] === 2) { // radar mast with spinning dish
      c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 24); c.stroke(); c.strokeStyle = '#b8c8de'; c.lineWidth = 2; c.stroke(); const a = t * 1.6 + d[0]; c.save(); c.translate(x, y - 27); c.scale(Math.cos(a), 1); c.beginPath(); c.ellipse(0, 0, 9, 6, 0, 0, 7); c.fillStyle = '#e8f2ff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); c.restore(); if (Math.sin(t * 4 + d[1]) > .6) glow(c, x, y - 34, 8, '#ff5b5b', .9); c.beginPath(); c.arc(x, y - 34, 1.8, 0, 7); c.fillStyle = '#ff5b5b'; c.fill(); }
    else { // blue fuel drums + stencilled ammo crate
      for (const [ox, oy] of [[-5, -1], [3, 1]]) { const bx = x + ox, by = y + oy; c.beginPath(); c.moveTo(bx - 4, by - 11); c.lineTo(bx - 4, by); c.ellipse(bx, by, 4, 2, 0, Math.PI, 0, true); c.lineTo(bx + 4, by - 11); c.closePath(); c.fillStyle = '#3a78c8'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke(); c.beginPath(); c.ellipse(bx, by - 11, 4, 2, 0, 0, 7); c.fillStyle = '#7fb4f0'; c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillRect(bx - 4, by - 7, 8, 1.4); }
      box(c, x + 8, y + 5, 6, 3, 6, 95, 25, 38); c.fillStyle = '#ffcc33'; c.fillRect(x + 4, y + 2, 3, 1.5); }
  }
  private prop(d: [number, number, number], t: number) {
    const c = this.c, [x, y] = iso(d[0], d[1]), bk = d[0] + ',' + d[1], bt = this.bounces.get(bk); let bounced = false;
    if (bt !== undefined) { const f = (this.t - bt) / .6; if (f >= 1) this.bounces.delete(bk); else { const sq = Math.sin(f * Math.PI * 3) * .28 * (1 - f), hop = Math.max(0, Math.sin(f * Math.PI * 2)) * 10 * (1 - f); c.save(); c.translate(x, y - hop); c.scale(1 + sq * .6, 1 - sq); c.translate(-x, -y); bounced = true; } }
    if (this.rock === 1) { c.beginPath(); c.ellipse(x + 2, y + 2, 11, 5, 0, 0, 7); c.fillStyle = 'rgba(16,30,60,.35)'; c.fill(); c.lineJoin = 'round'; c.lineCap = 'round'; this.propIce(d, t, x, y); if (bounced) c.restore(); return; }
    this.propMain(d, t, x, y); if (bounced) c.restore();
  }
  private propMain(d: [number, number, number], t: number, x: number, y: number) {
    const c = this.c; c.beginPath(); c.ellipse(x + 2, y + 2, 10, 5, 0, 0, 7); c.fillStyle = 'rgba(20,8,40,.4)'; c.fill(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (d[2] === 0) { box(c, x, y, 5, 2.5, 5, 250, 15, 45); c.strokeStyle = INK; c.lineWidth = 4.5; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x, y - 24); c.stroke(); c.strokeStyle = '#8a84a8'; c.lineWidth = 2; c.stroke(); const lit = this.night > .25; c.beginPath(); c.moveTo(x - 5, y - 24); c.lineTo(x + 5, y - 24); c.lineTo(x + 3.5, y - 32); c.lineTo(x - 3.5, y - 32); c.closePath(); c.fillStyle = lit ? '#fff1b8' : '#ffd36a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); c.beginPath(); c.moveTo(x - 4.5, y - 33); c.lineTo(x, y - 37); c.lineTo(x + 4.5, y - 33); c.closePath(); c.fillStyle = '#3a2a5a'; c.fill(); c.stroke(); }
    else if (d[2] === 1) { box(c, x, y, 9, 4.5, 6, 30, 45, 45); const hue = (d[0] * 31 + d[1] * 17) % 2 ? 190 : 300; for (const [ox, h2] of [[-4, 11], [1, 16], [5, 9]]) { const cx = x + ox, cy = y - 6, b = Math.sin(t * 2 + ox) * .8; c.beginPath(); c.moveTo(cx - 2.5, cy); c.lineTo(cx - .5, cy - h2 - b); c.lineTo(cx + 1.5, cy - h2 + 2 - b); c.lineTo(cx + 2.5, cy); c.closePath(); c.fillStyle = hsl(hue, 90, 70); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); } if (this.night > .2) glow(c, x, y - 12, 18, hsl(hue, 90, 70), this.night * .6); }
    else if (d[2] === 2) { c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 34); c.stroke(); c.strokeStyle = '#e8e0ff'; c.lineWidth = 1.8; c.stroke(); const w = Math.sin(t * 4 + d[0]) * 2.5; c.beginPath(); c.moveTo(x, y - 33); c.quadraticCurveTo(x + 7, y - 33 + w, x + 14, y - 31 + w); c.lineTo(x + 14, y - 21 + w); c.quadraticCurveTo(x + 7, y - 23 + w, x, y - 23); c.closePath(); c.fillStyle = this.rock ? '#5cf2ff' : '#ff5ea8'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); c.beginPath(); c.arc(x, y - 35, 2.5, 0, 7); c.fillStyle = '#ffd23f'; c.fill(); c.stroke(); }
    else { for (const [ox, oy] of [[-4, 0], [4, 1], [0, -2]]) { const bx = x + ox, by = y + oy; c.beginPath(); c.moveTo(bx - 4, by - 10); c.lineTo(bx - 4, by); c.ellipse(bx, by, 4, 2, 0, Math.PI, 0, true); c.lineTo(bx + 4, by - 10); c.closePath(); c.fillStyle = '#d24b4b'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke(); c.beginPath(); c.ellipse(bx, by - 10, 4, 2, 0, 0, 7); c.fillStyle = '#ff8a7a'; c.fill(); c.stroke(); c.fillStyle = '#ffd23f'; c.fillRect(bx - 4, by - 6, 8, 1.6); } }
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
    // tonal patches for richer ground
    { let sd2 = 5; const r2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647; for (let k = 0; k < 18; k++) { const a = r2() * 6.28, rr = r2() * (R - 2), [px, py] = iso(Math.cos(a) * rr, Math.sin(a) * rr), w = 60 + r2() * 120; const gg = c.createRadialGradient(px, py, 0, px, py, w); const tone = r2() < .5 ? (ice ? '180,230,255' : '220,170,240') : (ice ? '40,70,120' : '60,30,90'); gg.addColorStop(0, `rgba(${tone},.22)`); gg.addColorStop(1, `rgba(${tone},0)`); c.fillStyle = gg; c.save(); c.scale(1, 1); c.fillRect(px - w, py - w, w * 2, w * 2); c.restore(); } }
    // craters
    for (const [cx, cy, r] of this.craters) { if (Math.hypot(cx, cy) > R - 1) continue; const [x, y] = iso(cx, cy); c.beginPath(); c.ellipse(x, y, r * TW / 2, r * TH / 2, 0, 0, 7); c.fillStyle = 'rgba(40,16,60,.35)'; c.fill(); c.beginPath(); c.ellipse(x, y + 2, r * TW / 2, r * TH / 2, 0, .2, Math.PI - .2); c.strokeStyle = 'rgba(255,220,255,.18)'; c.lineWidth = 3; c.stroke(); }
    // paved lanes: a cobblestone ring around every plot cell; neighbouring rings merge into CoC-style paths
    { let sd3 = 3; const r3 = () => (sd3 = (sd3 * 16807) % 2147483647) / 2147483647; const q = (gx: number, gy: number, a: number, b: number) => { const p = [iso(gx - a, gy - b), iso(gx + a, gy - b), iso(gx + a, gy + b), iso(gx - a, gy + b)]; c.moveTo(p[0][0], p[0][1]); for (let k = 1; k < 4; k++) c.lineTo(p[k][0], p[k][1]); c.closePath(); };
      c.beginPath(); for (const sl of this.padSlots()) q(sl.gx, sl.gy, 1.62, 1.62); c.fillStyle = 'rgba(20,8,40,.35)'; c.fill();
      c.beginPath(); for (const sl of this.padSlots()) q(sl.gx, sl.gy, 1.5, 1.5); c.fillStyle = ice ? '#56789e' : '#6a4a84'; c.fill();
      if (ice) this.deck(q); else {
      const seen = new Set<string>();
      for (const sl of this.padSlots()) for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) { const u = sl.gx + i * .25 + .125, w = sl.gy + j * .25 + .125; if (Math.max(Math.abs(u - sl.gx), Math.abs(w - sl.gy)) < 1.05) continue; const k2 = `${Math.round(u * 8)},${Math.round(w * 8)}`; if (seen.has(k2)) continue; seen.add(k2);
        const jx = (r3() - .5) * .05, jy = (r3() - .5) * .05, L = r3(); c.beginPath(); q(u + jx, w + jy, .1, .1); c.fillStyle = ice ? `hsl(208,${25 + L * 15}%,${56 + L * 14}%)` : `hsl(${268 + L * 14},${18 + L * 12}%,${50 + L * 14}%)`; c.fill(); c.strokeStyle = 'rgba(20,8,40,.45)'; c.lineWidth = 1.2; c.stroke(); }
      }
      c.beginPath(); for (const sl of this.padSlots()) q(sl.gx, sl.gy, 1.5, 1.5); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.stroke(); }
    if (ice) this.frost(R);
    // surface details: boulders, crystal clusters, beacon posts (kept off building plots)
    let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647; const taken = (gx: number, gy: number) => this.padSlots().some(s => Math.abs(s.gx - gx) < 1.9 && Math.abs(s.gy - gy) < 1.9);
    for (let k = 0; k < 70; k++) { const a = rnd() * 7, r = 2 + rnd() * (R - 2.4), gx = Math.cos(a) * r, gy = Math.sin(a) * r; if (taken(gx, gy)) continue; const [x, y] = iso(gx, gy), kind = rnd();
      if (kind < .55) { const s2 = 4 + rnd() * 9; c.beginPath(); c.ellipse(x + 2, y + 2, s2 * 1.2, s2 * .5, 0, 0, 7); c.fillStyle = 'rgba(30,10,50,.35)'; c.fill(); c.beginPath(); c.moveTo(x - s2, y); c.quadraticCurveTo(x - s2 * .8, y - s2 * 1.1, x, y - s2); c.quadraticCurveTo(x + s2, y - s2 * .9, x + s2, y); c.quadraticCurveTo(x, y + s2 * .4, x - s2, y); c.fillStyle = ice ? '#5a6f8c' : '#6e4a86'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); if (ice) { c.beginPath(); c.moveTo(x - s2 * .85, y - s2 * .45); c.quadraticCurveTo(x - s2 * .7, y - s2 * 1.05, x, y - s2 * .98); c.quadraticCurveTo(x + s2 * .85, y - s2 * .85, x + s2 * .9, y - s2 * .3); c.quadraticCurveTo(x, y - s2 * .5, x - s2 * .85, y - s2 * .45); c.fillStyle = '#f2f9ff'; c.fill(); } else { c.beginPath(); c.moveTo(x - s2 * .6, y - s2 * .6); c.quadraticCurveTo(x - s2 * .2, y - s2 * .95, x + s2 * .2, y - s2 * .85); c.strokeStyle = 'rgba(255,230,255,.35)'; c.lineWidth = 2; c.stroke(); } }
      else if (kind < .85) { const hue = ice ? 200 : rnd() < .5 ? 190 : 290; for (let j = 0; j < 3; j++) { const cx = x + (j - 1) * 5, h2 = 8 + rnd() * 10; c.beginPath(); c.moveTo(cx - 3, y); c.lineTo(cx - 1, y - h2); c.lineTo(cx + 2, y - h2 - 3); c.lineTo(cx + 3, y); c.closePath(); c.fillStyle = ice ? hsl(hue, 70, 86 - j * 6) : hsl(hue, 90, 70); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); } }
      else if (ice) { c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 20); c.stroke(); c.strokeStyle = '#ff7a2e'; c.lineWidth = 2; c.stroke(); c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x, y - 12); c.stroke(); }
      else { c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 18); c.stroke(); c.beginPath(); c.arc(x, y - 20, 3, 0, 7); c.fillStyle = '#ffd23f'; c.fill(); c.stroke(); }
    }
    if (ice) { c.strokeStyle = 'rgba(255,210,63,.55)'; c.lineWidth = 4; c.setLineDash([14, 10]); for (const [a, b] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) { const [x1, y1] = iso(0, 0), [x2, y2] = iso(a, b); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); } c.setLineDash([]); }
    c.restore();
  }
  private routes = new Map<string, Pt[]>();
  routeOf(a: Slot, b: Slot): Pt[] {
    const k = a.key + '>' + b.key; let r = this.routes.get(k);
    if (!r) { const obst = SLOTS.filter(s => s !== a && s !== b && onMap(s) && s.key !== moveKey).map(s => [s.gx, s.gy] as Pt); r = route([a.gx, a.gy], [b.gx, b.gy], obst, MAIN_R); if (this.routes.size > 200) this.routes.clear(); this.routes.set(k, r); }
    return r;
  }
  private belt(a: Slot, b: Slot, col: string, on: boolean) {
    const c = this.c, P = this.routeOf(a, b).map(p => iso(p[0], p[1]));
    c.lineCap = 'round'; c.lineJoin = 'round';
    const path = () => { c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]); };
    path(); c.strokeStyle = '#24163a'; c.lineWidth = 15; c.stroke(); path(); c.strokeStyle = '#4a4470'; c.lineWidth = 10; c.stroke();
    path(); c.setLineDash([4, 8]); c.lineDashOffset = on ? -this.t * 30 : 0; c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 8; c.stroke(); c.setLineDash([]);
    if (!on) return;
    const L = polyLen(P);
    for (let d = (this.t * 40) % 34; d < L; d += 34) {
      const [x, y] = along(P, d);
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
    c.fillStyle = bg; rr(c, x - w / 2, y - 11, w, 22, 11); c.fill(); c.strokeStyle = '#120a24'; c.lineWidth = 3; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5; rr(c, x - w / 2 + 3, y - 8, w - 6, 8, 4); c.stroke();
    outlinedText(c, txt, x, y + 1, 14, fg);
  }
  private bubble(x: number, y: number, txt: string, bg = '#ffd23f') {
    const c = this.c; c.font = '700 14px Fredoka, sans-serif'; const bolt = txt === '⚡'; const w = bolt ? 28 : c.measureText(txt).width + 18;
    c.fillStyle = bg; c.strokeStyle = '#24163a'; c.lineWidth = 3; rr(c, x - w / 2, y - 13, w, 24, 12); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 6, y + 10); c.lineTo(x, y + 18); c.lineTo(x + 6, y + 10); c.fill(); c.stroke(); c.fillRect(x - 5, y + 8, 10, 3);
    if (bolt) { c.beginPath(); c.moveTo(x + 2, y - 9); c.lineTo(x - 6, y + 2); c.lineTo(x - 1, y + 2); c.lineTo(x - 3, y + 9); c.lineTo(x + 6, y - 2); c.lineTo(x + 1, y - 2); c.closePath(); c.fillStyle = '#ffd23f'; c.fill(); c.strokeStyle = '#24163a'; c.lineWidth = 2; c.stroke(); } else outlinedText(c, txt, x, y, 14, '#fff');
  }
}
function bakeShadow(g: CanvasRenderingContext2D, s: number) {
  // soft cast shadow (toward bottom-right, away from the warm key light) + contact ambient occlusion
  const hw = s * TW / 2, hh = s * TH / 2;
  g.save(); g.filter = 'blur(7px)'; g.fillStyle = 'rgba(16,4,36,.55)'; g.beginPath(); g.ellipse(18, 14, hw * 1.05, hh * 1.1, 0, 0, 7); g.fill(); g.restore();
  const ao = g.createRadialGradient(0, 0, hw * .5, 0, 0, hw * 1.15); ao.addColorStop(0, 'rgba(16,4,36,.45)'); ao.addColorStop(1, 'rgba(16,4,36,0)'); g.save(); g.scale(1, .5); g.fillStyle = ao; g.beginPath(); g.arc(0, 0, hw * 1.15, 0, 7); g.fill(); g.restore();
}
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function short(v: number) { const s = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx']; let e = 0; while (v >= 1000 && e < s.length - 1) { v /= 1000; e++; } return (v >= 100 || e === 0 ? Math.floor(v).toString() : v.toFixed(1)) + s[e]; }

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number) { c.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr2 = k % 2 ? r * .38 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath(); c.fillStyle = '#fff6c0'; c.fill(); c.strokeStyle = '#24163a'; c.lineWidth = 1.5; c.stroke(); }
