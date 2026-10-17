import { chromium } from 'playwright';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}); const errs=[];
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
const SEEN=['intro','factory','power','lab','export','foreman','tiers','fleet','warp','skills','rock2'];
const seed={v:2,cash:3.2e7,life:9e7,total:0,dm:0,warps:0,seen:SEEN,played:30,mines:M([[160,1],[30,1],[110,1],[40,1],[12,0],[0,0],[0,0],[0,0],[0,0]]),tech:['t0_0'],res:{...z,ore:5e4},made:{...z},mach:[60,30,14,6,1,0,0],gen:16,lab:12,last:Date.now()};
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
await ctx.addInitScript(s=>{localStorage.setItem('starforge.v2',s)},JSON.stringify(seed));
const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500); await p.evaluate(()=>{window.__night=0; window.bv.focus('m3')}); await p.waitForTimeout(1200);
const [x,y]=await p.evaluate(()=>window.bv.slotScreen('m3'));
await p.evaluate(()=>window.bv.construct('m3')); const t0=Date.now(); const got=[];
while(Date.now()-t0<1700){ const ce=await p.evaluate(()=>{const v=window.bv; return v.t-(v.cons.get('m3')??-99)}); const f=`shots/ding-${got.length}.png`; await p.screenshot({path:f,clip:{x:x-150,y:y-240,width:300,height:300}}); got.push([f,+ce.toFixed(2)]); }
console.log(JSON.stringify(got), errs); await b.close();
