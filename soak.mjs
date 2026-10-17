// Long soak: active play, background/foreground cycles (frozen page), offline returns. Logs health every 10s.
import { chromium } from 'playwright'; import fs from 'fs';
const URL=process.env.URL||'http://localhost:4180/', MIN=+(process.env.MIN||35), t0=Date.now(), OUT='/tmp/soak.jsonl'; fs.writeFileSync(OUT,'');
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const errs=[]; let p, cdp;
const el=()=>Math.round((Date.now()-t0)/1000);
const log=o=>{ o.t=el(); fs.appendFileSync(OUT,JSON.stringify(o)+'\n'); console.log(JSON.stringify(o)); };
async function open(){ p=await ctx.newPage(); p.on('pageerror',e=>errs.push(el()+'s '+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(el()+'s '+m.text()));
  await p.addInitScript(()=>{ window.__gaps=[]; let last=performance.now(); const f=t=>{ const g=t-last; last=t; if(g>200) window.__gaps.push(Math.round(g)); requestAnimationFrame(f)}; requestAnimationFrame(f);
    window.__long=0; try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) window.__long=Math.max(window.__long,Math.round(e.duration)) }).observe({type:'longtask',buffered:true}) }catch{} });
  await p.goto(URL); cdp=await ctx.newCDPSession(p); await p.waitForTimeout(1500); }
await open();
const health=async(tag)=>{ const s=Date.now(); const h=await p.evaluate(()=>new Promise(r=>{let n=0;const t=performance.now();const f=()=>{n++; if(performance.now()-t<1000) requestAnimationFrame(f); else { const g=window.__gaps.splice(0); r({fps:n, gaps:g.length, maxGap:Math.max(0,...g), long:window.__long, heap:Math.round((performance.memory?.usedJSHeapSize||0)/1048576), dom:document.getElementsByTagName('*').length, sprites:window.bv?.sprites?.size, pops:document.querySelectorAll('.pop,.fly,.toast,.burst i').length, cash:window.G.S.cash, life:window.G.S.life, goal:window.G.S.goal, ps:window.G.perSec()}); window.__long=0; } }; requestAnimationFrame(f)})); h.rtt=Date.now()-s-1000; h.tag=tag; h.err=errs.length; log(h); return h; };
const play=async secs=>{ const end=Date.now()+secs*1000; while(Date.now()<end){
  const cm=await p.$('.cmdr.open .cbub'); if(cm){ await cm.evaluate(e=>e.click()).catch(()=>{}); await p.waitForTimeout(250); continue; }
  const m=await p.$('.modal #col, .modal [data-close], .modal .x'); if(m){ await m.evaluate(e=>e.click()).catch(()=>{}); await p.waitForTimeout(200); }
  const c=await p.$('#claim'); if(c){ await c.click({force:true}).catch(()=>{}); await p.waitForTimeout(200); continue; }
  const idle=await p.evaluate(()=>window.G.S.mines.map((m,i)=>m.n&&!m.m&&!m.run?i:-1).filter(i=>i>=0)).catch(()=>[]);
  for(const i of idle){ const [x,y]=await p.evaluate(k=>window.bv.slotScreen(k),'m'+i); if(y>200&&y<700&&x>10&&x<380) await p.touchscreen.tap(x,y+25); }
  const g=await p.evaluate(()=>window.bv?.guide).catch(()=>null);
  if(g){ const x2=await p.$('#sheet.open [data-act=close]'); if(x2) await x2.evaluate(e=>e.click()).catch(()=>{}); const [x,y]=await p.evaluate(k=>window.bv.slotScreen(k),g); if(y>150&&y<760) await p.touchscreen.tap(x,y+25); await p.waitForTimeout(150);
    for (const sel of ['#sheet [data-act=hire]:not([disabled])','#sheet .trow[data-act^="tech:"]:not([disabled])','#sheet [data-act=buy]:not([disabled])']) { const bb=await p.$(sel); if(bb) await bb.evaluate(e=>e.click()).catch(()=>{}); } }
  else { for(let k=0;k<3;k++){ const bb=await p.$('#sheet [data-act=buy]:not([disabled])'); if(bb) await bb.evaluate(e=>e.click()).catch(()=>{}); } }
  await p.waitForTimeout(400);
} };
const hide=async on=>{ await p.evaluate(on=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>on}); Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>on?'hidden':'visible'}); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('visibilitychange')); },on); };
let cyc=0;
while(Date.now()-t0<MIN*60000){
  cyc++;
  // 1) active play ~4 min with health every 10s
  for(let k=0;k<24;k++){ await play(10); await health('play'); }
  // 2) background: hide + freeze for 90s, then return; expect ~perSec*90 credited
  const before=await p.evaluate(()=>({cash:window.G.S.cash,ps:window.G.perSec()})); await hide(true); await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
  await new Promise(r=>setTimeout(r,90000)); await cdp.send('Page.setWebLifecycleState',{state:'active'}); await hide(false); await p.waitForTimeout(1500);
  const wb=await p.$('.modal.wb, .modal #col'); const gotModal=!!wb; if(wb){ await p.screenshot({path:`shots/soak-bg-${cyc}.png`}); await wb.evaluate(e=>(e.querySelector?.('#col')||e).click()).catch(()=>{}); await p.waitForTimeout(500); }
  const after=await p.evaluate(()=>window.G.S.cash); log({tag:'bg',cyc,expect:Math.round(before.ps*90),gain:Math.round(after-before.cash),modal:gotModal}); await health('bg-return');
  // 3) every other cycle: offline return (close tab, wind clock back 2h, reopen)
  if(cyc%2===0){ await p.evaluate(()=>window.G.save()); const ps=await p.evaluate(()=>window.G.perSec()), c0=await p.evaluate(()=>window.G.S.cash); await p.close();
    const tmp=await ctx.newPage(); await tmp.goto(URL+'?noop'); await tmp.evaluate(()=>{ const k='starforge.v2'; const o=JSON.parse(localStorage.getItem(k)); o.last-=2*3600e3; localStorage.setItem(k,JSON.stringify(o)); }); await tmp.close();
    await open(); const wb2=await p.$('.modal #col'); if(wb2){ await p.screenshot({path:`shots/soak-off-${cyc}.png`}); await wb2.click({force:true}).catch(()=>{}); }
    await p.waitForTimeout(800); const c1=await p.evaluate(()=>window.G.S.cash); log({tag:'offline',cyc,psBefore:Math.round(ps),gain:Math.round(c1-c0),modal:!!wb2}); await health('off-return'); }
}
log({tag:'done',errs}); await b.close();
