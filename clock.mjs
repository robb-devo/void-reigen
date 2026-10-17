// E2E clock tamper: rewound device clock (save's high-water mark ahead of now) must not reopen the crate or pay offline.
import { chromium } from 'playwright';
const b=await chromium.launch(); const errs=[];
const z={ore:0,quartz:0,ingot:0,glass:0,part:0,alloy:0,chip:0,hull:0,exotic:0}; const M=a=>a.map(([n,m])=>({n,p:0,m:!!m,run:!!m}));
const now=Date.now(), D=864e5, dk=ms=>{const d=new Date(ms); return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate()};
const base={v:2,gv:3,seen:['intro','factory','power','lab','export','foreman','tiers'],cash:2e5,life:2e6,goal:14,mines:M([[50,1],[25,1],[20,0],[10,1],[0,0],[0,0],[0,0],[0,0],[0,0]]),tech:['t0_0'],res:{...z},made:{...z},mach:[1,1,10,5,0,0,0],gen:10,mute:true};
async function run(name, seed){ const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'}); await ctx.addInitScript(s=>{if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('starforge.v2',s)}},JSON.stringify(seed)); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:4173/'); await p.waitForTimeout(2500); const away=await p.evaluate(()=>document.querySelector('.modal.wb p')?.textContent||'-'); await p.evaluate(()=>document.querySelector('#col')?.click()); await p.waitForTimeout(2500);
  const r=await p.evaluate(()=>({ready:window.G.dailyReady(), vex:document.body.classList.contains('vex'), crate:!!document.querySelector('#dopen'), welcome:!!document.querySelector('.modal.wb'), daily:window.G.S.daily, hw:window.G.S.hw})); console.log(name.padEnd(34), JSON.stringify({away,ready:r.ready,vex:r.vex,crate:r.crate,streak:r.daily.streak,hwAhead:Math.round((r.hw-Date.now())/36e5)+'h'})); await ctx.close(); return r; }
// claimed "tomorrow" (clock was +1 day), now back to real time: no crate, no offline credit
await run('clock rewound 1 day after claim', {...base, last:now+D, hw:now+D, daily:{day:dk(now+D),streak:3,at:now+D}});
// played in the past (clock -8h) then restored: last is 8h ago but hw is now → no 8h credit
await run('played with clock -8h, restored', {...base, last:now-8*36e5, hw:now-60e3, daily:{day:dk(now),streak:2,at:now-60e3}});
// honest return after 8h: credited
await run('honest 8h away', {...base, last:now-8*36e5, hw:now-8*36e5, daily:{day:dk(now),streak:2,at:now-9*36e5}});
// clock was 30 days in the future, then fixed: guard accepts, no crate today, streak reset
await run('far-future clock fixed', {...base, last:now+30*D, hw:now+30*D, daily:{day:dk(now+30*D),streak:5,at:now+30*D}});
// normal next day: crate offered
await run('honest next day', {...base, last:now-60e3, hw:now-60e3, daily:{day:dk(now-D),streak:2,at:now-20*36e5}});
console.log('errors',JSON.stringify(errs)); await b.close();
