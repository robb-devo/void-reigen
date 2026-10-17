// Offline-return check: play briefly, close, wind the clock back, reopen -> Welcome-back modal + credited earnings.
import { chromium } from 'playwright';
const URL='http://localhost:4173/'; const b=await chromium.launch({args:['--use-gl=swiftshader']}); const errs=[];
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
const SEEN=['intro','factory','power','lab','export','foreman','tiers','fleet','warp','skills','rock2'];
const seed={v:2,gv:3,seen:SEEN,cash:1e5,life:2e6,goal:25,played:400,mines:M([[50,1],[25,1],[30,1],[10,1],[0,0],[0,0],[0,0],[0,0],[0,0]]),tech:['t0_0'],res:{...z},made:{...z},mach:[1,1,10,5,0,0,0],gen:10,lab:3,last:Date.now()};
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
let p=await ctx.newPage(); await p.goto(URL+'sw.js'); await p.evaluate(s=>localStorage.setItem('starforge.v2',s),JSON.stringify(seed));
for (const hrs of [0.25, 2, 30]) {
  p.on('pageerror',e=>errs.push(e.message)); await p.goto(URL); await p.waitForTimeout(1500); await p.evaluate(()=>document.querySelector('.modal #col')?.click());
  const ps=await p.evaluate(()=>window.G.perSec()), c0=await p.evaluate(()=>{window.G.save(); return window.G.S.cash}); await p.goto(URL+'sw.js'); // leaves the game (pagehide saves)
  await p.evaluate(h=>{ const o=JSON.parse(localStorage.getItem('starforge.v2')); o.last-=h*3600e3; o.hw-=h*3600e3; localStorage.setItem('starforge.v2',JSON.stringify(o)); },hrs);
  await p.goto(URL); await p.waitForTimeout(1500); const wb=await p.$('.modal #col'); if(wb) await p.screenshot({path:`shots/off-${hrs}h.png`});
  const txt=wb?await p.$eval('.modal',e=>e.innerText.replace(/\s+/g,' ').slice(0,120)):''; if(wb) await wb.click({force:true}); await p.waitForTimeout(400);
  const c1=await p.evaluate(()=>window.G.S.cash); const cap=Math.min(hrs,8)*3600; console.log(JSON.stringify({hrs,modal:!!wb,ps:Math.round(ps),gain:Math.round(c1-c0),naive:Math.round(ps*cap),ratio:+((c1-c0)/(ps*cap)).toFixed(2),txt}));
}
console.log('errors',errs); await b.close();
