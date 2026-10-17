// Renders the app icon + splash sources for @capacitor/assets from the SVGs in art-src/ (game style: ink outlines, gold + cyan).
import { chromium } from 'playwright'; import fs from 'fs';
const fg=fs.readFileSync('art-src/fg.svg','utf8'), bg=fs.readFileSync('art-src/bg.svg','utf8');
const font=fs.readFileSync('node_modules/@fontsource/fredoka/files/fredoka-latin-700-normal.woff2').toString('base64');
const b=await chromium.launch();
async function shot(out,size,body,transparent=false){ const p=await b.newPage({viewport:{width:size,height:size}}); await p.setContent(`<html><head><style>@font-face{font-family:F;src:url(data:font/woff2;base64,${font})}html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden;background:${transparent?'transparent':'#0a0520'}}.l{position:absolute;inset:0}.l svg{width:100%;height:100%}</style></head><body>${body}</body></html>`); await p.evaluate(()=>document.fonts.ready); await p.screenshot({path:out,omitBackground:transparent}); await p.close(); }
const layer=(svg,scale=1,dy=0)=>`<div class="l" style="transform:translateY(${dy}%) scale(${scale})">${svg}</div>`;
await shot('assets/icon-foreground.png',1024,layer(fg,.74),true);
await shot('assets/icon-background.png',1024,layer(bg));
await shot('assets/icon-only.png',1024,layer(bg)+layer(fg,.92));
const title=`<div style="position:absolute;left:0;right:0;top:57%;text-align:center;font:700 150px F;letter-spacing:6px;color:#ffd23f;-webkit-text-stroke:24px #24163a;paint-order:stroke fill;text-shadow:0 14px 0 #24163a">VOID REIGEN</div><div style="position:absolute;left:0;right:0;top:64.5%;text-align:center;font:700 58px F;letter-spacing:10px;color:#5cf2ff;-webkit-text-stroke:11px #24163a;paint-order:stroke fill">IDLE SPACE MINING</div>`;
for (const n of ['splash','splash-dark']) await shot(`assets/${n}.png`,2732,`<div class="l" style="transform:scale(1.6)">${bg}</div>`+layer(fg,.3,-10)+title);
await b.close(); console.log('rendered');
