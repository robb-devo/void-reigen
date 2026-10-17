export default async function(p, errs){ const F={force:true};
  const [x,y]=await p.evaluate(()=>window.bv.slotScreen('f1')); await p.mouse.click(x,y+30); await p.waitForTimeout(700);
  await p.screenshot({path:'shots/s11-sheet-move.png'});
  await p.tap('[data-act=move]',F); await p.waitForTimeout(900);
  await p.evaluate(()=>{ const b=window.bv; for (let r=1;r<9;r++) for(const [x,y] of [[r,r],[-r,r],[r,-r],[-r,-r],[0,r+5]]) { b.placeAt(x,y); if (b.place.ok) return; } });
  await p.waitForTimeout(500); await p.screenshot({path:'shots/s11-move-ghost.png'});
  await p.tap('[data-pb=ok]',F); await p.waitForTimeout(1200); await p.screenshot({path:'shots/s11-moved.png'});
  console.log('f1', JSON.stringify(await p.evaluate(()=>window.G.S.pos.f1)), JSON.stringify(await p.evaluate(()=>window.bv.links().map(l=>l[0].key+'>'+l[1].key+':'+JSON.stringify(window.bv.routeOf(l[0],l[1]))))), errs);
}
