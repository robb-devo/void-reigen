// Commander Vex: brief, skippable story beats + one-time explanations of each new system.
import { sfx } from './game/fx';
const PORTRAIT = `<svg viewBox="0 0 64 64"><defs><linearGradient id="cv1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff9f43"/></linearGradient><linearGradient id="cv2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9af3ff"/><stop offset="1" stop-color="#3a7bff"/></linearGradient></defs>
<path d="M10 62c2-12 10-18 22-18s20 6 22 18z" fill="#4a3a7a" stroke="#24163a" stroke-width="3"/><path d="M24 46l8 8 8-8" fill="none" stroke="#ffd23f" stroke-width="3"/>
<circle cx="32" cy="28" r="20" fill="url(#cv1)" stroke="#24163a" stroke-width="3"/><path d="M16 28a16 12 0 0 1 32 0v4a16 8 0 0 1-32 0z" fill="url(#cv2)" stroke="#24163a" stroke-width="3"/>
<path d="M21 24c3-4 8-5 12-4" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/><circle cx="26" cy="31" r="2.5" fill="#24163a"/><circle cx="38" cy="31" r="2.5" fill="#24163a"/><path d="M28 37q4 3 8 0" stroke="#24163a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<rect x="29" y="4" width="6" height="8" rx="2" fill="#ff5b5b" stroke="#24163a" stroke-width="2.5"/></svg>`;
type Beat = { t: string; h?: string };
let el: HTMLElement | null = null, queue: { id: string; beats: Beat[]; skip?: boolean; done?: () => void }[] = [], cur: typeof queue[0] | null = null, bi = 0, typer = 0;
export let lastTalk = 0;
export const talking = () => !!cur || performance.now() - lastTalk < 600;
/** Overlay manager hook: while gate() is true (a modal / skill tree is up) Vex is held off-screen and resumes after. */
let gate = () => false; export const setGate = (f: () => boolean) => { gate = f; };
setInterval(() => { if (!el) return; const held = !!cur && gate(); el.classList.toggle('held', held); document.body.classList.toggle('vex', !!cur && !held); }, 120);
export function say(id: string, beats: (string | Beat)[], o: { skip?: boolean; done?: () => void } = {}) {
  if (queue.some(q => q.id === id) || cur?.id === id) return;
  queue.push({ id, beats: beats.map(b => typeof b === 'string' ? { t: b } : b), ...o }); if (!cur) next();
}
function next() {
  cur = queue.shift() || null; bi = 0; if (!cur) { el?.classList.remove('open'); return; }
  if (!el) { el = document.createElement('div'); el.className = 'cmdr'; document.body.appendChild(el); el.addEventListener('click', e => { const t = e.target as HTMLElement; if (t.closest('[data-skip]')) { finish(); return; } advance(); }); }
  show();
}
function show() {
  const b = cur!.beats[bi]; const last = bi === cur!.beats.length - 1;
  el!.innerHTML = `<div class="cport">${PORTRAIT}</div><div class="cbub"><div class="cname">CMDR. VEX</div>${b.h ? `<div class="chead">${b.h}</div>` : ''}<p></p><div class="cfoot">${cur!.skip && !last ? '<button data-skip>Skip intro</button>' : '<span></span>'}<b>${last ? 'Got it' : 'Next'} ›</b></div><div class="cdots">${cur!.beats.length > 1 ? cur!.beats.map((_, k) => `<i class="${k === bi ? 'on' : ''}"></i>`).join('') : ''}</div></div>`;
  el!.classList.add('open'); document.body.classList.toggle('vex', !gate()); el!.classList.remove('bump'); void el!.offsetWidth; el!.classList.add('bump');
  const p = el!.querySelector('p')!; let n = 0; clearInterval(typer); sfx.select();
  typer = window.setInterval(() => { n += 2; p.innerHTML = b.t.slice(0, n); if (n % 8 === 0) sfx.blip(); if (n >= b.t.length) { clearInterval(typer); p.innerHTML = b.t; } }, 16);
}
function advance() {
  const b = cur!.beats[bi], p = el!.querySelector('p')!;
  if (p.innerHTML.length < b.t.length) { clearInterval(typer); p.innerHTML = b.t; return; }
  if (bi < cur!.beats.length - 1) { bi++; show(); } else finish();
}
function finish() { clearInterval(typer); lastTalk = performance.now(); document.body.classList.remove('vex'); const d = cur?.done; el!.classList.remove('open'); cur = null; d?.(); setTimeout(next, 350); }
