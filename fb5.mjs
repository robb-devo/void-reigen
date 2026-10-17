export default async function(p, errs){ console.log(await p.evaluate(()=>{ const b=window.bv; const L=b.links(); return JSON.stringify(L.map(([a,c,r,on])=>[a.key,c.key,r,on,b.routeOf(a,c)])); })); }
