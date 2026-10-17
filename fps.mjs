import { chromium } from 'playwright';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
const SEEN=['intro','factory','power','lab','export','foreman','tiers','fleet','warp','skills','rock2'];
const seed={v:2,gv:2,goal:14,cash:9000,life:9e4,total:0,dm:0,warps:0,seen:SEEN,played:30,mines:M([[50,1],[1,0],[18,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]]),tech:['t0_0'],res:{...z,ore:5e3},made:{...z},mach:[1,1,1,0,0,0,0],gen:3,lab:1,last:Date.now()};
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
await ctx.addInitScript(s=>{localStorage.setItem('starforge.v2',s)},JSON.stringify(seed));
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500);
const fps=()=>p.evaluate(()=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(n/2)}; requestAnimationFrame(f)}));
for (const n of [0,.5,1]) { await p.evaluate(n=>{window.__night=n},n); await p.waitForTimeout(500); const t=Date.now(); await p.evaluate(()=>1); console.log('night',n,'fps',await fps(),'evalms',Date.now()-t); }
await p.screenshot({path:'shots/h-night.png'}); console.log(errs); await b.close();
