/** Read-only comparison of the reviewed prototype and actual catalogue previews. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readDesigns } from './inventory.mjs';
import { publicPreview } from './public-preview.mjs';
const root = resolve(import.meta.dirname, '../../..');
const out = resolve(root, 'tools/design-library/out');
const map = JSON.parse(readFileSync(resolve(root, 'docs/reviews/everyday-2026-10-24/prototype-map.json')));
const designs = readDesigns(root, { pictures: true });
const prepared = JSON.parse(readFileSync(resolve(out, 'pilot.json')));
const renderer = readFileSync(resolve(out, 'renderer.iife.js'), 'utf8');
mkdirSync(resolve(out, 'everyday-fidelity'), { recursive: true });
for (const item of map) {
  const source = designs.find(d => d.id === item.native_id);
  const entry = prepared.find(d => d.id === item.native_id);
  const design = { ...source, tree: entry.tree, tokens: entry.tokens };
  writeFileSync(resolve(out, 'everyday-fidelity', item.id + '.html'), publicPreview({ templates: [design] }, renderer, [], { designId: design.id, designOnly: true }));
}
writeFileSync(resolve(out, 'everyday-fidelity.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Everyday prototype / native templates</title>
<style>*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui;background:#ece9e2;color:#27362e}header{padding:20px;background:#fff;position:sticky;top:0;z-index:2}h1{font-size:23px;margin:0}p{margin:8px 0}nav{display:flex;gap:10px;flex-wrap:wrap}button,select{font:inherit;padding:9px}main{display:flex;gap:24px;padding:24px;overflow:auto}section{flex:none}h2{font-size:16px}iframe{display:block;border:0;background:transparent;height:1500px}small{display:block;max-width:900px}</style>
<header><h1>Everyday, extraordinary · prototype / native</h1><p>50 real templates. Native previews use the same generator as the template catalogue.</p><nav><button id="prev">Previous</button><select id="design" aria-label="Design"></select><button id="next">Next</button><select id="width" aria-label="Viewport"><option value="320">Phone · 320px</option><option value="1000">Desktop · 1000px</option></select><select id="screen" aria-label="Screen"></select></nav><small>Native previews are inert. Consent follows campaign purpose; coupons, resource URLs and deadlines need configuration. Resource actions remain hidden until configured. Local preview fonts match the prototype; merchant sites use their chosen font-delivery settings.</small></header>
<main><section><h2>Reviewed prototype</h2><iframe id="prototype" title="Reviewed prototype"></iframe></section><section><h2>Native prepared campaign</h2><iframe id="native" title="Native prepared campaign"></iframe></section></main>
<script>const items=${JSON.stringify(map)},get=id=>document.getElementById(id);get('design').innerHTML=items.map((x,i)=>'<option value="'+i+'">'+x.id+' · '+x.name+' · '+x.tier+'</option>').join('');function show(reset){const item=items[Number(get('design').value)],width=Number(get('width').value);if(reset)get('screen').innerHTML=item.screens.map((s,i)=>'<option value="'+i+'">'+s.name+'</option>').join('');const step=Number(get('screen').value)||0;get('prototype').src='http://127.0.0.1:5195/?render='+item.id+(step?'&screen=ack':'');get('native').src='everyday-fidelity/'+item.id+'.html#screen='+item.screens[step].id+'&device='+(width===320?'mobile':'desktop');for(const id of ['prototype','native'])get(id).style.width=width+'px';}get('design').onchange=()=>show(true);get('width').onchange=()=>show(false);get('screen').onchange=()=>show(false);['prev','next'].forEach((id,i)=>get(id).onclick=()=>{get('design').value=(Number(get('design').value)+(i?1:items.length-1))%items.length;show(true);});show(true);</script></html>`);
console.log('everyday-fidelity.html: 50 prototype / native catalogue comparisons');
