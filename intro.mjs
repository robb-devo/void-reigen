import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('http://localhost:4173/'); await p.waitForTimeout(2200); await p.screenshot({path:'shots/c01-intro1.png'});
await p.click('.cmdr .cbub'); await p.waitForTimeout(1500); await p.screenshot({path:'shots/c02-intro2.png'});
for(let k=0;k<6;k++){ await p.click('.cmdr .cbub').catch(()=>{}); await p.waitForTimeout(500);} await p.waitForTimeout(900); await p.screenshot({path:'shots/c03-start.png'});
console.log('errors',JSON.stringify(errs)); await b.close();
