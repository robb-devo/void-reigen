// load-robust perf probe: measures the CPU cost of BaseView.draw per frame (median / p95), not just fps
import { chromium } from 'playwright';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
const SEEN=['intro','factory','power','lab','export','foreman','tiers','fleet','warp','skills','rock2','meteor','trader','wreck'];
const d=new Date(), TODAY=d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
const late={v:2,gv:3,seen:SEEN,cash:4e13,life:2e14,total:0,dm:108,warps:2,mines:M([[420,1],[300,1],[260,1],[220,1],[180,1],[150,1],[120,1],[80,1],[12,0]]),tech:['t0_0'],res:{...z,ore:9e9,quartz:5e9,ingot:2e8,glass:1e8,part:3e7,alloy:8e6,chip:4e5,hull:2e4,exotic:120},mach:[120,110,90,70,40,20,6],on:Array(7).fill(true),gen:180,ships:{scout:40,barge:30},conquered:['p1','p2'],missions:[],fupg:{},uid:1,ach:[],goal:40,sold:1,lost:0,wins:0,w:Array(7).fill(50),auto:false,taps:50,played:6000,last:Date.now(),mult:0,mute:true,liftOn:true,daily:{day:TODAY,streak:1}};
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
await ctx.addInitScript(s=>{localStorage.setItem('starforge.v2',s)},JSON.stringify(late));
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
const cdp=await ctx.newCDPSession(p); await cdp.send('Performance.enable'); await p.goto(process.env.URL||'http://localhost:4173/'); await p.waitForTimeout(2500);
await p.evaluate(()=>{const v=window.bv, o=v.draw.bind(v); window.__dt=[]; v.draw=(dt)=>{const t=performance.now(); o(dt); window.__dt.push(performance.now()-t);};});
const run=async(label,setup)=>{ await p.evaluate(setup); await p.waitForTimeout(800); await p.evaluate(()=>{window.__dt=[]}); 
  const fps=await p.evaluate(()=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++; if(performance.now()-t0<3000) requestAnimationFrame(f); else r(n/3)}; requestAnimationFrame(f)}));
  const m1=await cdp.send('Performance.getMetrics'); await p.waitForTimeout(3000); const m2=await cdp.send('Performance.getMetrics'); const g=(m,k)=>m.metrics.find(x=>x.name===k).value; const busy=['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].map(k=>k.replace('Duration','')+' '+((g(m2,k)-g(m1,k))/3*100).toFixed(0)+'%').join(' ');
  const a=await p.evaluate(()=>window.__dt.slice().sort((x,y)=>x-y)); const q=k=>a[Math.floor(a.length*k)]?.toFixed(2);
  console.log(label.padEnd(14),'fps',fps.toFixed(1),'draw ms med',q(.5),'p95',q(.95),'max',a[a.length-1]?.toFixed(1),'|',busy); };
await run('day',()=>{window.__night=0});
if(!process.env.QUICK){ await run('night',()=>{window.__night=1});
await run('zoomed-out',()=>{window.__night=0; window.bv.z=.62});
await run('meteors',()=>{window.bv.z=.8; window.__shower(7)}); }
if (process.env.EXTRA) await run('extra',new Function(process.env.EXTRA));
if(!process.env.QUICK) await run('fleet rock',()=>{window.bv.setRock(1); window.__night=.5});
console.log('errors',JSON.stringify(errs)); const l=await import('os'); console.log('load',l.loadavg().map(x=>x.toFixed(1)).join(' ')); await b.close();
