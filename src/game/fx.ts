import { S } from './state';
let AC: AudioContext | null = null;
const ac = () => (AC ??= new (window.AudioContext || (window as any).webkitAudioContext)());
let master: GainNode | null = null;
function out() { const c = ac(); if (!master) { master = c.createGain(); master.gain.value = 0.9; const comp = c.createDynamicsCompressor(); master.connect(comp).connect(c.destination); } return master; }
export function tone(f: number, d = 0.08, type: OscillatorType = 'sine', vol = 0.12, slide = 0, delay = 0) {
  if (S.mute) return; const c = ac(); if (c.state === 'suspended') c.resume();
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(out()); o.start(t); o.stop(t + d + 0.02);
}
function noise(d = 0.3, vol = 0.08, freq = 800) { if (S.mute) return; const c = ac(); const b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), a = b.getChannelData(0); for (let k = 0; k < a.length; k++) a[k] = (Math.random() * 2 - 1) * (1 - k / a.length); const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = c.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(out()); s.start(); }
let lastCoin = 0, combo = 0, comboT = 0, lastFan = 0;
export const sfx = {
  tap: () => tone(440, 0.05, 'triangle', 0.07, 1.8),
  drill: () => { tone(110, 0.1, 'triangle', 0.08, 0.55); noise(0.06, 0.035, 2200); },
  coin: () => { const n = performance.now(); if (n - lastCoin < 60) return; combo = n - comboT < 600 ? Math.min(combo + 1, 12) : 0; comboT = n; lastCoin = n; const f = 990 * Math.pow(2, combo / 24); tone(f, 0.07, 'triangle', 0.04); tone(f * 1.5, 0.16, 'sine', 0.045, 1, 0.03); },
  buy: () => { tone(620, 0.06, 'triangle', 0.08); tone(930, 0.1, 'triangle', 0.07, 1, 0.05); },
  no: () => tone(160, 0.12, 'sawtooth', 0.05, 0.7),
  fanfare: () => { const n = performance.now(); if (n - lastFan < 350) return; lastFan = n; [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.25, 'triangle', 0.07, 1, k * 0.08)); },
  claim: () => { for (let k = 0; k < 6; k++) tone(1200 + k * 160, 0.09, 'square', 0.025, 1, k * 0.045); tone(784, 0.35, 'triangle', 0.08, 1, 0.28); },
  launch: () => { noise(0.9, 0.06, 600); tone(120, 0.8, 'sawtooth', 0.03, 3); },
  warp: () => { tone(80, 1.6, 'sawtooth', 0.08, 12); noise(1.5, 0.08, 1200); [523, 784, 1047, 1568].forEach((f, k) => tone(f, 0.6, 'sine', 0.09, 1, 0.6 + k * 0.1)); },
  clank: () => { tone(300, 0.05, 'square', 0.04, 0.5); },
  blip: () => tone(880 + Math.random() * 220, 0.025, 'square', 0.012),
  select: () => { tone(260, 0.07, 'triangle', 0.09, 0.6); tone(520, 0.05, 'sine', 0.04, 1.2, 0.02); },
  build: () => { for (let k = 0; k < 3; k++) { tone(180 + k * 20, 0.06, 'square', 0.035, 0.4, k * 0.22); noise(0.04, 0.03, 3000); } [784, 988, 1319].forEach((f, k) => tone(f, 0.18, 'triangle', 0.07, 1, 0.9 + k * 0.06)); },
  land: () => { tone(500, 0.9, 'sine', 0.03, 0.3); noise(0.5, 0.04, 500); tone(90, 0.15, 'triangle', 0.1, 0.6, 1.5); },
};
export const buzz = (p: number | number[]) => { try { if ((navigator as any).userActivation?.hasBeenActive === false) return; navigator.vibrate?.(p); } catch {} };

// ---------- canvas particles ----------
type P = { x: number; y: number; vx: number; vy: number; l: number; ml: number; k: number; c: string; s: number; tx?: number; ty?: number; done?: () => void };
const parts: P[] = [];
let fctx: CanvasRenderingContext2D, sctx: CanvasRenderingContext2D, W = 0, H = 0, fx: HTMLCanvasElement, st: HTMLCanvasElement;
const STARS = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + 0.2, s: Math.random() * 2 + 0.5, o: Math.random() * 6 }));
const ROIDS = Array.from({ length: 5 }, (_, k) => ({ x: Math.random(), y: Math.random(), r: 6 + Math.random() * 14, sp: 0.004 + k * 0.002, rot: Math.random() * 6 }));
export function initFx(f: HTMLCanvasElement, s: HTMLCanvasElement) { fx = f; st = s; fctx = f.getContext('2d')!; sctx = s.getContext('2d')!; resize(); addEventListener('resize', resize); }
function resize() { const D = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; for (const c of [fx, st]) { c.width = W * D; c.height = H * D; c.style.width = W + 'px'; c.style.height = H + 'px'; } fctx.setTransform(D, 0, 0, D, 0, 0); sctx.setTransform(D, 0, 0, D, 0, 0); }
const COLS = ['#ffc94a', '#ff7a59', '#5cf2ff', '#b08cff', '#fff'];
export function burst(x: number, y: number, n = 12, kind: 0 | 1 = 0, col?: string) { for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, l: 0, ml: 35 + Math.random() * 30, k: kind, c: col || COLS[k % 5], s: kind ? 6 : 2 + Math.random() * 3.5 }); } }
export function fly(x: number, y: number, tx: number, ty: number, n: number, kind: 1 | 2, col = '#ffc94a', done?: () => void) { for (let k = 0; k < n; k++) parts.push({ x: x + (Math.random() - .5) * 30, y: y + (Math.random() - .5) * 20, vx: (Math.random() - .5) * 7, vy: -2 - Math.random() * 4, l: -k * 2, ml: 50 + Math.random() * 10, k: kind, c: col, s: kind === 1 ? 6.5 : 4, tx, ty, done: k === n - 1 ? done : undefined }); }
function coin(x: number, y: number, s: number, l: number, a: number) { fctx.save(); fctx.globalAlpha = a; fctx.translate(x, y); fctx.scale(Math.abs(Math.cos(l * 0.2)) * 0.6 + 0.4, 1); fctx.fillStyle = '#b86a10'; fctx.beginPath(); fctx.arc(0, 1.5, s, 0, 7); fctx.fill(); fctx.fillStyle = '#ffc94a'; fctx.beginPath(); fctx.arc(0, 0, s, 0, 7); fctx.fill(); fctx.fillStyle = '#fff8'; fctx.beginPath(); fctx.arc(-s * .3, -s * .3, s * .35, 0, 7); fctx.fill(); fctx.restore(); }
function gem(x: number, y: number, s: number, c: string, a: number) { fctx.globalAlpha = a; fctx.shadowColor = c; fctx.shadowBlur = 12; fctx.fillStyle = c; fctx.beginPath(); fctx.moveTo(x, y - s); fctx.lineTo(x + s * .8, y); fctx.lineTo(x, y + s); fctx.lineTo(x - s * .8, y); fctx.fill(); fctx.shadowBlur = 0; fctx.globalAlpha = 1; }
export function stepFx(dt: number, t: number) {
  sctx.clearRect(0, 0, W, H);
  for (const s of STARS) { sctx.globalAlpha = 0.3 + 0.4 * Math.sin(t / 1000 * s.s + s.o); sctx.fillStyle = '#cfe3ff'; sctx.beginPath(); sctx.arc(s.x * W, (s.y * H + t * 0.006 * s.r) % H, s.r, 0, 7); sctx.fill(); }
  sctx.globalAlpha = 0.18; for (const r of ROIDS) { const y = (r.y * H + t * r.sp * 4) % (H + 60) - 30; sctx.save(); sctx.translate(r.x * W, y); sctx.rotate(r.rot + t / 4000); sctx.fillStyle = '#8a7fb8'; sctx.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = r.r * (0.75 + ((k * 37) % 10) / 30); sctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } sctx.fill(); sctx.restore(); }
  sctx.globalAlpha = 1;
  fctx.clearRect(0, 0, W, H); const f = dt * 60;
  for (let k = parts.length - 1; k >= 0; k--) {
    const p = parts[k]; p.l += f; if (p.l < 0) continue;
    if (p.tx !== undefined) { const q = Math.min(1, p.l / p.ml), e = q * q * q, bx = p.x + p.vx * 5, by = p.y + p.vy * 9; const X = (1 - e) * ((1 - q) * p.x + q * bx) + e * p.tx, Y = (1 - e) * ((1 - q) * p.y + q * by) + e * p.ty!; p.k === 1 ? coin(X, Y, p.s, p.l, 1) : gem(X, Y, p.s, p.c, 1); if (q >= 1) { parts.splice(k, 1); p.done?.(); } continue; }
    p.vy += 0.25 * f; p.x += p.vx * f; p.y += p.vy * f; p.vx *= 0.98; const a = 1 - p.l / p.ml;
    if (a <= 0) { parts.splice(k, 1); continue; }
    if (p.k) coin(p.x, p.y, p.s, p.l, a); else { fctx.globalAlpha = a; fctx.fillStyle = p.c; fctx.fillRect(p.x, p.y, p.s, p.s); fctx.globalAlpha = 1; }
  }
  if (parts.length > 400) parts.splice(0, parts.length - 400);
}
let popN = 0;
export function popup(x: number, y: number, txt: string, color?: string) { if (popN > 14) return; popN++; setTimeout(() => popN--, 900); const d = document.createElement('div'); d.className = 'pop'; d.textContent = txt; d.style.left = x + 'px'; d.style.top = y + 'px'; if (color) d.style.color = color; document.body.appendChild(d); setTimeout(() => d.remove(), 900); }
const tq: string[] = []; let tbusy = false;
function nextToast() { const t = tq.shift(); if (!t) { tbusy = false; return; } tbusy = true; const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2400); setTimeout(nextToast, tq.length ? 1100 : 2000); }
export function toast(t: string) { if (tq.includes(t)) return; if (tq.length > 3) tq.shift(); tq.push(t); if (!tbusy) nextToast(); }
let lastRocket = 0;
export function rocket(x: number, y: number, force = false) { const n = performance.now(); if (!force && n - lastRocket < 700) return; lastRocket = n; const d = document.createElement('div'); d.className = 'rocket'; d.textContent = '🚀'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 1400); for (let k = 0; k < 8; k++) setTimeout(() => burst(x, y + 10 - k * 18, 3, 0, k % 2 ? '#ff9f43' : '#ffd84a'), k * 40); }
export function flash() { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:70;background:radial-gradient(circle,#fff,#7ee8ff 40%,#4a2f9a);pointer-events:none;transition:opacity 1.2s'; document.body.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => d.style.opacity = '0')); setTimeout(() => d.remove(), 1300); }
