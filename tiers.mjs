import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:1250}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:5199/src/base/render.ts'); await p.setContent('<body style="margin:0;background:#2a1838"><canvas id=c width=1100 height=1250></canvas></body>');
await p.addScriptTag({type:'module',content:`
import {drawBuilding} from 'http://localhost:5199/src/base/render.ts';
const c=document.getElementById('c').getContext('2d'); c.fillStyle='#7d5397'; c.fillRect(0,0,1100,1250);
const B=(process=>process)([['mine','drill',30],['mine','iron',20],['mach','smelter',20],['mach','fab',280],['gen','gen',50],['yard','yard',200]]);
B.forEach(([k,id,h],r)=>{for(let t=0;t<5;t++){const x=110+t*210,y=170+r*200; c.save(); c.translate(x,y); drawBuilding(c,0,k,id,h,t,0,0,2,0,true,'#5cf2ff'); drawBuilding(c,1,k,id,h,t,0,0,2,1.2,true,'#5cf2ff'); c.restore();}}); window.done=1;`});
await p.waitForFunction(()=>window.done,null,{timeout:15000}).catch(()=>{}); await p.screenshot({path:'shots/tiers-'+(process.env.N||0)+'.png'}); console.log(errs); await b.close();
