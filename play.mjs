// Real-time first-minutes playtest following the goal bar like a new player.
import { chromium } from 'playwright';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('http://localhost:4173/'); await p.waitForTimeout(800);
const F={force:true}; const t0=Date.now(); const marks=[20,60,120,180,240]; let mi=0; const log=[];
while(Date.now()-t0<245000){
  const c=await p.$('#claim'); if(c){ log.push(`${Math.round((Date.now()-t0)/1000)}s claim: `+(await p.$eval('.gm b',e=>e.textContent))); await c.click(F); await p.waitForTimeout(250); continue; }
  const go=await p.$('[data-go]'); if(go){ await go.click(F); await p.waitForTimeout(300); }
  const coach=await p.$('.coach'); if(coach && !(await coach.evaluate(e=>e.disabled))) { await coach.click(F).catch(()=>{}); }
  else { const tab=await p.$eval('nav button.on',e=>e.dataset.t);
    if(tab==='mine'){ await p.tap('#roid',F).catch(()=>{}); const bs=await p.$$('.biz .buy:not([disabled])'); if(bs.length) await bs[bs.length-1].click(F); }
    else if(tab==='fac'){ const bs=await p.$$('.mach .btn:not([disabled]), .gen .btn:not([disabled]), [data-u]:not([disabled]), .mk:not([disabled])'); if(bs.length) await bs[0].click(F); await p.tap('nav button[data-t=mine]',F); }
    else if(tab==='crew'){ const bs=await p.$$('[data-m]:not([disabled])'); if(bs.length) await bs[0].click(F); await p.tap('nav button[data-t=mine]',F); }
    else await p.tap('nav button[data-t=mine]',F); }
  await p.waitForTimeout(300);
  if(mi<marks.length && Date.now()-t0>marks[mi]*1000){ await p.screenshot({path:`shots/play-${String(marks[mi]).padStart(3,'0')}s.png`}); mi++; }
}
const s=await p.evaluate(()=>JSON.parse(localStorage.getItem('starforge.v2')));
console.log(log.join('\n')); console.log('cash',s.cash.toFixed(0),'life',s.life.toFixed(0),'mines',s.mines.map(m=>m.n).join(','),'mach',s.mach.join(','),'goal',s.goal,'errors',JSON.stringify(errs)); await b.close();
