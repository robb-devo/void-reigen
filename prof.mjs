import { chromium } from 'playwright';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
const late={v:2,cash:4e13,life:2e14,total:0,dm:108,warps:2,mines:M([[420,1],[300,1],[260,1],[220,1],[180,1],[150,1],[120,1],[80,1],[12,0]]),tech:[],res:{...z,ore:9e9,quartz:5e9,ingot:2e8,glass:1e8,part:3e7,alloy:8e6,chip:4e5,hull:2e4,exotic:120},made:{...z,ingot:1},mach:[120,110,90,70,40,20,6],on:Array(7).fill(true),gen:180,ships:{scout:40},conquered:['p1'],missions:[],fupg:{},uid:1,ach:[],goal:40,sold:1,lost:0,wins:0,w:Array(7).fill(50),auto:false,taps:5,played:600,last:Date.now(),mult:0,mute:true};
await ctx.addInitScript(s=>localStorage.setItem('starforge.v2',s),JSON.stringify(late));
const p=await ctx.newPage(); await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500); await p.$eval('#col',e=>e.click()).catch(()=>{});
console.log(await p.evaluate(()=>{const v=window.bv; let t=performance.now(); for(let i=0;i<60;i++) v.draw(0.016); const d=(performance.now()-t)/60; t=performance.now(); for(let i=0;i<60;i++) v.links(); return 'draw ms '+d.toFixed(2)+' links ms '+((performance.now()-t)/60).toFixed(3);}));
await b.close();
