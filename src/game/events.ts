// Random-event economics: the visiting trader's offers and the fleet-rock wreck salvage. Pure logic (no DOM).
import { RES_ORDER, Res, TECH } from './data';
import * as G from './state';

export type Offer = { kind: 'swap' | 'boost' | 'buy'; give: { r?: Res; cash?: number; n: number }; get: { r?: Res; n?: number; boost?: { kind: 'cash' | 'ore'; m: number; secs: number } }; tag: string; done?: boolean };
const S = () => G.S;
/** Goods the player actually has (and knows). */
const owned = () => RES_ORDER.filter(r => S().res[r] >= 10);
const known = () => RES_ORDER.filter(r => S().res[r] > 0 || S().made[r] > 0);
/** What the player is short of right now: the material of the cheapest research they can't afford yet, and the gap. */
function wanted(): { r: Res; gap: number } | null {
  const t = TECH.filter(t => G.techAvail(t) && !S().tech.includes(t.id) && S().res[t.res] < t.amt).sort((a, b) => a.cash - b.cash)[0];
  return t ? { r: t.res, gap: t.amt - S().res[t.res] } : null;
}
const val = (r: Res, n: number) => n * G.price(r); // only used to rank which pile is richest
const pick = <T,>(a: T[], rnd: () => number) => a[Math.floor(rnd() * a.length)];

/** Three offers for one visit. A swap always targets what you're short of when there is something. */
export function traderOffers(rnd = Math.random): Offer[] {
  const out: Offer[] = [], have = owned().sort((a, b) => val(b, S().res[b]) - val(a, S().res[a])), kn = known(), ps = Math.max(1, G.perSec());
  // 1) good-for-good: your richest pile → what you need (or the next tier up), at a generous rate
  // Goods are progression inputs, so amounts scale with the player's own stock (sell prices are far too low to price them).
  const A = have[0], w = wanted(), want = w?.r;
  if (A) { const B = want && want !== A ? want : kn.filter(r => r !== A && RES_ORDER.indexOf(r) > RES_ORDER.indexOf(A))[0] || kn.find(r => r !== A);
    if (B) { const n = Math.floor(S().res[A] * .35), m = Math.max(3, Math.ceil(B === want ? Math.max(w!.gap * .6, S().res[B] * .25) : S().res[B] * .3 + 10)); out.push({ kind: 'swap', give: { r: A, n }, get: { r: B, n: m }, tag: B === want ? 'YOU NEED THIS' : 'FAIR TRADE' }); } }
  // 2) good-for-boost: a pile of a second good → ×2 income for 2 minutes
  const C = have.find(r => r !== A) || A;
  if (C) out.push({ kind: 'boost', give: { r: C, n: Math.floor(S().res[C] * .3) }, get: { boost: { kind: 'cash', m: 2, secs: 120 } }, tag: 'HOT DEAL' });
  // 3) rotating third slot: ore surge for cash, or a crate of rare goods for cash
  const rare = kn.filter(r => RES_ORDER.indexOf(r) >= 2); 
  if (rare.length && rnd() < .5) { const R = pick(rare.slice(-3), rnd), cost = Math.ceil(ps * 45), m = Math.max(3, Math.ceil(S().res[R] * .25 + 5)); out.push({ kind: 'buy', give: { cash: cost, n: cost }, get: { r: R, n: m }, tag: 'RARE CARGO' }); }
  else out.push({ kind: 'boost', give: { cash: Math.ceil(ps * 30), n: Math.ceil(ps * 30) }, get: { boost: { kind: 'ore', m: 3, secs: 90 } }, tag: 'ORE SURGE' });
  return out.filter(o => o.give.n >= 1);
}
export const canTake = (o: Offer) => !o.done && (o.give.r ? S().res[o.give.r] >= o.give.n : S().cash >= (o.give.cash || 0));
export function takeOffer(o: Offer) {
  if (!canTake(o)) return false; const s = S();
  if (o.give.r) s.res[o.give.r] -= o.give.n; else s.cash -= o.give.cash || 0;
  if (o.get.r) s.res[o.get.r] += o.get.n || 0; if (o.get.boost) G.addBoost(o.get.boost.kind, o.get.boost.m, o.get.boost.secs);
  o.done = true; s.trades++; return true;
}

/** Derelict salvage: a little cash every hit, a pile of fleet goods + income on the final crack. */
export const WRECK_HITS = 5;
export function wreckLoot(final: boolean) {
  const ps = Math.max(1, G.perSec()); if (!final) return { cash: ps * 1.5, goods: [] as [Res, number][] };
  const kn = G.FLEET_RES.filter((r: Res) => S().res[r] + S().fstock[r] > 0 || S().made[r] > 0), goods: [Res, number][] = [];
  for (const r of (kn.length ? kn : ['part' as Res]).slice(-2)) goods.push([r, Math.max(3, Math.ceil((S().res[r] + S().fstock[r]) * .15))]);
  return { cash: ps * 20, goods };
}
export function takeWreck(final: boolean) { const l = wreckLoot(final), s = S(); G.earn(l.cash); for (const [r, n] of l.goods) s.fstock[r] += n; if (final) s.wrecks++; return l; }
