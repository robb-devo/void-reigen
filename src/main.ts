import './fonts';
import './style.css';
import { MINES, MACHINES, TECH, SHIPS, PLANETS, RUNS, RES, RES_ORDER, GEN, FLEET_UPG, MILESTONES, Res } from './game/data';
import * as G from './game/state';
import { GOALS, goalReward, ACHS } from './game/progress';
import { sfx, buzz, initFx, stepFx, burst, fly, popup, toast, rocket, flash } from './game/fx';

G.load();
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
const costStr = (c: Partial<Record<Res, number>>) => (Object.keys(c) as Res[]).map(r => `<span class="cs ${st().res[r] >= c[r]! ? '' : 'short'}">${RES[r].e}${fmt(c[r]!)}</span>`).join('');

// ---------- shell ----------
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const app = $('#app');
const TABS: [string, string, string][] = [['mine', '⛏️', 'Asteroid'], ['fac', '🏭', 'Factory'], ['crew', '👨‍🚀', 'Crew'], ['fleet', '🚀', 'Fleet'], ['warp', '🌀', 'Warp']];
app.innerHTML = `<canvas id="stars"></canvas>
<header><div class="toprow"><button class="iconbtn" id="trophy">🏆<i class="dot" id="tdot"></i></button><div class="title h">STARFORGE<span id="dmPill">🌀 <b id="dm">0</b></span></div><button class="iconbtn" id="mute"></button></div>
<div id="cash" class="h">$0</div><div id="rate"></div>
<div class="res" id="res">${RES_ORDER.map(r => `<div class="rc" data-r="${r}" style="--c:${RES[r].color}"><i>${RES[r].e}</i><span>0</span></div>`).join('')}</div></header>
<div id="goal"></div>
<main id="main"></main>
<nav>${TABS.map(([t, e, n]) => `<button data-t="${t}"><em>${e}</em>${n}<i class="dot"></i></button>`).join('')}</nav>
<canvas id="fx"></canvas>`;
const main = $('#main'), cashEl = $('#cash'), rateEl = $('#rate'), goalEl = $('#goal');
initFx($<HTMLCanvasElement>('#fx'), $<HTMLCanvasElement>('#stars'));
const resEl = (r: Res) => $(`.rc[data-r="${r}"]`);
const navBtn = (t: string) => $(`nav button[data-t="${t}"]`);
let tab = 'mine';
const cache = new WeakMap<HTMLElement, string>();
function setT(el: HTMLElement | null, v: string, html = false) { if (!el || cache.get(el) === v) return; cache.set(el, v); html ? (el.innerHTML = v) : (el.textContent = v); }
const center = (el: Element): [number, number] => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
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
  goalEl.innerHTML = `<div class="goal ${done ? 'ready' : ''}"><div class="gi">${done ? '🎁' : '🎯'}</div><div class="gm"><small>GOAL ${s.goal + 1}/${GOALS.length}</small><b>${g.text}</b>${g.prog && !done ? `<div class="gp"><i style="width:${Math.min(100, g.prog()[0] / g.prog()[1] * 100)}%"></i></div>` : ''}</div>${done ? `<button class="btn gold" id="claim">${g.reward ? 'Claim $' + fmt(goalReward(g)) : 'Next'}</button>` : g.tab !== tab ? `<button class="btn ghost go" data-go="${g.tab}">Go ›</button>` : ''}</div>`;
  $('#claim')?.addEventListener('click', ev => { const r = goalReward(g); G.earn(r); s.goal++; sfx.fanfare(); buzz([20, 30, 50]); burst(ev.clientX, ev.clientY, 30); if (r) fly(ev.clientX, ev.clientY, ...center(cashEl), 12, 1, '#ffc94a', () => bump(cashEl)); renderGoal(); spotlight(); });
  $('[data-go]', goalEl)?.addEventListener('click', () => { sfx.tap(); setTab(g.tab); });
}
let goalKey = '';
function updateGoal() {
  const g = GOALS[st().goal]; const key = g ? `${st().goal}|${g.done()}|${tab}|${g.prog ? Math.floor(g.prog()[0]) : ''}` : 'x';
  if (key !== goalKey || goalIdx !== st().goal) { const wasDone = goalKey.split('|')[1] === 'false' && g?.done(); goalKey = key; renderGoal(); spotlight(); if (wasDone) { sfx.fanfare(); buzz(30); bump(goalEl); } }
}
function spotlight() {
  document.querySelectorAll('.coach').forEach(e => e.classList.remove('coach'));
  const g = GOALS[st().goal]; if (!g || g.done() || g.tab !== tab || !g.focus || st().goal > 12) return;
  document.querySelector(g.focus)?.classList.add('coach');
}

// ---------- ASTEROID ----------
type Card = { root: HTMLElement; fill: HTMLElement; bt: HTMLElement; buy: HTMLButtonElement; lvl: HTMLElement; ms: HTMLElement; msl: HTMLElement; time: HTMLElement; mgr: HTMLElement; ico: HTMLElement };
let cards: Card[] = [];
const visibleMines = () => { let k = 0; for (let i = 0; i < MINES.length; i++) { k = i + 1; if (st().mines[i].n === 0) break; } return Math.min(MINES.length, k + 1); };
function renderMine() {
  main.innerHTML = `<div class="buyrow"><div class="hint"></div>${multBtn()}</div>`;
  cards = [];
  for (let i = 0; i < visibleMines(); i++) {
    const d = MINES[i], el = document.createElement('div'); el.className = 'biz'; el.style.animationDelay = i * 35 + 'ms'; el.style.setProperty('--h', String(d.hue));
    el.innerHTML = `<div class="ico"><b>${d.e}</b><span class="lvl">0</span><span class="mgr"></span></div><div class="mid"><div class="name"><span>${d.name}</span><small></small></div><div class="bar"><div class="fill"></div><span></span></div><div class="sub"><div class="ms"><i></i></div><div class="time"></div></div></div><button class="buy"></button>`;
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
  if (st().cash < c || (G.BUY[st().mult] === -1 && G.maxBuy(i) < 1)) return deny(cards[i].buy);
  const before = G.msIdx(st().mines[i].n), wasZero = st().mines[i].n === 0;
  st().cash -= c; st().mines[i].n += k; sfx.buy(); buzz(12);
  burst(ev.clientX, ev.clientY, 10); popup(ev.clientX, ev.clientY - 10, `+${k}`, '#5cf2ff'); bump(cards[i].ico);
  const n = G.msIdx(st().mines[i].n);
  if (n > before) celebrate(`${MINES[i].e} ${MINES[i].name}: ${n <= 6 ? 'Speed' : 'Profit'} ×2!`);
  if (wasZero) { celebrate(`${MINES[i].e} ${MINES[i].name} online!`, ev.clientX, ev.clientY); renderMine(); spotlight(); }
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
    setT(c.bt, b.n ? `$${fmt(G.revenue(i))}  ${RES[d.res].e}${fmt(G.orePerCycle(i))}` : `${RES[d.res].e} ${RES[d.res].name}`);
    c.root.classList.toggle('idle', !!b.n && !active);
    setT(c.time, b.n ? (active ? fmtT(ct * (1 - Math.min(1, b.p))) : 'TAP') : '');
    const lo = G.prevMs(b.n), hi = G.nextMs(b.n);
    c.ms.style.width = (hi ? (b.n - lo) / (hi - lo) * 100 : 100) + '%';
    setT(c.msl, hi ? `${b.n}/${hi} ${G.msIdx(b.n) < 6 ? '⚡' : '💰'}` : 'MAX');
    setT(c.mgr, b.m ? '🤖' : '');
  });
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
  <div class="gen card"><div class="ico sm" style="--h:55">${GEN.e}</div><div class="mid"><div class="name">${GEN.name} <small class="glv"></small></div><div class="pbar"><i></i><span></span></div></div><button class="btn"></button></div>
  <div class="sec">Production chain <span class="sech">tap ⏸ to reroute inputs</span></div><div id="chain"></div>
  <div class="sec">Market</div><div class="market">${RES_ORDER.map(r => `<button class="mk" data-sell="${r}" style="--c:${RES[r].color}"><i>${RES[r].e}</i><b></b><small></small></button>`).join('')}</div>
  <div class="sec">Research</div><div id="tech"></div>`;
  const chain = $('#chain');
  MACHINES.forEach((d, j) => {
    const el = document.createElement('div'); el.className = 'mach'; el.dataset.j = String(j); el.style.animationDelay = j * 40 + 'ms';
    if (!G.machUnlocked(j)) { el.classList.add('locked'); el.innerHTML = `<div class="lockmsg">🔒 <b>${d.e} ${d.name}</b><br><small>unlocks at $${fmt(d.unlock)} lifetime earnings</small></div>`; chain.appendChild(el); return; }
    const ins = (Object.keys(d.inp) as Res[]);
    el.innerHTML = `<div class="mhead"><div class="ico sm">${d.e}</div><div class="mid"><div class="name">${d.name} <small class="lv"></small></div><p class="info"></p></div><button class="tog"></button></div>
    <div class="line"><div class="ins">${ins.map(r => `<div class="node" data-in="${r}" style="--c:${RES[r].color}">${RES[r].e}<small>×${d.inp[r]}</small></div>`).join('')}</div><div class="belt"><div class="items">${ins.map(r => `<i>${RES[r].e}</i>`).join('').repeat(Math.ceil(6 / ins.length)).slice(0)}</div></div><div class="node machine">${d.e}<div class="eff"></div></div><div class="belt"><div class="items">${`<i>${RES[d.out].e}</i>`.repeat(6)}</div></div><div class="node" style="--c:${RES[d.out].color}">${RES[d.out].e}</div></div>
    <button class="btn wide"></button>`;
    chain.appendChild(el);
    const row: Row = { root: el, info: $('.info', el), btn: $<HTMLButtonElement>('.btn', el), tog: $('.tog', el), eff: $('.eff', el), lv: $('.lv', el) };
    facRows[j] = row;
    row.btn.addEventListener('click', ev => {
      const k = G.machK(j), c = G.machCostK(j, k); if (s.cash < c) return deny(row.btn);
      const lb = Math.floor(s.mach[j] / 10), first = s.mach[j] === 0; s.cash -= c; s.mach[j] += k; sfx.buy(); sfx.clank(); buzz(14); burst(ev.clientX, ev.clientY, 16, 0, RES[d.out].color);
      if (first) { celebrate(`${d.e} ${d.name} built!`); renderFac(); spotlight(); return; }
      if (Math.floor(s.mach[j] / 10) > lb) celebrate(`${d.e} ${d.name} Lv ${s.mach[j]}: output ×2!`);
      if (d.id === 'press' && s.mach[j] >= 3 && s.mach[j] - k < 3) celebrate('🚀 Shipyard unlocked! Check the Fleet tab');
    });
    row.tog.addEventListener('click', () => { s.on[j] = !s.on[j]; sfx.tap(); buzz(8); });
  });
  const gb = $<HTMLButtonElement>('.gen .btn');
  gb.addEventListener('click', ev => { const k = G.genK(), c = G.genCost(k); if (s.cash < c) return deny(gb); s.cash -= c; s.gen += k; sfx.buy(); tone2(); buzz(14); burst(ev.clientX, ev.clientY, 14, 0, '#ffe066'); });
  main.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach(b => b.addEventListener('click', () => { const r = b.dataset.sell as Res; if (s.res[r] < 1) return deny(b); const v = G.sell(r); sfx.buy(); sfx.coin(); buzz(14); const [x, y] = center(b); popup(x, y - 20, '+$' + fmt(v)); fly(x, y, ...center(cashEl), 8, 1, '#ffc94a', () => bump(cashEl)); }));
  techBtns = [];
  const list = TECH.filter(t => !s.tech.includes(t.id)).slice(0, 8), tech = $('#tech');
  tech.innerHTML = list.map(t => `<div class="row"><div class="ico sm" style="--h:${t.tgt < 0 ? 50 : MINES[t.tgt].hue}">${t.tgt < 0 ? '🌟' : MINES[t.tgt].e}</div><div class="mid"><div class="name sm">${t.name}</div><p>${t.tgt < 0 ? 'All mines' : MINES[t.tgt].name} profit <b class="x">×${t.x}</b></p></div><button class="btn gold tb" data-u="${t.id}">$${fmt(t.cash)}<b>${RES[t.res].e}${fmt(t.amt)}</b></button></div>`).join('') || '<p class="empty">All research complete. 🏆</p>';
  tech.querySelectorAll<HTMLButtonElement>('[data-u]').forEach(b => { const t = TECH.find(x => x.id === b.dataset.u)!; techBtns.push({ el: b, t }); b.addEventListener('click', ev => { if (s.cash < t.cash || s.res[t.res] < t.amt) return deny(b); s.cash -= t.cash; s.res[t.res] -= t.amt; s.tech.push(t.id); celebrate(`🔬 ${t.name}!`, ev.clientX, ev.clientY); renderFac(); }); });
}
function tone2() { sfx.clank(); }
function updateFac() {
  const s = st(), pe = G.powerEff(), sup = G.powerSupply(), dem = G.powerDemand();
  const g = $('.gen'); if (g) {
    setT($('.glv', g), `Lv ${s.gen}`); const pb = $('.pbar', g); $('i', pb).style.width = Math.min(100, dem / Math.max(sup, 1e-9) * 100) + '%'; pb.classList.toggle('over', dem > sup);
    setT($('span', pb), `⚡ ${fmt(dem)} / ${fmt(sup)}${dem > sup ? ` · machines at ${Math.round(pe * 100)}%` : ''}`);
    const k = G.genK(), c = G.genCost(k), b = $<HTMLButtonElement>('.btn', g); setT(b, `+${fmt(GEN.power * k)}⚡<b>$${fmt(c)}</b>`, true); b.disabled = s.cash < c; g.classList.toggle('alert', dem > sup);
  }
  MACHINES.forEach((d, j) => {
    const r = facRows[j]; if (!r) return; const ms = G.machStats[j], rate = G.machRate(j);
    setT(r.lv, s.mach[j] ? `Lv ${s.mach[j]}` : '');
    const reason = !s.mach[j] ? `Turns ${Object.keys(d.inp).map(x => RES[x as Res].name).join(' + ')} into ${RES[d.out].name} · ⚡${d.power}/lvl`
      : ms.reason === 'off' ? '<em>Paused</em> – inputs flow to other machines'
      : ms.reason === 'starved' ? `<em>Starved</em> – needs more ${RES[ms.need!].e} ${RES[ms.need!].name}`
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
  main.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach(b => { const r = b.dataset.sell as Res; const has = s.res[r] >= 1 || s.made[r] > 0 || G.resPerSec(r) > 0; b.classList.toggle('gone', !has); setT($('b', b), '$' + fmt(s.res[r] * G.price(r))); setT($('small', b), `${flow[r] >= 0 ? '+' : ''}${fmt(flow[r])}/s`); $('small', b).classList.toggle('neg', flow[r] < -0.01); b.disabled = s.res[r] < 1; });
  techBtns.forEach(({ el, t }) => { const ok = s.cash >= t.cash && s.res[t.res] >= t.amt; el.disabled = !ok; el.classList.toggle('afford', ok); });
}

// ---------- CREW ----------
function renderCrew() {
  const s = st();
  main.innerHTML = `<div class="sec">Foremen run mines forever – even offline</div>` + MINES.map((d, i) => `<div class="row ${s.mines[i].m ? 'done' : ''} ${!s.mines[i].n && !s.mines[i].m ? 'dim' : ''}"><div class="ico sm" style="--h:${d.hue}">${s.mines[i].m ? '🤖' : d.e}</div><div class="mid"><div class="name">${d.mname}</div><p>${s.mines[i].n ? `Automates ${d.name}` : `Build ${d.name} first`}</p></div>${s.mines[i].m ? '<span class="ok">✓ Hired</span>' : `<button class="btn" data-m="${i}">$${fmt(d.mgr)}</button>`}</div>`).join('');
  main.querySelectorAll<HTMLButtonElement>('[data-m]').forEach(b => b.addEventListener('click', ev => { const i = +b.dataset.m!; if (!s.mines[i].n) { toast('Build that mine first!'); return deny(b); } if (s.cash < MINES[i].mgr) return deny(b); s.cash -= MINES[i].mgr; s.mines[i].m = true; celebrate(`🤖 ${MINES[i].mname} hired!`, ev.clientX, ev.clientY); renderCrew(); }));
  spotlight();
}

// ---------- FLEET ----------
let greed = 1.4;
function renderFleet() {
  const s = st();
  if (!G.fleetOpen()) { main.innerHTML = `<div class="gate card"><div class="hero">🔒🚀</div><h2 class="h">Shipyard offline</h2><p>Upgrade the <b>Parts Press to Lv 3</b> to build ships. Salvage runs bring back goods; conquered planets boost profit and ore forever.</p><div class="gbar"><i style="width:${Math.min(100, s.mach[2] / 3 * 100)}%"></i></div><small>${s.mach[2]}/3</small></div>`; return; }
  main.innerHTML = `<div class="power card"><div><small>FLEET POWER</small><b class="h" id="fp"></b></div><div class="docks" id="docks"></div></div>
  <div class="seg"><span>Send</span>${[[1, 'Lean ×1'], [1.4, 'Safe ×1.4'], [2, 'Overwhelming ×2']].map(([g, n]) => `<button data-greed="${g}" class="${greed === g ? 'on' : ''}">${n}</button>`).join('')}</div>
  <div id="missions"></div>
  <div class="sec">Salvage runs <span class="sech">repeatable</span></div>${RUNS.map(r => `<div class="row mis" data-run="${r.id}"><div class="ico sm">${r.e}</div><div class="mid"><div class="name">${r.name}</div><p>⚔️${r.need} · ${fmtT(G.missionTime(r.time))} · <span class="lootp" data-loot="${r.id}"></span></p><p class="ch"></p></div><button class="btn"></button></div>`).join('')}
  <div class="sec">Conquest <span class="sech">permanent bonuses</span></div>${PLANETS.map((p, k) => { const done = s.conquered.includes(p.id), open = k === 0 || s.conquered.includes(PLANETS[k - 1].id);
    return `<div class="row mis planet ${done ? 'done' : ''} ${!open ? 'dim' : ''}" data-planet="${p.id}"><div class="ico sm">${p.e}</div><div class="mid"><div class="name">${open ? p.name : 'Unknown world'}</div><p>${done ? `🏳️ Yours · profit ×${p.bonus}, ore +50%` : open ? `${p.desc}<br>⚔️${p.need} · ${fmtT(G.missionTime(p.time))} · profit <b class="x">×${p.bonus}</b>` : 'Conquer the previous planet'}</p><p class="ch"></p></div>${done ? '<span class="ok">🏳️</span>' : open ? '<button class="btn gold"></button>' : ''}</div>`; }).join('')}
  <div class="sec">Shipyard</div>${SHIPS.map(sh => `<div class="row" data-ship="${sh.id}"><div class="ico sm">${sh.e}</div><div class="mid"><div class="name">${sh.name} <small class="own"></small></div><p>⚔️ ${sh.power} power</p></div><button class="btn sb"></button></div>`).join('')}
  <div class="sec">Fleet upgrades</div>${FLEET_UPG.map(u => `<div class="row" data-fu="${u.id}"><div class="ico sm">${u.e}</div><div class="mid"><div class="name">${u.name} <small class="own"></small></div><p>${u.desc}</p></div><button class="btn gold sb"></button></div>`).join('')}`;
  main.querySelectorAll<HTMLElement>('[data-greed]').forEach(b => b.addEventListener('click', () => { greed = +b.dataset.greed!; sfx.tap(); buzz(6); main.querySelectorAll('[data-greed]').forEach(x => x.classList.toggle('on', x === b)); }));
  main.querySelectorAll<HTMLElement>('[data-ship]').forEach(row => { const id = row.dataset.ship!, b = $<HTMLButtonElement>('button', row); b.addEventListener('click', ev => { const c = G.shipCost(id); if (!G.canAfford(c)) return deny(b); G.pay(c); s.ships[id] = (s.ships[id] || 0) + 1; sfx.launch(); buzz([20, 20, 40]); rocket(ev.clientX, ev.clientY - 20); burst(ev.clientX, ev.clientY, 14); }); });
  main.querySelectorAll<HTMLElement>('[data-fu]').forEach(row => { const id = row.dataset.fu!, u = FLEET_UPG.find(x => x.id === id)!, b = $<HTMLButtonElement>('button', row); b.addEventListener('click', ev => { if (G.fu(id) >= u.max) return; const c = { [u.res]: G.fuCost(id) }; if (!G.canAfford(c)) return deny(b); G.pay(c); s.fupg[id] = G.fu(id) + 1; celebrate(`${u.e} ${u.name} Lv ${s.fupg[id]}`, ev.clientX, ev.clientY); renderFleet(); }); });
  main.querySelectorAll<HTMLElement>('.mis').forEach(row => { const b = row.querySelector<HTMLButtonElement>('button'); if (!b) return; const kind = row.dataset.run ? 'run' : 'planet', id = (row.dataset.run || row.dataset.planet)!; b.addEventListener('click', ev => { const m = G.launch(kind, id, greed); if (!m) { const def = kind === 'run' ? RUNS.find(r => r.id === id)! : PLANETS.find(p => p.id === id)!; toast(s.missions.length >= G.docks() ? 'All docks busy – upgrade Launch Docks' : `Need ⚔️${def.need} idle power`); return deny(b); } sfx.launch(); buzz([30, 30, 60]); const n = Math.min(5, Object.values(m.ships).reduce((a, x) => a + x, 0)); for (let k = 0; k < n; k++) setTimeout(() => rocket(ev.clientX - 40 + k * 20, ev.clientY), k * 110); renderFleet(); }); });
  updateFleet();
}
function updateFleet() {
  const s = st(); if (!G.fleetOpen() || !$('#fp')) return;
  setT($('#fp'), `${fmt(G.idlePower())} / ${fmt(G.totalPower())}`);
  setT($('#docks'), Array.from({ length: G.docks() }, (_, k) => `<i class="${k < s.missions.length ? 'busy' : ''}"></i>`).join('') + `<small>docks</small>`, true);
  setT($('#missions'), s.missions.map(m => { const def = m.kind === 'run' ? RUNS.find(r => r.id === m.target)! : PLANETS.find(p => p.id === m.target)!; const left = Math.max(0, (m.end - G.clock()) / 1000); return `<div class="active card"><div class="ico sm">${def.e}</div><div class="mid"><div class="name">${def.name} <small>${Math.round(m.chance * 100)}% · ⚔️${m.power}</small></div><div class="bar thin"><div class="fill" style="transform:scaleX(${1 - left / m.dur})"></div></div></div><div class="time">${fmtT(left)}</div></div>`; }).join(''), true);
  main.querySelectorAll<HTMLElement>('.mis').forEach(row => { const b = row.querySelector<HTMLButtonElement>('button'); if (!b) return; const id = (row.dataset.run || row.dataset.planet)!; const def = row.dataset.run ? RUNS.find(r => r.id === id)! : PLANETS.find(p => p.id === id)!; const busy = s.missions.some(m => m.target === id); const { power } = G.pickShips(Math.ceil(def.need * greed)); const ch = G.chanceFor(power, def.need);
    setT(b, busy ? 'En route' : s.missions.length >= G.docks() ? 'Docks full' : row.dataset.run ? 'Launch' : 'Invade'); b.disabled = busy || ch <= 0 || s.missions.length >= G.docks();
    setT(row.querySelector('.ch'), busy ? '' : ch > 0 ? `<span class="${ch > 0.9 ? 'good' : ch > 0.7 ? 'mid' : 'risk'}">${Math.round(ch * 100)}% success</span> with ⚔️${power}` : `<span class="risk">Need ⚔️${def.need} idle</span>`, true); });
  main.querySelectorAll<HTMLElement>('[data-loot]').forEach(el => { const r = RUNS.find(x => x.id === el.dataset.loot)!; setT(el, Object.entries(r.loot).map(([k, v]) => RES[k as Res].e + fmt(v! * (1 + s.conquered.length * 0.5) + G.prodRate(k as Res) * r.time * 1.5)).join(' ')); });
  main.querySelectorAll<HTMLElement>('[data-ship]').forEach(row => { const id = row.dataset.ship!, b = $<HTMLButtonElement>('button', row), c = G.shipCost(id); setT(b, costStr(c), true); b.disabled = !G.canAfford(c); setT($('.own', row), `${G.idle(id)}/${s.ships[id] || 0}`); });
  main.querySelectorAll<HTMLElement>('[data-fu]').forEach(row => { const id = row.dataset.fu!, u = FLEET_UPG.find(x => x.id === id)!, b = $<HTMLButtonElement>('button', row); const max = G.fu(id) >= u.max; setT($('.own', row), `Lv ${G.fu(id)}/${u.max}`); setT(b, max ? 'MAX' : costStr({ [u.res]: G.fuCost(id) }), true); b.disabled = max || !G.canAfford({ [u.res]: G.fuCost(id) }); });
}
function missionsTick() {
  for (const o of G.resolveMissions()) {
    const def = o.m.kind === 'run' ? RUNS.find(r => r.id === o.m.target)! : PLANETS.find(p => p.id === o.m.target)!;
    const lostN = Object.values(o.lost).reduce((a, b) => a + b, 0);
    if (o.ok && o.m.kind === 'planet') { flash(); sfx.warp(); celebrate(`🏳️ ${def.name} conquered! Profit ×${(def as typeof PLANETS[number]).bonus}`); }
    else if (o.ok) { sfx.fanfare(); buzz([20, 30]); toast(`${def.e} ${def.name}: loot secured!${lostN ? ` (−${lostN} ships)` : ''}`); if (o.loot) { const [x, y] = center(navBtn('fleet')); for (const r in o.loot) fly(x, y, ...center(resEl(r as Res)), 6, 2, RES[r as Res].color, () => bump(resEl(r as Res))); } }
    else { sfx.no(); buzz([60, 40, 60]); shakeEl(app); toast(`💥 ${def.name} failed – lost ${lostN} ship${lostN === 1 ? '' : 's'}`); }
    if (tab === 'fleet') renderFleet(); G.save();
  }
}

// ---------- WARP ----------
function renderWarp() {
  const s = st();
  if (!G.warpOpen()) { main.innerHTML = `<div class="gate card"><div class="hero">🌀</div><h2 class="h">Warp Drive dormant</h2><p>Reach <b>$100T lifetime earnings</b> to charge it. Warping resets this sector for <b>Dark Matter</b>: +2% profit, +1% ore & factory speed each — forever.</p><div class="gbar"><i style="width:${Math.min(100, Math.log10(G.allTime() + 1) / 14 * 100)}%"></i></div><small>$${fmt(G.allTime())} / $100T</small></div>` + stats(); return; }
  const g = G.dmGain();
  main.innerHTML = `<div class="nova card"><div class="sun">🌀</div><h2 class="h">Warp to a new sector</h2><p>Resets mines, factory, fleet and planets. Keeps <b style="color:var(--violet)">Dark Matter</b> and trophies.</p><div class="h gain">+${fmt(g, 0)} 🌀</div><button class="btn gold big" id="go" ${g < 1 ? 'disabled' : ''}>${g < 1 ? 'Next at $' + fmt(G.dmNext()) + ' all-time' : 'ENGAGE WARP'}</button></div>` + stats();
  $('#go')?.addEventListener('click', () => { if (G.dmGain() < 1) return; confirmModal('🌀', 'Engage warp?', `Reset this sector for +${fmt(G.dmGain(), 0)} Dark Matter.`, 'WARP', () => { const g = G.dmGain(), o = st(); G.setS(G.fresh({ dm: o.dm + g, total: o.total + o.life, warps: o.warps + 1, mute: o.mute, taps: o.taps, ach: o.ach, goal: GOALS.length - 1, sold: o.sold, played: o.played })); G.save(); sfx.warp(); buzz([50, 50, 100, 50, 200]); flash(); for (let k = 0; k < 5; k++) setTimeout(() => burst(Math.random() * innerWidth, Math.random() * innerHeight * .6, 40), k * 120); setTab('mine'); }); });
}
function stats() { const s = st(); return `<div class="sec">Stats</div><div class="card stats">${[['Dark Matter', `${fmt(s.dm, 0)} (+${Math.round(s.dm * 2)}%)`], ['Trophy bonus', `+${Math.round((G.achMul() - 1) * 100)}%`], ['Planet bonus', '×' + fmt(G.planetMul())], ['Earned this sector', '$' + fmt(s.life)], ['All-time', '$' + fmt(G.allTime())], ['Missions won / ships lost', `${s.wins} / ${s.lost}`], ['Play time', fmtT(s.played)], ['Taps', s.taps]].map(([a, b]) => `<div class="stat"><span>${a}</span><b>${b}</b></div>`).join('')}</div><div class="sec">Settings</div><button class="btn big ghost" id="reset">Reset save</button>`; }
document.addEventListener('click', e => { if ((e.target as HTMLElement).id === 'reset') confirmModal('🗑️', 'Reset everything?', 'Wipes all progress including Dark Matter and trophies.', 'Reset', () => { localStorage.removeItem(G.KEY); G.setS(G.fresh()); setTab('mine'); renderGoal(); }); });

// ---------- modals ----------
function modal(html: string) { const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="sheet">${html}</div>`; document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m) m.remove(); }); return m; }
function confirmModal(icon: string, title: string, txt: string, ok: string, fn: () => void) {
  const m = modal(`<div class="hero">${icon}</div><h2 class="h">${title}</h2><p>${txt}</p><div class="two"><button class="btn big ghost" data-x>Cancel</button><button class="btn gold big" data-ok>${ok}</button></div>`);
  m.querySelector('[data-x]')!.addEventListener('click', () => m.remove()); m.querySelector('[data-ok]')!.addEventListener('click', () => { m.remove(); fn(); });
}
$('#trophy').addEventListener('click', () => { sfx.tap(); const s = st(); const m = modal(`<h2 class="h">🏆 Trophies <small>${s.ach.length}/${ACHS.length}</small></h2><p>Each trophy: <b style="color:var(--mint)">+2% profit</b> forever</p><div class="achs">${ACHS.map(a => `<div class="ach ${s.ach.includes(a.id) ? 'got' : ''}"><i>${s.ach.includes(a.id) ? a.e : '🔒'}</i><b>${a.name}</b><small>${a.desc}</small></div>`).join('')}</div><button class="btn big" data-x>Close</button>`); m.querySelector('[data-x]')!.addEventListener('click', () => m.remove()); m.querySelector('.sheet')!.classList.add('tall'); });
function checkAch() { const s = st(); for (const a of ACHS) if (!s.ach.includes(a.id) && a.check(s)) { s.ach.push(a.id); sfx.fanfare(); buzz([20, 40, 20, 40]); toast(`🏆 ${a.name} · +2% profit`); bump($('#trophy')); burst(...center($('#trophy')), 24); } }

// ---------- tabs ----------
const RENDER: Record<string, () => void> = { mine: renderMine, fac: renderFac, crew: renderCrew, fleet: renderFleet, warp: renderWarp };
function setTab(t: string) { tab = t; document.querySelectorAll<HTMLElement>('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); main.scrollTop = 0; cards = []; facRows = []; techBtns = []; RENDER[t](); renderGoal(); spotlight(); main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter'); }
document.querySelectorAll<HTMLElement>('nav button').forEach(b => b.addEventListener('click', () => { if (tab !== b.dataset.t) { sfx.tap(); buzz(6); setTab(b.dataset.t!); } }));
const muteBtn = $('#mute'); const setMute = () => muteBtn.textContent = st().mute ? '🔇' : '🔊'; setMute();
muteBtn.addEventListener('click', () => { st().mute = !st().mute; setMute(); sfx.tap(); buzz(8); G.save(); });
function dots() {
  const s = st(), d = document.querySelectorAll<HTMLElement>('nav .dot'), nb = document.querySelectorAll<HTMLElement>('nav button');
  d[1].classList.toggle('show', MACHINES.some((m, j) => G.machUnlocked(j) && !s.mach[j] && s.cash >= m.cost) || TECH.some(t => !s.tech.includes(t.id) && s.cash >= t.cash && s.res[t.res] >= t.amt));
  d[2].classList.toggle('show', MINES.some((m, i) => !s.mines[i].m && s.mines[i].n && s.cash >= m.mgr));
  d[3].classList.toggle('show', G.fleetOpen() && s.missions.length < G.docks() && RUNS.some(r => G.idlePower() >= r.need));
  d[4].classList.toggle('show', G.warpOpen() && G.dmGain() >= Math.max(1, s.dm * 0.5));
  nb[3].classList.toggle('lockd', !G.fleetOpen()); nb[4].classList.toggle('lockd', !G.warpOpen());
  $('#dmPill').style.display = s.dm > 0 || s.warps > 0 ? '' : 'none';
}

// ---------- loop ----------
let prev = performance.now(), acc = 0, lastSlow = 0, oreFlyT = 0, tickSlow = 0, navFlyT = 0;
const shown = Object.fromEntries(RES_ORDER.map(r => [r, 0])) as Record<Res, number>;
const lastRes = { ...st().res };
function frame(now: number) {
  const dt = Math.min(0.25, (now - prev) / 1000); prev = now; const s = st();
  const ev = G.tick(dt);
  for (const e of ev) {
    const c = cards[e.i], d = MINES[e.i];
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
  setT(rateEl, G.perSec() > 0 ? `+$${fmt(G.perSec())}/s` : 'Tap mines to earn');
  setT($('#dm'), fmt(s.dm, 0));
  RES_ORDER.forEach(r => { shown[r] += (s.res[r] - shown[r]) * Math.min(1, dt * 10); const el = resEl(r); setT($('span', el), fmt(shown[r])); el.classList.toggle('hide', s.res[r] < 0.5 && s.made[r] === 0 && !MINES.some((m, i) => m.res === r && s.mines[i].n)); });
  if (tab === 'mine') updateMine(); else if (tab === 'fac') updateFac();
  if (now - tickSlow > 400) {
    const span = (now - tickSlow) / 1000; tickSlow = now;
    RES_ORDER.forEach(r => { const f = (s.res[r] - lastRes[r]) / span; flow[r] = flow[r] * 0.6 + f * 0.4; lastRes[r] = s.res[r]; });
    dots(); missionsTick(); checkAch(); updateGoal(); if (tab === 'fleet') updateFleet();
    if (tab === 'crew') main.querySelectorAll<HTMLButtonElement>('[data-m]').forEach(b => { const i = +b.dataset.m!; b.disabled = s.cash < MINES[i].mgr || !s.mines[i].n; b.classList.toggle('afford', !b.disabled); });
  }
  stepFx(dt, now);
  requestAnimationFrame(frame);
}

// ---------- offline ----------
function offline() {
  const secs = Math.min(8 * 3600, (Date.now() - st().last) / 1000);
  if (secs < 30) return; if (G.perSec() <= 0 && !st().mach.some(Boolean) && !st().missions.length) return;
  const r = G.simulateOffline(secs); st().last = Date.now(); missionsTick();
  if (r.cash <= 1 && RES_ORDER.every(x => r.delta[x] <= 0.5)) return;
  document.querySelector('.modal.wb')?.remove();
  const lines = RES_ORDER.filter(x => r.delta[x] > 0.5).map(x => `<span style="color:${RES[x].color}">${RES[x].e} +${fmt(r.delta[x])}</span>`).join('');
  const m = modal(`<div class="hero">🛰️</div><h2 class="h">Welcome back, Commander</h2><p>Your crew worked for ${fmtT(secs)}${secs >= 8 * 3600 ? ' (max 8h)' : ''}.</p><div class="amt">+$${fmt(r.cash)}</div><div class="loot">${lines}</div><button class="btn gold big" id="col">Collect</button>`); m.classList.add('wb');
  $('#col', m).addEventListener('click', ev => { m.remove(); sfx.fanfare(); buzz([30, 40, 80]); fly(ev.clientX, ev.clientY, ...center(cashEl), 24, 1, '#ffc94a', () => bump(cashEl)); burst(ev.clientX, ev.clientY, 30); G.save(); });
}

setTab('mine'); offline(); requestAnimationFrame(frame);
setInterval(G.save, 5000);
addEventListener('visibilitychange', () => { if (document.hidden) G.save(); else { prev = performance.now(); offline(); } });
addEventListener('pagehide', G.save);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').catch(() => {});
void MILESTONES;
