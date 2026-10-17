// Interleaved A/B fps + main-thread busy (same load conditions): A=4181, B=4182
import { execSync } from 'child_process';
const R={a:[],b:[]};
for (let i=0;i<3;i++) for (const k of ['a','b']) { const out=execSync('node prof.mjs',{env:{...process.env,URL:`http://localhost:${k==='a'?4181:4182}/`}}).toString();
  for (const l of out.split('\n').filter(l=>/fps/.test(l))) { const [name]=l.split(/\s{2,}/); const fps=+l.match(/fps ([\d.]+)/)[1], task=+l.match(/Task (\d+)%/)[1]; R[k].push({name:name.trim(),fps,task}); } }
const names=[...new Set(R.a.map(x=>x.name))];
for (const n of names) { const av=(k,f)=>{const v=R[k].filter(x=>x.name===n).map(x=>x[f]); return (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1)}; console.log(n.padEnd(12),'A fps',av('a','fps'),'task',av('a','task')+'%','| B fps',av('b','fps'),'task',av('b','task')+'%'); }
console.log('load',(await import('os')).loadavg().map(x=>x.toFixed(1)).join(' '));
