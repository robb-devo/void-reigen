import { chromium } from 'playwright';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
await ctx.addInitScript(s=>localStorage.setItem('starforge.v2',s),JSON.stringify({v:2,gv:3,seen:['intro','factory','power','lab','export','foreman','tiers'],cash:3e7,life:9e7,goal:24,mines:M([[160,1],[90,1],[64,1],[40,1],[12,0],[0,0],[0,0],[0,0],[0,0]]),tech:['t0_0'],res:{...z,ore:5e4,quartz:3e4,ingot:4e3},made:{...z},mach:[38,30,14,6,1,0,0],gen:22,last:Date.now(),daily:{day:99999999,streak:1}}));
const p=await ctx.newPage(); await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(()=>['#rate','#rush','#boost','.rc','.goal','#cash','header','.top'].map(s=>{const e=document.querySelector(s); if(!e) return s+' -'; const r=e.getBoundingClientRect(); return s+' '+Math.round(r.top)+'-'+Math.round(r.bottom)}))));
await b.close();
