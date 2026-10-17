import { chromium } from 'playwright';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}); const errs=[];
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
const SEEN=['intro','factory','power','lab','export','foreman','tiers','fleet','warp','skills','rock2'];
const seed={v:2,gv:3,seen:SEEN,cash:4e13,life:2e14,dm:108,warps:2,played:30,mines:M([[420,1],[300,1],[260,1],[220,1],[180,1],[150,1],[120,1],[80,1],[12,0]]),res:{...z,ore:9e9},made:{...z},tech:['t0_0'],mach:[120,110,90,70,40,20,6],on:Array(7).fill(true),gen:180,lab:30,ships:{scout:40,barge:30},conquered:['p1','p2'],missions:[],fupg:{},uid:1,ach:[],goal:40,lift:6,fstock:{...z,part:1e7,alloy:1e6,chip:1e5,hull:1e4,exotic:50},last:Date.now()};
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
await ctx.addInitScript(s=>{localStorage.setItem('starforge.v2',s)},JSON.stringify(seed));
const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500); await p.evaluate(()=>{window.__night=0});
const N=process.env.N||0;
const propScreen=()=>p.evaluate(()=>{const v=window.bv, r=v.cv.getBoundingClientRect(); const L=v.decorList.map(d=>{const X=(d[0]-d[1])*36, Y=(d[0]+d[1])*18; return [r.left+v.ox+v.z*X, r.top+v.oy+v.z*Y, d[2]]}).filter(([x,y])=>x>30&&x<360&&y>300&&y<700); return L;});
const tapProp=async(tag)=>{ const L=await propScreen(); for(const [x,y,k] of L){ await p.touchscreen.tap(x,y-8); await p.waitForTimeout(30); const ok=await p.evaluate(()=>window.bv.bounces.size); if(!ok){ await p.evaluate(()=>document.querySelector('#sheet [data-act=close]')?.click()); await p.waitForTimeout(250); continue; }
  for(let i=0;i<4;i++){ await p.screenshot({path:`shots/prop-${tag}-${N}-${i}.png`,clip:{x:x-60,y:y-80,width:120,height:110}}); } console.log(tag,'kind',k,'sheetOpened',!!await p.$('#sheet.open')); return; } console.log('no tappable prop',tag); };
await p.evaluate(()=>{const c=document.querySelector('#base'); c.dispatchEvent(new WheelEvent('wheel',{deltaY:-400,clientX:195,clientY:460,bubbles:true}));}); await p.waitForTimeout(600);
await p.screenshot({path:`shots/r0-day-${N}.png`}); await tapProp('r0');
await p.evaluate(()=>document.querySelector('#sheet [data-act=close]')?.click()); await p.waitForTimeout(300); await p.evaluate(()=>window.bv.travel(1)); await p.waitForTimeout(2500); await p.screenshot({path:`shots/r1-day-${N}.png`});
await p.evaluate(()=>{const c=document.querySelector('#base'); c.dispatchEvent(new WheelEvent('wheel',{deltaY:-300,clientX:195,clientY:460,bubbles:true}));}); await p.waitForTimeout(600); await p.screenshot({path:`shots/r1-dayz-${N}.png`}); await tapProp('r1');
await p.evaluate(()=>{window.__night=1}); await p.waitForTimeout(500); await p.screenshot({path:`shots/r1-night-${N}.png`});
console.log(errs); await b.close();
