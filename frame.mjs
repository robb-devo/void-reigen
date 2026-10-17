// Early-camera framing check: fresh start + early seeds; reports where the build cluster sits relative to the free playfield.
import { chromium } from 'playwright';
const b=await chromium.launch({args:['--use-gl=swiftshader']}); const errs=[]; const N=process.env.N||0;
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
const seeds={fresh:null, early:{v:2,gv:3,seen:['intro'],cash:400,life:900,goal:8,played:20,mines:M([[18,0],[3,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]]),tech:['t0_0'],res:{...z,ore:40},made:{...z,ingot:30},mach:[1,1,0,0,0,0,0],gen:3,lab:1,last:Date.now()}};
for (const [name,seed] of Object.entries(seeds)) { const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  if(seed) await ctx.addInitScript(s=>{localStorage.setItem('starforge.v2',s)},JSON.stringify(seed)); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(name==='fresh'?2500:3000); if(name==='fresh'){ await p.evaluate(()=>document.querySelector('.cmdr .cskip,.cmdr [data-skip]')?.click()); await p.waitForTimeout(1500); }
  const r=await p.evaluate(()=>{ const v=window.bv; const ys=['hq','m0','m1','f0','f1','gen','lab'].map(k=>{try{return v.slotScreen(k)[1]}catch{return null}}).filter(Boolean); const gb=document.querySelector('#goal')?.getBoundingClientRect(); return {z:+v.z.toFixed(2),hudBottom:Math.round(gb?.bottom||0),clusterY:[Math.round(Math.min(...ys)),Math.round(Math.max(...ys))]}; });
  await p.screenshot({path:`shots/frame-${name}-${N}.png`}); console.log(name, JSON.stringify(r)); await ctx.close(); }
console.log('errors',errs); await b.close();
