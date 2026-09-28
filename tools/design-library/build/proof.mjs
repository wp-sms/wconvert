import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Full-height paired screens for human review, using the already prepared pilot.
const out = resolve(import.meta.dirname, '../out');
const entries = JSON.parse(readFileSync(resolve(out, 'pilot.json'), 'utf8'));
const renderer = readFileSync(resolve(out, 'renderer.iife.js'), 'utf8');
writeFileSync(resolve(out, 'proof.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Campaign screen proofs</title>
<style>body{margin:24px;font:15px/1.5 system-ui;color:#24362d;background:#f5f4ee}h1{font-size:24px}select,button{font:inherit;padding:10px;margin-right:12px}article{margin:28px 0}.pair{display:flex;gap:24px;align-items:start}.frame{background:#e5e8e1;padding:16px;box-sizing:border-box;flex:none}.wide{width:800px}.phone{width:352px}h2{font-size:18px}small{display:block;margin-bottom:12px;color:#43564a}</style>
<h1>Campaign screen proofs</h1><p>Actual prepared copy · desktop and 320px phone · every screen · no data sent</p><label>Campaign <select id="campaign"></select></label><label><input id="rtl" type="checkbox"> RTL</label><h2 id="title"></h2><main></main>
<script>${renderer}</script><script>
const entries=${JSON.stringify(entries).replaceAll('<', '\\u003c')}, R=WConvertRenderer, picker=document.getElementById('campaign'), main=document.querySelector('main');
for(const entry of entries)picker.add(new Option(entry.name,entry.id));
function render(){R.disposePreview(main);main.replaceChildren();const entry=entries.find(e=>e.id===picker.value);document.getElementById('title').textContent=entry.name+' · '+entry.display_type;entry.tree.steps.forEach((screen,index)=>{const article=document.createElement('article');const title=document.createElement('h2');title.textContent=(index+1)+'. '+screen.name;article.append(title);const pair=document.createElement('div');pair.className='pair';for(const size of ['wide','phone']){const frame=document.createElement('div');frame.className='frame '+size;frame.dir=document.getElementById('rtl').checked?'rtl':'ltr';const label=document.createElement('small');label.textContent=size==='wide'?'Desktop · 768px available':'Phone · 320px available';frame.append(label);const host=document.createElement('div'),shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=R.SHADOW_CSS;shadow.append(style);const root=R.render(entry.tree,entry.tokens,index);root.style.maxHeight='none';root.style.margin='auto';shadow.append(root);R.prepareControls(root,shadow);frame.append(host);pair.append(frame);}article.append(pair);main.append(article);});}
picker.onchange=render;document.getElementById('rtl').onchange=render;render();</script></html>`);
console.log('  proof.html (all campaign screens paired for visual review)');
