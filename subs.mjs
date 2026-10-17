import { chromium } from 'playwright';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}); const errs=[];
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0};
const seed={v:2,cash:3.2e7,life:9e7,total:0,dm:0,warps:0,mines:[[160,1],[90,1],[64,1],[40,0],[12,0],[0,0],[0,0],[0,0],[0,0]].map(([n,m])=>({n,p:0,m:!!m,run:!!m})),tech:['t0_0'],res:{...z,ore:5e4,part:800},made:{...z,ingot:3e4,part:900},mach:[38,30,14,6,1,0,0],on:Array(7).fill(true),gen:22,ships:{},conquered:[],missions:[],fupg:{},uid:1,ach:['a1','a2'],goal:20,sold:3,lost:0,wins:0,w:Array(7).fill(50),auto:false,mute:true,last:Date.now(),mult:0,taps:50,played:900};
await ctx.addInitScript(s=>{if(!sessionStorage.seed){sessionStorage.seed=1;localStorage.setItem('starforge.v2',s)}},JSON.stringify(seed));
const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.stack)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500); await p.$eval('#col',e=>e.click()).catch(()=>{}); await p.evaluate(()=>document.querySelectorAll('.cmdr .skip').forEach(e=>e.click()));
for (const t of ['mine','crew','warp']) { await p.evaluate(t=>{const k=window.bv.slotScreen('hq'); return t},t); await p.evaluate(t=>window.setTabDbg?.(t),t); }
// open via HQ sheet buttons
const [x,y]=await p.evaluate(()=>window.bv.slotScreen('hq')); await p.touchscreen.tap(x,y+25); await p.waitForTimeout(600);
await p.evaluate(()=>{window.__cm=setInterval(()=>document.querySelectorAll('.cmdr.open .cbub').forEach(e=>e.click()),200)}); await p.waitForTimeout(3000);
for (const [a,n] of [['list','s1-mines'],['crew','s2-crew'],['warp','s3-stats'],['trophy','s4-trophies']]) { await p.evaluate(()=>window.bv.focus('hq')); await p.waitForTimeout(900); const [x,y]=await p.evaluate(()=>window.bv.slotScreen('hq')); await p.touchscreen.tap(x,y+25); await p.waitForTimeout(700); await p.evaluate(a=>document.querySelector(`#sheet.open [data-act="${a}"]`)?.click(),a); await p.waitForTimeout(800); await p.screenshot({path:`shots/${n}.png`}); await p.evaluate(()=>{document.querySelector('.modal')?.remove(); document.querySelector('#back').click()}); await p.waitForTimeout(500); }
// corrupt save edge case
const c2=await b.newContext({viewport:{width:390,height:844}}); await c2.addInitScript(()=>localStorage.setItem('starforge.v2','{broken')); const p2=await c2.newPage(); p2.on('pageerror',e=>errs.push('corrupt:'+e.message)); await p2.goto('http://localhost:4173/'); await p2.waitForTimeout(1500);
console.log('errors',JSON.stringify(errs)); await b.close();
