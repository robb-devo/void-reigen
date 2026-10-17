export default async function(p, errs){
  const F={force:true};
  await p.screenshot({path:'shots/s11-fb-0.png'});
  await p.tap('#buildbtn',F); await p.waitForTimeout(700); await p.screenshot({path:'shots/s11-shop.png'});
  await p.tap('[data-cat=mach]',F); await p.waitForTimeout(300); await p.screenshot({path:'shots/s11-shop-fac.png'});
  const c=await p.$('.scard.ready.afford'); if(!c){console.log('no afford card');return;}
  console.log('placing', await c.getAttribute('data-k')); await c.click(F); await p.waitForTimeout(1200);
  await p.screenshot({path:'shots/s11-place-1.png'});
  // drag the ghost with the mouse
  const g=await p.evaluate(()=>{const b=window.bv; const pl=b.place; return b.screen(pl.gx,pl.gy);});
  await p.mouse.move(g[0],g[1]-10); await p.mouse.down(); for(let k=1;k<=10;k++){ await p.mouse.move(g[0]-k*9,g[1]-10+k*3); await p.waitForTimeout(30);} await p.mouse.up();
  await p.waitForTimeout(400); await p.screenshot({path:'shots/s11-place-2.png'});
  console.log('place', JSON.stringify(await p.evaluate(()=>window.bv.place)));
  // force an invalid spot to see red
  await p.evaluate(()=>window.bv.placeAt(0,0)); await p.waitForTimeout(300); await p.screenshot({path:'shots/s11-place-bad.png'});
  await p.evaluate(()=>{ const b=window.bv; for (let r=0;r<9;r++) for(const [x,y] of [[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,-r],[r,-r],[-r,r]]) { b.placeAt(x,y); if (b.place.ok) return; } });
  await p.waitForTimeout(300); await p.tap('[data-pb=ok]',F); await p.waitForTimeout(2200); await p.screenshot({path:'shots/s11-placed.png'});
  console.log('pos', JSON.stringify(await p.evaluate(()=>window.G.S.pos)), 'errs', JSON.stringify(errs));
}
