import { chromium } from 'playwright'; import fs from 'fs';
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
const d=new Date(), TODAY=d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
const late={v:2,gv:3,seen:['intro','factory','power','lab','export','foreman','tiers','fleet','warp','skills','rock2','meteor'],cash:4e13,life:2e14,total:0,dm:108,warps:2,mines:M([[420,1],[300,1],[260,1],[220,1],[180,1],[150,1],[120,1],[80,1],[12,0]]),tech:['t0_0'],res:{...z,ore:9e9},mach:[120,110,90,70,40,20,6],on:Array(7).fill(true),gen:180,ships:{},conquered:[],missions:[],fupg:{},uid:1,ach:[],goal:40,w:Array(7).fill(50),played:6000,last:Date.now(),mute:true,daily:{day:TODAY,streak:1}};
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
await ctx.addInitScript(s=>{localStorage.setItem('starforge.v2',s)},JSON.stringify(late));
const p=await ctx.newPage(); await p.goto('http://localhost:4173/'); await p.waitForTimeout(2500);
await b.startTracing(p,{path:'/tmp/trace.json',categories:['devtools.timeline','disabled-by-default-devtools.timeline','blink','cc','gpu','skia']}); await p.waitForTimeout(3000); await b.stopTracing();
const ev=JSON.parse(fs.readFileSync('/tmp/trace.json')).traceEvents; const main=ev.find(e=>e.name==='thread_name'&&e.args.name==='CrRendererMain'); const tid=main?.tid;
const agg={}; for(const e of ev){ if(e.ph!=='X'||!e.dur) continue; const k=(e.tid===tid?'M ':'o'+e.tid%1000+' ')+e.name; agg[k]=(agg[k]||0)+e.dur; }
Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([k,v])=>console.log((v/3e4).toFixed(1).padStart(6)+'%',k)); await b.close();
