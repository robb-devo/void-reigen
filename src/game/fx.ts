import { vibrate } from '../native';
import { S } from './state';
// ---------- Sound: one consistent, poppy synth kit ----------
// Mix buses: ui (taps/selects), reward (coins/claims), world (machines, ships), each into a soft
// limiter; a short stereo-ish delay send adds sparkle to chimes. All levels set in MIX.
let AC: AudioContext | null = null;
const ac = () => (AC ??= new (window.AudioContext || (window as any).webkitAudioContext)());
// Bus base levels (the internal mix); the player's sliders scale them (S.vol, 0..1).
const MIX = { master: .85, ui: .55, reward: .7, world: .5, amb: .4, fx: .25 };
type Bus = 'ui' | 'reward' | 'world' | 'amb';
export type Vol = { master: number; ui: number; fx: number; amb: number };
export const VOL_DEF: Vol = { master: .8, ui: .8, fx: .8, amb: .35 };
export const vol = (): Vol => ({ ...VOL_DEF, ...(S.vol || {}) });
let buses: Record<Bus, GainNode> | null = null, send: GainNode | null = null, masterG: GainNode | null = null;
const busVol = (b: Bus) => { const o = vol(); return b === 'ui' ? o.ui : b === 'amb' ? o.amb : o.fx; };
/** push slider values into the live graph (smoothly) */
export function applyVol() {
  if (!buses || !AC) return; const t = AC.currentTime, o = vol();
  masterG!.gain.setTargetAtTime(S.mute ? 0 : MIX.master * o.master * o.master, t, .03); // squared: perceptual taper
  for (const k of Object.keys(buses) as Bus[]) { const x = busVol(k); buses[k].gain.setTargetAtTime(MIX[k] * x * x, t, .03); }
  send!.gain.setTargetAtTime(MIX.fx * Math.max(o.ui, o.fx) ** 2, t, .03);
}
function bus(b: Bus) {
  const c = ac();
  if (!buses) {
    const m = masterG = c.createGain(); const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .12; m.connect(comp).connect(c.destination);
    const d = c.createDelay(.5); d.delayTime.value = .11; const fb = c.createGain(); fb.gain.value = .28; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500; send = c.createGain(); { const o = vol(); send.gain.value = MIX.fx * Math.max(o.ui, o.fx) ** 2; } send.connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(m);
    buses = { ui: c.createGain(), reward: c.createGain(), world: c.createGain(), amb: c.createGain() };
    // ambient bus is low-passed a touch so background machinery sits behind the UI
    const alp = c.createBiquadFilter(); alp.type = 'lowpass'; alp.frequency.value = 5200; buses.amb.connect(alp).connect(m);
    for (const k of ['ui', 'reward', 'world'] as Bus[]) buses[k].connect(m);
    const o = vol(); m.gain.value = S.mute ? 0 : MIX.master * o.master * o.master; for (const k of Object.keys(buses) as Bus[]) { const x = busVol(k); buses[k].gain.value = MIX[k] * x * x; }
  }
  return buses[b];
}
// routing overrides used while an ambient (automated) sound plays: forced bus, gain and stereo pan
let busO: Bus | null = null, gainO = 1, panO = 0;
function out(c: AudioContext, g: AudioNode, b: Bus) {
  const dst = bus(busO || b);
  if (panO && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = panO; g.connect(p).connect(dst); } else g.connect(dst);
}
type V = { f: number; d?: number; type?: OscillatorType; vol?: number; to?: number; at?: number; bus?: Bus; wet?: boolean; att?: number };
export function tone(f: number, d = 0.08, type: OscillatorType = 'sine', vol = 0.12, slide = 0, delay = 0) { v({ f, d, type, vol, to: slide ? f * slide : 0, at: delay }); }
const live = () => { if (S.mute) return null; const c = ac(); if (c.state === 'suspended') c.resume(); return c; };
function v(o: V) {
  const c = live(); if (!c) return;
  const t = c.currentTime + (o.at || 0), d = o.d ?? .08, os = c.createOscillator(), g = c.createGain();
  os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f, t); if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + d * .9);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime((o.vol ?? .2) * trim * gainO, t + (o.att ?? .004)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  os.connect(g); out(c, g, o.bus || 'ui'); if (o.wet && send && !busO) g.connect(send); os.start(t); os.stop(t + d + .03);
}
function noise(d = 0.3, vol = 0.08, freq = 800, at = 0, b: Bus = 'world', q = 1) {
  const c = live(); if (!c) return; const t = c.currentTime + at; const buf = c.createBuffer(1, Math.ceil(c.sampleRate * d), c.sampleRate), a = buf.getChannelData(0); for (let k = 0; k < a.length; k++) a[k] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(vol * trim * gainO, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  src.connect(f).connect(g); out(c, g, b); src.start(t); src.stop(t + d + .02);
}
// building blocks
const pop = (f = 520, at = 0, vol = .32, b: Bus = 'ui') => { v({ f: f * 1.9, to: f * .7, d: .09, type: 'sine', vol, at, bus: b }); v({ f: f * 4, to: f * 2, d: .03, type: 'triangle', vol: vol * .45, at, bus: b }); };
const click = (at = 0, vol = .12) => { noise(.016, vol * 6, 6500, at, 'ui', .9); v({ f: 3200, to: 2200, d: .012, type: 'triangle', vol: vol * .9, at, att: .001 }); };
const chime = (f: number, at = 0, vol = .14) => { noise(.02, vol * .5, 9000, at, 'reward', 2); v({ f, d: .32, type: 'sine', vol, at, bus: 'reward', wet: true }); v({ f: f * 2.76, d: .12, type: 'sine', vol: vol * .35, at, bus: 'reward', wet: true }); v({ f: f * 5.4, d: .05, type: 'sine', vol: vol * .15, at, bus: 'reward' }); };
const kick = (at = 0, vol = .5) => v({ f: 160, to: 45, d: .16, type: 'sine', vol, at, bus: 'world', att: .002 });
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const st2 = (base: number, k: number) => base * Math.pow(2, PENTA[Math.min(PENTA.length - 1, k)] / 12);
let trim = 1;
/** pentatonic step for the tap sound: rises with the tap combo */
let tapStep = 0; export const setTapStep = (k: number) => { tapStep = Math.max(0, Math.min(10, k)); };
// loudness trims from the offline analysis (audio_an.py): keeps every SFX in its category's LU window
export const TRIM: Record<string, number> = {blip: 15.817, build: 1.549, buy: 2.917, claim: 1.641, clank: 3.413, coin: 3.548, drill: 6.457, fanfare: 2.318, land: 1.288, land2: 3.236, launch: 5.433, lode: 1.659, no: 7.079, pBarrel: 3.981, pCrystal: 1.531, pFlag: 3.715, pLamp: 4.169, pMetal: 6.761, pRadar: 7.585, rank: 1.84, rushUp: 3.388, select: 2.884, tap: 4.467, warp: 1.758};
let lastCoin = 0, combo = 0, comboT = 0, lastFan = 0, lastBlip = 0;
const raw = {
  // bright 'tick' transient (4-11 kHz) on top of a higher-pitched body: reads crisp on phone speakers
  tap: () => { click(0, .13); pop(st2(760, tapStep), 0, .15); v({ f: 5300, to: 4100, d: .03, type: 'sine', vol: .1, att: .0008 }); noise(.016, 1, 9000, 0, 'ui', 1.2); },
  select: () => { click(0, .12); pop(560, 0, .2); pop(1120, .042, .12); v({ f: 6272, d: .05, type: 'sine', vol: .04, at: .042, att: .001 }); noise(.014, .45, 9500, .042, 'ui', 1.4); },
  drill: () => { pop(300, 0, .28, 'world'); noise(.07, .07, 1800, 0, 'world', 1.2); v({ f: 90, to: 60, d: .12, type: 'square', vol: .03, bus: 'world' }); },
  coin: () => { const n = performance.now(); if (n - lastCoin < 70) return; combo = n - comboT < 700 ? Math.min(combo + 1, 10) : 0; comboT = n; lastCoin = n; chime(st2(1046, combo), 0, .1); },
  buy: () => { pop(500, 0, .3); chime(1318, .04, .08); },
  no: () => { v({ f: 330, to: 220, d: .12, type: 'square', vol: .05 }); v({ f: 280, to: 190, d: .14, type: 'square', vol: .05, at: .09 }); },
  fanfare: () => { const n = performance.now(); if (n - lastFan < 350) return; lastFan = n; kick(0, .35); [523, 659, 784, 1047].forEach((f, k) => { v({ f, d: .28, type: 'triangle', vol: .12, at: k * .075, bus: 'reward', wet: true }); }); chime(2093, .32, .1); },
  claim: () => { kick(0, .4); for (let k = 0; k < 6; k++) chime(st2(784, k + 2), k * .045, .08); pop(392, .3, .25, 'reward'); chime(1568, .34, .14); },
  launch: () => { noise(.9, .12, 500, 0, 'world', .7); v({ f: 70, to: 260, d: .8, type: 'sawtooth', vol: .04, bus: 'world' }); kick(0, .4); },
  warp: () => { v({ f: 60, to: 900, d: 1.6, type: 'sawtooth', vol: .07, bus: 'world' }); noise(1.5, .1, 1200, 0, 'world', .6); [523, 784, 1047, 1568].forEach((f, k) => chime(f, .6 + k * .1, .14)); kick(.6, .6); },
  clank: () => { click(0, .14); v({ f: 900, to: 600, d: .03, type: 'square', vol: .03 }); },
  blip: () => { const n = performance.now(); if (n - lastBlip < 45) return; lastBlip = n; v({ f: 700 + Math.random() * 300, d: .03, type: 'triangle', vol: .05 }); },
  build: () => { for (let k = 0; k < 3; k++) { click(k * .2, .16); v({ f: 240 - k * 20, to: 140, d: .06, type: 'square', vol: .04, at: k * .2, bus: 'world' }); } kick(.85, .5); [784, 988, 1319, 1568].forEach((f, k) => chime(f, .88 + k * .055, .1)); },
  land: () => { noise(.6, .07, 400, 0, 'world', .8); v({ f: 420, to: 140, d: .8, type: 'sine', vol: .05, bus: 'world' }); kick(1.4, .3); pop(380, 1.42, .3, 'world'); click(1.42, .2); },
  // tap-a-prop toys: tiny, playful, each with its own timbre (ui bus, quieter than a building tap)
  pLamp: () => { click(0, .1); v({ f: 2093, d: .18, type: 'sine', vol: .07, wet: true }); v({ f: 3136, d: .1, type: 'sine', vol: .035, at: .01 }); },
  pCrystal: () => { click(0, .08); chime(1568, 0, .07); chime(2349, .06, .05); },
  pFlag: () => { noise(.05, .5, 1400, 0, 'ui', 1.6); noise(.05, .4, 1900, .07, 'ui', 1.6); pop(880, 0, .07); },
  pBarrel: () => { pop(240, 0, .26); v({ f: 120, to: 70, d: .1, type: 'sine', vol: .14 }); click(0, .08); },
  pMetal: () => { click(0, .12); v({ f: 1180, to: 1120, d: .16, type: 'square', vol: .018 }); v({ f: 1770, d: .12, type: 'sine', vol: .04 }); },
  pRadar: () => { v({ f: 1760, d: .05, type: 'square', vol: .02 }); v({ f: 2349, d: .07, type: 'square', vol: .018, at: .08 }); click(0, .08); },
  rushUp: () => { [0, 2, 4].forEach((k, j) => v({ f: st2(1046, k + tapStep), d: .09, type: 'triangle', vol: .09, at: j * .045, bus: 'reward', wet: true })); click(0, .12); },
  land2: () => { kick(0, .45); noise(.25, .09, 700, 0, 'world', .8); pop(260, .02, .2, 'world'); },
  lode: () => { kick(0, .5); for (let k = 0; k < 8; k++) chime(st2(1046, k + 1), k * .035, .09); },
  rank: () => { kick(0, .5); [392, 523, 659, 784, 1047].forEach((f, k) => v({ f, d: .35, type: 'triangle', vol: .12, at: k * .07, bus: 'reward', wet: true })); chime(2093, .4, .14); chime(2637, .48, .1); },
};
export const sfx = Object.fromEntries(Object.entries(raw).map(([k, fn]) => [k, () => { trim = TRIM[k] ?? 1; try { fn(); } finally { trim = 1; } }])) as typeof raw;
/** Automated/background sounds (idle mines, drones, auto rockets): own 'amb' bus, globally rate-limited,
 *  and spatialised by the caller: g = 0..1 loudness from on-screen position + zoom, pan = -1..1. */
let ambT = 0, ambN = 0;
export function ambient(k: keyof typeof raw, g = 1, pan = 0) {
  if (S.mute || document.hidden || g < .04) return; const n = performance.now();
  if (n - ambT > 1000) { ambT = n; ambN = 0; } if (ambN >= 4) return; ambN++; // at most 4 per second
  busO = 'amb'; gainO = Math.min(1, g); panO = Math.max(-1, Math.min(1, pan));
  try { sfx[k](); } finally { busO = null; gainO = 1; panO = 0; }
}
/** loudness/pan for a sound at screen point (x, y): quieter towards / beyond the edges and when zoomed out (z<1) */
export function spatial(x: number, y: number, z = 1): [number, number] {
  const W = innerWidth, H = innerHeight, dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2), d = Math.hypot(dx, dy * .8);
  const edge = d <= 1 ? 1 - .35 * d : Math.max(0, .65 - .5 * (d - 1)); // off-screen falls off quickly
  return [edge * Math.max(.3, Math.min(1, z)), Math.max(-.7, Math.min(.7, dx * .7))];
}
/** preview helper for the settings sliders */
export function previewBus(b: 'master' | 'ui' | 'fx' | 'amb') { if (b === 'ui') sfx.tap(); else if (b === 'fx') sfx.coin(); else if (b === 'amb') { busO = 'amb'; try { sfx.coin(); } finally { busO = null; } } else sfx.select(); }

export const buzz = (p: number | number[]) => { if (S.nohap) return; try { if ((navigator as any).userActivation?.hasBeenActive === false) return; vibrate(p); } catch {} }; // native haptics in the app, navigator.vibrate on the web

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
let toastGate = () => false; export const setToastGate = (f: () => boolean) => { toastGate = f; };
function nextToast() { if (tq.length && toastGate()) { tbusy = true; setTimeout(nextToast, 400); return; } const t = tq.shift(); if (!t) { tbusy = false; return; } tbusy = true; document.querySelectorAll('.toast').forEach(e => e.remove()); const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2400); setTimeout(nextToast, tq.length ? 1100 : 2000); }
export function toast(t: string) { if (tq.includes(t)) return; if (tq.length > 3) tq.shift(); tq.push(t); if (!tbusy) nextToast(); }
let lastRocket = 0;
export function rocket(x: number, y: number, force = false) { const n = performance.now(); if (!force && n - lastRocket < 700) return; lastRocket = n; const d = document.createElement('div'); d.className = 'rocket'; d.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 2c4 3 5 8 3 13H9C7 10 8 5 12 2z" fill="#eef2ff" stroke="#24163a" stroke-width="2"/><circle cx="12" cy="9" r="2" fill="#5cf2ff" stroke="#24163a" stroke-width="1.5"/><path d="M9 13l-3 4h3M15 13l3 4h-3" fill="#ff5b5b" stroke="#24163a" stroke-width="1.5"/><path d="M10 16l2 5 2-5" fill="#ffb23f"/></svg>'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 1400); for (let k = 0; k < 8; k++) setTimeout(() => burst(x, y + 10 - k * 18, 3, 0, k % 2 ? '#ff9f43' : '#ffd84a'), k * 40); }
export function flash() { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:70;background:radial-gradient(circle,#fff,#7ee8ff 40%,#4a2f9a);pointer-events:none;transition:opacity 1.2s'; document.body.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => d.style.opacity = '0')); setTimeout(() => d.remove(), 1300); }
/** Dev/QA: render one SFX offline (for loudness/spectrum analysis). */
export async function renderSfx(name: keyof typeof sfx, secs = 2, rate = 44100) {
  const keepAC = AC, keepB = buses, keepS = send, keepM = S.mute;
  AC = new OfflineAudioContext(1, Math.ceil(secs * rate), rate) as unknown as AudioContext; buses = null; send = null; S.mute = false;
  try { (sfx[name] as () => void)(); return (await (AC as unknown as OfflineAudioContext).startRendering()).getChannelData(0); }
  finally { AC = keepAC; buses = keepB; send = keepS; S.mute = keepM; }
}
