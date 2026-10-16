import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
for (const s of [192,512]) { await p.setViewportSize({width:s,height:s}); await p.goto('file:///workspace/idle-tycoon/public/icon.svg'); await p.screenshot({path:`/workspace/idle-tycoon/public/icon-${s}.png`}); }
await b.close();
