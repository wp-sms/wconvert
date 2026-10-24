/** Visual regression evidence: the approved prototype and real renderer, same viewport. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { previewFonts } from '../build/preview-fonts.mjs';
const root = path.resolve(import.meta.dirname, '../../..');
const folder = path.join(root, 'docs/reviews/black-friday-fidelity');
fs.mkdirSync(folder, { recursive: true });
const map = JSON.parse(fs.readFileSync(path.join(root, 'docs/reviews/black-friday-2026-10-24/prototype-map.json')));
const selected = process.env.FIDELITY_IDS?.split(',');
const entries = map.filter(x => !selected || selected.includes(x.id));
const renderer = fs.readFileSync(path.join(root, 'tools/design-library/out/renderer.iife.js'), 'utf8');
const browser = await chromium.launch();
const results = [];
const phase = process.env.FIDELITY_PHASE || 'before';
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
 for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const item of entries) {
   await page.goto(`http://127.0.0.1:8846/frame.html?id=${item.id}&review&motion=off`);
   await page.evaluate(async () => { await document.fonts.ready; });
   const reference = await page.locator('.design').evaluate(el => {
    const s = getComputedStyle(el), h = el.querySelector('h1') || el.querySelector('.r45-top>strong');
    return { width: el.offsetWidth, height: el.offsetHeight, background: s.backgroundColor, palette: Object.fromEntries(["--bg","--fg","--accent","--button-ink","--em"].map(k=>[k,s.getPropertyValue(k).trim()])), buttonRadius: getComputedStyle(el.querySelector(".cta")).borderRadius,
     heading: h && { text: h.textContent, font: getComputedStyle(h).fontFamily, size: getComputedStyle(h).fontSize, weight: getComputedStyle(h).fontWeight } };
   });
   const ref = `${item.id}-${width}-prototype.png`;
   if (!fs.existsSync(path.join(folder, ref))) await page.locator('.design').screenshot({ path: path.join(folder, ref), animations: 'disabled' });
   const design = JSON.parse(fs.readFileSync(path.join(root, item.directory, 'templates', item.native_id + '.json')));
   const data = JSON.stringify(design).replaceAll('<', '\\u003c');
   await page.setContent(`<style>${previewFonts([design])}body{margin:0;padding:26px;display:flex;justify-content:center;background:#e9e7e3}.frame{max-width:100%;width:${['floating_bar','inline','fullscreen'].includes(design.display_type)?'100%':design.tokens.width}}@media(max-width:650px){body{padding:16px}}</style><div class="frame"><div id="host"></div></div><script>${renderer}</script><script>const d=${data};const s=document.querySelector('#host').attachShadow({mode:'open'});const css=document.createElement('style');css.textContent=WConvertRenderer.SHADOW_CSS;s.append(css);const r=WConvertRenderer.render(d.tree,d.tokens,0);r.style.maxBlockSize='none';s.append(r);if(d.display_type!=='inline')r.append(WConvertRenderer.closeButton(()=>{}));r.querySelectorAll('.wc-count').forEach(n=>n.textContent=({d:'37',h:'11',m:'53',s:'18'})[n.dataset.unit]||'37d 11:53:18');</script>`);
   await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelector('#host').shadowRoot.querySelectorAll('img')].map(i=>i.decode().catch(()=>{}))); });
   const native = await page.locator('.wc-root').evaluate(el => {
    const h=el.querySelector('.wc-heading'), r=el.getBoundingClientRect();
    const nodes=[...el.querySelectorAll('.wc-leaf,.wc-panel,.wc-row,.wc-grid,.wc-split')];
    const overflow=nodes.filter(n=>{const b=n.getBoundingClientRect();return b.left<r.left-2||b.right>r.right+2}).map(n=>n.getAttribute('data-node-id')||n.className);
    const close=el.querySelector('.wc-close')?.getBoundingClientRect();
    const closeOverlap=close?nodes.filter(n=>{if(!n.matches('.wc-leaf')||n.matches('.wc-image'))return false;const b=n.getBoundingClientRect();return b.left<close.right&&b.right>close.left&&b.top<close.bottom&&b.bottom>close.top}).map(n=>n.textContent):[];
    return {width:el.offsetWidth,height:el.offsetHeight,heading:h&&{text:h.textContent,font:getComputedStyle(h).fontFamily,size:getComputedStyle(h).fontSize,weight:getComputedStyle(h).fontWeight},overflow,closeOverlap};
   });
   const file=`${item.id}-${width}-${phase}.png`;
   await page.locator('.wc-root').screenshot({ path:path.join(folder,file),animations:'disabled' });
   results.push({id:item.id,name:item.name,width,reference,native,ref,file});
   console.log(item.id,width,reference.height,native.height);
  }
 }
} finally { await browser.close(); }
fs.writeFileSync(path.join(folder,`${phase}.json`),JSON.stringify(results,null,2)+'\n');
// Pairs retain their natural aspect ratios; both are scaled by the same factor.
for(let batch=0;batch<10;batch++){
 const rows=results.filter(r=>Number(r.id)>batch*5&&Number(r.id)<=batch*5+5);
 if(!rows.length)continue;
 const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#e9e7e3;font:14px system-ui}h2{margin:10px 0}section{margin-bottom:25px;break-inside:avoid}.pair{display:flex;gap:12px;align-items:start}.pair img{width:100%;display:block}.pair div{width:48%}small{display:block;margin-bottom:8px}</style>${rows.map(r=>`<section><h2>${r.id} · ${r.name} · ${r.width}px</h2><div class="pair"><div><small>Approved prototype · ${r.reference.width} × ${r.reference.height}</small><img src="${r.ref}"></div><div><small>Native · ${r.native.width} × ${r.native.height}</small><img src="${r.file}"></div></div></section>`).join('')}`;
 fs.writeFileSync(path.join(folder,`${phase}-sheet-${batch+1}.html`),html);
}
