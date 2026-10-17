// environment baseline: rAF rate of an almost empty page with the same browser flags/viewport
import { chromium } from 'playwright';
for (const args of [['--use-gl=swiftshader','--enable-unsafe-swiftshader'],[]]) { const b=await chromium.launch({args}); const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true})).newPage();
await p.setContent('<div id=d style="width:100px;height:100px;background:red"></div>'); await p.waitForTimeout(500);
const f=await p.evaluate(()=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++; d.style.transform=`translateX(${n%50}px)`; if(performance.now()-t0<3000) requestAnimationFrame(f); else r(n/3)}; requestAnimationFrame(f)}));
console.log(args.length?'swiftshader':'default', 'bare-page fps', f.toFixed(1)); await b.close(); }
