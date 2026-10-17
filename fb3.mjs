import { chromium } from 'playwright';
const b = await chromium.launch(); const errs=[];
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0};
const early={v:2,cash:400,life:300,total:0,dm:0,warps:0,mines:[[5,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]].map(([n,m])=>({n,p:0,m:!!m,run:false})),tech:[],res:{...z,ore:30},made:{...z},mach:[0,0,0,0,0,0],on:[true,true,true,true,true,true],gen:1,ships:{},conquered:[],missions:[],fupg:{},uid:2,ach:[],goal:2,last:Date.now(),taps:60,played:200,daily:{day:30000101,streak:1,at:Date.now()},seen:['intro']};
await ctx.addInitScript(s=>{if(!sessionStorage.seed){sessionStorage.seed=1;localStorage.setItem('starforge.v2',s)}},JSON.stringify(early));
const p=await ctx.newPage(); p.on('console',m=>m.type()==='error'&&errs.push(m.text())); p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:4190/'); await p.waitForTimeout(2000);
await p.screenshot({path:'shots/s11-tut-1.png'});
for (let k=0;k<3;k++){ const n=await p.$('.vex .next, [data-next], .cmd .nx'); if(!n) break; await n.click({force:true}); await p.waitForTimeout(400);} 
await p.evaluate(()=>{ document.querySelectorAll('.vex, .cmdr').forEach(e=>e.click()); });
await p.waitForTimeout(800); await p.screenshot({path:'shots/s11-tut-2.png'});
console.log('coach', await p.evaluate(()=>document.querySelector('#buildbtn')?.className), 'body', await p.evaluate(()=>document.body.className));
console.log('errs', JSON.stringify(errs)); await b.close();
