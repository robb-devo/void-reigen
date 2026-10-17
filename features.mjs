// Verifies Stage 9 features on screen: daily crate, tap rush, meteor shower.
import { chromium } from 'playwright';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}); const errs=[]; const N=process.env.N||0;
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
const SEEN=['intro','factory','power','lab','export','foreman','tiers','fleet','warp','skills','rock2'];
const base={v:2,gv:3,seen:SEEN,cash:2e5,life:2e6,goal:14,played:30,mines:M([[50,1],[25,1],[20,0],[10,1],[0,0],[0,0],[0,0],[0,0],[0,0]]),tech:['t0_0'],res:{...z},made:{...z},mach:[1,1,10,5,0,0,0],gen:10,lab:3,last:Date.now()};
async function page(seed){ const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'}); await ctx.addInitScript(s=>{if(!sessionStorage.seeded){sessionStorage.seeded=1;localStorage.setItem('starforge.v2',s)}},JSON.stringify(seed)); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text())); await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500); await p.evaluate(()=>{window.__night=0}); return p; }
// 1) daily crate
let p=await page({...base,daily:{day:0,streak:0}}); await p.waitForTimeout(2500); const crate=!!await p.$('#dopen'); await p.screenshot({path:`shots/f-crate-1-${N}.png`});
if(crate){ const c0=await p.evaluate(()=>window.G.S.cash); await p.click('#dopen'); await p.waitForTimeout(250); await p.screenshot({path:`shots/f-crate-2-${N}.png`}); await p.waitForTimeout(700); await p.screenshot({path:`shots/f-crate-3-${N}.png`}); const c1=await p.evaluate(()=>window.G.S.cash); await p.click('#dopen'); await p.waitForTimeout(600); console.log('crate gain',Math.round(c1-c0),'streak',JSON.stringify(await p.evaluate(()=>window.G.S.daily)),'modal left',!!await p.$('.modal')); }
else console.log('NO CRATE');
// reload same day: no crate
await p.reload(); await p.waitForTimeout(3500); console.log('crate again same day?',!!await p.$('#dopen'));
// 2) tap rush on the drill (m0 automated) – 24 quick taps
await p.evaluate(()=>window.bv.focus('m2')); await p.waitForTimeout(900); const [x,y]=await p.evaluate(()=>window.bv.slotScreen('m2'));
for(let i=0;i<24;i++){ const [x,y]=await p.evaluate(()=>window.bv.slotScreen('m2')); await p.touchscreen.tap(x,y+25); await p.waitForTimeout(110); if(i===20) await p.screenshot({path:`shots/f-rush-${N}.png`}); }
console.log('rush', JSON.stringify(await p.evaluate(()=>({rush:window.G.rush, pill:document.querySelector('#rush')?.textContent}))));
await p.waitForTimeout(1600); console.log('rush after idle', await p.evaluate(()=>window.G.rush));
await p.evaluate(()=>document.querySelector('#sheet [data-act=close]')?.click()); await p.waitForTimeout(400);
// 3) meteor shower
await p.evaluate(()=>window.__shower(6)); await p.waitForTimeout(700); await p.screenshot({path:`shots/f-meteor-1-${N}.png`}); await p.waitForTimeout(3600); await p.screenshot({path:`shots/f-meteor-2-${N}.png`});
const ms=await p.evaluate(()=>{const v=window.bv; const r=v.cv.getBoundingClientRect(); return v.meteors.filter(m=>m.st===1).map(m=>{const X=(m.gx-m.gy)*36, Y=(m.gx+m.gy)*18; return [r.left+v.ox+v.z*X, r.top+v.oy+v.z*Y-8]})});
console.log('dbg',JSON.stringify(await p.evaluate(([mx,my])=>{const v=window.bv; const r=v.cv.getBoundingClientRect(); const lx=(mx-r.left-v.ox)/v.z, ly=(my-r.top-v.oy)/v.z; return {hit:!!v.meteorAt(lx,ly), talking:document.body.classList.contains('vex'), el:document.elementFromPoint(mx,my)?.id||document.elementFromPoint(mx,my)?.className}},ms[0]||[0,0])));
const c0=await p.evaluate(()=>window.G.S.cash); for(const [mx,my] of ms.slice(0,3)){ await p.touchscreen.tap(mx,my); await p.waitForTimeout(120);} await p.screenshot({path:`shots/f-meteor-3-${N}.png`});
console.log('meteors landed',ms.length,'cracked gain',Math.round(await p.evaluate(()=>window.G.S.cash)-c0),'count',await p.evaluate(()=>window.G.S.meteors),'sheet opened',!!await p.$('#sheet.open'));
console.log('errors',errs); await b.close();
