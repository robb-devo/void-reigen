// Real-time playtest of the BASE view: follow goal arrows, tap slots, use the building sheet.
import { chromium } from 'playwright';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('http://localhost:4173/'); await p.waitForTimeout(900);
const T=+(process.env.T||240), t0=Date.now(), log=[]; const marks=[15,60,120,180,240]; let mi=0, skip=0;
const tapSlot=async k=>{ const [x,y]=await p.evaluate(k=>window.bv.slotScreen(k),k); if(y>200&&y<700&&x>10&&x<380) { await p.touchscreen.tap(x,y+25); await p.waitForTimeout(80);} };
while(Date.now()-t0<T*1000){
  const c=await p.$('#claim'); if(c){ log.push(`${Math.round((Date.now()-t0)/1000)}s ${await p.$eval('.gm b',e=>e.textContent)}`); await c.click({force:true}).catch(()=>{}); await p.waitForTimeout(200); continue; }
  const go=await p.$('[data-go]'); if(go && Date.now()>skip && await go.getAttribute('data-go').catch(()=>'base')!=='base'){ await go.click({force:true}).catch(()=>{}); await p.waitForTimeout(300); const bs=await p.$$('.coach:not([disabled])'); if(bs.length) await bs[0].click({force:true}).catch(()=>{}); else skip=Date.now()+8000; await p.tap('nav button[data-t=base]',{force:true}); continue; }
  if(await p.$eval('nav button.on',e=>e.dataset.t)!=='base') await p.tap('nav button[data-t=base]',{force:true});
  const guide=await p.evaluate(()=>window.bv?.guide);
  // drill every idle mine
  const idle=await p.evaluate(()=>window.G.S.mines.map((m,i)=>m.n&&!m.m&&!m.run?i:-1).filter(i=>i>=0));
  if(idle.length){ const x=await p.$('#sheet.open [data-act=close]'); if(x) await x.evaluate(e=>e.click()).catch(()=>{}); await p.waitForTimeout(150); }
  for(const i of idle) { await tapSlot('m'+i); }
  if(guide){ const x2=await p.$('#sheet.open [data-act=close]'); if(x2) { await x2.evaluate(e=>e.click()).catch(()=>{}); await p.waitForTimeout(200); } await tapSlot(guide); await p.waitForTimeout(150); const hb2=await p.$('#sheet [data-act=hire].coach:not([disabled])'); if(hb2) await hb2.evaluate(e=>e.click()).catch(()=>{}); const tb=await p.$('#sheet .trow[data-act^="tech:"]:not([disabled])'); if(tb) await tb.evaluate(e=>e.click()).catch(()=>{}); const bb=await p.$('#sheet [data-act=buy]:not([disabled])'); if(bb) await bb.evaluate(e=>e.click()).catch(()=>{}); }
  else { const hb=await p.$('#sheet [data-act=hire]:not([disabled])'); if(hb) await hb.evaluate(e=>e.click()).catch(()=>{}); }
  await p.waitForTimeout(250);
  if(mi<marks.length && Date.now()-t0>marks[mi]*1000){ await p.screenshot({path:`shots/pb-${String(marks[mi]).padStart(3,'0')}s.png`}); mi++; }
}
const s=await p.evaluate(()=>window.G.S); console.log(log.join('\n')); console.log('cash',s.cash.toFixed(0),'life',s.life.toFixed(0),'mines',s.mines.map(m=>m.n).join(','),'mach',s.mach.join(','),'goal',s.goal,'errors',JSON.stringify(errs)); await b.close();
