// Isometric asteroid base renderer (Canvas2D). Chunky, saturated, outlined vector art.
// Every building has a unique silhouette and 5 visual tiers. Drawing is split in two passes:
//   static (MODE 0) -> cached to a bitmap per (building, tier, zoom)   |   anim (MODE 1) -> drawn live every frame.
export const TW = 72, TH = 36;
export const iso = (x: number, y: number): [number, number] => [(x - y) * TW / 2, (x + y) * TH / 2];
export const INK = '#24163a';
type C = CanvasRenderingContext2D;
export const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
let MODE: 0 | 1 = 0; const S = () => MODE === 0, A = () => MODE === 1;
export const TIER_NAMES = ['Prototype', 'Outpost', 'Industrial', 'Advanced', 'Ascended'];
export type Kind = 'mine' | 'mach' | 'gen' | 'yard' | 'gate' | 'hq' | 'lab';

export function poly(c: C, pts: number[], fill: string | CanvasGradient, stroke: string | null = INK, lw = 2.5) {
  c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath();
  c.fillStyle = fill; c.fill(); if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); }
}
function lg(c: C, x0: number, y0: number, x1: number, y1: number, a: string, b: string) { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
/** shaded iso box with panel texture + rim light. Returns top y. */
export function box(c: C, x: number, y: number, hw: number, hh: number, h: number, hue: number, sat = 70, lit = 55, o: { top?: string | CanvasGradient; panels?: number; rivets?: boolean } = {}) {
  poly(c, [x - hw, y, x, y + hh, x, y + hh - h, x - hw, y - h], lg(c, x - hw, y - h, x, y + hh, hsl(hue, sat, lit - 4), hsl(hue, sat, lit - 18)));
  poly(c, [x + hw, y, x, y + hh, x, y + hh - h, x + hw, y - h], lg(c, x, y - h, x + hw, y, hsl(hue, sat, lit - 22), hsl(hue, sat + 5, lit - 34)));
  poly(c, [x - hw, y - h, x, y - hh - h, x + hw, y - h, x, y + hh - h], o.top || lg(c, x - hw, y - h - hh, x + hw, y - h + hh, hsl(hue, sat - 5, lit + 16), hsl(hue, sat, lit + 4)));
  if (o.panels) { c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.5; for (let k = 1; k <= o.panels; k++) { const f = k / (o.panels + 1); c.beginPath(); c.moveTo(x - hw + hw * f, y + hh * f); c.lineTo(x - hw + hw * f, y + hh * f - h); c.moveTo(x + hw * f, y + hh - hh * f); c.lineTo(x + hw * f, y + hh - hh * f - h); c.stroke(); } }
  if (o.rivets) { c.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 1; k < 6; k++) { const f = k / 6; c.beginPath(); c.arc(x - hw + hw * f, y + hh * f - h + 4, 1.3, 0, 7); c.fill(); } }
  c.lineCap = 'round'; c.beginPath(); c.moveTo(x - hw + 3, y - h); c.lineTo(x, y - hh - h + 2); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.moveTo(x + 2, y - hh - h + 2); c.lineTo(x + hw - 3, y - h); c.strokeStyle = 'rgba(255,230,190,.35)'; c.stroke();
  return y - h;
}
export function cyl(c: C, x: number, y: number, r: number, h: number, hue: number, sat = 60, lit = 55, top?: string, bands = 0) {
  const ry = r / 2;
  c.beginPath(); c.moveTo(x - r, y - h); c.lineTo(x - r, y); c.ellipse(x, y, r, ry, 0, Math.PI, 0, true); c.lineTo(x + r, y - h); c.closePath();
  const g = c.createLinearGradient(x - r, 0, x + r, 0); g.addColorStop(0, hsl(hue, sat, lit - 8)); g.addColorStop(.3, hsl(hue, sat, lit + 10)); g.addColorStop(.55, hsl(hue, sat, lit)); g.addColorStop(1, hsl(hue, sat, lit - 30));
  c.fillStyle = g; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
  for (let k = 1; k <= bands; k++) { const by = y - h * k / (bands + 1); c.beginPath(); c.ellipse(x, by, r, ry, 0, 0, Math.PI); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 2; c.stroke(); }
  c.beginPath(); c.ellipse(x, y - h, r, ry, 0, 0, Math.PI * 2); c.fillStyle = top || hsl(hue, sat, lit + 14); c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
}
function cone(c: C, x: number, y: number, r: number, h: number, col: string) {
  c.beginPath(); c.moveTo(x - r, y); c.ellipse(x, y, r, r / 2, 0, Math.PI, 0, true); c.lineTo(x, y - h); c.closePath();
  c.fillStyle = lg(c, x - r, 0, x + r, 0, col, 'rgba(0,0,0,.45)'); c.fill(); c.fillStyle = col; c.globalAlpha = .55; c.fill(); c.globalAlpha = 1; c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
}
function dome(c: C, x: number, y: number, r: number, col: string) {
  c.beginPath(); c.ellipse(x, y, r, r / 2, 0, 0, Math.PI); c.arc(x, y, r, 0, Math.PI, true); c.closePath();
  const g = c.createRadialGradient(x - r * .4, y - r * .6, 1, x, y - r * .3, r * 1.2); g.addColorStop(0, '#fff'); g.addColorStop(.25, col); g.addColorStop(1, 'rgba(20,10,50,.8)');
  c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
}
export function glow(c: C, x: number, y: number, r: number, col: string, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = Math.max(0, Math.min(1, a)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
}
function lamp(c: C, x: number, y: number, col: string, t: number, ph = 0) {
  if (S()) { c.beginPath(); c.arc(x, y, 3.2, 0, 7); c.fillStyle = INK; c.fill(); return; }
  const on = (Math.sin(t * 3 + ph) + 1) / 2; glow(c, x, y, 11, col, .3 + on * .6);
  c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fillStyle = on > .4 ? '#fff' : col; c.fill();
}
function windowsL(c: C, x: number, y: number, hw: number, hh: number, h: number, n: number, rows = 1) {
  for (let r = 0; r < rows; r++) for (let k = 0; k < n; k++) {
    const f = (k + 0.7) / (n + 0.4), wx = x - hw + hw * f, wy = y + hh * f - h * (0.4 + r * 0.32);
    if (S()) poly(c, [wx - 4, wy - 2, wx + 2, wy + 1, wx + 2, wy - 7, wx - 4, wy - 10], '#3b3560', INK, 1.5);
    else { poly(c, [wx - 4, wy - 2, wx + 2, wy + 1, wx + 2, wy - 7, wx - 4, wy - 10], '#ffe98a', null); glow(c, wx - 1, wy - 4, 9, 'rgba(255,220,120,.6)', .7); }
  }
}
export function steam(c: C, x: number, y: number, t: number, col: string, n = 4, rise = 34) {
  for (let k = 0; k < n; k++) {
    const f = (((t * .6 + k / n) % 1) + 1) % 1, r = 4 + f * 10;
    c.globalAlpha = (1 - f) * .85; c.beginPath(); c.arc(x + Math.sin((t + k) * 2) * 4 * f, y - f * rise, r, 0, 7); c.fillStyle = col; c.fill();
  }
  c.globalAlpha = 1;
}
function pad(c: C, x: number, y: number, hw: number, hh: number, hue: number, tier: number) {
  c.beginPath(); c.ellipse(x + 6, y + 6, hw * 1.08, hh * 1.08, 0, 0, 7); c.fillStyle = 'rgba(20,8,40,.38)'; c.fill();
  box(c, x, y, hw, hh, 7, 235, 18, 46 + tier * 3, { top: tier >= 3 ? lg(c, x - hw, y, x + hw, y, hsl(hue, 35, 66), hsl(hue, 25, 52)) : undefined });
  if (tier >= 1) { c.fillStyle = 'rgba(255,255,255,.5)'; for (const [dx, dy] of [[-hw * .8, 0], [hw * .8, 0], [0, -hh * .8], [0, hh * .8]]) { c.beginPath(); c.arc(x + dx, y - 7 + dy, 2, 0, 7); c.fill(); } }
  if (tier >= 2) { c.setLineDash([6, 6]); c.beginPath(); c.moveTo(x - hw * .82, y - 7); c.lineTo(x, y - 7 + hh * .82); c.lineTo(x + hw * .82, y - 7); c.strokeStyle = 'rgba(255,210,63,.9)'; c.lineWidth = 2.5; c.stroke(); c.setLineDash([]); }
}

/** Draw a building. mode 0 = static body (cache me), 1 = animated overlay. */
export function drawBuilding(c: C, mode: 0 | 1, kind: Kind, id: string, hue: number, tier: number, x: number, y: number, s: number, t: number, active: boolean, accent: string) {
  MODE = mode;
  const hw = s * TW / 2 * 0.86, hh = s * TH / 2 * 0.86;
  if (S()) pad(c, x, y, hw, hh, hue, tier);
  const gy = y - 7, P: Arg = { c, id, hue, tier, x, y: gy, hw, hh, t, on: active, ac: accent };
  (DRAW[id] || DRAW[kind] || DRAW.hq)(P);
}
type Arg = { c: C; id: string; hue: number; tier: number; x: number; y: number; hw: number; hh: number; t: number; on: boolean; ac: string };
const DRAW: Record<string, (p: Arg) => void> = {};

// ---------------- MINES (unique per id) ----------------
function orePile(p: Arg, ox: number, oy: number, sc = 1) {
  if (!S()) return; const { c, x, y, hw, hh, ac, tier } = p; const px = x + ox * hw, py = y + oy * hh;
  c.beginPath(); c.ellipse(px, py, hw * .3 * sc, hh * .3 * sc, 0, Math.PI, 0); c.fillStyle = ac; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
  for (let k = 0; k < 3 + tier; k++) { const a = k * 2.1, cx = px + Math.cos(a) * 9 * sc, cy = py - 4 - (k % 2) * 5; poly(c, [cx - 4, cy, cx, cy - 6, cx + 4, cy], ac, INK, 1.5); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(cx - 1, cy - 4, 2, 2); }
}
function derrick(c: C, tx: number, ty: number, th: number, rungs: number, col = hsl(45, 95, 58)) {
  const legs = [[-11, 0], [11, 0], [0, -6]];
  c.lineCap = 'round';
  for (const pass of [0, 1]) { c.strokeStyle = pass ? col : INK; c.lineWidth = pass ? 2.5 : 5.5; for (const [lx, ly] of legs) { c.beginPath(); c.moveTo(tx + lx, ty + ly); c.lineTo(tx, ty - th); c.stroke(); } for (let k = 1; k < rungs; k++) { const f = k / rungs, w = 11 * (1 - f); c.beginPath(); c.moveTo(tx - w, ty - th * f); c.lineTo(tx + w, ty - th * f + 3); c.stroke(); } }
}
DRAW.drill = p => { // Pebble Drill: derrick + spinning bit
  const { c, x, y, hw, hh, tier, t, on, hue } = p; orePile(p, -.45, .25);
  const bw = hw * (.4 + tier * .05), bh = 14 + tier * 6, bx = x + hw * .15, by = y - hh * .05;
  let top = by - bh;
  if (S()) { top = box(c, bx, by, bw, bw / 2, bh, hue, 78, 52, { panels: 1 + (tier > 1 ? 1 : 0), rivets: tier >= 2 }); }
  windowsL(c, bx, by, bw, bw / 2, bh, Math.min(3, tier + 1));
  const th = 36 + tier * 12;
  if (S()) derrick(c, bx, top, th, 3 + tier);
  if (A()) { const sp = on ? t * 14 : 0; c.save(); c.translate(bx, top + 6); c.scale(1, .5); for (let k = 0; k < 3; k++) { c.rotate(Math.PI * 2 / 3); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 13 + tier * 2, sp, sp + .7); c.closePath(); c.fillStyle = '#e6e9f5'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); } c.restore(); if (on) { c.fillStyle = hsl(30, 60, 50, .7); for (let k = 0; k < 3; k++) { const a = t * 9 + k * 2; c.beginPath(); c.arc(bx + Math.cos(a) * 18, top + 8 + Math.sin(a) * 5 - Math.abs(Math.sin(t * 7 + k)) * 6, 2.5, 0, 7); c.fill(); } } }
  if (tier >= 1) lamp(c, bx, top - th - 3, tier >= 3 ? '#5cf2ff' : '#ff5b5b', t, hue);
  if (tier >= 3 && A()) glow(c, bx, top - th * .5, 24, p.ac, .3 + (Math.sin(t * 4) + 1) * .2);
  if (tier >= 4 && S()) for (let k = -1; k <= 1; k++) poly(c, [bx + k * 9 - 4, top + 2, bx + k * 9, top - 16 - (k ? 0 : 8), bx + k * 9 + 4, top + 2], hsl(200, 90, 72));
};
DRAW.ice = p => { // Comet Harvester: tank + big collector dish + ice crystals
  const { c, x, y, hw, hh, tier, t, on } = p;
  if (S()) { for (let k = 0; k < 3 + tier; k++) { const a = k * 1.9, cx = x - hw * .5 + Math.cos(a) * 12, cy = y + hh * .2 + Math.sin(a) * 5; poly(c, [cx - 5, cy, cx - 2, cy - 14 - k % 3 * 4, cx + 2, cy - 18 - k % 2 * 5, cx + 5, cy], lg(c, cx, cy - 18, cx, cy, '#e6fbff', '#5cc8ff'), INK, 1.8); } }
  const r = hw * (.3 + tier * .03), h = 20 + tier * 7;
  if (S()) { cyl(c, x + hw * .15, y, r, h, 195, 70, 62, undefined, 1 + (tier >> 1)); }
  // dish
  const dx = x + hw * .15, dy = y - h - 6, ang = A() ? Math.sin(t * .6) * .35 : 0;
  if (A()) { c.save(); c.translate(dx, dy); c.rotate(ang); c.beginPath(); c.ellipse(0, -10, 18 + tier * 3, 8 + tier, 0, 0, Math.PI); c.fillStyle = '#eef6ff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke(); c.beginPath(); c.moveTo(0, -4); c.lineTo(0, -22); c.stroke(); lampRaw(c, 0, -24, '#5cf2ff', t); c.restore(); if (on) { for (let k = 0; k < 4; k++) { const f = ((t * .8 + k / 4) % 1); c.globalAlpha = 1 - f; c.fillStyle = '#c8f4ff'; c.beginPath(); c.arc(dx - 30 + f * 30, dy - 50 + f * 40, 3, 0, 7); c.fill(); } c.globalAlpha = 1; } }
  else { c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(dx, y - h); c.lineTo(dx, dy); c.stroke(); }
  if (tier >= 2 && S()) box(c, x - hw * .1, y + hh * .35, 10, 5, 14, 200, 30, 70);
  if (tier >= 3 && A()) glow(c, dx, y - h * .5, 28, '#7ae8ff', .4 + Math.sin(t * 3) * .15);
};
function lampRaw(c: C, x: number, y: number, col: string, t: number) { const on = (Math.sin(t * 3) + 1) / 2; glow(c, x, y, 10, col, .3 + on * .6); c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fillStyle = '#fff'; c.fill(); }
DRAW.iron = p => { // Iron Rig: excavator arm + bucket chain over a crater
  const { c, x, y, hw, hh, tier, t, on, hue } = p;
  if (S()) { c.beginPath(); c.ellipse(x - hw * .3, y + hh * .15, hw * .38, hh * .38, 0, 0, 7); c.fillStyle = '#3a2148'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke(); c.beginPath(); c.ellipse(x - hw * .3, y + hh * .2, hw * .28, hh * .26, 0, 0, 7); c.fillStyle = p.ac; c.fill(); }
  const bx = x + hw * .3, by = y - hh * .1, bw = hw * (.32 + tier * .04), bh = 18 + tier * 6; let top = by - bh;
  if (S()) { top = box(c, bx, by, bw, bw / 2, bh, hue, 75, 50, { panels: 2, rivets: true }); c.fillStyle = '#ffd23f'; for (let k = 0; k < 4; k++) poly(c, [bx - bw + k * bw / 4, by - 4 + k * bw / 8, bx - bw + (k + .5) * bw / 4, by - 4 + (k + .5) * bw / 8, bx - bw + (k + .5) * bw / 4, by - 10 + (k + .5) * bw / 8, bx - bw + k * bw / 4, by - 10 + k * bw / 8], k % 2 ? '#ffd23f' : INK, null); }
  windowsL(c, bx, by, bw, bw / 2, bh, 1 + Math.min(2, tier));
  if (A()) { const sw = on ? Math.sin(t * 2.2) * .35 : 0; const L1 = 30 + tier * 6; c.save(); c.translate(bx - 6, top + 2); c.rotate(-2.3 + sw); c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 9; c.beginPath(); c.moveTo(0, 0); c.lineTo(L1, 0); c.stroke(); c.strokeStyle = '#ffb02e'; c.lineWidth = 5; c.stroke(); c.translate(L1, 0); c.rotate(1.6 - sw * 1.5); c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.moveTo(0, 0); c.lineTo(22, 0); c.stroke(); c.strokeStyle = '#ffb02e'; c.lineWidth = 4; c.stroke(); c.translate(22, 0); poly(c, [-2, -7, 12, -6, 10, 8, -4, 6], '#9aa3c0'); c.restore(); }
  if (tier >= 1) lamp(c, bx + bw * .6, top - 6, '#ffb02e', t, 1);
  if (tier >= 2 && S()) cyl(c, bx + bw * .4, top + 2, 5, 16 + tier * 4, 10, 20, 40, '#1d1530');
  if (tier >= 2 && A() && on) steam(c, bx + bw * .4, top - 14 - tier * 4, t, 'rgba(90,80,110,.6)');
  if (tier >= 4 && A()) glow(c, x - hw * .3, y + hh * .2, 40, p.ac, .5);
};
DRAW.crystal = p => { // Laser Array: tripod emitter firing a beam into a crystal
  const { c, x, y, hw, hh, tier, t, on } = p;
  const cx = x - hw * .35, cy = y + hh * .1;
  if (S()) { for (let k = 0; k < 2 + tier; k++) { const a = k * 2.3, px = cx + Math.cos(a) * 8, py = cy + Math.sin(a) * 4; poly(c, [px - 6, py, px - 3, py - 22 - k * 3, px + 3, py - 28 - k * 2, px + 6, py], lg(c, px - 6, 0, px + 6, 0, '#f2c6ff', '#9b4dff'), INK, 2); } }
  const ex = x + hw * .3, ey = y - hh * .1, eh = 26 + tier * 9;
  if (S()) { for (const [lx, ly] of [[-12, 4], [12, 4], [0, -6]]) { c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(ex + lx, ey + ly); c.lineTo(ex, ey - eh); c.stroke(); c.strokeStyle = '#c4c9e6'; c.lineWidth = 3; c.stroke(); } cyl(c, ex, ey - eh + 6, 10 + tier, 12, 280, 50, 50); }
  if (A()) { const head: [number, number] = [ex - 10, ey - eh]; if (on) { const fl = .6 + Math.sin(t * 30) * .4; c.lineCap = 'round'; c.strokeStyle = `rgba(255,120,255,${.5 * fl})`; c.lineWidth = 9; c.beginPath(); c.moveTo(head[0], head[1]); c.lineTo(cx, cy - 18); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke(); glow(c, cx, cy - 18, 30, '#ff7bff', .8 * fl); } glow(c, head[0], head[1], 14, '#ff9bff', on ? .9 : .3); }
  if (tier >= 2) lamp(c, ex, ey - eh - 8, '#c48bff', t);
  if (tier >= 3 && S()) dome(c, ex + 18, ey + 6, 9, '#c48bff');
};
DRAW.plasma = p => { // Plasma Excavator: torus reactor + torch head digging
  const { c, x, y, hw, hh, tier, t, on, hue } = p; orePile(p, -.5, .3, .8);
  const bx = x + hw * .2, by = y, r = hw * (.33 + tier * .03);
  if (S()) { cyl(c, bx, by, r, 16 + tier * 5, hue, 70, 48, undefined, 1); c.beginPath(); c.ellipse(bx, by - 26 - tier * 5, r * .9, r * .35, 0, 0, 7); c.strokeStyle = INK; c.lineWidth = 10; c.stroke(); c.strokeStyle = '#ff6b9a'; c.lineWidth = 5; c.stroke(); }
  if (A()) { const p2 = (Math.sin(t * 5) + 1) / 2; glow(c, bx, by - 26 - tier * 5, r * 1.6, '#ff4f8b', on ? .45 + p2 * .35 : .1); for (let k = 0; k < (on ? 3 : 0); k++) { const a = t * 3 + k * 2.1; c.beginPath(); c.arc(bx + Math.cos(a) * r * .9, by - 26 - tier * 5 + Math.sin(a) * r * .35, 3, 0, 7); c.fillStyle = '#fff'; c.fill(); } if (on) { const tx = x - hw * .45, ty = y + hh * .2; c.strokeStyle = '#ffb3d0'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx - r * .6, by - 10); for (let k = 1; k <= 5; k++) c.lineTo(bx - r * .6 + (tx - bx + r * .6) * k / 5 + (Math.random() - .5) * 8, by - 10 + (ty - by + 10) * k / 5 + (Math.random() - .5) * 8); c.stroke(); glow(c, tx, ty, 18, '#ff8fb8', .8); } }
  if (tier >= 2) lamp(c, bx + r, by - 18, '#ff4f8b', t, 2);
};
DRAW.moon = p => { // Moon Cracker: huge piston hammer on a frame
  const { c, x, y, hw, hh, tier, t, on, hue } = p;
  const fx = x, fy = y, fh = 50 + tier * 10, fw = hw * .55;
  if (S()) { orePile(p, -.1, .45, .9); for (const s of [-1, 1]) box(c, fx + s * fw, fy - s * 4, 7, 3.5, fh, hue, 60, 55, { panels: 0 }); box(c, fx, fy - fh + 2, fw + 9, 8, 10, hue, 70, 48, { rivets: true }); }
  if (A()) { const ph = on ? (t * 1.1) % 1 : .3, drop = ph < .15 ? ph / .15 : ph < .3 ? 1 : 1 - (ph - .3) / .7, hy = fy - fh + 14 + drop * (fh - 34); c.strokeStyle = '#c4c9e6'; c.lineWidth = 6; c.beginPath(); c.moveTo(fx, fy - fh + 4); c.lineTo(fx, hy); c.stroke(); box(c, fx, hy + 18, 14 + tier * 2, 7 + tier, 18, 220, 20, 60); if (on && ph >= .15 && ph < .22) { glow(c, fx, fy - 2, 40, '#ffe066', .9); } }
  if (tier >= 1) { lamp(c, fx - fw, fy - fh - 8, '#ffd23f', t); lamp(c, fx + fw, fy - fh - 12, '#ffd23f', t, 1); }
};
DRAW.planet = p => { // Planet Stripper: tracked crawler with a giant drum cutter
  const { c, x, y, hw, hh, tier, t, on, hue } = p;
  const bx = x + hw * .1, by = y + hh * .05, bw = hw * .62;
  if (S()) { box(c, bx, by + 4, bw, bw / 2, 10, 230, 15, 30); box(c, bx, by - 6, bw * .8, bw * .4, 22 + tier * 5, hue, 80, 52, { panels: 3, rivets: true }); cyl(c, bx + bw * .4, by - 34 - tier * 5, 7, 20 + tier * 4, 10, 20, 40, '#1d1530'); }
  windowsL(c, bx, by - 6, bw * .8, bw * .4, 22 + tier * 5, 3, tier >= 2 ? 2 : 1);
  if (A()) { const dx = bx - bw * .85, dy = by - 8, R = 14 + tier * 2, sp = on ? t * 6 : 0; c.beginPath(); c.ellipse(dx, dy, R * .55, R, -.5, 0, 7); c.fillStyle = '#9aa3c0'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); for (let k = 0; k < 6; k++) { const a = sp + k * Math.PI / 3; c.beginPath(); c.moveTo(dx, dy); c.lineTo(dx + Math.cos(a) * R * .55, dy + Math.sin(a) * R); c.stroke(); } if (on) steam(c, bx + bw * .4, by - 56 - tier * 9, t, 'rgba(80,70,100,.7)'); }
};
DRAW.star = p => { // Star Siphon: funnel tower beaming upward
  const { c, x, y, hw, tier, t, on } = p;
  const h = 40 + tier * 12;
  if (S()) { cyl(c, x, y, hw * .45, 12, 45, 80, 55); c.beginPath(); c.moveTo(x - 10, y - 12); c.lineTo(x - 22 - tier * 2, y - h); c.lineTo(x + 22 + tier * 2, y - h); c.lineTo(x + 10, y - 12); c.closePath(); c.fillStyle = lg(c, x - 22, 0, x + 22, 0, '#ffe58a', '#c07a10'); c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke(); c.beginPath(); c.ellipse(x, y - h, 22 + tier * 2, 7, 0, 0, 7); c.fillStyle = '#3a2148'; c.fill(); c.stroke(); }
  if (A()) { if (on) { const g = c.createLinearGradient(0, y - h - 260, 0, y - h); g.addColorStop(0, 'rgba(255,230,120,0)'); g.addColorStop(1, 'rgba(255,230,120,.75)'); c.fillStyle = g; c.fillRect(x - 10 - Math.sin(t * 8) * 2, y - h - 260, 20 + Math.sin(t * 8) * 4, 260); } glow(c, x, y - h, 40, '#ffe066', on ? .8 : .2); }
};
DRAW.hole = p => { // Black Hole Tap: containment ring + dark singularity
  const { c, x, y, hw, tier, t } = p; const cy = y - 40 - tier * 4, R = hw * .55;
  if (S()) { for (const s of [-1, 1]) box(c, x + s * R, y, 7, 3.5, 40 + tier * 4, 290, 40, 40); }
  if (A()) { glow(c, x, cy, R * 1.8, '#b06bff', .5); c.beginPath(); c.arc(x, cy, R * .45, 0, 7); c.fillStyle = '#05010c'; c.fill(); c.strokeStyle = '#e0b0ff'; c.lineWidth = 2; c.stroke(); c.save(); c.translate(x, cy); c.rotate(t); c.beginPath(); c.ellipse(0, 0, R * .9, R * .25, 0, 0, 7); c.strokeStyle = 'rgba(255,170,255,.8)'; c.lineWidth = 3; c.stroke(); c.restore(); }
};

// ---------------- FACTORY MACHINES (unique per id) ----------------
DRAW.smelter = p => { // blast furnace: conical brick tower with glowing tap
  const { c, x, y, hw, hh, tier, t, on, ac } = p; const r = hw * (.36 + tier * .03), h = 26 + tier * 8, tx = x - hw * .1;
  if (S()) { box(c, x + hw * .35, y + hh * .05, 13, 6.5, 18 + tier * 3, 20, 60, 45, { panels: 1 }); cyl(c, tx, y, r, h, 15, 55, 45, undefined, 2 + (tier >> 1)); cone(c, tx, y - h, r * .9, 18 + tier * 3, hsl(15, 50, 40)); cyl(c, tx, y - h - 14 - tier * 3, 5, 12 + tier * 3, 10, 20, 35, '#1d1530'); }
  if (A()) { const fl = on ? (Math.sin(t * 9) + 1) / 2 : 0; poly(c, [tx + r * .2, y - 4, tx + r * .8, y - 8, tx + r * .8, y - 18, tx + r * .2, y - 14], on ? hsl(30 + fl * 15, 100, 55 + fl * 12) : '#3a3456', INK, 2); if (on) { glow(c, tx + r * .5, y - 10, 26, ac, .6); c.fillStyle = '#ffb02e'; c.fillRect(tx + r * .5 - 2, y - 6, 4, 8); steam(c, tx, y - h - 28 - tier * 6, t, 'rgba(200,200,220,.6)'); } }
  if (tier >= 2) lamp(c, x + hw * .35, y - 22 - tier * 3, '#ffd23f', t, 1);
  if (tier >= 3 && A() && on) glow(c, tx, y - h * .5, 34, '#ff7a2e', .25);
};
DRAW.kiln = p => { // glass kiln: brick dome with glass skylight + crucible
  const { c, x, y, hw, hh, tier, t, on, ac } = p; const r = hw * (.42 + tier * .03);
  if (S()) { box(c, x, y, r, r / 2, 10, 25, 30, 45); dome(c, x, y - 10, r, hsl(18, 55, 52)); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5; for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(x, y - 10, r * (1 - k * .22), r * .5, 0, Math.PI, 0); c.stroke(); } dome(c, x, y - 10 - r * .78, r * .32, '#a8f0ff'); if (tier >= 2) cyl(c, x + hw * .55, y + hh * .2, 7, 16, 195, 40, 60); }
  if (A()) { const fl = (Math.sin(t * 6) + 1) / 2; poly(c, [x - r * .7, y - 6, x - r * .25, y - 1, x - r * .25, y - 14, x - r * .7, y - 19], on ? hsl(40, 100, 60 + fl * 10) : '#3a3456', INK, 2); if (on) { glow(c, x - r * .45, y - 10, 24, ac, .7); glow(c, x, y - 10 - r, 22, '#9af3ff', .5 + fl * .3); } }
  if (tier >= 3) lamp(c, x + r, y - 12, '#5cf2ff', t, 2);
};
DRAW.press = p => { // parts press: tall gantry with a stamping piston
  const { c, x, y, hw, hh, tier, t, on, hue } = p; const w = hw * .5, h = 44 + tier * 8;
  if (S()) { box(c, x, y + 2, w + 6, (w + 6) / 2, 10, 220, 20, 40, { rivets: true }); for (const s of [-1, 1]) box(c, x + s * w * .8, y - s * 3, 7, 3.5, h, hue, 70, 55, { panels: 0 }); box(c, x, y - h + 4, w + 8, (w + 8) / 2, 12, hue, 75, 50, { rivets: true, panels: 2 }); }
  if (A()) { const ph = on ? (t * 1.6) % 1 : 0, d = ph < .2 ? ph / .2 : ph < .3 ? 1 : 1 - (ph - .3) / .7; const py = y - h + 22 + d * (h - 44); c.strokeStyle = '#c4c9e6'; c.lineWidth = 7; c.beginPath(); c.moveTo(x, y - h + 6); c.lineTo(x, py); c.stroke(); box(c, x, py + 10, 13, 6.5, 10, 210, 15, 70); if (on && ph > .19 && ph < .26) { for (let k = 0; k < 6; k++) { const a = k; c.fillStyle = '#ffe066'; c.fillRect(x + Math.cos(a) * 16, y - 10 + Math.sin(a) * 6, 3, 3); } } box(c, x, y - 8, 10, 5, 4, 45, 80, 60); }
  if (tier >= 1) { lamp(c, x - w * .8, y - h - 6, '#ff5b5b', t); lamp(c, x + w * .8, y - h - 10, '#ff5b5b', t, 1.5); }
};
DRAW.forge = p => { // alloy forge: crucible on a crane over a lava trough
  const { c, x, y, hw, hh, tier, t, on, ac } = p;
  if (S()) { box(c, x + hw * .25, y - hh * .05, hw * .38, hw * .19, 26 + tier * 6, 0, 55, 42, { panels: 2, rivets: true }); poly(c, [x - hw * .75, y + hh * .1, x - hw * .2, y + hh * .4, x, y + hh * .3, x - hw * .55, y], '#3a1830'); cyl(c, x + hw * .25 - 8, y - 30 - tier * 6, 5, 18 + tier * 4, 10, 20, 35, '#1d1530'); c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(x - hw * .6, y + hh * .05); c.lineTo(x - hw * .6, y - 52 - tier * 4); c.lineTo(x + hw * .1, y - 52 - tier * 4); c.stroke(); c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.stroke(); }
  if (A()) { const sw = on ? Math.sin(t * 1.5) * 10 : 0; const cx = x - hw * .25 + sw, cy = y - 22; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, y - 52 - tier * 4); c.lineTo(cx, cy - 10); c.stroke(); c.beginPath(); c.moveTo(cx - 10, cy - 10); c.lineTo(cx + 10, cy - 10); c.lineTo(cx + 7, cy + 4); c.lineTo(cx - 7, cy + 4); c.closePath(); c.fillStyle = '#6d6a85'; c.fill(); c.stroke(); c.beginPath(); c.ellipse(cx, cy - 10, 10, 3.5, 0, 0, 7); c.fillStyle = on ? '#ffb02e' : '#4a3f60'; c.fill(); poly(c, [x - hw * .7, y + hh * .1, x - hw * .22, y + hh * .36, x - hw * .05, y + hh * .28, x - hw * .55, y + hh * .02], on ? lg(c, x - hw * .7, 0, x, 0, '#ffe066', ac) : '#4a2a40', null); if (on) { glow(c, x - hw * .35, y + hh * .2, 30, '#ff8a2e', .6); steam(c, x + hw * .25 - 8, y - 50 - tier * 10, t, 'rgba(120,100,120,.6)'); } }
  if (tier >= 2) lamp(c, x + hw * .55, y - 30 - tier * 6, '#ffd23f', t);
};
DRAW.fab = p => { // chip fab: white clean-room with glass roof strip + vent fans + robot arm
  const { c, x, y, hw, hh, tier, t, on } = p; const bw = hw * (.64 + tier * .04), bh = 22 + tier * 6;
  let top = y - bh;
  if (S()) { top = box(c, x, y, bw, bw / 2, bh, 210, 25, 82, { panels: 3 }); poly(c, [x - bw * .6, top + 2, x, top - bw * .3 + 2, x + bw * .2, top - bw * .2 + 2, x - bw * .4, top + bw * .1 + 2], 'rgba(120,220,255,.85)', INK, 2); for (const s of [0, 1]) { c.beginPath(); c.ellipse(x + bw * (.35 + s * .2) - 8, top + 4 - s * 5, 7, 3.5, 0, 0, 7); c.fillStyle = '#4a4470'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); } }
  windowsL(c, x, y, bw, bw / 2, bh, 3, tier >= 3 ? 2 : 1);
  if (A()) { for (const s of [0, 1]) { const fx = x + bw * (.35 + s * .2) - 8, fy = top + 4 - s * 5, a = on ? t * 12 : 0; c.strokeStyle = '#c4c9e6'; c.lineWidth = 2; c.beginPath(); c.moveTo(fx - Math.cos(a) * 6, fy - Math.sin(a) * 3); c.lineTo(fx + Math.cos(a) * 6, fy + Math.sin(a) * 3); c.stroke(); } const ax = x + bw * .8, ay = y - 4, an = on ? Math.sin(t * 2.5) : 0; c.save(); c.translate(ax, ay); c.rotate(-1.9 + an * .4); c.strokeStyle = INK; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(20, 0); c.stroke(); c.strokeStyle = '#ff9f43'; c.lineWidth = 4; c.stroke(); c.translate(20, 0); c.rotate(1.3 - an * .6); c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(14, 0); c.stroke(); c.strokeStyle = '#ff9f43'; c.lineWidth = 3; c.stroke(); c.restore(); if (on) glow(c, x - bw * .2, top - 4, 20, '#7ae8ff', .5); }
  if (tier >= 1) lamp(c, x - bw, y - bh - 2, '#5cff9d', t);
};
DRAW.hull = p => { // hullworks: big arched hangar with a hull section peeking out
  const { c, x, y, hw, hh, tier, t, on, hue } = p; const w = hw * .8, h = 30 + tier * 6;
  if (S()) { poly(c, [x - w, y, x, y + w / 2, x, y + w / 2 - h, x - w, y - h], lg(c, x - w, 0, x, 0, hsl(hue, 30, 55), hsl(hue, 30, 42))); c.beginPath(); c.moveTo(x - w, y - h); c.quadraticCurveTo(x - w * .1, y - h - w * .9, x + w, y - h); c.lineTo(x, y + w / 2 - h); c.closePath(); c.fillStyle = lg(c, x - w, y - h - w, x + w, y - h, hsl(hue, 35, 70), hsl(hue, 35, 50)); c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke(); poly(c, [x + w, y, x, y + w / 2, x, y + w / 2 - h, x + w, y - h], hsl(hue, 30, 35)); poly(c, [x + w * .2, y + w * .4 - 2, x + w * .8, y + w * .1 - 2, x + w * .8, y + w * .1 - h * .8, x + w * .2, y + w * .4 - h * .8], '#1d1530', INK, 2); c.strokeStyle = 'rgba(0,0,0,.2)'; for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(x - w + k * w / 5, y + k * w / 10 - h); c.lineTo(x - w + k * w / 5, y + k * w / 10); c.stroke(); } }
  if (A()) { const b = on ? Math.sin(t * .8) * 4 : 0; poly(c, [x + w * .3, y + w * .32 - 8 + b, x + w * .85, y + w * .05 - 14 + b, x + w * .7, y + w * .05 - 26 + b, x + w * .3, y + w * .3 - 22 + b], '#c4c9e6', INK, 2); if (on) { c.fillStyle = '#ffe066'; const sp = (t * 7) % 1; glow(c, x + w * .55, y + w * .2 - 16, 16 * sp + 6, '#fff3a0', .9 - sp * .6); } }
  if (tier >= 2) lamp(c, x - w * .1, y - h - w * .45, '#ff5b5b', t);
};
DRAW.quantum = p => { // quantum lab: floating orb inside gyroscope rings on a pylon
  const { c, x, y, hw, tier, t, on } = p; const cy = y - 46 - tier * 5;
  if (S()) { cyl(c, x, y, hw * .45, 12, 260, 40, 40); cyl(c, x, y - 12, hw * .2, 14, 260, 40, 55); }
  if (A()) { glow(c, x, cy, 46, '#b06bff', on ? .65 : .2); for (let k = 0; k < 2 + (tier >> 1); k++) { c.save(); c.translate(x, cy); c.rotate(t * (k % 2 ? -1 : 1) * (1 + k * .5)); c.beginPath(); c.ellipse(0, 0, 26 - k * 5, 9 + k * 3, 0, 0, 7); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); c.strokeStyle = ['#5cf2ff', '#ff7bd5', '#ffd23f'][k % 3]; c.lineWidth = 2.5; c.stroke(); c.restore(); } const g = c.createRadialGradient(x - 4, cy - 4, 1, x, cy, 12); g.addColorStop(0, '#fff'); g.addColorStop(1, '#9b4dff'); c.beginPath(); c.arc(x, cy + Math.sin(t * 2) * 3, 11, 0, 7); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke(); }
};

// ---------------- infrastructure ----------------
DRAW.gen = p => {
  const { c, x, y, hw, hh, tier, t, on } = p; const r = hw * (.4 + tier * .04), h = 22 + tier * 7, cy = y - h;
  if (S()) { cyl(c, x, y, r, h, 210, 25, 62, undefined, 1 + (tier >> 1)); c.beginPath(); c.ellipse(x, cy, r * .62, r * .31, 0, 0, 7); c.fillStyle = '#4a4470'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); if (tier >= 2) for (const s of [-1, 1]) cyl(c, x + s * hw * .72, y + hh * .15, 6, 16 + tier * 4, 45, 85, 55, undefined, 1); for (const s of [-1, 1]) { c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(x + s * r, cy + 4); c.lineTo(x + s * r * .4, cy - 26); c.stroke(); } }
  if (A()) { const pulse = (Math.sin(t * 3) + 1) / 2; glow(c, x, cy - 14, 42 + tier * 6, '#ffe066', on ? .45 + pulse * .45 : .15); c.beginPath(); c.ellipse(x, cy, r * .55, r * .27, 0, 0, 7); c.fillStyle = on ? '#fff3a0' : '#665e88'; c.fill(); for (let k = 0; k < 1 + Math.min(2, tier >> 1); k++) { c.save(); c.translate(x, cy - 16 - k * 10); c.beginPath(); c.ellipse(0, 0, r * (.8 - k * .15), r * .22, Math.sin(t * (1.5 + k)) * .25, 0, 7); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); c.strokeStyle = k ? '#5cf2ff' : '#ffd23f'; c.lineWidth = 2.5; c.stroke(); c.restore(); } if (on) { c.strokeStyle = '#fff6b0'; c.lineWidth = 2; c.beginPath(); let px = x - r * .4, py = cy - 26; c.moveTo(px, py); for (let k = 0; k < 4; k++) { px += r * .2; py += (Math.random() - .5) * 10; c.lineTo(px, py); } c.stroke(); } }
};
DRAW.yard = p => {
  const { c, x, y, hw, hh, tier, t, on } = p; const gx = x + hw * .58, gh = 44 + tier * 10;
  if (S()) { c.beginPath(); c.ellipse(x, y, hw * .75, hh * .75, 0, 0, 7); c.fillStyle = '#3d3460'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke(); c.beginPath(); c.ellipse(x, y, hw * .62, hh * .62, 0, 0, 7); c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.setLineDash([8, 6]); c.stroke(); c.setLineDash([]); box(c, gx, y - hh * .2, 8, 4, gh, 15, 70, 50, { panels: 0 }); c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(gx, y - hh * .2 - gh + 6); c.lineTo(x + 8, y - gh + 14); c.stroke(); }
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .78; lamp(c, x + Math.cos(a) * hw * .75, y + Math.sin(a) * hh * .75, on ? '#5cff9d' : '#ff5b5b', t, k); }
};
export function ship(c: C, x: number, y: number, sc: number, flame: number) {
  c.save(); c.translate(x, y); c.scale(sc, sc);
  if (flame > 0) { glow(c, 0, 12, 22, '#ffb23f', .6 + flame * .3); poly(c, [-6, 6, 0, 10 + flame * 20, 6, 6], '#fff3a0', null); }
  poly(c, [0, -44, 12, -10, 18, 6, 0, 0, -18, 6, -12, -10], lg(c, -18, 0, 18, 0, '#ffffff', '#9aa3c0'));
  poly(c, [0, -44, 6, -26, -6, -26], '#ff5b5b', INK, 2);
  c.beginPath(); c.arc(0, -16, 5, 0, 7); c.fillStyle = '#5cf2ff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
  poly(c, [-12, -10, -24, 8, -16, 8], '#ff9f43', INK, 2); poly(c, [12, -10, 24, 8, 16, 8], '#ff9f43', INK, 2);
  c.restore();
}
DRAW.gate = p => {
  const { c, x, y, hw, tier, t, on } = p; const R = hw * .8, cy = y - R * .9;
  if (S()) { for (const s of [-1, 1]) box(c, x + s * R * .8, y, 9, 4.5, 22, 270, 40, 45, { rivets: true }); c.beginPath(); c.ellipse(x, cy, R * .78, R * .82, 0, 0, 7); c.strokeStyle = INK; c.lineWidth = 14; c.stroke(); c.strokeStyle = '#6a6290'; c.lineWidth = 9; c.stroke(); }
  if (A()) { if (on) { c.save(); c.translate(x, cy); c.rotate(t * .8); for (let k = 0; k < 3; k++) { c.rotate(2.09); c.beginPath(); c.ellipse(0, 0, R * .66, R * .3, 0, 0, Math.PI); c.strokeStyle = `hsla(${280 + k * 30},100%,70%,.7)`; c.lineWidth = 4; c.stroke(); } c.restore(); glow(c, x, cy, R, '#b06bff', .5 + Math.sin(t * 2) * .2); c.beginPath(); c.ellipse(x, cy, R * .78, R * .82, 0, 0, 7); c.strokeStyle = '#c48bff'; c.lineWidth = 5; c.stroke(); } for (let k = 0; k < 6 + tier * 2; k++) { const a = k / (6 + tier * 2) * Math.PI * 2 + t * .3; lampRaw(c, x + Math.cos(a) * R * .78, cy + Math.sin(a) * R * .82, on ? '#5cf2ff' : '#555', t + k); } }
};
DRAW.hq = p => {
  const { c, x, y, hw, hh, tier, t } = p; const w = hw * (.58 + tier * .03), h = 30 + tier * 6;
  let top = y - h;
  if (S()) { top = box(c, x, y, w, w / 2, h, 215, 55, 58, { panels: 2, rivets: true }); dome(c, x - 4, top + 2, w * .55, '#8fe6ff'); c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x + w * .55, top); c.lineTo(x + w * .55, top - 40); c.stroke(); c.beginPath(); c.moveTo(x - w * .75, top - 2); c.lineTo(x - w * .75, top - 36); c.stroke(); if (tier >= 1) box(c, x + w * .9, y + 2, 10, 5, 22, 45, 80, 55); }
  windowsL(c, x, y, w, w / 2, h, 3);
  if (A()) { c.save(); c.translate(x + w * .55, top - 40); c.rotate(Math.sin(t * .5) * .5); c.beginPath(); c.ellipse(0, 0, 13, 6, -.4, 0, Math.PI); c.fillStyle = '#eef2ff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke(); c.restore(); lampRaw(c, x + w * .55, top - 47, '#ff5b5b', t); const wv = Math.sin(t * 4) * 3; poly(c, [x - w * .75, top - 36, x - w * .75 + 20, top - 32 + wv, x - w * .75, top - 24], '#ff5b5b', INK, 2); }
};
DRAW.lab = p => { // research lab: glass dome observatory with rotating telescope + bubbling tubes
  const { c, x, y, hw, tier, t, on } = p; const w = hw * .55;
  if (S()) { box(c, x, y, w, w / 2, 16 + tier * 4, 160, 50, 55, { panels: 2 }); dome(c, x, y - 16 - tier * 4, w * .85, '#7affd1'); for (const s of [-1, 1]) cyl(c, x + s * w * 1.15, y + 4, 6, 22, 170, 30, 70); }
  if (A()) { const top = y - 16 - tier * 4; c.save(); c.translate(x, top - w * .5); c.rotate(-.6 + Math.sin(t * .4) * .5); c.fillStyle = '#c4c9e6'; c.strokeStyle = INK; c.lineWidth = 2; c.fillRect(-4, -26, 8, 26); c.strokeRect(-4, -26, 8, 26); c.restore(); for (const s of [-1, 1]) { const bx = x + s * w * 1.15; glow(c, bx, y - 14, 14, '#7affd1', on ? .7 : .3); for (let k = 0; k < 3; k++) { const f = ((t * .9 + k / 3) % 1); c.beginPath(); c.arc(bx + Math.sin(k + t) * 2, y - 6 - f * 26, 2, 0, 7); c.fillStyle = 'rgba(200,255,240,' + (1 - f) + ')'; c.fill(); } } }
};

/** Construction plot */
export function drawPlot(c: C, x: number, y: number, s: number, t: number, afford: boolean) {
  const hw = s * TW / 2 * .8, hh = s * TH / 2 * .8;
  poly(c, [x - hw, y, x, y - hh, x + hw, y, x, y + hh], afford ? 'rgba(92,255,157,.2)' : 'rgba(255,255,255,.06)', afford ? '#5cff9d' : 'rgba(255,255,255,.35)', 2);
  for (const [dx, dy] of [[-hw, 0], [hw, 0], [0, -hh], [0, hh]]) { const cx = x + dx * .8, cy = y + dy * .8; poly(c, [cx - 4, cy, cx, cy - 11, cx + 4, cy], '#ff9f43', INK, 1.5); c.fillStyle = '#fff'; c.fillRect(cx - 2, cy - 6, 4, 2); }
  const b = afford ? Math.abs(Math.sin(t * 3)) * 6 : 0;
  c.beginPath(); c.arc(x, y - 14 - b, 13, 0, 7); c.fillStyle = afford ? '#5cff9d' : '#8b84b0'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  c.fillStyle = INK; c.fillRect(x - 6, y - 16 - b, 12, 4); c.fillRect(x - 2, y - 20 - b, 4, 12);
}
/** Scaffolding drawn over a building under construction (f: 0..1 progress) */
export function scaffold(c: C, x: number, y: number, s: number, f: number, t: number) {
  const hw = s * TW / 2 * .7, hh = s * TH / 2 * .7, H = 70;
  c.strokeStyle = INK; c.lineWidth = 4.5; c.lineCap = 'round';
  const posts = [[-hw, 0], [0, hh], [hw, 0], [0, -hh]];
  const draw = (col: string, lw: number) => { c.strokeStyle = col; c.lineWidth = lw; for (const [dx, dy] of posts) { c.beginPath(); c.moveTo(x + dx, y + dy); c.lineTo(x + dx, y + dy - H); c.stroke(); } for (let k = 1; k <= 3; k++) { const hy = H * k / 3; c.beginPath(); posts.forEach(([dx, dy], i) => i ? c.lineTo(x + dx, y + dy - hy) : c.moveTo(x + dx, y + dy - hy)); c.closePath(); c.stroke(); } c.beginPath(); c.moveTo(x - hw, y); c.lineTo(x, y + hh - H / 3); c.moveTo(x, y + hh); c.lineTo(x + hw, y - H / 3); c.stroke(); };
  draw(INK, 5); draw('#ffb02e', 2.5);
  // crane hook
  const cx = x + hw * .2 + Math.sin(t * 3) * 8; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, y - H - 30); c.lineTo(cx, y - H * (1 - f) - 10); c.stroke();
  poly(c, [cx - 7, y - H * (1 - f) - 10, cx + 7, y - H * (1 - f) - 10, cx + 7, y - H * (1 - f), cx - 7, y - H * (1 - f)], '#ffd23f', INK, 2);
  for (let k = 0; k < 4; k++) { const a = t * 6 + k * 1.7, r = (t * 40 + k * 13) % 30; c.globalAlpha = .6 * (1 - r / 30); c.beginPath(); c.arc(x + Math.cos(a) * (hw + r), y + Math.sin(a) * (hh + r / 2), 5 + r / 4, 0, 7); c.fillStyle = '#d8c8f0'; c.fill(); }
  c.globalAlpha = 1;
}
