import { JSDOM } from 'jsdom';
import { createHash } from 'node:crypto';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Build inert rendered screens, never publish editable trees or the premium renderer. */
export function publicPreview(pack, renderer, media = []) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  try {
    dom.window.eval(renderer);
    const rendererApi = dom.window.WConvertRenderer;
    pack = structuredClone(pack);
    for (const binding of pack.image_bindings ?? []) {
      const asset = pack.assets.find(item => item.id === binding.asset_id);
      const bytes = media.find(item => item.id === binding.asset_id)?.bytes;
      if (!asset || !Buffer.isBuffer(bytes) || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error('Public preview needs verified image bytes');
      const walk = node => { if (node.id === binding.node_id) node.src = `data:${asset.mime};base64,${bytes.toString('base64')}`; for (const key of ['children','start','end']) for (const child of node[key] ?? []) walk(child); };
      for (const step of pack.templates.find(item => item.id === binding.template_id).tree.steps) walk(step.content);
    }
    const screens = [];
    for (const design of pack.templates) for (const [index, step] of design.tree.steps.entries()) for (const variant of step.results?.length ? step.results : [null]) {
      const node = rendererApi.render(design.tree, design.tokens, index);
      if (variant) {
        const heading = node.querySelector('[data-result-heading]'), body = node.querySelector('[data-result-body]'), link = node.querySelector('[data-result-link]');
        if (heading) heading.textContent = variant.heading;
        if (body) body.textContent = variant.body;
        if (link) { link.hidden = false; link.textContent = variant.link_label || 'Review the destination in the editor'; }
      }
      for (const timer of node.querySelectorAll('[role=timer]')) { timer.textContent = '02d 14h 00m'; timer.setAttribute('aria-label', 'Example countdown, not a live deadline'); timer.setAttribute('title', 'Example countdown. Set your own campaign deadline.'); }
      // All actions stay in the showcase toolbar. Samples cannot navigate or submit.
      for (const control of node.querySelectorAll('input,select,textarea,button')) { control.disabled = true; control.removeAttribute('name'); }
      for (const link of node.querySelectorAll('a')) { link.removeAttribute('href'); link.removeAttribute('target'); }
      const css = rendererApi.SHADOW_CSS;
      const html = `<style>${css}</style>${node.outerHTML}`;
      screens.push({ name: `${design.name} · ${step.name}${variant ? ` · ${variant.heading}` : ''}`, type: design.display_type, tier: design.tier === 'free' ? 'Free' : 'Pro', html });
    }
    const revision = createHash('sha256').update(JSON.stringify(pack)).update(renderer).digest('hex');
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escape(pack.name)} · WConvert designs</title>
<style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:#f2f5f3;color:#183d35;font:16px/1.5 system-ui}main{max-width:1200px;margin:auto;padding:24px}h1{font-size:clamp(24px,4vw,36px);letter-spacing:-.03em;margin:8px 0}p{max-width:65ch}nav{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}button,select{font:inherit;min-height:40px;border:1px solid #758c84;border-radius:8px;padding:7px 12px;background:white;color:inherit}button{cursor:pointer}button[aria-pressed=true]{background:#205b52;color:white}button:focus-visible,select:focus-visible{outline:3px solid #985600;outline-offset:3px}label{display:flex;align-items:center;gap:8px}section{background:#e5eae6;border:1px solid #c7d3cc;border-radius:16px;padding:24px;overflow:auto}#sample{display:block;margin:auto;max-width:100%;width:100%;container-type:inline-size}#frame{width:100%;max-width:100%;margin:auto}#frame.phone{width:320px}small{display:block;margin:16px 0}select{max-width:100%}@media(max-width:500px){main{padding:16px}section{padding:12px}nav label{width:100%;flex-wrap:wrap}}</style>
<main><small>WConvert · ${escape(pack.version)}</small><h1>${escape(pack.name)}</h1><p>${escape(pack.description)}</p><p>Explore every screen. These samples do not collect details or send messages.</p><nav aria-label="Preview controls"><label>Design and screen <select id="screen">${screens.map((s, i) => `<option value="${i}">${escape(s.name)} · ${s.tier}</option>`).join('')}</select></label><button id="desktop" aria-pressed="true">Desktop</button><button id="mobile" aria-pressed="false">Mobile</button><button id="direction" aria-pressed="false">Right to left</button></nav><p id="format"></p><section aria-label="Design preview"><div id="frame"><div id="sample"></div></div></section><small>Sample content and example countdowns. Review your wording, destinations and campaign dates in the editor.</small><details><summary>Preview revision</summary><small>${revision}</small></details></main>
${screens.map((s, i) => `<template id="view-${i}">${s.html}</template>`).join('')}
<script>(()=>{const sample=document.getElementById('sample'),root=sample.attachShadow({mode:'closed'}),select=document.getElementById('screen');const formats=${JSON.stringify(screens.map(s => s.type)).replace(/</g, '\\u003c')};const show=()=>{root.replaceChildren(document.getElementById('view-'+select.value).content.cloneNode(true));document.getElementById('format').textContent='Format: '+({popup:'Popup',inline:'Inside the page',floating_bar:'Notification bar',bar:'Notification bar',slide_in:'Slide-in',fullscreen:'Full screen'}[formats[Number(select.value)]]||formats[Number(select.value)]);};select.addEventListener('change',show);for(const id of ['desktop','mobile'])document.getElementById(id).addEventListener('click',()=>{document.getElementById('frame').classList.toggle('phone',id==='mobile');for(const name of ['desktop','mobile'])document.getElementById(name).setAttribute('aria-pressed',String(name===id));});document.getElementById('direction').addEventListener('click',event=>{const rtl=sample.dir!=='rtl';sample.dir=rtl?'rtl':'ltr';event.currentTarget.setAttribute('aria-pressed',String(rtl));});show();})();</script></html>`;
  } finally { dom.window.close(); }
}
