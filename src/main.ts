import './fonts';
import './style.css';
import './design.css';
import { MINES, MACHINES, TECH, SHIPS, PLANETS, RUNS, RES, RES_ORDER, GEN, FLEET_UPG, MILESTONES, PERKS, SECTORS, Res } from './game/data';
const mk = (id: string) => (id === 'hull' ? 'hullworks' : id);
import * as G from './game/state';
import { GOALS, goalReward, ACHS } from './game/progress';
import { art, ri } from './game/art';
import { BaseView, SLOTS, Slot, level, tier, nextTierAt, visible, cost as slotCost, slotByKey } from './base/view';
import { setBusy } from './base/render';
import { I } from './design';
import { renderSfx, setToastGate } from './game/fx';
import { SKILLS, BRANCHES, LEVEL_GATE, XP } from './game/skills';
import { TIER_NAMES } from './base/render';
import { say, talking, setGate } from './commander';
import { sfx, buzz, initFx, stepFx, burst, fly, popup, toast, rocket, flash } from './game/fx';

const rawSave = localStorage.getItem(G.KEY); G.load(); G.migrateSeen(rawSave);
const st = () => G.S;

// ---------- formatting ----------
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
function fmt(v: number, dec = 2): string {
  if (!isFinite(v)) return '∞'; if (v < 0) return '-' + fmt(-v, dec);
  if (v < 1000) return v < 100 && v % 1 ? (v < 10 ? v.toFixed(1) : v.toFixed(0)).replace(/\.0$/, '') : Math.floor(v).toString();
  const e = Math.floor(Math.log10(v) / 3); const s = e < SUF.length ? SUF[e] : (() => { const k = e - SUF.length; return String.fromCharCode(97 + Math.floor(k / 26)) + String.fromCharCode(97 + k % 26); })();
  const n = v / Math.pow(1000, e); return (n >= 100 ? n.toFixed(1) : n.toFixed(dec)) + s;
}
const fmtT = (s: number) => s < 1 ? s.toFixed(1) + 's' : s < 60 ? Math.ceil(s) + 's' : s < 3600 ? `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s` : `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m`;
const costStr = (c: Partial<Record<Res, number>>) => (Object.keys(c) as Res[]).map(r => `<span class="cs ${st().res[r] >= c[r]! ? '' : 'short'}">${ri(r)}${fmt(c[r]!)}</span>`).join('');

// ---------- shell ----------
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const app = $('#app');
const TABS: [string, string, string][] = [['base', '🛰️', 'Base'], ['mine', '⛏️', 'Mines'], ['fac', '🏭', 'Factory'], ['crew', '👨‍🚀', 'Crew'], ['fleet', '🚀', 'Fleet'], ['warp', '🌀', 'Warp']];
app.innerHTML = `<button id="back" class="btn">‹ Base</button><canvas id="stars"></canvas>
<button id="rockbtn" class="rockbtn"></button><header><div class="toprow"><div class="tl"><button class="cmdbadge" id="cmdbadge"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="#2c2050" stroke-width="5"/><circle id="cmdring" cx="18" cy="18" r="15" fill="none" stroke="#ffd23f" stroke-width="5" stroke-linecap="round" stroke-dasharray="94.2" stroke-dashoffset="94.2" transform="rotate(-90 18 18)"/></svg><b id="cmdlv">1</b><i class="dot" id="cdot"></i></button><button class="iconbtn" id="trophy"><svg viewBox="0 0 24 24"><path d="M7 3h10v4a5 5 0 0 1-10 0z" fill="#ffd23f" stroke="#24163a" stroke-width="2"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4" fill="none" stroke="#24163a" stroke-width="2"/><path d="M10 12h4v4h-4zM8 17h8v3H8z" fill="#ff9f43" stroke="#24163a" stroke-width="2"/></svg><i class="dot" id="tdot"></i></button></div><div class="title h">VOID REIGEN<span id="dmPill">${art('hole')}<b id="dm">0</b></span></div><div class="tl r"><div id="dn" class="dn"></div><button class="iconbtn" id="mute"></button></div></div>
<div id="cash" class="h">$0</div><div id="rate"></div>
<div class="res" id="res">${RES_ORDER.map(r => `<div class="rc" data-r="${r}" style="--c:${RES[r].color}">${ri(r)}<span>0</span></div>`).join('')}</div></header>
<div id="goal"></div>
<main id="main"></main>
<nav>${TABS.filter(([t]) => t !== 'mine' && t !== 'crew' && t !== 'warp').map(([t, e, n]) => `<button data-t="${t}"><em>${e}</em>${n}<i class="dot"></i></button>`).join('')}</nav>
<canvas id="fx"></canvas>`;
const main = $('#main'), cashEl = $('#cash'), rateEl = $('#rate'), goalEl = $('#goal');
initFx($<HTMLCanvasElement>('#fx'), $<HTMLCanvasElement>('#stars'));
const resEl = (r: Res) => $(`.rc[data-r="${r}"]`);
const navBtn = (t: string) => $(`nav button[data-t="${t}"]`);
let tab = 'base';
const cache = new WeakMap<HTMLElement, string>();
function setT(el: HTMLElement | null, v: string, html = false) { if (!el || cache.get(el) === v) return; cache.set(el, v); html ? (el.innerHTML = v) : (el.textContent = v); }
const center = (el: Element | null): [number, number] => { const r = (el && el.getClientRects().length ? el : document.getElementById('cash')!).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
function bump(el: HTMLElement) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function shakeEl(el: HTMLElement) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function deny(el?: HTMLElement | null) { sfx.no(); buzz([15, 30, 15]); if (el) shakeEl(el); }
function celebrate(msg: string, x = innerWidth / 2, y = 170) { sfx.fanfare(); buzz([25, 40, 60]); shakeEl(app); burst(x, y, 40); toast(msg); }
const multLabel = () => `Buy ×${G.BUY[st().mult] === -1 ? 'MAX' : G.BUY[st().mult]}`;
function multBtn() { return `<button class="mult" data-mult>${multLabel()}</button>`; }
document.addEventListener('click', e => { const t = (e.target as HTMLElement).closest('[data-mult]'); if (t) { st().mult = (st().mult + 1) % 4; sfx.tap(); buzz(8); document.querySelectorAll('[data-mult]').forEach(b => b.textContent = multLabel()); } });

// ---------- goal / tutorial bar ----------
let goalIdx = -1;
function renderGoal() {
  const s = st(); while (s.goal < GOALS.length && GOALS[s.goal].done() && !GOALS[s.goal].reward) s.goal++;
  const g = GOALS[s.goal]; goalIdx = s.goal;
  if (!g) { goalEl.innerHTML = ''; return; }
  const done = g.done();
  goalEl.innerHTML = `<div class="goal ${done ? 'ready' : ''}"><div class="gi">${done ? `<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" rx="2" fill="#b06bff" stroke="#24163a" stroke-width="2"/><rect x="2" y="6" width="20" height="5" rx="1.5" fill="#c48bff" stroke="#24163a" stroke-width="2"/><path d="M12 6v15" stroke="#ffd23f" stroke-width="3"/><path d="M12 6c-2-4-6-3-5 0M12 6c2-4 6-3 5 0" fill="none" stroke="#ffd23f" stroke-width="2"/></svg>` : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ff5b5b" stroke="#24163a" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="#fff" stroke="#24163a" stroke-width="1.5"/><circle cx="12" cy="12" r="2.5" fill="#ff5b5b"/></svg>`}</div><div class="gm"><small>GOAL ${s.goal + 1}/${GOALS.length}</small><b>${g.text}</b>${g.prog && !done ? `<div class="gp"><i style="width:${Math.min(100, g.prog()[0] / g.prog()[1] * 100)}%"></i></div>` : ''}</div>${done ? `<button class="btn gold" id="claim">${g.reward ? 'Claim $' + fmt(goalReward(g)) : 'Next'}</button>` : g.tab !== tab ? `<button class="btn ghost go" data-go="${g.tab}">Go ›</button>` : ''}</div>`;
  $('#claim')?.addEventListener('click', ev => { const r = goalReward(g); G.earn(r); xp(XP.goal(s.goal), ev.clientX, ev.clientY); s.goal++; sfx.claim(); buzz([20, 30, 50]); burst(ev.clientX, ev.clientY, 30); if (r) fly(ev.clientX, ev.clientY, ...center(cashEl), 12, 1, '#ffc94a', () => bump(cashEl)); renderGoal(); spotlight(); });
  $('[data-go]', goalEl)?.addEventListener('click', () => { sfx.tap(); setTab(g.tab); });
  goalEl.querySelector('.gm')?.addEventListener('click', () => { if (tab === 'base' && bv?.guide) { sfx.select(); bv.focus(bv.guide); } });
}
let goalKey = '';
function updateGoal() {
  const g = GOALS[st().goal]; const done = !!g && g.done(); const key = g ? `${st().goal}|${done}|${tab}` : 'x';
  if (g && g.prog && !done) { const pi = goalEl.querySelector<HTMLElement>('.gp i'); if (pi) pi.style.width = Math.min(100, g.prog()[0] / g.prog()[1] * 100) + '%'; }
  if (key !== goalKey || goalIdx !== st().goal) { const wasDone = goalKey.split('|')[1] === 'false' && g?.done(); goalKey = key; renderGoal(); spotlight(); if (wasDone) { sfx.fanfare(); buzz(30); bump(goalEl); } }
}
let guided = -1; let wantGuide: string | null = null;
function spotlight() {
  document.querySelectorAll('.coach').forEach(e => e.classList.remove('coach'));
  const g = GOALS[st().goal]; if (bv) bv.guide = null; wantGuide = null;
  if (!g || g.done() || g.tab !== tab || !g.focus) return;
  if (g.focus.startsWith('@')) { if (bv) { const k = g.focus.slice(1); bv.guide = k; wantGuide = k; if (guided !== st().goal) { guided = st().goal; if (st().warps === 0 && st().goal < 14 && k !== 'm0') bv.focus(k, bv.z, .45, 'm0'); else bv.focus(k); } } return; }
  if (st().goal > 12) return;
  document.querySelector(g.focus)?.classList.add('coach');
}

// ---------- ASTEROID ----------
type Card = { root: HTMLElement; fill: HTMLElement; bt: HTMLElement; buy: HTMLButtonElement; lvl: HTMLElement; ms: HTMLElement; msl: HTMLElement; time: HTMLElement; mgr: HTMLElement; ico: HTMLElement };
let cards: Card[] = [];
const visibleMines = () => { let k = 0; const lim = MINES.filter(G.avail).length; for (let i = 0; i < lim; i++) { k = i + 1; if (st().mines[i].n === 0) break; } return Math.min(lim, k + 1); };
function renderMine() {
  const built = MINES.filter((d, i) => st().mines[i].n > 0 && G.avail(d));
  main.innerHTML = `<div class="roidwrap" id="roid"><div class="orbit">${built.map((d, k) => `<i style="--a:${k / built.length * 360}deg">${art(d.id)}</i>`).join('')}</div><div class="roid"><span></span><span></span><span></span><b></b><b></b></div><div class="roidtxt h">Sector ${G.sector()} · ${SECTORS[Math.min(G.sector() - 1, SECTORS.length - 1)]}<small>tap the asteroid to drill all</small></div></div><div class="buyrow"><div class="hint"></div>${multBtn()}</div>`;
  $('#roid').addEventListener('pointerdown', ev => { let any = false; st().mines.forEach((b, i) => { if (b.n && !b.m && !b.run) { b.run = true; any = true; } void i; }); st().taps++; const r = $('.roid'); r.classList.remove('hit'); void r.offsetWidth; r.classList.add('hit'); burst(ev.clientX, ev.clientY, 12, 0, '#ff9f43'); if (any) { sfx.drill(); buzz(12); } else sfx.tap(); });
  cards = [];
  for (let i = 0; i < visibleMines(); i++) {
    const d = MINES[i], el = document.createElement('div'); el.className = 'biz'; el.style.animationDelay = i * 35 + 'ms'; el.style.setProperty('--h', String(d.hue));
    el.innerHTML = `<div class="ico"><b>${art(d.id)}</b><span class="lvl">0</span><span class="mgr"></span></div><div class="mid"><div class="name"><span>${d.name}</span><small></small></div><div class="bar"><div class="fill"></div><span></span></div><div class="sub"><div class="ms"><i></i></div><div class="time"></div></div></div><button class="buy"></button>`;
    main.appendChild(el);
    const c: Card = { root: el, fill: $('.fill', el), bt: $('.bar span', el), buy: $<HTMLButtonElement>('.buy', el), lvl: $('.lvl', el), ms: $('.ms i', el), msl: $('.name small', el), time: $('.time', el), mgr: $('.mgr', el), ico: $('.ico', el) };
    cards.push(c);
    c.ico.addEventListener('pointerdown', ev => tapMine(i, ev));
    $('.bar', el).addEventListener('pointerdown', ev => tapMine(i, ev));
    c.buy.addEventListener('click', ev => buyMine(i, ev));
  }
}
function tapMine(i: number, ev: PointerEvent) {
  const b = st().mines[i]; if (!b.n) return deny();
  const c = cards[i]; c.ico.classList.remove('tap'); void c.ico.offsetWidth; c.ico.classList.add('tap');
  st().taps++;
  if (!b.run && !b.m) { b.run = true; sfx.drill(); buzz(10); burst(ev.clientX, ev.clientY, 8, 0, `hsl(${MINES[i].hue} 100% 65%)`); }
}
function buyMine(i: number, ev: MouseEvent) {
  const k = G.buyK(i), c = G.costN(i, k);
  if (st().cash < c || (G.BUY[st().mult] === -1 && G.maxBuy(i) < 1)) return deny(cards[i]?.buy);
  const before = G.msIdx(st().mines[i].n), wasZero = st().mines[i].n === 0;
  st().cash -= c; st().mines[i].n += k; sfx.buy(); buzz(12);
  burst(ev.clientX, ev.clientY, 10); popup(ev.clientX, ev.clientY - 10, `+${k}`, '#5cf2ff'); if (cards[i]) bump(cards[i].ico); else bv?.puff('m' + i);
  const n = G.msIdx(st().mines[i].n);
  if (n > before) celebrate(`${MINES[i].name}: ${n <= 6 ? 'Speed' : 'Profit'} ×2!`);
  if (wasZero) { celebrate(`${MINES[i].name} online!`, ev.clientX, ev.clientY); if (tab === 'mine') renderMine(); spotlight(); }
}
function updateMine() {
  cards.forEach((c, i) => {
    const b = st().mines[i], d = MINES[i], k = G.buyK(i), cost = G.costN(i, k), ok = st().cash >= cost && !(G.BUY[st().mult] === -1 && G.maxBuy(i) < 1);
    c.root.classList.toggle('locked', !b.n);
    setT(c.lvl, String(b.n));
    setT(c.buy, b.n ? `<b>×${k}</b>$${fmt(cost)}` : `<b>Build</b>$${fmt(cost)}`, true);
    c.buy.disabled = !ok; c.buy.classList.toggle('afford', ok);
    const ct = G.cycle(i), active = b.m || b.run, fast = ct < 0.3 && active;
    c.fill.classList.toggle('fast', fast);
    if (!fast) c.fill.style.transform = `scaleX(${active ? Math.min(1, b.p) : 0})`;
    setT(c.bt, b.n ? `$${fmt(G.revenue(i))}  ${ri(d.res)}${fmt(G.orePerCycle(i))}` : `${ri(d.res)} ${RES[d.res].name}`, true);
    c.root.classList.toggle('idle', !!b.n && !active);
    setT(c.time, b.n ? (active ? fmtT(ct * (1 - Math.min(1, b.p))) : 'TAP') : '');
    const lo = G.prevMs(b.n), hi = G.nextMs(b.n);
    c.ms.style.width = (hi ? (b.n - lo) / (hi - lo) * 100 : 100) + '%';
    setT(c.msl, hi ? `${b.n}/${hi} ${G.msIdx(b.n) < 6 ? I.bolt : I.coin}` : 'MAX', true);
    setT(c.mgr, b.m ? I.bot : '', true);
  });
}


// ---------- BASE (isometric asteroid) ----------
let ySeg = 0;
let bv: BaseView | null = null; let bwrap: HTMLElement | null = null; let sheetKey: string | null = null; let lastDrone = 0;
function renderBase() {
  if (!bwrap) { bwrap = document.createElement('div'); bwrap.className = 'basewrap'; main.innerHTML = ''; main.appendChild(bwrap); bv = new BaseView(bwrap); bv.z = Math.max(.62, Math.min(.95, 1 - SLOTS.filter(x => visible(x) === 'built').length * .03)); bv.onTap = baseTap; (window as any).bv = bv; (window as any).G = G; bwrap.insertAdjacentHTML('beforeend', `<div class="bhint" id="bhint">Pinch to zoom · drag to pan</div><div class="bsheet" id="sheet"></div>`);
    bv.onConstruct = () => sfx.build();
    bv.onTravel = () => { sfx.land(); };
    const sh = $('#sheet'); let y0 = -1; sh.addEventListener('pointerdown', e => { y0 = e.clientY; }); sh.addEventListener('pointerup', e => { if (y0 < 0) return; const dy = e.clientY - y0; y0 = -1; if (dy < -30) { sh.classList.remove('compact'); sfx.select(); } else if (dy > 40) { if (sh.classList.contains('compact')) closeSheet(); else sh.classList.add('compact'); sfx.select(); } }); }
  main.innerHTML = ''; main.appendChild(bwrap); requestAnimationFrame(() => bv!.resize());
}
function baseEvent(i: number, v: number, ct: number, now: number) {
  if (ct < 0.3 && now - lastDrone < 500) { acc += v; return; }
  if (now - lastDrone < 120) { acc += v; return; } lastDrone = now;
  const col = RES[MINES[i].res].color;
  bv!.drone('m' + i, 'hq', col, () => { const [x, y] = bv!.slotScreen('hq'); popup(x, y - 20, '+$' + fmt(v)); fly(x, y - 10, ...center(cashEl), 3, 1, '#ffc94a', () => bump(cashEl)); fly(x, y, ...center(resEl(MINES[i].res)), 1, 2, col, () => bump(resEl(MINES[i].res))); sfx.coin(); });
}
function baseTap(sl: Slot | null, x: number, y: number) {
  if (talking()) { if (sl?.kind === 'mine' && visible(sl) === 'built') { const b = st().mines[sl.idx]; st().taps++; if (!b.run && !b.m) { b.run = true; sfx.drill(); buzz(10); burst(x, y, 10, 0, `hsl(${MINES[sl.idx].hue} 100% 65%)`); } } return; }
  if (!sl) { closeSheet(); return; }
  $('#bhint')?.remove();
  if (sl.kind === 'mine' && G.sk('mHand') && visible(sl) === 'built') { const b = st().mines[sl.idx]; if (b.run && !b.m) { b.p = Math.min(.999, b.p + .35); burst(x, y, 6, 0, '#ffd23f'); } }
  if (sl.kind === 'mine' && visible(sl) === 'built') { const b = st().mines[sl.idx]; st().taps++; if (!b.run && !b.m) { b.run = true; sfx.drill(); buzz(10); burst(x, y, 10, 0, `hsl(${MINES[sl.idx].hue} 100% 65%)`); } else sfx.tap(); }
  else sfx.select();
  openSheet(sl.key);
}
const slotOf = (k: string) => slotByKey(k)!;
const AUX: Record<string, number> = { hangar: 1, dock: 0, turret: 2, fuel: 2 };
function closeSheet() { sheetKey = null; if (bv) bv.sel = null; $('#sheet')?.classList.remove('open'); }
function slotArt(sl: Slot) { return sl.kind === 'mine' ? art(MINES[sl.idx].id) : sl.kind === 'mach' ? art(mk(MACHINES[sl.idx].id)) : sl.kind === 'gen' ? art('gen') : sl.kind === 'yard' ? art('cruiser') : sl.kind === 'lift' ? art('cruiser') : sl.kind === 'gate' ? art('hole') : sl.kind === 'lab' ? art('quantum') : art('p1'); }
function slotName(sl: Slot) { return sl.kind === 'mine' ? MINES[sl.idx].name : sl.kind === 'mach' ? MACHINES[sl.idx].name : sl.kind === 'gen' ? GEN.name : sl.kind === 'yard' ? 'Shipyard' : sl.kind === 'lift' ? 'Cargo Lift' : sl.kind === 'hangar' ? 'Hangar' : sl.kind === 'dock' ? 'Launch Docks' : sl.kind === 'turret' ? 'Defense Battery' : sl.kind === 'fuel' ? 'Fuel Depot' : sl.kind === 'gate' ? 'Warp Gate' : sl.kind === 'lab' ? 'Research Lab' : 'Command HQ'; }
function openSheet(key: string): void {
  const k0 = slotOf(key); if (k0.kind in AUX) { if (sheetKey !== 'yard' || bv?.sel !== key) ySeg = AUX[k0.kind]; openSheet('yard'); if (bv) bv.sel = key; return; } if (k0.kind === 'lift' && !G.fleetOpen()) key = 'yard';
  const sh = $('#sheet'), sl = slotOf(key); const newKey = sheetKey !== key; sheetKey = key; if (bv) bv.sel = key;
  const v = visible(sl), s = st();
  let actions = '';
  if (sl.kind === 'mine') actions = `<button class="btn gold big" data-act="buy"></button>${s.mines[sl.idx].n && !s.mines[sl.idx].m ? `<button class="btn big" data-act="hire"></button>` : ''}<div class="row2">${multBtn()}<button class="btn ghost" data-act="list">All mines ›</button></div>`;
  else if (sl.kind === 'mach') actions = `<button class="btn gold big" data-act="buy"></button>${s.mach[sl.idx] && G.sharedInputs(sl.idx).length ? `<div class="split"><span>Priority for shared ${G.sharedInputs(sl.idx).map(r => ri(r)).join('')}</span><input type="range" min="1" max="100" value="${s.w[sl.idx]}" data-sw="${sl.idx}"><b>${s.w[sl.idx]}</b></div>` : ''}<div class="row2">${multBtn()}${s.mach[sl.idx] ? `<button class="btn ghost" data-act="tog"></button>` : ''}</div>`;
  else if (sl.kind === 'gen') actions = `<button class="btn gold big" data-act="buy"></button><div class="row2">${multBtn()}<button class="btn ghost" data-act="fac">Factory ›</button></div>`;
  else if (sl.kind === 'yard') actions = v === 'built' ? `<div class="fstock" id="ystock"></div><div class="seg">${['Missions', 'Ships', 'Upgrades'].map((n, k) => `<button data-act="yseg:${k}" class="${ySeg === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="slist" id="ylist"></div>` : `<button class="btn big" disabled>Build a Chip Fab to unlock</button>`;
  else if (sl.kind === 'gate') actions = `<button class="btn gold big" data-act="dowarp"></button><div class="slist">${PERKS.map(p => `<div class="trow ${s.warps >= p.warps ? '' : 'dimr'}"><span class="ti">${art(p.art)}</span><span class="tn"><b>${p.name}</b><small>${p.desc}</small></span><span class="tc">${s.warps >= p.warps ? I.check : 'Warp ' + p.warps}</span></div>`).join('')}</div>`;
  else if (sl.kind === 'lab') actions = `<div class="slist" id="llist"></div>`;
  else if (sl.kind === 'lift') actions = `<div class="fstock" id="lstock"></div><button class="btn gold big" data-act="buy"></button><div class="row2"><button class="btn" data-act="fly">Fly to Fleet Rock ›</button><button class="btn ghost" data-act="ltog"></button></div>`;
  else actions = `<button class="btn gold big" data-act="buy"></button><div class="mkt" id="mkt"></div>${G.autoOK() ? `<button class="btn ghost" data-act="auto">Auto-export: ${s.auto ? 'ON' : 'OFF'}</button>` : ''}<div class="row2"><button class="btn ghost" data-act="list">All mines ›</button><button class="btn ghost" data-act="crew">Crew ›</button></div><div class="row2"><button class="btn ghost" data-act="trophy">Trophies ›</button><button class="btn ghost" data-act="warp">Stats &amp; settings ›</button></div>`;
  const compactable = sl.kind === 'mine' || sl.kind === 'mach' || sl.kind === 'gen';
  sh.innerHTML = `<div class="grab" data-act="expand"></div><button class="x" data-act="close">✕</button><div class="shead"><div class="sart">${(bv?.portrait(k0.kind in AUX ? key : sheetKey!) && `<img src="${bv!.portrait(k0.kind in AUX ? key : sheetKey!)}" alt="">`) || slotArt(sl)}</div><div class="smid"><h3 class="h">${slotName(sl)}</h3><div class="slv"></div><div class="stier"></div></div></div><div class="sstats"></div><div class="sact">${actions}</div>`;
  if (newKey) sh.classList.toggle('compact', compactable); else if (!compactable) sh.classList.remove('compact');
  sh.classList.add('open'); sh.classList.remove('spop'); void sh.offsetWidth; sh.classList.add('spop');
  sh.querySelectorAll<HTMLElement>('[data-act]').forEach(b => b.addEventListener('click', ev => sheetAct(b.dataset.act!, ev as MouseEvent, b)));
  sh.querySelector<HTMLInputElement>('[data-sw]')?.addEventListener('input', e => { const inp = e.target as HTMLInputElement, j = +inp.dataset.sw!; st().w[j] = +inp.value; (inp.nextElementSibling as HTMLElement).textContent = inp.value; if (+inp.value % 10 === 0) { sfx.clank(); buzz(4); } });
  sh.querySelector<HTMLInputElement>('[data-sw]')?.addEventListener('pointerdown', e => e.stopPropagation());
  setTimeout(() => sheetTxt.clear(), 0); updateSheet(true);
  if (newKey && bv) { const top = sh.parentElement!.getBoundingClientRect().bottom - (innerHeight - sh.getBoundingClientRect().bottom + (sh.style.transform ? 0 : 0)) - sh.offsetHeight; const top2 = innerHeight - parseFloat(getComputedStyle(sh).bottom) - sh.offsetHeight; const y = bv.slotScreen(key)[1] + 40; void top; if (y > top2 - 10) bv.focus(key, bv.z, Math.max(.2, (top2 - 90) / innerHeight)); }
}
const sheetTxt = new Map<string, string>();
function sheetAct(a: string, ev: MouseEvent, b: HTMLElement) {
  if (!sheetKey) return; const sl = slotOf(sheetKey), s = st(); if (!sl) return;
  if (a === 'close') { sfx.tap(); return closeSheet(); }
  if (a === 'list' || a === 'fac' || a === 'crew' || a === 'fleet' || a === 'warp') { sfx.tap(); return setTab(a === 'list' ? 'mine' : a); }
  if (a === 'trophy') return $('#trophy').click();
  if (a === 'hire') { const i = sl.idx; if (s.cash < MINES[i].mgr) return deny(b); s.cash -= MINES[i].mgr; s.mines[i].m = true; celebrate(`${MINES[i].mname} hired!`, ev.clientX, ev.clientY); return openSheet(sheetKey!); }
  if (a === 'dowarp') { if (!G.warpOpen() || G.dmGain() < 1) return deny(b); confirmModal(art('hole'), 'Engage warp?', `Reset this sector for +${fmt(G.dmGain(), 0)} Dark Matter and jump to Sector ${G.sector() + 1}.`, 'WARP', () => { closeSheet(); sfx.warp(); buzz([50, 50, 100, 50, 200]); bv!.warp(() => { G.gainXp(XP.warp); G.doWarp(); G.save(); flash(); for (let k = 0; k < 5; k++) setTimeout(() => burst(Math.random() * innerWidth, Math.random() * innerHeight * .6, 40), k * 120); celebrate(`Welcome to Sector ${G.sector()}!`); renderGoal(); }); }); return; }
  if (a.startsWith('tech:')) { const t = TECH.find(x => x.id === a.slice(5))!; if (s.cash < t.cash || s.res[t.res] < t.amt) return deny(b); s.cash -= t.cash; s.res[t.res] -= t.amt; s.tech.push(t.id); sfx.claim(); celebrate(`${t.name}!`, ev.clientX, ev.clientY); bv!.puff('lab', '#7affd1'); bv!.puff('m' + Math.max(0, t.tgt), '#ffe98a'); return openSheet(sheetKey!); }
  if (a.startsWith('yseg:')) { ySeg = +a.slice(5); sfx.select(); return openSheet(sheetKey!); }
  if (a.startsWith('ship:')) { const id = a.slice(5), c = G.shipCost(id); if (!G.canAfford(c)) return deny(b); G.pay(c); s.ships[id] = (s.ships[id] || 0) + 1; sfx.build(); buzz([20, 20, 40]); burst(ev.clientX, ev.clientY, 14); bv!.construct('yard'); return; }
  if (a.startsWith('fu:')) { const id = a.slice(3), u = FLEET_UPG.find(x => x.id === id)!; if (G.fu(id) >= u.max) return; const c = { [u.res]: G.fuCost(id) }; if (!G.canAfford(c)) return deny(b); G.pay(c); s.fupg[id] = G.fu(id) + 1; celebrate(`${u.name} Lv ${s.fupg[id]}`, ev.clientX, ev.clientY); bv!.construct('yard'); return; }
  if (a === 'expand') { const sh = $('#sheet'); sh.classList.toggle('compact'); sfx.select(); return; }
  if (a.startsWith('go:')) { const [, kind, id] = a.split(':'); const ms = G.launch(kind as 'run' | 'planet', id, 1.4); if (!ms) return deny(b); sfx.launch(); buzz([30, 30, 60]); bv!.launch(Object.values(ms.ships).reduce((x, y) => x + y, 0)); return openSheet(sheetKey!); }
  if (a === 'fly') { closeSheet(); sfx.launch(); buzz([20, 30]); bv!.travel(1); return; }
  if (a === 'ltog') { s.liftOn = !s.liftOn; sfx.select(); return; }
  if (a === 'buy' && sl.kind === 'lift') { const c = G.liftCost(); if (s.cash < c) return deny(b); s.cash -= c; s.lift++; sfx.build(); buzz([20, 20, 40]); burst(ev.clientX, ev.clientY, 16); bv!.construct('lift'); celebrate(`Cargo Lift Lv ${s.lift}`, ev.clientX, ev.clientY); return; }
  if (a === 'auto') { s.auto = !s.auto; sfx.select(); return openSheet(sheetKey!); }
  if (a.startsWith('sell:')) { const r = a.slice(5) as Res; if (G.sellable(r) < 1) { toast('Nothing spare – your factory needs it'); return deny(b); } const v2 = G.sell(r); sfx.coin(); buzz(10); popup(ev.clientX, ev.clientY - 20, '+$' + fmt(v2)); fly(ev.clientX, ev.clientY, ...center(cashEl), 6, 1, '#ffc94a', () => bump(cashEl)); return; }
  if (a === 'tog') { s.on[sl.idx] = !s.on[sl.idx]; sfx.tap(); buzz(8); return; }
  if (a === 'buy') {
    const t0 = tier(sl), wasPlot = visible(sl) === 'plot';
    if (sl.kind === 'mine') { buyMine(sl.idx, ev); }
    else if (sl.kind === 'mach') { const j = sl.idx, k = G.machK(j), c = G.machCostK(j, k); if (s.cash < c) return deny(b); const lb = Math.floor(s.mach[j] / 10), first = !s.mach[j]; s.cash -= c; s.mach[j] += k; sfx.buy(); sfx.clank(); buzz(14); burst(ev.clientX, ev.clientY, 16, 0, RES[MACHINES[j].out].color); if (first) celebrate(MACHINES[j].id === 'fab' ? 'Shipyard unlocked!' : `${MACHINES[j].name} built!`); else if (Math.floor(s.mach[j] / 10) > lb) celebrate(`${MACHINES[j].name} Lv ${s.mach[j]}: output ×2!`); }
    else if (sl.kind === 'hq') { let v = 0; for (const r of RES_ORDER) if (G.sellable(r) >= 1) v += G.sell(r); if (v <= 0) { toast('Nothing spare – your factory needs it all'); return deny(b); } sfx.coin(); buzz(14); popup(ev.clientX, ev.clientY - 20, '+$' + fmt(v)); fly(ev.clientX, ev.clientY, ...center(cashEl), 10, 1, '#ffc94a', () => bump(cashEl)); }
    else if (sl.kind === 'gen') { const k = G.genK(), c = G.genCost(k); if (s.cash < c) return deny(b); s.cash -= c; s.gen += k; sfx.buy(); buzz(14); burst(ev.clientX, ev.clientY, 14, 0, '#ffe066'); }
    bv?.puff(sl.key); bump(b); 
    if (tier(sl) > t0 && !wasPlot) { const [x, y] = bv!.slotScreen(sl.key); celebrate(`${slotName(sl)} evolved: ${TIER_NAMES[tier(sl)]}!`, x, y); bv!.puff(sl.key, '#ffe98a'); }
    openSheet(sheetKey!); spotlight();
  }
}
function bindActs(sel: string) { document.querySelectorAll<HTMLElement>(`#sheet ${sel} [data-act]`).forEach(b => { if (b.dataset.bound) return; b.dataset.bound = '1'; b.addEventListener('click', ev => sheetAct(b.dataset.act!, ev as MouseEvent, b)); }); }
function sset(sel: string, v: string) { const el = $('#sheet ' + sel); if (!el || sheetTxt.get(sel) === v) return; sheetTxt.set(sel, v); el.innerHTML = v; }
function updateSheet(force = false) {
  if (!sheetKey) return; const sl = slotOf(sheetKey), s = st(), n = level(sl), v = visible(sl); void force;
  const nt = nextTierAt(sl);
  sset('.slv', v === 'plot' ? 'Not built yet' : sl.kind === 'mine' || sl.kind === 'mach' || sl.kind === 'gen' ? `Level <b>${n}</b>` : sl.kind === 'hq' ? `Sector <b>${G.sector()}</b>` : '');
  sset('.stier', v === 'plot' ? '' : `<span class="tierb t${tier(sl)}">${TIER_NAMES[tier(sl)]}</span>${nt ? `<small>new look at Lv ${nt}</small>` : ''}`);
  let stats: [string, string][] = [];
  if (sl.kind === 'mine') { const i = sl.idx, d = MINES[i]; stats = [['Profit / cycle', '$' + fmt(G.revenue(i))], [RES[d.res].name + ' / cycle', fmt(G.orePerCycle(i))], ['Cycle', fmtT(G.cycle(i))], ['Next ×2 at', G.nextMs(s.mines[i].n) ? 'Lv ' + G.nextMs(s.mines[i].n) : 'MAX'], ['Foreman', s.mines[i].m ? d.mname : 'none – tap to drill']]; }
  else if (sl.kind === 'mach') { const j = sl.idx, d = MACHINES[j], ms = G.machStats[j]; stats = [['Recipe', `${(Object.keys(d.inp) as Res[]).map(r => `${d.inp[r]}${ri(r)}`).join(' + ')} → 1${ri(d.out)}`], ['Output', `${fmt(G.machRate(j))}/s`], ['Power', `${fmt(d.power * s.mach[j])}${I.bolt}`], ['Status', !s.mach[j] ? 'not built' : ms.reason === '' ? `running ${Math.round(ms.eff * 100)}%` : ms.reason === 'starved' ? `starved${ms.need ? ' of ' + RES[ms.need].name : ''}` : ms.reason === 'power' ? 'low power – upgrade generator' : ms.reason]]; }
  else if (sl.kind === 'gen') stats = [['Supply', fmt(G.powerSupply()) + '' + I.bolt + ''], ['Demand', fmt(G.powerDemand()) + '' + I.bolt + ''], ['Efficiency', Math.round(G.powerEff() * 100) + '%']];
  else if (sl.kind === 'hq') stats = [['Income', '$' + fmt(G.perSec()) + '/s'], ['Earned this sector', '$' + fmt(s.life)], ['Dark Matter', fmt(s.dm, 0)]];
  else if (sl.kind === 'lift') stats = [['Hauls', `${Math.round(G.liftFrac() * 100)}% spare/s`], ['Delivered', fmt(s.lifted)]];
  else if (sl.kind === 'yard') stats = v === 'built' ? [['Docks', String(G.docks())], ['Fleet power', fmt(G.totalPower())]] : [['Unlock', 'Build a Chip Fab']];
  else if (sl.kind === 'lab') stats = [['Researched', `${s.tech.length} / ${TECH.filter(t => G.techAvail(t)).length}`], ['Ready to buy', String(TECH.filter(t => G.techAvail(t) && !s.tech.includes(t.id) && s.cash >= t.cash && s.res[t.res] >= t.amt).length)]];
  else stats = [['Charge', G.warpOpen() ? 'READY' : `$${fmt(s.life)} / $${fmt(G.warpNeed())}`]];
  sset('.sstats', stats.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join(''));
  const buy = $<HTMLButtonElement>('#sheet [data-act="buy"]');
  if (buy && sl.kind === 'hq') { const v = RES_ORDER.reduce((a, r) => a + (G.sellable(r) >= 1 ? G.sellable(r) * G.price(r) : 0), 0); sset('[data-act="buy"]', `Export surplus<b>$${fmt(v)}</b>`); buy.disabled = v <= 0; }
  else if (buy) { const c = slotCost(sl)!, k = sl.kind === 'mine' ? (s.mines[sl.idx].n ? G.buyK(sl.idx) : 1) : sl.kind === 'mach' ? G.machK(sl.idx) : G.genK(); sset('[data-act="buy"]', `${v === 'plot' ? 'Build' : `Upgrade ×${k}`}<b>$${fmt(c)}</b>`); buy.disabled = s.cash < c; }
  if (sl.kind === 'mine') { const h = $<HTMLButtonElement>('#sheet [data-act="hire"]'); if (h) { sset('[data-act="hire"]', `Hire ${MINES[sl.idx].mname}<b>$${fmt(MINES[sl.idx].mgr)}</b>`); h.disabled = s.cash < MINES[sl.idx].mgr; h.classList.toggle('coach', /^Hire/.test(GOALS[s.goal]?.text || '')); } }
  if (sl.kind === 'hq') { const rs = RES_ORDER.filter(r => s.made[r] > 0 || s.res[r] >= 1); sset('#mkt', rs.map(r => { const v2 = G.sellable(r) * G.price(r); return `<button class="mk2" data-act="sell:${r}" style="--c:${RES[r].color}" ${v2 >= 1 ? '' : 'disabled'}>${ri(r)}<b>$${fmt(v2)}</b></button>`; }).join('')); bindActs('#mkt'); }
  if (sl.kind === 'lab') { const list = TECH.filter(t => G.techAvail(t) && !s.tech.includes(t.id)).slice(0, 3); sset('#llist', list.length ? list.map(t => `<button class="trow" data-act="tech:${t.id}" ${s.cash >= t.cash && s.res[t.res] >= t.amt ? '' : 'disabled'}><span class="ti">${art(t.tgt < 0 ? 'star' : MINES[t.tgt].id)}</span><span class="tn"><b>${t.name}</b><small>${t.tgt < 0 ? 'All mines' : MINES[t.tgt].name} profit ×${t.x}</small></span><span class="tc">$${fmt(t.cash)}<small>${ri(t.res)}${fmt(t.amt)}</small></span></button>`).join('') : '<p class="muted">All research complete for this sector.</p>'); bindActs('#llist'); }
  if (sl.kind === 'yard' && v === 'built') { const now = G.clock(); const busy = s.missions.map(m => { const d = m.kind === 'run' ? RUNS.find(r => r.id === m.target)! : PLANETS.find(p => p.id === m.target)!; return `<div class="trow busy"><span class="ti">${art(m.kind === 'run' ? d.id : d.id)}</span><span class="tn"><b>${d.name}</b><small>${Math.round(m.chance * 100)}% · ${m.power}${I.sword}</small></span><span class="tc">${fmtT(Math.max(0, (m.end - now) / 1000))}</span></div>`; }).join('');
    const opts = [...RUNS.filter(r => G.idlePower() >= r.need && !s.missions.some(m => m.target === r.id)).slice(-2).map(r => ['run', r] as const), ...PLANETS.filter(p => G.avail(p as never) && !s.conquered.includes(p.id) && !s.missions.some(m => m.target === p.id) && G.idlePower() >= p.need).slice(0, 1).map(p => ['planet', p] as const)];
    const free = s.missions.length < G.docks();
    if (ySeg === 1) { sset('#ylist', G.shipsAvail().map(sh => { const c = G.shipCost(sh.id); return `<button class="trow" data-act="ship:${sh.id}" ${G.canAfford(c) ? '' : 'disabled'}><span class="ti">${art(sh.id)}</span><span class="tn"><b>${sh.name} <small>×${s.ships[sh.id] || 0}${G.away(sh.id) ? ` · ${G.away(sh.id)} away` : ''}</small></b><small>${sh.power}${I.sword} power</small></span><span class="tc">${costStr(c)}</span></button>`; }).join('')); bindActs('#ylist'); }
    else if (ySeg === 2) { sset('#ylist', FLEET_UPG.map(u => { const lv = G.fu(u.id), mx = lv >= u.max, c = { [u.res]: G.fuCost(u.id) }; return `<button class="trow" data-act="fu:${u.id}" ${!mx && G.canAfford(c) ? '' : 'disabled'}><span class="ti">${art(({ engines: 'plasma', armor: 'hull', docks: 'scout' } as Record<string, string>)[u.id])}</span><span class="tn"><b>${u.name} <small>Lv ${lv}/${u.max}</small></b><small>${u.desc}</small></span><span class="tc">${mx ? 'MAX' : costStr(c)}</span></button>`; }).join('')); bindActs('#ylist'); }
    else sset('#ylist', busy + (free ? opts.map(([k, d]) => `<button class="trow" data-act="go:${k}:${d.id}"><span class="ti">${art(d.id)}</span><span class="tn"><b>${k === 'planet' ? 'Conquer ' : ''}${d.name}</b><small>needs ${d.need}${I.sword} · ${fmtT(G.missionTime(d.time))}</small></span><span class="tc go">LAUNCH</span></button>`).join('') : '') + (!busy && !opts.length ? `<p class="muted">${free ? 'No mission you can crew yet – build ships in the <b>Ships</b> tab.' : 'All docks busy – ships are out flying.'}</p>` : '')); bindActs('#ylist'); }
  if (sl.kind === 'gate') { const ok = G.warpOpen() && G.dmGain() >= 1; const wb = $<HTMLButtonElement>('#sheet [data-act="dowarp"]'); if (wb) { sset('[data-act="dowarp"]', ok ? `ENGAGE WARP<b>+${fmt(G.dmGain(), 0)} DM</b>` : `Charging…<b>${Math.floor(Math.min(1, s.life / G.warpNeed()) * 100)}%</b>`); wb.disabled = !ok; } }
  if (sl.kind === 'lift' || sl.kind === 'yard') { sset(sl.kind === 'lift' ? '#lstock' : '#ystock', `<small>${sl.kind === 'lift' ? 'ON THE FLEET ROCK' : 'FLEET STOCK · delivered by the Cargo Lift'}</small><div>${G.FLEET_RES.filter(r => s.made[r] > 0 || s.fstock[r] >= 1).map(r => `<span style="--c:${RES[r].color}">${ri(r)}<b>${fmt(s.fstock[r])}</b>${G.liftRate(r) > .01 ? `<i>+${fmt(G.liftRate(r))}/s</i>` : ''}</span>`).join('') || '<em>Nothing yet – make Parts and Alloy</em>'}</div>`); }
  if (sl.kind === 'lift') { const bb = $<HTMLButtonElement>('#sheet [data-act="buy"]'); if (bb) { sset('[data-act="buy"]', `Upgrade lift<b>$${fmt(G.liftCost())}</b>`); bb.disabled = s.cash < G.liftCost(); } sset('[data-act="ltog"]', s.liftOn ? '⏸ Pause lift' : '▶ Run lift'); }
  if (sl.kind === 'mach') sset('[data-act="tog"]', s.on[sl.idx] ? '⏸ Pause' : '▶ Resume');
}

// ---------- FACTORY ----------
type Row = { root: HTMLElement; info: HTMLElement; btn: HTMLButtonElement; tog: HTMLElement; eff: HTMLElement; lv: HTMLElement };
let facRows: Row[] = [];
let techBtns: { el: HTMLButtonElement; t: typeof TECH[number] }[] = [];
const flow: Record<Res, number> = Object.fromEntries(RES_ORDER.map(r => [r, 0])) as Record<Res, number>;
function renderFac() {
  facRows = [];
  const s = st();
  main.innerHTML = `<div class="buyrow"><div class="hint"></div>${multBtn()}</div>
  <div class="gen card"><div class="ico sm" style="--h:55">${art('gen')}</div><div class="mid"><div class="name">${GEN.name} <small class="glv"></small></div><div class="pbar"><i></i><span></span></div></div><button class="btn"></button></div>
  <div class="sec">Production chain <span class="sech">tap ⏸ to reroute inputs</span></div><div id="chain"></div>
  <div class="sec">Market${s.warps >= 2 ? `<button class="autot ${s.auto ? 'on' : ''}" id="auto">Auto-export ${s.auto ? 'ON' : 'OFF'}</button>` : ''}</div><div class="market">${RES_ORDER.map(r => `<button class="mk" data-sell="${r}" style="--c:${RES[r].color}">${ri(r)}<b></b><small></small></button>`).join('')}</div>
  <div class="sec">Research</div><div id="tech"></div>`;
  const chain = $('#chain');
  MACHINES.forEach((d, j) => {
    if (!G.avail(d)) return;
    const el = document.createElement('div'); el.className = 'mach'; el.dataset.j = String(j); el.style.animationDelay = j * 40 + 'ms';
    if (!G.machUnlocked(j)) { el.classList.add('locked'); el.innerHTML = `<div class="lockmsg">${I.lock} <b>${d.name}</b><br><small>unlocks at $${fmt(d.unlock)} lifetime earnings</small></div>`; chain.appendChild(el); return; }
    const ins = (Object.keys(d.inp) as Res[]);
    el.innerHTML = `<div class="mhead"><div class="ico sm">${art(mk(d.id))}</div><div class="mid"><div class="name">${d.name} <small class="lv"></small></div><p class="info"></p></div><button class="tog"></button></div>
    <div class="line"><div class="ins">${ins.map(r => `<div class="node" data-in="${r}" style="--c:${RES[r].color}">${ri(r)}<small>×${d.inp[r]}</small></div>`).join('')}</div><div class="belt"><div class="items">${ins.map(r => `<i>${ri(r)}</i>`).join('').repeat(Math.ceil(6 / ins.length)).slice(0)}</div></div><div class="node machine">${art(mk(d.id))}<div class="eff"></div></div><div class="belt"><div class="items">${`<i>${ri(d.out)}</i>`.repeat(6)}</div></div><div class="node" style="--c:${RES[d.out].color}">${ri(d.out)}</div></div>
    ${s.mach[j] && G.sharedInputs(j).length ? `<div class="split"><span>Share of ${G.sharedInputs(j).map(r => ri(r)).join('')}</span><input type="range" min="1" max="100" value="${s.w[j]}" data-w="${j}"><b>${s.w[j]}</b></div>` : ''}
    <button class="btn wide"></button>`;
    chain.appendChild(el);
    const row: Row = { root: el, info: $('.info', el), btn: $<HTMLButtonElement>('.btn', el), tog: $('.tog', el), eff: $('.eff', el), lv: $('.lv', el) };
    facRows[j] = row;
    row.btn.addEventListener('click', ev => {
      const k = G.machK(j), c = G.machCostK(j, k); if (s.cash < c) return deny(row.btn);
      const lb = Math.floor(s.mach[j] / 10), first = s.mach[j] === 0; s.cash -= c; s.mach[j] += k; sfx.buy(); sfx.clank(); buzz(14); burst(ev.clientX, ev.clientY, 16, 0, RES[d.out].color);
      if (first) { celebrate(d.id === 'fab' ? 'Shipyard online! Fly to the Fleet Rock' : `${d.name} built!`); renderFac(); spotlight(); return; }
      if (Math.floor(s.mach[j] / 10) > lb) celebrate(`${d.name} Lv ${s.mach[j]}: output ×2!`);
      
    });
    row.tog.addEventListener('click', () => { s.on[j] = !s.on[j]; sfx.tap(); buzz(8); });
  });
  main.querySelectorAll<HTMLInputElement>('[data-w]').forEach(inp => { inp.addEventListener('input', () => { const j = +inp.dataset.w!; s.w[j] = +inp.value; setT(inp.nextElementSibling as HTMLElement, inp.value); if (+inp.value % 10 === 0) { sfx.clank(); buzz(4); } }); inp.addEventListener('pointerdown', e => e.stopPropagation()); });
  $('#auto')?.addEventListener('click', () => { s.auto = !s.auto; sfx.tap(); buzz(8); renderFac(); });
  const gb = $<HTMLButtonElement>('.gen .btn');
  gb.addEventListener('click', ev => { const k = G.genK(), c = G.genCost(k); if (s.cash < c) return deny(gb); s.cash -= c; s.gen += k; sfx.buy(); tone2(); buzz(14); burst(ev.clientX, ev.clientY, 14, 0, '#ffe066'); });
  main.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach(b => b.addEventListener('click', () => { const r = b.dataset.sell as Res; if (G.sellable(r) < 1) { toast('Nothing spare – your factory needs it'); return deny(b); } const v = G.sell(r); sfx.buy(); sfx.coin(); buzz(14); const [x, y] = center(b); popup(x, y - 20, '+$' + fmt(v)); fly(x, y, ...center(cashEl), 8, 1, '#ffc94a', () => bump(cashEl)); }));
  techBtns = [];
  const list = TECH.filter(t => G.techAvail(t) && !s.tech.includes(t.id)).slice(0, 8), tech = $('#tech');
  tech.innerHTML = list.map(t => `<div class="row"><div class="ico sm" style="--h:${t.tgt < 0 ? 50 : MINES[t.tgt].hue}">${art(t.tgt < 0 ? 'star' : MINES[t.tgt].id)}</div><div class="mid"><div class="name sm">${t.name}</div><p>${t.tgt < 0 ? 'All mines' : MINES[t.tgt].name} profit <b class="x">×${t.x}</b></p></div><button class="btn gold tb" data-u="${t.id}">$${fmt(t.cash)}<b>${ri(t.res)}${fmt(t.amt)}</b></button></div>`).join('') || '<p class="empty">All research complete. ' + I.trophy + '</p>';
  tech.querySelectorAll<HTMLButtonElement>('[data-u]').forEach(b => { const t = TECH.find(x => x.id === b.dataset.u)!; techBtns.push({ el: b, t }); b.addEventListener('click', ev => { if (s.cash < t.cash || s.res[t.res] < t.amt) return deny(b); s.cash -= t.cash; s.res[t.res] -= t.amt; s.tech.push(t.id); celebrate(`${I.flask} ${t.name}!`, ev.clientX, ev.clientY); renderFac(); }); });
}
function tone2() { sfx.clank(); }
function updateFac() {
  const s = st(), pe = G.powerEff(), sup = G.powerSupply(), dem = G.powerDemand();
  const g = $('.gen'); if (g) {
    setT($('.glv', g), `Lv ${s.gen}`); const pb = $('.pbar', g); $('i', pb).style.width = Math.min(100, dem / Math.max(sup, 1e-9) * 100) + '%'; pb.classList.toggle('over', dem > sup);
    setT($('span', pb), `${I.bolt} ${fmt(dem)} / ${fmt(sup)}${dem > sup ? ` · machines at ${Math.round(pe * 100)}%` : ''}`, true);
    const k = G.genK(), c = G.genCost(k), b = $<HTMLButtonElement>('.btn', g); setT(b, `+${fmt(GEN.power * k)}${I.bolt}<b>$${fmt(c)}</b>`, true); b.disabled = s.cash < c; g.classList.toggle('alert', dem > sup);
  }
  MACHINES.forEach((d, j) => {
    const r = facRows[j]; if (!r) return; const ms = G.machStats[j], rate = G.machRate(j);
    setT(r.lv, s.mach[j] ? `Lv ${s.mach[j]}` : '');
    const reason = !s.mach[j] ? `Turns ${Object.keys(d.inp).map(x => RES[x as Res].name).join(' + ')} into ${RES[d.out].name} · ${I.bolt}${d.power}/lvl`
      : ms.reason === 'off' ? '<em>Paused</em> – inputs flow to other machines'
      : ms.reason === 'starved' ? `<em>Starved</em> – needs more ${ri(ms.need!)} ${RES[ms.need!].name}`
      : ms.reason === 'power' ? '<em class="pw">Low power</em> – upgrade the generator'
      : `${fmt(rate * pe)} ${RES[d.out].name}/s`;
    setT(r.info, reason, true);
    const k = G.machK(j), c = G.machCostK(j, k); setT(r.btn, `${s.mach[j] ? `Upgrade ×${k}` : 'Build'} · $${fmt(c)}`); r.btn.disabled = s.cash < c;
    setT(r.tog, s.on[j] ? '⏸' : '▶');
    const eff = s.mach[j] && s.on[j] ? ms.eff : 0;
    r.root.classList.toggle('running', eff > 0.02); r.root.classList.toggle('bad', !!s.mach[j] && s.on[j] && eff < 0.6);
    r.eff.style.setProperty('--e', String(eff)); setT(r.eff, s.mach[j] ? Math.round(eff * 100) + '%' : '');
    r.root.style.setProperty('--sp', Math.max(0.3, 2.4 / Math.sqrt(1 + rate * Math.max(eff, 0.05))) + 's');
    r.root.querySelectorAll<HTMLElement>('[data-in]').forEach(n => n.classList.toggle('need', ms.reason === 'starved' && ms.need === n.dataset.in));
  });
  main.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach(b => { const r = b.dataset.sell as Res; const has = s.res[r] >= 1 || s.made[r] > 0 || G.resPerSec(r) > 0; b.classList.toggle('gone', !has); setT($('b', b), '$' + fmt(G.sellable(r) * G.price(r))); setT($('small', b), `${flow[r] >= 0 ? '+' : ''}${fmt(flow[r])}/s`); $('small', b).classList.toggle('neg', flow[r] < -0.01); b.disabled = G.sellable(r) < 1; });
  techBtns.forEach(({ el, t }) => { const ok = s.cash >= t.cash && s.res[t.res] >= t.amt; el.disabled = !ok; el.classList.toggle('afford', ok); });
}

// ---------- CREW ----------
function renderCrew() {
  const s = st();
  main.innerHTML = `<div class="sec">Foremen run mines forever – even offline</div>` + MINES.map((d, i) => `<div class="row ${s.mines[i].m ? 'done' : ''} ${!s.mines[i].n && !s.mines[i].m ? 'dim' : ''}"><div class="ico sm" style="--h:${d.hue}">${art(d.id)}</div><div class="mid"><div class="name">${d.mname}</div><p>${s.mines[i].n ? `Automates ${d.name}` : `Build ${d.name} first`}</p></div>${s.mines[i].m ? `<span class="ok">${I.check} Hired</span>` : `<button class="btn" data-m="${i}">$${fmt(d.mgr)}</button>`}</div>`).join('');
  main.querySelectorAll<HTMLButtonElement>('[data-m]').forEach(b => b.addEventListener('click', ev => { const i = +b.dataset.m!; if (!s.mines[i].n) { toast('Build that mine first!'); return deny(b); } if (s.cash < MINES[i].mgr) return deny(b); s.cash -= MINES[i].mgr; s.mines[i].m = true; celebrate(`${I.bot} ${MINES[i].mname} hired!`, ev.clientX, ev.clientY); renderCrew(); }));
  spotlight();
}

// ---------- FLEET ----------
let greed = 1.4;
function renderFleet() {
  const s = st();
  if (!G.fleetOpen()) { main.innerHTML = `<div class="gate card"><div class="hero art-hero">${art('scout')}</div><h2 class="h">Shipyard offline</h2><p>Build the <b>Chip Fab</b> in your factory to bring the shipyard online. Salvage runs bring back goods; conquered planets boost profit and ore forever.</p><div class="gbar"><i style="width:${Math.min(100, Math.log10(G.allTime() + 1) / Math.log10(MACHINES[4].unlock) * 100)}%"></i></div><small>Chip Fab unlocks at $${fmt(MACHINES[4].unlock)} lifetime</small></div>`; return; }
  main.innerHTML = `<div class="power card"><div><small>FLEET POWER</small><b class="h" id="fp"></b></div><div class="docks" id="docks"></div></div>
  <div id="missions"></div>
  <div class="sec">Shipyard</div>${G.shipsAvail().map(sh => `<div class="row" data-ship="${sh.id}"><div class="ico sm">${art(sh.id)}</div><div class="mid"><div class="name">${sh.name} <small class="own"></small></div><p>${I.sword} ${sh.power} power</p></div><button class="btn sb"></button></div>`).join('')}
  <div class="sec">Salvage runs <span class="sech">repeatable</span></div>${RUNS.map(r => `<div class="row mis" data-run="${r.id}"><div class="ico sm">${art(r.id)}</div><div class="mid"><div class="name">${r.name}</div><p>${I.sword}${r.need} · ${fmtT(G.missionTime(r.time))} · <span class="lootp" data-loot="${r.id}"></span></p><p class="ch"></p></div><button class="btn"></button></div>`).join('')}
  <div class="sec">Conquest <span class="sech">permanent bonuses</span></div>${s.conquered.length ? `<div class="card empire"><small>YOUR EMPIRE · profit ×${fmt(G.planetMul())}</small><div>${PLANETS.filter(p => s.conquered.includes(p.id)).map(p => `<span title="${p.name}">${art(p.id)}</span>`).join('')}</div></div>` : ''}${PLANETS.filter(G.avail).map((p, k, PL) => { const done = s.conquered.includes(p.id), open = k === 0 || s.conquered.includes(PL[k - 1].id); if (done) return ''; if (!open && k > 0 && !(k - 1 === 0 || s.conquered.includes(PL[k - 2].id))) return '';
    return `<div class="row mis planet ${done ? 'done' : ''} ${!open ? 'dim' : ''}" data-planet="${p.id}"><div class="ico sm">${art(open ? p.id : 'unknown')}</div><div class="mid"><div class="name">${open ? p.name : 'Unknown world'}</div><p>${done ? `${I.flag} Yours · profit ×${p.bonus}, ore +50%` : open ? `${p.desc}<br>${I.sword}${p.need} · ${fmtT(G.missionTime(p.time))} · profit <b class="x">×${p.bonus}</b>` : 'Conquer the previous planet'}</p><p class="ch"></p></div>${done ? '<span class="ok">' + I.flag + '</span>' : open ? '<button class="btn gold"></button>' : ''}</div>`; }).join('')}
  <div class="sec">Fleet upgrades</div>${FLEET_UPG.map(u => `<div class="row" data-fu="${u.id}"><div class="ico sm">${art(({ engines: 'plasma', armor: 'hull', docks: 'scout' } as Record<string, string>)[u.id])}</div><div class="mid"><div class="name">${u.name} <small class="own"></small></div><p>${u.desc}</p></div><button class="btn gold sb"></button></div>`).join('')}`;
  main.querySelectorAll<HTMLElement>('[data-ship]').forEach(row => { const id = row.dataset.ship!, b = $<HTMLButtonElement>('button', row); b.addEventListener('click', ev => { const c = G.shipCost(id); if (!G.canAfford(c)) return deny(b); G.pay(c); s.ships[id] = (s.ships[id] || 0) + 1; sfx.launch(); buzz([20, 20, 40]); rocket(ev.clientX, ev.clientY - 20, true); burst(ev.clientX, ev.clientY, 14); }); });
  main.querySelectorAll<HTMLElement>('[data-fu]').forEach(row => { const id = row.dataset.fu!, u = FLEET_UPG.find(x => x.id === id)!, b = $<HTMLButtonElement>('button', row); b.addEventListener('click', ev => { if (G.fu(id) >= u.max) return; const c = { [u.res]: G.fuCost(id) }; if (!G.canAfford(c)) return deny(b); G.pay(c); s.fupg[id] = G.fu(id) + 1; celebrate(`${u.name} Lv ${s.fupg[id]}`, ev.clientX, ev.clientY); renderFleet(); }); });
  main.querySelectorAll<HTMLElement>('.mis').forEach(row => { const b = row.querySelector<HTMLButtonElement>('button'); if (!b) return; const kind = row.dataset.run ? 'run' : 'planet', id = (row.dataset.run || row.dataset.planet)!; b.addEventListener('click', () => { if (s.missions.length >= G.docks()) { toast('All docks busy – upgrade Launch Docks'); return deny(b); } sfx.tap(); shipSheet(kind, id); }); });
  updateFleet();
}
function shipSheet(kind: 'run' | 'planet', id: string) {
  const s = st(), def = kind === 'run' ? RUNS.find(r => r.id === id)! : PLANETS.find(p => p.id === id)!;
  let sel: Record<string, number> = { ...G.pickShips(Math.ceil(def.need * greed)).pick };
  const m = modal(`<div class="shead"><div class="ico sm">${art(def.id)}</div><div><h2 class="h">${def.name}</h2><p>Needs ${I.sword}${def.need} · ${fmtT(G.missionTime(def.time))}</p></div></div>
    <div class="seg">${[[1, 'Lean'], [1.4, 'Safe'], [2, 'Overwhelm'], [99, 'All']].map(([g, n]) => `<button data-pre="${g}">${n}</button>`).join('')}</div>
    <div class="pick">${G.shipsAvail().filter(sh => G.idle(sh.id) > 0).map(sh => `<div class="prow" data-s="${sh.id}"><div class="ico sm">${art(sh.id)}</div><div class="mid"><b>${sh.name}</b><small>${I.sword}${sh.power} · ${G.idle(sh.id)} idle</small></div><button class="stp" data-d="-1">−</button><b class="cnt h">0</b><button class="stp" data-d="1">+</button></div>`).join('') || '<p>No idle ships – build some in the Shipyard.</p>'}</div>
    <div class="odds"><div class="obar"><i></i></div><span></span></div>
    <div class="two"><button class="btn big ghost" data-x>Cancel</button><button class="btn gold big" data-go>Launch</button></div>`);
  m.querySelector('.sheet')!.classList.add('ships');
  const upd = () => {
    let p = 0; m.querySelectorAll<HTMLElement>('.prow').forEach(r => { const sid = r.dataset.s!; sel[sid] = Math.max(0, Math.min(G.idle(sid), sel[sid] || 0)); p += sel[sid] * SHIPS.find(x => x.id === sid)!.power; setT($('.cnt', r), String(sel[sid])); });
    const ch = G.chanceFor(p, def.need), loss = Math.round((ch ? 0.05 * ch + 0.35 * (1 - ch) : 0) * (1 - 0.2 * G.fu('armor')) * 100);
    const o = $('.odds', m); ($('i', o) as HTMLElement).style.width = ch * 100 + '%'; o.className = 'odds ' + (ch > 0.9 ? 'good' : ch > 0.7 ? 'mid' : 'risk');
    setT($('span', o), p < def.need ? `${I.sword}${p} / ${def.need} – not enough power` : `${I.sword}${p} · <b>${Math.round(ch * 100)}% success</b> · ~${loss}% ship losses expected`, true);
    ($('[data-go]', m) as HTMLButtonElement).disabled = p < def.need;
  };
  m.querySelectorAll<HTMLElement>('.stp').forEach(b => { let t: number | undefined; const go = () => { const sid = (b.closest('.prow') as HTMLElement).dataset.s!; sel[sid] = (sel[sid] || 0) + +b.dataset.d!; sfx.tap(); buzz(4); upd(); }; b.addEventListener('pointerdown', () => { go(); t = window.setTimeout(function rep() { go(); t = window.setTimeout(rep, 70); }, 380); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => b.addEventListener(e, () => clearTimeout(t))); });
  m.querySelectorAll<HTMLElement>('[data-pre]').forEach(b => b.addEventListener('click', () => { const g = +b.dataset.pre!; sfx.tap(); if (g === 99) { sel = {}; G.shipsAvail().forEach(sh => sel[sh.id] = G.idle(sh.id)); } else { greed = g; sel = { ...G.pickShips(Math.ceil(def.need * g)).pick }; } upd(); }));
  $('[data-x]', m).addEventListener('click', () => m.remove());
  $('[data-go]', m).addEventListener('click', ev => { const ms = G.launch(kind, id, greed, sel); if (!ms) return deny($('[data-go]', m)); m.remove(); sfx.launch(); buzz([30, 30, 60]); const nShips = Math.min(6, Object.values(ms.ships).reduce((a, x) => a + x, 0)); for (let k = 0; k < nShips; k++) setTimeout(() => rocket(ev.clientX - 50 + k * 20, ev.clientY, true), k * 110); renderFleet(); });
  upd();
}
function updateFleet() {
  const s = st(); if (!G.fleetOpen() || !$('#fp')) return;
  setT($('#fp'), `${fmt(G.idlePower())} / ${fmt(G.totalPower())}`);
  setT($('#docks'), Array.from({ length: G.docks() }, (_, k) => `<i class="${k < s.missions.length ? 'busy' : ''}"></i>`).join('') + `<small>docks</small>`, true);
  setT($('#missions'), s.missions.map(m => { const def = m.kind === 'run' ? RUNS.find(r => r.id === m.target)! : PLANETS.find(p => p.id === m.target)!; const left = Math.max(0, (m.end - G.clock()) / 1000); return `<div class="active card"><div class="ico sm">${art(def.id)}</div><div class="mid"><div class="name">${def.name} <small>${Math.round(m.chance * 100)}% · ${I.sword}${m.power}</small></div><div class="bar thin"><div class="fill" style="transform:scaleX(${1 - left / m.dur})"></div></div></div><div class="time">${fmtT(left)}</div></div>`; }).join(''), true);
  main.querySelectorAll<HTMLElement>('.mis').forEach(row => { const b = row.querySelector<HTMLButtonElement>('button'); if (!b) return; const id = (row.dataset.run || row.dataset.planet)!; const def = row.dataset.run ? RUNS.find(r => r.id === id)! : PLANETS.find(p => p.id === id)!; const busy = s.missions.some(m => m.target === id); const { power } = G.pickShips(Math.ceil(def.need * greed)); const ch = G.chanceFor(power, def.need);
    setT(b, busy ? 'En route' : s.missions.length >= G.docks() ? 'Docks full' : row.dataset.run ? 'Launch' : 'Invade'); b.disabled = busy || ch <= 0 || s.missions.length >= G.docks();
    setT(row.querySelector('.ch'), busy ? '' : ch > 0 ? `<span class="${ch > 0.9 ? 'good' : ch > 0.7 ? 'mid' : 'risk'}">${Math.round(ch * 100)}% success</span> with ${I.sword}${power}` : `<span class="risk">Need ${I.sword}${def.need} idle</span>`, true); });
  main.querySelectorAll<HTMLElement>('[data-loot]').forEach(el => { const r = RUNS.find(x => x.id === el.dataset.loot)!; setT(el, Object.entries(r.loot).map(([k, v]) => ri(k as Res) + fmt(v! * (1 + s.conquered.length * 0.5) + G.prodRate(k as Res) * r.time * 1.5)).join(' '), true); });
  main.querySelectorAll<HTMLElement>('[data-ship]').forEach(row => { const id = row.dataset.ship!, b = $<HTMLButtonElement>('button', row), c = G.shipCost(id); setT(b, costStr(c), true); b.disabled = !G.canAfford(c); setT($('.own', row), (s.ships[id] || 0) ? `×${s.ships[id]}${G.away(id) ? ` · ${G.away(id)} away` : ''}` : ''); });
  main.querySelectorAll<HTMLElement>('[data-fu]').forEach(row => { const id = row.dataset.fu!, u = FLEET_UPG.find(x => x.id === id)!, b = $<HTMLButtonElement>('button', row); const max = G.fu(id) >= u.max; setT($('.own', row), `Lv ${G.fu(id)}/${u.max}`); setT(b, max ? 'MAX' : costStr({ [u.res]: G.fuCost(id) }), true); b.disabled = max || !G.canAfford({ [u.res]: G.fuCost(id) }); });
}
function missionsTick() {
  for (const o of G.resolveMissions()) {
    if (bv && tab === 'base') sfx.land(), bv.land(Object.values(o.m.ships).reduce((a, b) => a + b, 0) - Object.values(o.lost).reduce((a, b) => a + b, 0));
    const def = o.m.kind === 'run' ? RUNS.find(r => r.id === o.m.target)! : PLANETS.find(p => p.id === o.m.target)!;
    const lostN = Object.values(o.lost).reduce((a, b) => a + b, 0);
    if (o.ok && o.m.kind === 'planet') { xp(XP.conquer); flash(); sfx.warp(); celebrate(`${I.flag} ${def.name} conquered! Profit ×${(def as typeof PLANETS[number]).bonus}`); }
    else if (o.ok) { sfx.fanfare(); buzz([20, 30]); toast(`${def.name}: loot secured!${lostN ? ` (−${lostN} ships)` : ''}`); if (o.loot) { const [x, y] = bv ? bv.slotScreen(bv.rock ? 'yard' : 'lift') : center(cashEl); for (const r in o.loot) fly(x, y, ...center(resEl(r as Res)), 6, 2, RES[r as Res].color, () => bump(resEl(r as Res))); } }
    else { sfx.no(); buzz([60, 40, 60]); shakeEl(app); toast(`${I.boom} ${def.name} failed – lost ${lostN} ship${lostN === 1 ? '' : 's'}`); }
    if (tab === 'fleet') renderFleet(); G.save();
  }
}

// ---------- WARP ----------
function renderWarp() {
  const s = st();
  if (!G.warpOpen()) { main.innerHTML = `<div class="gate card"><div class="hero art-hero">${art('hole')}</div><h2 class="h">Warp Drive dormant</h2><p>Earn <b>$${fmt(G.warpNeed())} this sector</b> to charge it. Warping resets this sector for <b>Dark Matter</b>: a permanent profit multiplier, plus +1% ore & factory speed each — and every warp opens a new sector with new tech.</p><div class="gbar"><i style="width:${Math.min(100, Math.log10(s.life + 1) / Math.log10(G.warpNeed()) * 100)}%"></i></div><small>$${fmt(s.life)} / $${fmt(G.warpNeed())}</small></div>` + perks() + stats(); return; }
  const g = G.dmGain();
  main.innerHTML = `<div class="nova card"><div class="sun art-hero">${art('hole')}</div><h2 class="h">Warp to a new sector</h2><p>Resets mines, factory, fleet and planets. Keeps <b style="color:var(--violet)">Dark Matter</b> and trophies.</p><div class="h gain">+${fmt(g, 0)} ${I.warp}</div><p class="sectorline">Next: <b>Sector ${G.sector() + 1} · ${SECTORS[Math.min(G.sector(), SECTORS.length - 1)]}</b></p><button class="btn gold big" id="go" ${g < 1 ? 'disabled' : ''}>${g < 1 ? 'Next at $' + fmt(G.dmNext()) + ' all-time' : 'ENGAGE WARP'}</button></div>` + perks() + stats();
  $('#go')?.addEventListener('click', () => { if (G.dmGain() < 1) return; confirmModal(art('hole'), 'Engage warp?', `Reset this sector for +${fmt(G.dmGain(), 0)} Dark Matter and jump to Sector ${G.sector() + 1}.`, 'WARP', () => { G.doWarp(); G.save(); sfx.warp(); buzz([50, 50, 100, 50, 200]); flash(); for (let k = 0; k < 5; k++) setTimeout(() => burst(Math.random() * innerWidth, Math.random() * innerHeight * .6, 40), k * 120); setTab('mine'); }); });
}
function perks() { const s = st(); return `<div class="sec">Warp perks</div>${PERKS.map(p => `<div class="row perk ${s.warps >= p.warps ? 'got' : 'dim'}"><div class="ico sm">${art(p.art)}</div><div class="mid"><div class="name">${p.name} <small>${s.warps >= p.warps ? `${I.check} active` : `after warp ${p.warps}`}</small></div><p>${p.desc}</p></div></div>`).join('')}`; }
function stats() { const s = st(); return `<div class="sec">Stats</div><div class="card stats">${[['Dark Matter', `${fmt(s.dm, 0)} (profit ×${fmt(G.dmMul())})`], ['Trophy bonus', `+${Math.round((G.achMul() - 1) * 100)}%`], ['Planet bonus', '×' + fmt(G.planetMul())], ['Earned this sector', '$' + fmt(s.life)], ['All-time', '$' + fmt(G.allTime())], ['Missions won / ships lost', `${s.wins} / ${s.lost}`], ['Play time', fmtT(s.played)], ['Taps', s.taps]].map(([a, b]) => `<div class="stat"><span>${a}</span><b>${b}</b></div>`).join('')}</div><div class="sec">Settings</div><button class="btn big ghost" id="reset">Reset save</button>`; }
document.addEventListener('click', e => { if ((e.target as HTMLElement).id === 'reset') confirmModal(I.trash, 'Reset everything?', 'Wipes all progress including Dark Matter and trophies.', 'Reset', () => { localStorage.removeItem(G.KEY); G.setS(G.fresh()); setTab('mine'); renderGoal(); }); });

// ---------- modals ----------
function modal(html: string) { closeSheet(); const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="sheet">${html}</div>`; document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m) m.remove(); }); return m; }
function confirmModal(icon: string, title: string, txt: string, ok: string, fn: () => void) {
  const m = modal(`<div class="hero">${icon}</div><h2 class="h">${title}</h2><p>${txt}</p><div class="two"><button class="btn big ghost" data-x>Cancel</button><button class="btn gold big" data-ok>${ok}</button></div>`);
  m.querySelector('[data-x]')!.addEventListener('click', () => m.remove()); m.querySelector('[data-ok]')!.addEventListener('click', () => { m.remove(); fn(); });
}
$('#trophy').addEventListener('click', () => { sfx.tap(); const s = st(); const m = modal(`<h2 class="h"><span class="hico">${$('#trophy svg')?.outerHTML || ''}</span> Trophies <small>${s.ach.length}/${ACHS.length}</small></h2><p>Each trophy: <b style="color:var(--mint)">+2% profit</b> forever</p><div class="achs">${ACHS.map(a => `<div class="ach ${s.ach.includes(a.id) ? 'got' : ''}"><i>${s.ach.includes(a.id) ? ($('#trophy svg')?.outerHTML || '') : `<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3" fill="#8b84b0" stroke="#24163a" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#24163a" stroke-width="2.5"/><circle cx="12" cy="15.5" r="1.8" fill="#24163a"/></svg>`}</i><b>${a.name}</b><small>${a.desc}</small></div>`).join('')}</div><button class="btn big" data-x>Close</button>`); m.querySelector('[data-x]')!.addEventListener('click', () => m.remove()); m.querySelector('.sheet')!.classList.add('tall'); });
function checkAch() { const s = st(); for (const a of ACHS) if (!s.ach.includes(a.id) && a.check(s)) { s.ach.push(a.id); xp(XP.ach); if (s.goal < 9) continue; sfx.fanfare(); buzz([20, 40, 20, 40]); toast(`${I.trophy} ${a.name} · +2% profit`); bump($('#trophy')); burst(...center($('#trophy')), 24); } }

// ---------- tabs ----------
const RENDER: Record<string, () => void> = { base: renderBase, mine: renderMine, fac: renderFac, crew: renderCrew, fleet: renderFleet, warp: renderWarp };
function setTab(t: string) { tab = t; app.classList.toggle('sub', t !== 'base'); main.classList.toggle('basemode', t === 'base'); app.classList.toggle('basemode', t === 'base'); if (t !== 'base') closeSheet(); document.querySelectorAll<HTMLElement>('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); main.scrollTop = 0; cards = []; facRows = []; techBtns = []; RENDER[t](); renderGoal(); spotlight(); main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter'); }
document.querySelectorAll<HTMLElement>('nav button').forEach(b => b.addEventListener('click', () => { if (tab !== b.dataset.t) { sfx.tap(); buzz(6); setTab(b.dataset.t!); } }));
const muteBtn = $('#mute'); const setMute = () => muteBtn.innerHTML = st().mute ? `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#8b84b0" stroke="#24163a" stroke-width="2" stroke-linejoin="round"/><path d="M16 9l5 6M21 9l-5 6" stroke="#ff5b5b" stroke-width="2.5" stroke-linecap="round"/></svg>` : `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#5cf2ff" stroke="#24163a" stroke-width="2" stroke-linejoin="round"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`; setMute();
muteBtn.addEventListener('click', () => { st().mute = !st().mute; setMute(); sfx.tap(); buzz(8); G.save(); });
function dots() {
  const s = st(), dot = (t: string, on: boolean) => document.querySelector(`nav button[data-t="${t}"] .dot`)?.classList.toggle('show', on);
  dot('fac', MACHINES.some((mm, j) => G.machUnlocked(j) && !s.mach[j] && s.cash >= mm.cost));
  dot('fleet', false);
  dot('base', G.fleetOpen() && s.missions.length < G.docks() && RUNS.some(r => G.idlePower() >= r.need) && tab !== 'base');
  document.querySelector('nav button[data-t="fleet"]')?.classList.toggle('lockd', !G.fleetOpen());
  $('#dmPill').style.display = s.dm > 0 || s.warps > 0 ? '' : 'none';
}

// ---------- loop ----------
let prev = performance.now(), acc = 0, lastSlow = 0, oreFlyT = 0, tickSlow = 0, navFlyT = 0;
const shown = Object.fromEntries(RES_ORDER.map(r => [r, 0])) as Record<Res, number>;
const lastRes = { ...st().res };
let lastFr = false;
function frame(now: number) {
  const dt = Math.min(0.25, (now - prev) / 1000); prev = now; const s = st();
  const ev = G.tick(dt);
  for (const e of ev) {
    const c = cards[e.i], d = MINES[e.i];
    if (e.lode && tab === 'base' && bv && !bv.rock) { const [x, y] = bv.slotScreen('m' + e.i); popup(x, y - 30, 'MOTHERLODE ×10', '#ffd23f'); burst(x, y, 24, 0, '#ffd23f'); sfx.lode(); }
    if (tab === 'base' && bv) { if (!bv.rock) baseEvent(e.i, e.v, e.ct, now); else acc += e.v; continue; }
    if (c && e.ct > 0.3) {
      const [x, y] = center(c.ico); popup(x, y - 40, '+$' + fmt(e.v));
      fly(x, y, ...center(cashEl), Math.min(6, 2 + (e.i >> 1)), 1, '#ffc94a', () => bump(cashEl));
      if (now - oreFlyT > 150) { oreFlyT = now; fly(x, y, ...center(resEl(d.res)), 2, 2, RES[d.res].color, () => bump(resEl(d.res))); }
      sfx.coin(); if (e.i >= 3 && e.ct > 4) { rocket(x, y - 10); sfx.launch(); }
    } else if (!c && tab !== 'mine' && now - navFlyT > 900) { navFlyT = now; const [x, y] = center(navBtn('mine')); fly(x, y - 10, ...center(resEl(d.res)), 2, 2, RES[d.res].color, () => bump(resEl(d.res))); acc += e.v; }
    else acc += e.v;
  }
  if (now - lastSlow > 600) { lastSlow = now; if (acc > 0 && tab === 'mine' && G.perSec() > 0) { const r = cashEl.getBoundingClientRect(); popup(r.right + 14, r.top + 22, '+$' + fmt(acc), '#5cf2ff'); } acc = 0; }
  // header
  setT(cashEl, '$' + fmt(s.cash));
  setT(rateEl, G.perSec() > 0 ? `+$${fmt(G.perSec())}/s` : !s.taps ? 'Tap a mine to start' : s.life < 500 ? 'Tap mines to earn' : 'Hire a foreman on a mine to automate it');
  setT($('#dm'), fmt(s.dm, 0));
  const fr = !!bv?.rock && tab === 'base'; $('#res').classList.toggle('fleet', fr); const snap = fr !== lastFr; lastFr = fr; RES_ORDER.forEach(r => { const src = fr ? s.fstock : s.res; if (snap) shown[r] = src[r]; shown[r] += (src[r] - shown[r]) * Math.min(1, dt * 10); if (fr && !G.FLEET_RES.includes(r)) { resEl(r).classList.add('hide'); return; } const el = resEl(r); setT($('span', el), fmt(shown[r])); el.classList.toggle('hide', fr ? src[r] < .5 && s.made[r] === 0 : s.res[r] < 0.5 && s.made[r] === 0 && !MINES.some((m, i) => m.res === r && s.mines[i].n)); });
  if (tab === 'base' && bv) { bv.draw(dt); updateSheet(); }
  if (tab === 'mine') updateMine(); else if (tab === 'fac') updateFac();
  if (now - tickSlow > 400) {
    const span = (now - tickSlow) / 1000; tickSlow = now;
    RES_ORDER.forEach(r => { const f = (s.res[r] - lastRes[r]) / span; flow[r] = flow[r] * 0.6 + f * 0.4; lastRes[r] = s.res[r]; });
    dots(); missionsTick(); checkAch(); disclose(); explain(); updateGoal(); if (tab === 'fleet') updateFleet();
    if (tab === 'crew') main.querySelectorAll<HTMLButtonElement>('[data-m]').forEach(b => { const i = +b.dataset.m!; b.disabled = s.cash < MINES[i].mgr || !s.mines[i].n; b.classList.toggle('afford', !b.disabled); });
  }
  stepFx(dt, now);
  requestAnimationFrame(frame);
}

// ---------- progressive disclosure + Commander ----------
const seen = (id: string) => (st().seen ||= []).includes(id);
const mark = (id: string) => { if (!seen(id)) st().seen.push(id); };
function intro(id: string, beats: (string | { t: string; h?: string })[], focus?: string) { if (seen(id) || document.querySelector('#sheet.open, .modal, .tree')) return; if (focus && bv && ((slotByKey(focus)?.rock || 0) !== bv.rock || bv.travelT >= 0)) return; mark(id); if (focus && bv && tab === 'base') bv.focus(focus); say(id, beats); }
function disclose() {
  const s = st();
  app.classList.toggle('nonav', s.goal < 9 && !s.warps);
  $('#trophy').style.visibility = s.ach.length && s.goal >= 9 ? '' : 'hidden';
  $('#res').classList.toggle('hide', s.goal < 1 && !s.warps);
}
function explain() {
  const s = st(); if (talking()) return;
  if (s.goal >= 2 || s.warps) intro('factory', [{ h: 'REFINE', t: 'Raw ore is cheap. A <b>Smelter</b> turns it into <b>ingots</b> – worth far more. Conveyors carry the ore over by themselves.' }], 'f0');
  if (s.mach[0] && G.powerDemand() >= G.powerSupply() * .75) intro('power', [{ h: 'POWER', t: 'Every factory draws power. When buildings flash <b>' + I.bolt + '</b>, upgrade the <b>Fusion Generator</b>.' }], 'gen');
  if (s.goal >= 4 || s.tech.length) intro('lab', [{ h: 'RESEARCH', t: 'The <b>Lab</b> trades cash and goods for permanent profit boosts. Spend ingots here!' }], 'lab');
  if (s.goal >= 7) intro('export', [{ h: 'EXPORT', t: 'Got spare goods? Export them at <b>HQ</b>. I never sell what your factory still needs.' }], 'hq');
  if (s.goal >= 8) intro('foreman', [{ h: 'AUTOMATE', t: 'Tired of tapping? Hire a <b>foreman</b> on any mine and it runs forever – even while you are away.' }], 'm0');
  if (s.mines.some(x => x.n >= 25)) intro('tiers', [{ t: 'Look at that! Buildings <b>evolve</b> at milestone levels: 25, 100, 300… Bigger, shinier, faster.' }]);
  if (G.cmdLevel().lv >= 2) intro('skills', [{ h: 'COMMANDER', t: 'You just ranked up! Every <b>Commander level</b> earns a skill point. Tap your <b>rank badge</b> (top left) to open the skill tree.' }, { t: 'Skills stay with you forever – even through warps. Pick a branch that fits how you play.' }]);
  if (bv?.rock === 1) intro('rock2', [{ h: 'FLEET ROCK', t: 'Welcome to the <b>fleet asteroid</b>. The <b>Shipyard</b> builds ships, the <b>Hangar</b> stores them, <b>Docks</b> launch missions.' }, { t: 'Ships are paid from <b>fleet stock</b> (top bar) – whatever the lift has delivered. <b>Defenses</b> and the <b>Fuel Depot</b> upgrade the fleet.' }], 'yard');
  if (G.fleetOpen()) intro('fleet', [{ h: 'FLEET', t: 'We bought a second rock! The <b>Cargo Lift</b> ships goods up to our new <b>fleet asteroid</b>.' }, { t: 'The lift hauls spare <b>Parts, Alloy and Chips</b> up by itself – upgrade it to haul faster. Then fly over with the button on the right.' }], 'lift');
  if (G.warpOpen()) intro('warp', [{ h: 'WARP', t: 'The <b>Warp Gate</b> is charged. Warping resets this sector but pays <b>Dark Matter</b> – a permanent multiplier on everything.' }], 'gate');
}
function storyIntro() {
  if (seen('intro') || st().life > 0) { mark('intro'); return; }
  mark('intro');
  say('intro', [
    { t: 'Commander! Welcome to <b>Void Reigen</b>. This lonely rock is ours now – let’s turn it into an empire.' },
    { h: '① MINE', t: '<b>Tap</b> your drill to dig ore. Every load becomes cash.' },
    { h: '② REFINE · ③ UPGRADE', t: 'Factories turn ore into pricier goods. Reinvest to <b>level up</b> buildings – they evolve as they grow.' },
    { h: '④ AUTOMATE', t: 'Hire foremen and your base runs itself. Then: ships, planets… the whole sector. Tap the drill to begin!' },
  ], { skip: true, done: () => bv?.focus('m0') });
}

// ---------- offline ----------
function offline() {
  const secs = Math.min(G.offlineCap(), (Date.now() - st().last) / 1000);
  if (secs < 30) return; if (G.perSec() <= 0 && !st().mach.some(Boolean) && !st().missions.length) return;
  const r = G.simulateOffline(secs); st().last = Date.now(); missionsTick();
  if (r.cash <= 1 && RES_ORDER.every(x => r.delta[x] <= 0.5)) return;
  document.querySelector('.modal.wb')?.remove();
  const lines = RES_ORDER.filter(x => r.delta[x] > 0.5).map(x => `<span style="color:${RES[x].color}">${ri(x)} +${fmt(r.delta[x])}</span>`).join('');
  const m = modal(`<div class="hero art-hero">${art('cruiser')}</div><h2 class="h">Welcome back, Commander</h2><p>Your crew worked for ${fmtT(secs)}${secs >= G.offlineCap() ? ` (max ${G.offlineCap() / 3600}h)` : ''}.</p><div class="amt">+$${fmt(r.cash)}</div><div class="loot">${lines}</div><button class="btn gold big" id="col">Collect</button>`); m.classList.add('wb');
  $('#col', m).addEventListener('click', ev => { m.remove(); sfx.fanfare(); buzz([30, 40, 80]); fly(ev.clientX, ev.clientY, ...center(cashEl), 24, 1, '#ffc94a', () => bump(cashEl)); burst(ev.clientX, ev.clientY, 30); G.save(); });
}

$('#back').addEventListener('click', () => { sfx.tap(); setTab('base'); });
setTab('base'); disclose(); offline(); setTimeout(storyIntro, 600); requestAnimationFrame(frame);
setInterval(G.save, 5000);
addEventListener('visibilitychange', () => { if (document.hidden) G.save(); else { prev = performance.now(); offline(); } });
addEventListener('pagehide', G.save);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').catch(() => {});
void MILESTONES;

// ---------- Commander rank + skill tree ----------
function xp(n: number, x = 60, y = 60) {
  const up = G.gainXp(n); const b = $('#cmdbadge'); if (st().goal >= 2) { fly(x, y, ...center(b), 3, 1, '#7affd1', () => bump(b)); }
  if (up) setTimeout(() => { sfx.rank(); buzz([30, 40, 80]); const [bx, by] = center(b); burst(bx, by, 40, 0, '#7affd1'); toast(`Commander rank ${G.cmdLevel().lv}! +1 skill point`); bump(b); }, 700);
  cmdHud();
}
function cmdHud() {
  const L = G.cmdLevel(), pts = G.skillPoints(); $('#cmdlv').textContent = String(L.lv);
  ($('#cmdring') as unknown as SVGCircleElement).style.strokeDashoffset = String(94.2 * (1 - L.into / L.need));
  $('#cdot').style.display = pts > 0 ? 'block' : 'none'; $('#cmdbadge').classList.toggle('pulse', pts > 0);
  $('#cmdbadge').style.visibility = st().goal >= 2 || st().xp > 0 || st().warps ? '' : 'hidden';
}
let treeSel: string | null = null;
function openTree() { closeSheet();
  sfx.select(); const m = document.createElement('div'); m.className = 'tree'; document.body.appendChild(m);
  const draw = () => {
    const s = st(), L = G.cmdLevel(), pts = G.skillPoints();
    const node = (id: string) => { const d = SKILLS.find(x => x.id === id)!, br = BRANCHES[d.br], has = G.sk(id), can = G.canLearn(id), lockLv = L.lv < LEVEL_GATE[d.tier];
      return `<button class="tn2 ${has ? 'has' : can ? 'can' : 'lock'} ${treeSel === id ? 'sel' : ''}" data-sk="${id}" style="--c:${br.color}"><span class="ta">${art(d.art)}</span>${lockLv && !has ? `<em>Rank ${LEVEL_GATE[d.tier]}</em>` : ''}</button>`; };
    const d = treeSel ? SKILLS.find(x => x.id === treeSel)! : null;
    m.innerHTML = `<div class="thead"><button class="x" data-tx>✕</button><div class="trank"><div class="tbadge">${L.lv}</div><div><small>COMMANDER RANK</small><b>Vex's Protégé</b><div class="tbar"><i style="width:${L.into / L.need * 100}%"></i></div><small>${fmt(L.into, 0)} / ${fmt(L.need, 0)} XP</small></div></div><div class="tpts ${pts ? 'on' : ''}"><b>${pts}</b><small>points</small></div></div>
    <div class="tgrid">${BRANCHES.map((br, bi) => `<div class="tcol" style="--c:${br.color}"><div class="tbr">${art(br.art)}<b>${br.name}</b></div>${SKILLS.filter(x => x.br === bi).sort((a, b) => a.tier - b.tier).map((x, k) => (k ? `<div class="tlink ${G.sk(x.id) ? 'on' : ''}"></div>` : '') + node(x.id)).join('')}</div>`).join('')}</div>
    <div class="tinfo">${d ? `<div class="ti2" style="--c:${BRANCHES[d.br].color}"><span class="ta">${art(d.art)}</span><div><small>${BRANCHES[d.br].name.toUpperCase()} · TIER ${d.tier + 1}</small><b>${d.name}</b><p>${d.desc}</p></div></div>${G.sk(d.id) ? `<button class="btn big" disabled>Learned ${I.check}</button>` : `<button class="btn gold big" data-learn ${G.canLearn(d.id) ? '' : 'disabled'}>${L.lv < LEVEL_GATE[d.tier] ? `Reach rank ${LEVEL_GATE[d.tier]}` : d.tier && !SKILLS.some(x => x.br === d.br && x.tier === d.tier - 1 && G.sk(x.id)) ? 'Learn the skill above first' : pts ? 'Learn · 1 point' : 'No points – rank up!'}</button>`}` : `<p class="muted">Rank up by claiming goals, earning trophies, conquering planets and warping. Each rank = 1 skill point. Skills are permanent.</p>`}</div>`;
    m.querySelector('[data-tx]')!.addEventListener('click', () => { sfx.tap(); m.classList.add('out'); setTimeout(() => m.remove(), 200); cmdHud(); });
    m.querySelectorAll<HTMLElement>('[data-sk]').forEach(b => b.addEventListener('click', () => { treeSel = b.dataset.sk!; sfx.select(); draw(); }));
    m.querySelector('[data-learn]')?.addEventListener('click', ev => { if (!treeSel || !G.learn(treeSel)) return; const e = ev as MouseEvent; sfx.claim(); buzz([20, 30, 60]); burst(e.clientX, e.clientY, 30, 0, BRANCHES[SKILLS.find(x => x.id === treeSel)!.br].color); G.save(); draw(); const nb = m.querySelector(`[data-sk="${treeSel}"]`); nb?.classList.add('learnt'); cmdHud(); });
  };
  draw();
}
$('#cmdbadge').addEventListener('click', openTree);
setBusy(() => st().missions.length);
// rock switch (mining ⇄ fleet asteroid)
const rockBtn = $('#rockbtn');
function rockHud() { const show = !!bv && tab === 'base' && G.fleetOpen() && bv.travelT < 0; rockBtn.style.display = show ? '' : 'none'; if (!bv) return; rockBtn.innerHTML = bv.rock ? `${art('drill')}<span>Mining<br>Rock</span>` : `${art('cruiser')}<span>Fleet<br>Rock</span>`; }
rockBtn.addEventListener('click', () => { if (!bv) return; closeSheet(); sfx.launch(); buzz([20, 30]); bv.travel(bv.rock ? 0 : 1); });
setInterval(() => { if (bv && !bv.rock && tab === 'base' && G.fleetOpen() && st().liftOn && Math.random() < .25) { const j = MACHINES.findIndex((d, j) => st().mach[j] > 0 && G.FLEET_RES.includes(d.out) && G.liftRate(d.out) > 0 && Math.random() < .5); if (j >= 0) bv.drone('f' + j, 'lift', RES[MACHINES[j].out].color); } }, 300);
setInterval(() => { rockHud(); cmdHud(); if (bv) { rockBtn.classList.remove('pulse'); const sl = wantGuide ? slotByKey(wantGuide) : null; if (!sl) bv.guide = null; else if ((sl.rock || 0) === bv.rock) bv.guide = wantGuide; else if (!bv.rock) bv.guide = 'lift'; else { bv.guide = null; rockBtn.classList.add('pulse'); } } }, 300);

// subtle day/night dial: sun ↔ moon on a little arc, shows the Night Shift bonus when it applies
const dnEl = $('#dn'); let dnLast = '';
setInterval(() => { const n = G.nightness(), ph = G.nightPhase(), k = n > .5 ? 'moon' : 'sun', bonus = n > .3 && G.sk('iNight'); const key = k + bonus + Math.round(ph * 40);
  if (key === dnLast) return; dnLast = key; const a = ph * Math.PI * 2, x = 14 + Math.sin(a) * 8, y = 15 - Math.cos(a) * 5;
  dnEl.innerHTML = `<svg viewBox="0 0 28 22"><path d="M3 18a11 9 0 0 1 22 0" fill="none" stroke="#ffffff22" stroke-width="2" stroke-dasharray="2 3"/>${k === 'sun' ? `<circle cx="${x}" cy="${y}" r="4.5" fill="#ffd23f" stroke="#24163a" stroke-width="1.5"/>` : `<path d="M${x + 1} ${y - 5}a5 5 0 1 0 4 7a4 4 0 0 1-4-7z" fill="#cfe6ff" stroke="#24163a" stroke-width="1.5"/>`}</svg>${bonus ? '<b>×2</b>' : ''}`;
  dnEl.title = n > .5 ? 'Night' : 'Day'; dnEl.classList.toggle('night', n > .5); }, 500);

(window as unknown as { __renderSfx: unknown }).__renderSfx = async (n: string) => Array.from(await renderSfx(n as never));

// ---------- overlay manager: ONE foreground thing at a time ----------
// priority: modal / skill tree  >  Vex  >  building panel  >  toasts. HUD auto-hides what isn't needed right now.
const fgModal = () => !!document.querySelector('.modal, .tree');
setGate(fgModal);
setToastGate(() => fgModal() || talking() || !!document.querySelector('#sheet.open'));
setInterval(() => { const b = document.body, sheet = !!document.querySelector('#sheet.open'); b.classList.toggle('fg-sheet', sheet); b.classList.toggle('fg-modal', fgModal()); }, 120);
