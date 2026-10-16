import { chromium } from 'playwright';
const URL='http://localhost:4173/'; const b = await chromium.launch(); const errs=[];
const OUT=process.env.OUT||'shots';
async function page(seed){ const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  if(seed) await ctx.addInitScript(s=>{if(!sessionStorage.seed){sessionStorage.seed=1;localStorage.setItem('starforge.v2',s)}},JSON.stringify(seed));
  const p=await ctx.newPage(); p.on('console',m=>m.type()==='error'&&errs.push(m.text())); p.on('pageerror',e=>errs.push(e.message)); await p.goto(URL); await p.waitForTimeout(1000); return p; }
const F={force:true};
let p=await page();
await p.screenshot({path:`${OUT}/01-first-launch.png`});
for(let k=0;k<45;k++){ await p.tap('.biz .ico',F); await p.waitForTimeout(450); const c=await p.$('#claim'); if(c) await c.click(F); const btn=await p.$('.coach:not([disabled]), .biz .buy:not([disabled])'); if(btn) await btn.click(F).catch(()=>{}); }
await p.screenshot({path:`${OUT}/02-first-minute.png`});
await p.tap('nav button[data-t=fac]',F); await p.waitForTimeout(600); await p.screenshot({path:`${OUT}/03-early-factory.png`});
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0};
const mid={v:2,cash:3.2e7,life:9e7,total:0,dm:0,warps:0,mines:[[160,1],[90,1],[64,1],[40,1],[12,0],[0,0],[0,0],[0,0]].map(([n,m])=>({n,p:0,m:!!m,run:false})),tech:['t0_0','t0_1','t0_2','t1_0','t1_1'],res:{...z,ore:52000,quartz:31000,ingot:4100,glass:2600,part:820,alloy:240,chip:3},made:{...z,ingot:9000,glass:5000,part:1500,alloy:300,chip:3},mach:[38,30,14,6,1,0],on:[true,true,true,true,true,true],gen:22,ships:{scout:14,barge:3},conquered:['p1'],missions:[{uid:1,kind:'run',target:'r2',end:Date.now()+40000,dur:60,ships:{barge:2},power:12,chance:0.9}],fupg:{engines:1},uid:2,ach:['tap100','c1k','c1m','d100','mgr3','ing100','p1'],goal:20,sold:12,lost:2,wins:5,mute:true,last:Date.now()-2.5*3600e3,mult:0,taps:640,played:3000};
p=await page(mid); await p.screenshot({path:`${OUT}/04-welcome-back.png`});
await p.tap('#col',F); await p.waitForTimeout(1600); await p.screenshot({path:`${OUT}/05-asteroid-mid.png`});
await p.tap('nav button[data-t=fac]',F); await p.waitForTimeout(900); await p.screenshot({path:`${OUT}/06-factory-mid.png`});
await p.evaluate(()=>document.querySelector('#main').scrollTo(0,800)); await p.waitForTimeout(300); await p.screenshot({path:`${OUT}/07-factory-scroll.png`});
await p.evaluate(()=>document.querySelector('#main').scrollTo(0,99999)); await p.waitForTimeout(300); await p.screenshot({path:`${OUT}/08-factory-market-research.png`});
await p.tap('nav button[data-t=crew]',F); await p.waitForTimeout(500); await p.screenshot({path:`${OUT}/09-crew.png`});
await p.tap('nav button[data-t=fleet]',F); await p.waitForTimeout(700); await p.screenshot({path:`${OUT}/10-fleet.png`});
await p.evaluate(()=>document.querySelector('#main').scrollTo(0,700)); await p.waitForTimeout(300); await p.screenshot({path:`${OUT}/11-fleet-scroll.png`});
await p.evaluate(()=>document.querySelector('#main').scrollTo(0,0)); await p.waitForTimeout(200); const lb=await p.$('.mis button:not([disabled])'); if(lb){ await lb.click(F); await p.waitForTimeout(500); await p.screenshot({path:`${OUT}/14-ship-select.png`}); await p.tap('.modal [data-x]',F);} 
await p.tap('nav button[data-t=warp]',F); await p.waitForTimeout(500); await p.screenshot({path:`${OUT}/12-warp.png`});
await p.tap('#trophy',F); await p.waitForTimeout(600); await p.screenshot({path:`${OUT}/13-trophies.png`});
await p.tap('.modal [data-x]',F); await p.tap('nav button[data-t=mine]',F);
const late={...mid,cash:4e13,life:2e14,total:5e15,dm:108,warps:2,mines:[[420,1],[300,1],[260,1],[220,1],[180,1],[150,1],[120,1],[80,1],[12,0]].map(([n,m])=>({n,p:0,m:!!m,run:false})),res:{...z,ore:9e9,quartz:5e9,ingot:2e8,glass:1e8,part:3e7,alloy:8e6,chip:4e5,hull:2e4,exotic:120},made:{...z,ingot:1e9,glass:5e8,part:1e8,alloy:1e7,chip:1e6,hull:5e4,exotic:300},mach:[120,110,90,70,40,20,6],on:Array(7).fill(true),w:[50,50,70,30,50,50,50],gen:180,ships:{scout:40,barge:30,cruiser:20,dread:6,titan:1},conquered:['p1','p2','p3','p4','p5'],missions:[],fupg:{engines:3,armor:2,docks:2},goal:41,auto:true,last:Date.now()};
p=await page(late); await p.waitForTimeout(800); await p.screenshot({path:`${OUT}/15-sector3-asteroid.png`});
await p.tap('nav button[data-t=fac]',F); await p.waitForTimeout(800); await p.evaluate(()=>document.querySelector('#main').scrollTo(0,900)); await p.waitForTimeout(300); await p.screenshot({path:`${OUT}/16-sector3-factory-splits.png`});
await p.tap('nav button[data-t=fleet]',F); await p.waitForTimeout(600); { const lb=await p.$('.mis button:not([disabled])'); if(lb){ await lb.click(F); await p.waitForTimeout(500); await p.screenshot({path:`${OUT}/14-ship-select.png`}); await p.tap('.modal [data-x]',F); await p.waitForTimeout(300);} } await p.evaluate(()=>document.querySelector('#main').scrollTo(0,1100)); await p.waitForTimeout(300); await p.screenshot({path:`${OUT}/17-sector3-conquest.png`});
await p.tap('nav button[data-t=warp]',F); await p.waitForTimeout(500); await p.screenshot({path:`${OUT}/18-warp-perks.png`});
await p.tap('nav button[data-t=mine]',F);
const fps=await p.evaluate(()=>new Promise(r=>{let n=0,t=performance.now();const f=()=>{n++; if(performance.now()-t<3000) requestAnimationFrame(f); else r(n/3)};requestAnimationFrame(f)}));
console.log('fps',fps.toFixed(1),'errors:',JSON.stringify(errs)); await b.close();
