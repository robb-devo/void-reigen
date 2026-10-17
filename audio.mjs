import { chromium } from 'playwright'; import fs from 'fs';
const b=await chromium.launch(); const p=await (await b.newContext()).newPage(); await p.goto('http://localhost:4190/'); await p.waitForTimeout(1200);
const names=['tap','select','drill','coin','buy','no','fanfare','claim','launch','warp','clank','blip','build','land','lode','rank','pLamp','pCrystal','pFlag','pBarrel','pMetal','pRadar','rushUp','land2','place','snap'];
fs.mkdirSync('audio',{recursive:true});
for (const n of names) { const a=await p.evaluate(n=>window.__renderSfx(n),n); const f=new Float32Array(a); fs.writeFileSync(`audio/${n}.f32`,Buffer.from(f.buffer)); await p.waitForTimeout(120); }
await b.close(); console.log('ok');
