import { execSync } from 'child_process';
const css=s=>`const st=document.createElement('style'); st.textContent=${JSON.stringify(s)}; document.head.appendChild(st)`;
const ex={
 base:"",
 noCanvas:css("#base{display:none!important}"),
 noBackdrop:css("*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}"),
 noAnim:css("*{animation:none!important;transition:none!important}"),
 noHud:css("body>*:not(#app):not(main){display:none!important}"),
 noFilter:css("*{filter:none!important;box-shadow:none!important}"),
};
for (const [k,v] of Object.entries(ex)) { const out=execSync('node prof.mjs',{env:{...process.env,QUICK:1,EXTRA:v+";window.__night=0"}}).toString(); console.log(k.padEnd(10), out.split('\n').filter(l=>/^(extra)/.test(l)).join(' || ')); }
