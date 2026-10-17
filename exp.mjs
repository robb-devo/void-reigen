// A/B raster-cost experiments: monkeypatch canvas ops in-page and compare fps / main-thread busy
import { execSync } from 'child_process';
const ex={
 base:"",
 noBig:"const c=window.bv.c,o=c.drawImage.bind(c),W=window.bv.cv.width; c.drawImage=(i,...a)=>{ if(i.width>=W*.9) return; o(i,...a)}",
 noImg:"const c=window.bv.c; c.drawImage=()=>{}",
 noGrad:"const c=window.bv.c,o=c.fillRect.bind(c); c.fillRect=(...a)=>{ if(typeof c.fillStyle!=='string') return; o(...a)}",
 noPath:"const c=window.bv.c; c.fill=()=>{}; c.stroke=()=>{}",
 dpr1:"const v=window.bv; v.dpr=1; v.resize()",
};
for (const [k,v] of Object.entries(ex)) { const out=execSync('node prof.mjs',{env:{...process.env,QUICK:1,EXTRA:v+";window.__night=0"}}).toString(); console.log(k.padEnd(7), out.split('\n').filter(l=>/^(extra)/.test(l)).join(' || ')); }
