// Clock-tamper tests for the daily crate, offline earnings and boosts. Run: npx tsx sim/clock.ts
import * as G from '../src/game/state';
let NOW = new Date(2026, 9, 17, 12, 0).getTime(); const real = Date.now; Date.now = () => NOW;
const H = 3600e3, D = 24 * H; let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) fails++; };
G.setS(G.fresh()); G.S.last = NOW; G.save();
ok(G.dailyReady(), 'fresh save: crate ready'); G.claimDaily(); G.save(); ok(!G.dailyReady(), 'claimed: not ready same day');
NOW += 13 * H; G.save(); ok(G.dailyReady(), 'next day 01:00: ready'); ok(G.dailyNext().streak === 2, 'streak continues to 2'); G.claimDaily(); G.save();
// rewind the device clock one day: nothing re-opens, no offline credit
NOW -= D; ok(!G.dailyReady(), 'clock rewound 1 day: not ready'); ok(G.awaySecs() < 0, 'rewound: no offline time');
// play a while in the past, save (last = past), then restore the clock: offline credit is only the real gap
G.save(); NOW += D + 10 * 60e3; ok(Math.abs(G.awaySecs() - 600) < 1, `restored clock: away ${G.awaySecs().toFixed(0)}s (expect 600)`);
// forward jump: one early crate, then nothing until real time catches up
const realNow = NOW; NOW += D; ok(G.dailyReady(), 'clock +1 day: one early crate'); G.claimDaily(); G.save(); const st = G.S.daily.streak;
NOW = realNow + 60e3; ok(!G.dailyReady(), 'back to real time: not ready'); ok(G.awaySecs() < 0, 'back to real time: no offline credit');
NOW = realNow + D + 60e3; ok(!G.dailyReady(), 'real next day (already pre-claimed): not ready');
NOW = realNow + 2 * D + H; ok(G.dailyReady() && G.dailyNext().streak === st + 1, 'the day after: ready, streak continues');
// midnight double dip
G.setS(G.fresh()); NOW = new Date(2026, 9, 20, 23, 59).getTime(); G.S.hw = NOW; G.claimDaily(); NOW += 2 * 60e3; ok(!G.dailyReady(), '23:59 claim then 00:01: not ready (4h gap)'); NOW += 4 * H; ok(G.dailyReady(), '04:01: ready');
// big forward jump then clock fixed (>2 days): accepted, today's crate forfeited, streak reset
G.setS(G.fresh()); NOW = new Date(2026, 9, 21, 12).getTime(); G.claimDaily(); G.save(); NOW += 30 * D; G.claimDaily(); G.save(); NOW -= 30 * D; G.clockGuard();
ok(!G.dailyReady() && G.S.daily.streak === 0 && G.S.hw === NOW, 'far-future clock fixed: guard resets hw, no crate today'); NOW += D; ok(G.dailyReady() && G.dailyNext().streak === 1, 'next day: fresh streak');
// boosts tick on played time only
G.setS(G.fresh()); G.addBoost('cash', 2, 60); G.addBoost('ore', 3, 30); G.tick(10); ok(Math.abs(G.S.boosts.cash!.left - 50) < 1e-6 && G.boostM('ore') === 3, 'boosts stack and tick with play'); G.simulateOffline(3600); ok(Math.abs(G.S.boosts.cash!.left - 50) < 1e-6, 'boost not consumed/applied offline'); G.tick(21); ok(!G.S.boosts.ore && G.boostM('cash') === 2, 'ore boost expires first'); G.tick(30); ok(!G.S.boosts.cash, 'income boost expires');
Date.now = real; console.log(fails ? `${fails} FAILED` : 'all clock tests pass'); process.exit(fails ? 1 : 0);
