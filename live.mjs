import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text())); p.on('requestfailed',r=>errs.push('FAIL '+r.url()));
await p.goto('https://robb-devo.github.io/void-reigen/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const [x,y]=await p.evaluate(()=>window.bv.slotScreen('m0')); await p.touchscreen.tap(x,y+25); await p.waitForTimeout(800);
const sw=await p.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()));
await p.screenshot({path:'shots/live-pages.png'}); console.log('title',await p.title(),'cash',await p.textContent('#cash'),'sw',sw,'errors',JSON.stringify(errs)); await b.close();
