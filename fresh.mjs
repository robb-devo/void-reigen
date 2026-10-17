import { chromium } from 'playwright';
const b = await chromium.launch(); const errs=[];
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const p=await ctx.newPage(); p.on('console',m=>m.type()==='error'&&errs.push(m.text())); p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4190/'); await p.waitForTimeout(1500);
// skip intro beats
for(let k=0;k<6;k++){ await p.mouse.click(200,300); await p.waitForTimeout(250); }
// play: tap the drill a lot, buy drills, until goal 2
for(let k=0;k<160;k++){ const [x,y]=await p.evaluate(()=>window.bv?window.bv.slotScreen('m0'):[0,0]); await p.mouse.click(x,y+30); await p.waitForTimeout(60); if(k%10==0){ const c=await p.$('#claim'); if(c) await c.click({force:true}); const bb=await p.$('#sheet.open [data-act=buy]:not([disabled])'); if(bb) await bb.click({force:true}); } }
await p.evaluate(()=>{ window.G.S.cash+=2000; });
await p.waitForTimeout(800); for(let k=0;k<4;k++){ const c=await p.$('#claim'); if(c) await c.click({force:true}); await p.waitForTimeout(300);} await p.mouse.click(200,300); await p.waitForTimeout(300); await p.mouse.click(200,300); await p.waitForTimeout(500);
await p.screenshot({path:'shots/s11-fresh-goal.png'});
console.log('goal', await p.evaluate(()=>window.G.S.goal), 'mines', await p.evaluate(()=>window.G.S.mines[0].n), 'build', await p.evaluate(()=>document.querySelector('#buildbtn')?.className));
const bt=await p.$('#buildbtn.show'); if(bt){ await bt.click({force:true}); await p.waitForTimeout(600); await p.screenshot({path:'shots/s11-fresh-shop.png'}); const c=await p.$('.scard.coach, .scard.afford'); if(c){ await c.click({force:true}); await p.waitForTimeout(1000); await p.tap('[data-pb=ok]',{force:true}); await p.waitForTimeout(2500); await p.screenshot({path:'shots/s11-fresh-placed.png'}); } }
console.log('pos', JSON.stringify(await p.evaluate(()=>window.G.S.pos)), 'mach', JSON.stringify(await p.evaluate(()=>window.G.S.mach)), 'errs', JSON.stringify(errs));
await b.close();
