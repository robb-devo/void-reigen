import { chromium } from 'playwright';
const OUT='shots/r12'; const b = await chromium.launch(); const errs=[];
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0};
const mid={v:2,cash:3.2e12,life:9e12,total:0,dm:0,warps:0,mines:[[169,1],[90,1],[64,1],[40,1],[0,0],[0,0],[0,0],[0,0],[0,0]].map(([n,m])=>({n,p:0,m:!!m,run:false})),tech:[],res:{...z,ore:52000,quartz:3000,ingot:900},made:{...z},mach:[38,30,14,6,0,0,0],on:Array(7).fill(true),gen:22,ships:{},conquered:[],missions:[],fupg:{},uid:2,ach:['tap100'],goal:20,taps:640,played:3000,xp:400,seen:['intro','factory','power','lab','export','foreman','tiers','skills','place'],daily:{day:30000101,streak:1,at:Date.now()},last:Date.now()};
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
await ctx.addInitScript(s=>{if(!sessionStorage.seed){sessionStorage.seed=1;localStorage.setItem('starforge.v2',s)}},JSON.stringify(mid));
const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text())); await p.goto('http://localhost:4190/'); await p.waitForTimeout(1500);
await p.evaluate(()=>{const bv=window.bv; bv.z=1.2; }); await p.waitForTimeout(300);
await p.evaluate(()=>{const bv=window.bv;const [x,y]=bv.slotScreen('hq'); bv.ox+=195-x; bv.oy+=430-y;}); await p.waitForTimeout(600);
for (const [k,key,dt] of [['dust','hq',300],['up','hq',350],['lvl','hq',500]]) { await p.evaluate(([k,key])=>window.bv.vfx(key,k,'#7affd1'),[k,key]); await p.waitForTimeout(dt); { const [sx,sy]=await p.evaluate(k=>window.bv.slotScreen(k),key); await p.screenshot({path:`${OUT}/vfx-${k}.png`,clip:{x:Math.max(0,sx-140),y:Math.max(0,sy-200),width:280,height:280}}); } await p.waitForTimeout(2300); }
// real flow: buy on m0 at Lv169 -> 170 (level-up)
let [x,y]=await p.evaluate(()=>window.bv.slotScreen('m0')); await p.mouse.click(x,y+30); await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelector('#sheet [data-act=buy]').click()); await p.waitForTimeout(450); await p.screenshot({path:`${OUT}/vfx-real-lvl.png`});
await p.waitForTimeout(2500); await p.evaluate(()=>document.querySelector('#sheet [data-act=buy]').click()); await p.waitForTimeout(300); await p.screenshot({path:`${OUT}/vfx-real-up.png`});
console.log('errs',errs); await b.close();
