import { execSync } from 'child_process';
for (const pf of [0,1,2,4,8,15]) { const out=execSync('node prof.mjs',{env:{...process.env,URL:'http://localhost:4182/',QUICK:1,EXTRA:`window.__pf=${pf};window.__night=0`}}).toString(); console.log('pf',pf, out.split('\n').filter(l=>/^extra/.test(l)).join('')); }
