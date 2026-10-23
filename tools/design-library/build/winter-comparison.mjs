/** Local side-by-side proof: approved prototype and the shipping inert preview. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readDesigns } from './inventory.mjs';
import { publicPreview } from './public-preview.mjs';
const root = resolve(import.meta.dirname, '../../..');
const out = resolve(root, 'tools/design-library/out');
const map = JSON.parse(readFileSync(resolve(root, 'docs/reviews/winter-fidelity-2026-10-23/prototype-map.json')));
const designs = readDesigns(root);
const renderer = readFileSync(resolve(out, 'renderer.iife.js'), 'utf8');
mkdirSync(resolve(out, 'winter-fidelity'), { recursive: true });
for (const item of map) {
  const design = designs.find(design => design.id === item.native_id);
  if (!design) throw new Error(`Missing ${item.native_id}`);
  item.screens = design.tree.steps.map(step => ({ id: step.id, name: step.name }));
  writeFileSync(resolve(out, 'winter-fidelity', item.id + '.html'), publicPreview({ templates: [design] }, renderer, [], { designId: design.id, designOnly: true }));
}
writeFileSync(resolve(out, 'winter-fidelity.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Winter prototype comparison</title>
<style>*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui;background:#e9ece7;color:#21382e}header{padding:18px 24px;background:#fff;position:sticky;top:0;z-index:2;border-bottom:1px solid #b7c6bc}h1{font-size:22px;margin:0 0 6px}p{margin:6px 0}nav{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px}button,select{font:inherit;padding:9px;border:1px solid #7e9487;border-radius:6px;background:white;color:inherit}main{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px}section{min-width:0}h2{font-size:16px;margin:0 0 10px}.viewport{overflow:hidden;position:relative}.viewport img{display:block;max-width:100%;height:auto;margin-inline:auto}@media(max-width:650px){main{grid-template-columns:1fr}}</style>
<header><h1>Approved prototype / native template</h1><p>All 40 designs. Right-hand previews use the same generator as the template server. Countdown values are examples; signup and copy buttons are inert here.</p><nav><button id="prev" aria-label="Previous template">←</button><select id="design" aria-label="Template"></select><button id="next" aria-label="Next template">→</button><select id="width" aria-label="Viewport"><option value="1000">Desktop · 1000px</option><option value="320">Phone · 320px</option></select><select id="screen" aria-label="Screen"></select></nav></header>
<main><section><h2>Approved prototype</h2><div class="viewport"><img id="prototype" alt="Approved prototype"></div></section><section><h2>Native implementation</h2><div class="viewport"><img id="native" alt="Native implementation"></div></section></main>
<script>const items=${JSON.stringify(map)},get=id=>document.getElementById(id);let current=0;get('design').innerHTML=items.map((x,i)=>'<option value="'+i+'">'+x.id+' · '+x.name+'</option>').join('');
function show(reset){current=Number(get('design').value);const item=items[current];if(reset)get('screen').innerHTML=item.screens.map((s,i)=>'<option value="'+i+'">'+s.name+'</option>').join('');const step=Number(get('screen').value)||0;get('prototype').src='winter-fidelity/views/'+item.id+'-'+step+'-'+get('width').value+'-prototype.png';get('native').src='winter-fidelity/views/'+item.id+'-'+step+'-'+get('width').value+'-native.png';}
get('design').onchange=()=>show(true);get('screen').onchange=()=>show(false);get('width').onchange=()=>show(false);['prev','next'].forEach((id,i)=>get(id).onclick=()=>{get('design').value=(current+(i?1:items.length-1))%items.length;show(true);});show(true);</script></html>`);
console.log('winter-fidelity.html: 40 paired prototype / native previews');

if (process.argv.includes('--capture')) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  mkdirSync(resolve(out, 'winter-fidelity/views'), { recursive: true });
  try {
    for (const item of map) for (const width of [320, 1000]) for (const [step, screen] of item.screens.entries()) {
      await page.setViewportSize({ width, height: 900 });
      for (const kind of ['prototype', 'native']) {
        const url = kind === 'prototype'
          ? `http://127.0.0.1:5194/?render=${item.id}&motion=off${step ? '&screen=ack' : ''}`
          : `http://127.0.0.1:9452/winter-fidelity/${item.id}.html#screen=${encodeURIComponent(screen.id)}&device=${width === 320 ? 'mobile' : 'desktop'}`;
        await page.goto(url);
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
        await page.locator(kind === 'prototype' ? '.campaign' : '#sample').screenshot({ path: resolve(out, `winter-fidelity/views/${item.id}-${step}-${width}-${kind}.png`), animations: 'disabled' });
      }
    }
  } finally { await browser.close(); }
  console.log('Captured all 55 screens, at desktop and phone widths, from both implementations.');
}
