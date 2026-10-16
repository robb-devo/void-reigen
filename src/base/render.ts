// Isometric asteroid base renderer (Canvas2D). Chunky, saturated, outlined "Supercell-ish" vector art,
// every building has 5 visual tiers driven by its level. Pure drawing: no game logic in here.
export const TW = 72, TH = 36; // tile size (screen px at zoom 1)
export const iso = (x: number, y: number): [number, number] => [(x - y) * TW / 2, (x + y) * TH / 2];
const INK = '#24163a';
type C = CanvasRenderingContext2D;
export const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

function poly(c: C, pts: number[], fill: string, stroke = INK, lw = 2.5) {
  c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath();
  c.fillStyle = fill; c.fill(); if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); }
}
/** iso box centred at (x,y) ground; hw/hh half diamond extents; h height. Returns top-face centre y. */
export function box(c: C, x: number, y: number, hw: number, hh: number, h: number, hue: number, sat = 70, lit = 55, top?: string) {
  poly(c, [x - hw, y, x, y + hh, x, y + hh - h, x - hw, y - h], hsl(hue, sat, lit - 12));
  poly(c, [x + hw, y, x, y + hh, x, y + hh - h, x + hw, y - h], hsl(hue, sat, lit - 24));
  poly(c, [x - hw, y - h, x, y - hh - h, x + hw, y - h, x, y + hh - h], top || hsl(hue, sat, lit + 8));
  // rim highlight
  c.beginPath(); c.moveTo(x - hw + 3, y - h); c.lineTo(x, y - hh - h + 2); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2; c.stroke();
  return y - h;
}
function cyl(c: C, x: number, y: number, r: number, h: number, hue: number, sat = 60, lit = 55, top?: string) {
  const ry = r / 2;
  c.beginPath(); c.moveTo(x - r, y - h); c.lineTo(x - r, y); c.ellipse(x, y, r, ry, 0, Math.PI, 0, true); c.lineTo(x + r, y - h); c.closePath();
  const g = c.createLinearGradient(x - r, 0, x + r, 0); g.addColorStop(0, hsl(hue, sat, lit - 6)); g.addColorStop(.35, hsl(hue, sat, lit + 6)); g.addColorStop(1, hsl(hue, sat, lit - 26));
  c.fillStyle = g; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.ellipse(x, y - h, r, ry, 0, 0, Math.PI * 2); c.fillStyle = top || hsl(hue, sat, lit + 12); c.fill(); c.stroke();
}
function glow(c: C, x: number, y: number, r: number, col: string, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
}
function lamp(c: C, x: number, y: number, col: string, t: number, ph = 0) {
  const on = (Math.sin(t * 3 + ph) + 1) / 2; glow(c, x, y, 9, col, .35 + on * .5);
  c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fillStyle = on > .4 ? '#fff' : col; c.fill();
}
function shadow(c: C, x: number, y: number, hw: number, hh: number) {
  c.beginPath(); c.ellipse(x + 4, y + 4, hw * 1.05, hh * 1.05, 0, 0, 7); c.fillStyle = 'rgba(20,8,40,.35)'; c.fill();
}
function windows(c: C, x: number, y: number, hw: number, hh: number, h: number, n: number, col: string) {
  // windows on the left face
  for (let k = 0; k < n; k++) {
    const f = (k + 0.7) / (n + 0.4), wx = x - hw + hw * f, wy = y + hh * f - h * 0.55;
    poly(c, [wx - 4, wy - 2, wx + 2, wy + 1, wx + 2, wy - 7, wx - 4, wy - 10], col, INK, 1.5);
  }
}

export type Kind = 'mine' | 'mach' | 'gen' | 'yard' | 'gate' | 'hq';
export const TIER_NAMES = ['Prototype', 'Outpost', 'Industrial', 'Advanced', 'Ascended'];

/** Draw a building at screen pos (x,y) = footprint centre on ground. s = footprint tiles. */
export function drawBuilding(c: C, kind: Kind, id: string, hue: number, tier: number, x: number, y: number, s: number, t: number, active: boolean, accent: string) {
  const hw = s * TW / 2 * 0.86, hh = s * TH / 2 * 0.86;
  shadow(c, x, y, hw, hh);
  // concrete pad — gets fancier with tier
  box(c, x, y, hw, hh, 6, 230, 14, 44 + tier * 3, tier >= 3 ? hsl(hue, 30, 62) : undefined);
  if (tier >= 2) { c.setLineDash([6, 6]); c.beginPath(); c.moveTo(x - hw * .8, y - 6); c.lineTo(x, y - 6 + hh * .8); c.lineTo(x + hw * .8, y - 6); c.strokeStyle = 'rgba(255,220,80,.8)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
  const gy = y - 6;
  if (kind === 'mine') mine(c, id, hue, tier, x, gy, hw, hh, t, active, accent);
  else if (kind === 'mach') factory(c, id, hue, tier, x, gy, hw, hh, t, active, accent);
  else if (kind === 'gen') reactor(c, tier, x, gy, hw, hh, t, active);
  else if (kind === 'yard') yard(c, tier, x, gy, hw, hh, t, active);
  else if (kind === 'gate') gate(c, tier, x, gy, hw, t, active);
  else hq(c, tier, x, gy, hw, hh, t);
}

function mine(c: C, id: string, hue: number, tier: number, x: number, y: number, hw: number, hh: number, t: number, active: boolean, accent: string) {
  // ore pile (front-left)
  const px = x - hw * .45, py = y + hh * .25;
  c.beginPath(); c.ellipse(px, py, hw * .32, hh * .32, 0, Math.PI, 0); c.fillStyle = accent; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
  for (let k = 0; k < 3 + tier; k++) { const a = k * 2.1; poly(c, [px + Math.cos(a) * 9 - 4, py - 4 - (k % 2) * 5, px + Math.cos(a) * 9, py - 10 - (k % 2) * 5, px + Math.cos(a) * 9 + 4, py - 4 - (k % 2) * 5], accent, INK, 1.5); }
  // base housing
  const bw = hw * (.42 + tier * .05), bh = 16 + tier * 7;
  const top = box(c, x + hw * .15, y - hh * .05, bw, bw / 2, bh, hue, 75, 52);
  windows(c, x + hw * .15, y - hh * .05, bw, bw / 2, bh, Math.min(3, tier + 1), active ? '#ffe98a' : '#4b5a7a');
  // derrick tower
  const tx = x + hw * .15, ty = top - bw / 2 * 0.1, th = 34 + tier * 12;
  c.strokeStyle = INK; c.lineWidth = 5; c.lineCap = 'round';
  const legs = [[-10, 0], [10, 0], [0, -5]];
  for (const [lx, ly] of legs) { c.beginPath(); c.moveTo(tx + lx, ty + ly); c.lineTo(tx, ty - th); c.stroke(); }
  c.strokeStyle = hsl(45, 95, 58); c.lineWidth = 2.5;
  for (const [lx, ly] of legs) { c.beginPath(); c.moveTo(tx + lx, ty + ly); c.lineTo(tx, ty - th); c.stroke(); }
  for (let k = 1; k < 3 + tier; k++) { const f = k / (3 + tier), w = 10 * (1 - f); c.beginPath(); c.moveTo(tx - w, ty - th * f); c.lineTo(tx + w, ty - th * f); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); c.strokeStyle = hsl(45, 95, 58); c.lineWidth = 1.5; c.stroke(); }
  // spinning drill head
  const sp = active ? t * 14 : 0, by = ty + 6;
  c.save(); c.translate(tx, by); c.scale(1, .5);
  for (let k = 0; k < 3; k++) { c.rotate(Math.PI * 2 / 3); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 13 + tier * 2, sp, sp + .7); c.closePath(); c.fillStyle = hsl(hue, 20, 85); c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); }
  c.restore();
  // top cap / beacon
  if (tier >= 1) lamp(c, tx, ty - th - 4, tier >= 3 ? '#5cf2ff' : '#ff5b5b', t, hue);
  if (tier >= 2) { cyl(c, x - hw * .05, y - hh * .55, 7 + tier, 20 + tier * 6, 200, 20, 70); if (active) steam(c, x - hw * .05, y - hh * .55 - 22 - tier * 6, t, 'rgba(255,255,255,.55)'); }
  if (tier >= 3) { // glowing energy coil
    const g = (Math.sin(t * 4) + 1) / 2; glow(c, tx, ty - th * .5, 26, accent, .3 + g * .4);
    c.beginPath(); c.ellipse(tx, ty - th * .5, 12, 5, 0, 0, 7); c.strokeStyle = accent; c.lineWidth = 3; c.stroke();
  }
  if (tier >= 4) { // crystal crown
    for (let k = -1; k <= 1; k++) poly(c, [tx + k * 9 - 4, top + 2, tx + k * 9, top - 16 - (k ? 0 : 8), tx + k * 9 + 4, top + 2], hsl((hue + 180) % 360, 90, 70), INK, 1.5);
    glow(c, tx, top - 10, 30, hsl((hue + 180) % 360, 100, 70), .5);
  }
  void id;
}

function factory(c: C, id: string, hue: number, tier: number, x: number, y: number, hw: number, hh: number, t: number, active: boolean, accent: string) {
  const bw = hw * (.62 + tier * .05), bh = 22 + tier * 8;
  const top = box(c, x - hw * .05, y, bw, bw / 2, bh, hue, 62, 55);
  // big glowing furnace mouth on right face
  const mx = x - hw * .05 + bw * .5, my = y + bw / 4 - bh * .35;
  const fl = active ? (Math.sin(t * 9) + 1) / 2 : 0;
  poly(c, [mx - 9, my + 2, mx + 9, my - 7, mx + 9, my - 19, mx - 9, my - 10], active ? hsl(30 + fl * 15, 100, 55 + fl * 10) : '#3a3456', INK, 2);
  if (active) glow(c, mx, my - 8, 26, accent, .55);
  windows(c, x - hw * .05, y, bw, bw / 2, bh, 2 + Math.min(2, tier), active ? '#ffe98a' : '#4b5a7a');
  // roof details
  if (tier >= 1) box(c, x - hw * .2, top + 4, bw * .35, bw * .17, 8 + tier * 2, hue, 30, 70);
  // chimneys (more with tier)
  const nc = 1 + Math.min(2, tier >> 1);
  for (let k = 0; k < nc; k++) {
    const cx = x + hw * (.12 + k * .2) - bw * .1, cy = top - 2 + k * 5, ch = 22 + tier * 6;
    cyl(c, cx, cy, 6, ch, 10, 15, 45, '#1d1530');
    c.fillStyle = '#ff5b5b'; c.fillRect(cx - 6, cy - ch * .7, 12, 4);
    if (active) steam(c, cx, cy - ch, t + k * 1.3, 'rgba(220,220,240,.6)');
  }
  // tier 3+: output tank glowing with product colour
  if (tier >= 3) { cyl(c, x - hw * .62, y + hh * .1, 9, 26, 220, 15, 65); glow(c, x - hw * .62, y + hh * .1 - 14, 18, accent, .6); c.fillStyle = accent; c.fillRect(x - hw * .62 - 3, y + hh * .1 - 24, 6, 16); }
  if (tier >= 4) { lamp(c, x - hw * .05, top - bw * .5 - 4, '#5cf2ff', t); c.beginPath(); c.arc(x - hw * .05, top - 10, 14, Math.PI, 0); c.fillStyle = 'rgba(120,230,255,.5)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); }
  if (tier >= 2) { lamp(c, x - hw * .05 - bw, y - bh, '#ffd23f', t, 1); lamp(c, x - hw * .05 + bw, y - bh, '#ffd23f', t, 2); }
  void id;
}

function reactor(c: C, tier: number, x: number, y: number, hw: number, hh: number, t: number, active: boolean) {
  const r = hw * (.42 + tier * .04), h = 24 + tier * 8;
  cyl(c, x, y, r, h, 210, 25, 62);
  const pulse = (Math.sin(t * 3) + 1) / 2;
  // core
  const cy = y - h;
  glow(c, x, cy - 12, 40 + tier * 6, '#ffe066', active ? .5 + pulse * .4 : .15);
  c.beginPath(); c.ellipse(x, cy, r * .6, r * .3, 0, 0, 7); c.fillStyle = active ? '#fff3a0' : '#665e88'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
  // rotating rings
  for (let k = 0; k < 1 + Math.min(2, tier >> 1); k++) {
    c.save(); c.translate(x, cy - 14 - k * 10); c.beginPath(); c.ellipse(0, 0, r * (.8 - k * .15), r * .22, Math.sin(t * (1.5 + k)) * .25, 0, 7); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); c.strokeStyle = k ? '#5cf2ff' : '#ffd23f'; c.lineWidth = 2.5; c.stroke(); c.restore();
  }
  // bolts
  if (active) for (let k = 0; k < 2 + tier; k++) { const a = t * 2 + k * 2.3; lamp(c, x + Math.cos(a) * r * .9, cy - 12 + Math.sin(a) * r * .25, '#ffe066', t, k); }
  if (tier >= 2) for (const s of [-1, 1]) cyl(c, x + s * hw * .7, y + hh * .15, 6, 16 + tier * 4, 45, 85, 55);
  void hh;
}

function yard(c: C, tier: number, x: number, y: number, hw: number, hh: number, t: number, active: boolean) {
  // launch pad ring
  c.beginPath(); c.ellipse(x, y, hw * .75, hh * .75, 0, 0, 7); c.fillStyle = '#3d3460'; c.fill(); c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.setLineDash([8, 6]); c.stroke(); c.setLineDash([]);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .78; lamp(c, x + Math.cos(a) * hw * .75, y + Math.sin(a) * hh * .75, active ? '#5cff9d' : '#ff5b5b', t, k); }
  // gantry
  const gx = x + hw * .55, gh = 40 + tier * 10;
  box(c, gx, y - hh * .2, 8, 4, gh, 15, 70, 50);
  c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(gx, y - hh * .2 - gh + 6); c.lineTo(x + 6, y - gh + 10); c.stroke();
  // ship: hover bob
  const bob = active ? Math.sin(t * 2) * 3 : 0, sy = y - 14 + bob, sz = 1 + tier * .15;
  c.save(); c.translate(x, sy); c.scale(sz, sz);
  poly(c, [0, -44, 12, -10, 18, 6, 0, 0, -18, 6, -12, -10], '#eef2ff');
  poly(c, [0, -44, 6, -24, -6, -24], '#ff5b5b', INK, 2);
  c.beginPath(); c.arc(0, -16, 5, 0, 7); c.fillStyle = '#5cf2ff'; c.fill(); c.stroke();
  poly(c, [-12, -10, -24, 8, -16, 8], '#ff9f43', INK, 2); poly(c, [12, -10, 24, 8, 16, 8], '#ff9f43', INK, 2);
  if (active) glow(c, 0, 10, 16, '#ffb23f', .7 + Math.sin(t * 20) * .2);
  c.restore();
}

function gate(c: C, tier: number, x: number, y: number, hw: number, t: number, active: boolean) {
  const R = hw * .8;
  for (const s of [-1, 1]) box(c, x + s * R * .8, y, 8, 4, 18, 270, 40, 45);
  const cy = y - R * .9;
  if (active) { c.save(); c.translate(x, cy); c.rotate(t * .8); for (let k = 0; k < 3; k++) { c.rotate(2.09); c.beginPath(); c.ellipse(0, 0, R * .7, R * .3, 0, 0, Math.PI); c.strokeStyle = `hsla(${280 + k * 30},100%,70%,.7)`; c.lineWidth = 4; c.stroke(); } c.restore(); glow(c, x, cy, R, '#b06bff', .5 + Math.sin(t * 2) * .2); }
  c.beginPath(); c.ellipse(x, cy, R * .78, R * .82, 0, 0, 7); c.strokeStyle = INK; c.lineWidth = 13; c.stroke();
  c.strokeStyle = active ? '#c48bff' : '#6a6290'; c.lineWidth = 8; c.stroke();
  for (let k = 0; k < 6 + tier * 2; k++) { const a = k / (6 + tier * 2) * Math.PI * 2 + t * .3; lamp(c, x + Math.cos(a) * R * .78, cy + Math.sin(a) * R * .82, active ? '#5cf2ff' : '#555', t, k); }
}

function hq(c: C, tier: number, x: number, y: number, hw: number, hh: number, t: number) {
  const top = box(c, x, y, hw * .6, hh * .6, 30, 215, 55, 58);
  windows(c, x, y, hw * .6, hh * .6, 30, 3, '#ffe98a');
  c.beginPath(); c.arc(x, top + 2, hw * .35, Math.PI, 0); c.fillStyle = 'rgba(140,230,255,.75)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
  c.beginPath(); c.arc(x - 8, top - 8, 6, Math.PI, 1.5 * Math.PI); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x + hw * .3, top); c.lineTo(x + hw * .3, top - 40); c.stroke();
  // dish
  c.save(); c.translate(x + hw * .3, top - 40); c.rotate(Math.sin(t * .5) * .5); c.beginPath(); c.ellipse(0, 0, 12, 6, -.4, 0, Math.PI); c.fillStyle = '#eef2ff'; c.fill(); c.stroke(); c.restore();
  lamp(c, x + hw * .3, top - 46, '#ff5b5b', t);
  // flag
  c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(x - hw * .45, top - 4); c.lineTo(x - hw * .45, top - 34); c.stroke();
  const w = Math.sin(t * 4) * 3; poly(c, [x - hw * .45, top - 34, x - hw * .45 + 20, top - 30 + w, x - hw * .45, top - 22], '#ff5b5b', INK, 2);
  void tier;
}

export function steam(c: C, x: number, y: number, t: number, col: string) {
  for (let k = 0; k < 4; k++) {
    const f = (((t * .6 + k / 4) % 1) + 1) % 1, r = 4 + f * 10;
    c.globalAlpha = (1 - f) * .9; c.beginPath(); c.arc(x + Math.sin((t + k) * 2) * 4 * f, y - f * 34, r, 0, 7); c.fillStyle = col; c.fill();
  }
  c.globalAlpha = 1;
}

/** Construction plot for an unbuilt-but-available building. */
export function drawPlot(c: C, x: number, y: number, s: number, t: number, afford: boolean) {
  const hw = s * TW / 2 * .8, hh = s * TH / 2 * .8;
  poly(c, [x - hw, y, x, y - hh, x + hw, y, x, y + hh], afford ? 'rgba(92,255,157,.18)' : 'rgba(255,255,255,.06)', afford ? '#5cff9d' : 'rgba(255,255,255,.35)', 2);
  c.setLineDash([]);
  for (const [dx, dy] of [[-hw, 0], [hw, 0], [0, -hh], [0, hh]]) { cylCone(c, x + dx * .8, y + dy * .8); }
  const b = afford ? Math.abs(Math.sin(t * 3)) * 6 : 0;
  c.beginPath(); c.arc(x, y - 14 - b, 13, 0, 7); c.fillStyle = afford ? '#5cff9d' : '#8b84b0'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  c.fillStyle = INK; c.fillRect(x - 6, y - 16 - b, 12, 4); c.fillRect(x - 2, y - 20 - b, 4, 12);
}
function cylCone(c: C, x: number, y: number) { poly(c, [x - 4, y, x, y - 11, x + 4, y], '#ff9f43', INK, 1.5); c.fillStyle = '#fff'; c.fillRect(x - 2, y - 6, 4, 2); }
