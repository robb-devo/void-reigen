// Conveyor / walker routing on a half-tile grid: A* around building footprints, preferring the paved
// lanes between pads and penalising turns, so belts snake through the gaps wherever the player builds.
export type Pt = [number, number];
const STEP = .5, LIM = 10.5, N = Math.round(LIM * 2 / STEP) + 1;
const idx = (x: number, y: number) => Math.round((y + LIM) / STEP) * N + Math.round((x + LIM) / STEP);
/**
 * @param obst footprint centres of every other building (blocked within ±1.1)
 * @param R    rock radius: nodes beyond R-1 are off-limits
 */
export function route(a: Pt, b: Pt, obst: Pt[], R: number): Pt[] {
  const blocked = new Uint8Array(N * N), lane = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = i * STEP - LIM, y = j * STEP - LIM; if (Math.hypot(x, y) > R - 1) blocked[j * N + i] = 1; }
  for (const [ox, oy] of [...obst, a, b]) for (let dy = -1.5; dy <= 1.5; dy += STEP) for (let dx = -1.5; dx <= 1.5; dx += STEP) { const x = ox + dx, y = oy + dy; if (Math.abs(x) > LIM || Math.abs(y) > LIM) continue; const k = idx(x, y); if (Math.max(Math.abs(dx), Math.abs(dy)) < 1.1) blocked[k] = 1; else lane[k] = 1; }
  // the endpoints' own footprints are open, so a belt can leave its building
  for (const [ox, oy] of [a, b]) for (let dy = -1; dy <= 1; dy += STEP) for (let dx = -1; dx <= 1; dx += STEP) { const x = ox + dx, y = oy + dy; if (Math.abs(x) <= LIM && Math.abs(y) <= LIM) blocked[idx(x, y)] = 0; }
  const s = idx(a[0], a[1]), t = idx(b[0], b[1]); blocked[s] = 0; blocked[t] = 0;
  // A* with state = node*4 + dir
  const G = new Float32Array(N * N * 4).fill(1e9), from = new Int32Array(N * N * 4).fill(-1), D: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const tx = t % N, ty = Math.floor(t / N), h = (k: number) => Math.abs(k % N - tx) + Math.abs(Math.floor(k / N) - ty);
  const open: number[] = [], f = new Float32Array(N * N * 4).fill(1e9);
  const push = (st: number) => { open.push(st); let i = open.length - 1; while (i) { const p = (i - 1) >> 1; if (f[open[p]] <= f[open[i]]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => { const top = open[0], last = open.pop()!; if (open.length) { open[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < open.length && f[open[l]] < f[open[m]]) m = l; if (r < open.length && f[open[r]] < f[open[m]]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
  for (let d = 0; d < 4; d++) { G[s * 4 + d] = 0; f[s * 4 + d] = h(s); push(s * 4 + d); }
  let end = -1, guard = 0;
  while (open.length && guard++ < 60000) {
    const st = pop(), k = st >> 2, d0 = st & 3; if (k === t) { end = st; break; }
    const x = k % N, y = Math.floor(k / N);
    for (let d = 0; d < 4; d++) { const nx = x + D[d][0], ny = y + D[d][1]; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const nk = ny * N + nx; if (blocked[nk]) continue;
      const c = G[st] + (lane[nk] ? 1 : 1.6) + (d !== d0 ? 2.5 : 0), ns = nk * 4 + d; if (c < G[ns]) { G[ns] = c; from[ns] = st; f[ns] = c + h(nk); push(ns); } }
  }
  if (end < 0) return [a, [b[0], a[1]], b]; // no route: fall back to the old L
  const pts: Pt[] = []; for (let st = end; st >= 0; st = from[st]) { const k = st >> 2; pts.push([(k % N) * STEP - LIM, Math.floor(k / N) * STEP - LIM]); }
  pts.reverse();
  // keep only corners
  const out: Pt[] = [pts[0]]; for (let i = 1; i < pts.length - 1; i++) { const p = out[out.length - 1], q = pts[i], r = pts[i + 1]; if ((q[0] - p[0]) * (r[1] - q[1]) !== (q[1] - p[1]) * (r[0] - q[0])) out.push(q); } out.push(pts[pts.length - 1]);
  return out;
}
export const polyLen = (P: Pt[]) => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };
export function along(P: Pt[], d: number): Pt { for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (d <= l || i === P.length - 1) { const f = l ? Math.min(1, d / l) : 0; return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f]; } d -= l; } return P[P.length - 1]; }
