// Verifies Stage 10 events on screen: trader landing/deals/boost, derelict wreck salvage, overlay count.
import { chromium } from 'playwright';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}); const errs=[]; const N=process.env.N||0;
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
const d=new Date(), TODAY=d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
const SEEN=['intro','factory','power','lab','export','foreman','tiers','fleet','warp','skills','rock2','meteor'];
const mid={v:2,gv:3,seen:SEEN,cash:3.2e7,life:9e7,goal:24,played:3000,mines:M([[160,1],[90,1],[64,1],[40,1],[12,0],[0,0],[0,0],[0,0],[0,0]]),tech:['t0_0'],res:{...z,ore:52000,quartz:31000,ingot:4100,glass:2600,part:820,alloy:240,chip:3},made:{...z,ingot:5000,glass:3000,part:900,alloy:300,chip:3},mach:[38,30,14,6,1,0,0],on:Array(7).fill(true),gen:22,lab:3,ships:{scout:4},last:Date.now(),daily:{day:TODAY,streak:1,at:Date.now()},mute:true};
async function page(seed){ const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'}); await ctx.addInitScript(s=>{if(!sessionStorage.seeded){sessionStorage.seeded=1;localStorage.setItem('starforge.v2',s)}},JSON.stringify(seed)); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text())); await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500); await p.evaluate(()=>{window.__night=0}); return p; }
const fg=p=>p.evaluate(()=>[...document.querySelectorAll('.modal,.tree,#sheet.open,.cmdr.open')].length);
const vexOff=async p=>{ for(let i=0;i<6;i++){ const on=await p.evaluate(()=>document.body.classList.contains('vex')); if(!on) return; await p.evaluate(()=>document.querySelector('.cmdr .cbub')?.click()); await p.waitForTimeout(450);} };
const shipXY=p=>p.evaluate(()=>{const v=window.bv,t=v.trader; if(!t) return null; const r=v.cv.getBoundingClientRect(); return [r.left+v.ox+v.z*(t.gx-t.gy)*36, r.top+v.oy+v.z*((t.gx+t.gy)*18-40)]});
let p=await page(mid); let maxfg=0;
// --- trader ---
console.log('trader came', await p.evaluate(()=>window.__trader()), await p.evaluate(()=>JSON.stringify({oy:window.bv.oy,cam:window.bv.cam,tr:window.bv.trader})));
for (const [ms,n] of [[700,1],[900,2],[1300,3]]) { await p.waitForTimeout(ms); await p.screenshot({path:`shots/t-land-${n}-${N}.png`}); }
console.log('trader state', JSON.stringify(await p.evaluate(()=>({oy:window.bv.oy,st:window.bv.trader?.st, vex:document.body.classList.contains('vex')})))); maxfg=Math.max(maxfg,await fg(p));
await p.screenshot({path:`shots/t-vex-${N}.png`}); await vexOff(p); await p.waitForTimeout(400);
await p.screenshot({path:`shots/t-landed-${N}.png`});
let [x,y]=await shipXY(p); await p.touchscreen.tap(x,y); await p.waitForTimeout(600); maxfg=Math.max(maxfg,await fg(p));
await p.screenshot({path:`shots/t-modal-${N}.png`});
const offers=await p.evaluate(()=>[...document.querySelectorAll('.offer')].map(o=>o.innerText.replace(/\s+/g,' ')));
console.log('offers', JSON.stringify(offers)); const r0=await p.evaluate(()=>({...window.G.S.res}));
for (const i of [0,1]) { await p.click(`[data-take="${i}"]`,{force:true}); await p.waitForTimeout(500); }
await p.screenshot({path:`shots/t-deals-${N}.png`}); const r1=await p.evaluate(()=>({...window.G.S.res}));
console.log('res delta', JSON.stringify(Object.fromEntries(Object.keys(r0).map(k=>[k,Math.round(r1[k]-r0[k])]).filter(([,v])=>v))), 'boost', JSON.stringify(await p.evaluate(()=>window.G.S.boost)), 'trades', await p.evaluate(()=>window.G.S.trades));
await p.click('.trader [data-x]',{force:true}); await p.waitForTimeout(500); await p.screenshot({path:`shots/t-boost-${N}.png`});
console.log('boost pill', await p.evaluate(()=>document.querySelector('#boost.on')?.textContent));
const ps0=await p.evaluate(()=>{const c=window.G.S.cash; return new Promise(r=>setTimeout(()=>r(window.G.S.cash-c),3000))}); console.log('cash in 3s with boost', Math.round(ps0), 'perSec', Math.round(await p.evaluate(()=>window.G.perSec())));
// take last deal via ship again -> leaves
[x,y]=await shipXY(p); await p.touchscreen.tap(x,y); await p.waitForTimeout(500); await p.click('[data-take="2"]',{force:true}).catch(()=>{}); await p.waitForTimeout(1500); await p.screenshot({path:`shots/t-leave-${N}.png`}); await p.waitForTimeout(2500);
console.log('trader after all deals', JSON.stringify(await p.evaluate(()=>window.bv.trader)), 'modal', !!await p.$('.trade'));
// --- wreck while on the mining rock: waits on the fleet rock, button pulses ---
await p.evaluate(()=>window.__wreck()); await p.waitForTimeout(600); console.log('pulse', await p.evaluate(()=>document.querySelector('#rockbtn').classList.contains('pulse')));
await p.click('#rockbtn',{force:true}); await p.waitForTimeout(2200); await vexOff(p); await p.screenshot({path:`shots/w-landed-${N}.png`});
// crash animation when already here
await p.evaluate(()=>window.__wreck()); await p.waitForTimeout(500); await p.screenshot({path:`shots/w-fall-${N}.png`}); await p.waitForTimeout(1200); await p.screenshot({path:`shots/w-impact-${N}.png`}); await vexOff(p); maxfg=Math.max(maxfg,await fg(p));
const wxy=()=>p.evaluate(()=>{const v=window.bv,w=v.wreckE; const r=v.cv.getBoundingClientRect(); return [r.left+v.ox+v.z*(w.gx-w.gy)*36, r.top+v.oy+v.z*((w.gx+w.gy)*18-20)]});
const c0=await p.evaluate(()=>window.G.S.cash), f0=await p.evaluate(()=>({...window.G.S.fstock}));
for (let i=0;i<5;i++){ const [wx,wy]=await wxy(); await p.touchscreen.tap(wx,wy); await p.waitForTimeout(i===3?400:250); if(i===3) await p.screenshot({path:`shots/w-hit4-${N}.png`}); }
await p.waitForTimeout(150); await p.screenshot({path:`shots/w-final-${N}.png`}); await p.waitForTimeout(900);
const f1=await p.evaluate(()=>({...window.G.S.fstock}));
console.log('wreck: wrecks', await p.evaluate(()=>window.G.S.wrecks), 'cash', Math.round(await p.evaluate(()=>window.G.S.cash)-c0), 'fstock', JSON.stringify(Object.fromEntries(Object.keys(f0).map(k=>[k,Math.round(f1[k]-f0[k])]).filter(([,v])=>v))), 'sheet', !!await p.$('#sheet.open'), 'gone', await p.evaluate(()=>window.bv.wreckE===null));
console.log('max foreground', maxfg, 'errors', JSON.stringify(errs)); await b.close();
