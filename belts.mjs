import { chromium } from 'playwright';
const OUT='shots/r12'; const TAG=process.env.TAG||'before'; const b = await chromium.launch(); const errs=[];
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0};
const busy={v:2,cash:9e13,life:2e8,total:0,dm:0,warps:0,mines:[[300,1],[220,1],[160,1],[120,1],[90,1],[60,1],[30,1],[0,0],[0,0]].map(([n,m])=>({n,p:0,m:!!m,run:false})),tech:[],res:{...z,ore:5e6,quartz:3e6,ingot:9e5,glass:4e5,part:1e5},made:{...z},mach:[80,60,50,40,30,20,0],on:Array(7).fill(true),gen:60,ships:{},conquered:[],missions:[],fupg:{},uid:2,ach:['tap100'],goal:30,taps:640,played:30000,xp:4000,seen:['intro','factory','power','lab','export','foreman','tiers','skills','place','fleet'],daily:{day:30000101,streak:1,at:Date.now()},last:Date.now()};
const mid={...busy,cash:3.2e7,life:9e7,mines:[[160,1],[90,1],[64,1],[40,1],[0,0],[0,0],[0,0],[0,0],[0,0]].map(([n,m])=>({n,p:0,m:!!m,run:false})),mach:[38,30,14,6,0,0,0],gen:22,goal:20};
async function run(seed,name,views){ const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await ctx.addInitScript(s=>{if(!sessionStorage.seed){sessionStorage.seed=1;localStorage.setItem('starforge.v2',s)}},JSON.stringify(seed));
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text())); await p.goto('http://localhost:4190/'); await p.waitForTimeout(2000);
  await p.evaluate(()=>document.querySelectorAll('.modal').forEach(m=>m.remove()));
  for (const [vn,zz,gx,gy] of views) { await p.evaluate(zz=>{const bv=window.bv; bv.cam=null; bv.z=zz;},zz); await p.waitForTimeout(150); await p.evaluate(([zz,gx,gy])=>{const bv=window.bv; const [sx,sy]=bv.slotScreen('hq'); const px=sx+(gx-gy)*36*zz, py=sy+(gx+gy)*18*zz; bv.ox+=innerWidth/2-px; bv.oy+=innerHeight*0.52-py;},[zz,gx,gy]); for(let i=0;i<3;i++){ await p.evaluate(()=>{for(const b of document.querySelectorAll('button')) if(/Got it/.test(b.textContent)) b.click();}); await p.waitForTimeout(150);} await p.waitForTimeout(500); await p.screenshot({path:`${OUT}/belt-${TAG}-${name}-${vn}.png`}); }
  await ctx.close(); }
await run(busy,'busy',[['wide',.62,0,0],['back',1.5,-3,-3],['left',1.5,-2,3],['right',1.5,3,-2],['front',1.5,3,3]]);
await run(mid,'mid',[['wide',.8,0,0],['zoom',1.6,0,0]]);
console.log('errs',errs); await b.close();
