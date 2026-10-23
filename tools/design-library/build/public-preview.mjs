import { JSDOM } from 'jsdom';
import { previewController } from './preview-controls.mjs';
import { createHash } from 'node:crypto';
import { put, slots } from './design-images.mjs';
import { previewFonts } from './preview-fonts.mjs';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Build inert rendered screens, never publish editable trees, original premium images or the premium renderer. */
export function publicPreview(pack, renderer, media = [], { designId, embed = false, designOnly = false } = {}) {
  if (designOnly && !designId) throw new Error('Design-only v1 requires one explicit design');
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  try {
    dom.window.eval(renderer);
    const rendererApi = dom.window.WConvertRenderer;
    pack = structuredClone(pack);
    for (const binding of pack.image_bindings ?? []) {
      const asset = pack.assets.find(item => item.id === binding.asset_id);
      const item = media.find(candidate => candidate.id === binding.asset_id), bytes = item?.bytes;
      // A premium picture arrives already downscaled (`verified: false`), so it
      // cannot match the original's digest; every other image must.
      if (!asset || !Buffer.isBuffer(bytes) || (item.verified !== false && createHash('sha256').update(bytes).digest('hex') !== asset.sha256)) throw new Error('Public preview needs verified image bytes');
      if (asset.access === 'premium' && item.verified !== false) throw new Error('A public preview never embeds an original premium image');
      const template = pack.templates.find(item => item.id === binding.template_id), design = { tree: template.tree, tokens: template.tokens ?? {} };
      const slot = slots(design)[binding.slot];
      if (!slot || slot.url !== '') throw new Error('Public preview binds an empty picture slot only');
      const uri = `data:${item.mime ?? asset.mime};base64,${bytes.toString('base64')}`;
      put(design, slot.path, slot.background ? `url("${uri}")` : uri);
      template.tokens = design.tokens;
    }
    const screens = [];
    if (designId && !pack.templates.some(design => design.id === designId)) throw new Error("Unknown preview design");
    for (const design of pack.templates.filter(design => !designId || design.id === designId)) for (const [index, step] of design.tree.steps.entries()) for (const variant of step.results?.length ? step.results : [null]) {
      const node = rendererApi.render(design.tree, design.tokens, index);
      if (design.display_type === 'fullscreen') rendererApi.decorateFullscreen(node, design.tokens?.width, '900px');
      if (design.display_type !== 'inline') {
        const close = rendererApi.closeButton(() => {});
        if (design.display_type === 'floating_bar') close.dataset.bar = '';
        node.append(close);
      }
      if (variant) {
        rendererApi.previewResult?.(node, variant, step.products_required);
        const heading = node.querySelector('[data-result-heading]'), body = node.querySelector('[data-result-body]'), link = node.querySelector('[data-result-link]');
        if (heading) heading.textContent = variant.heading;
        if (body) body.textContent = variant.body;
        if (link) { link.hidden = !variant.href; link.textContent = variant.link_label || ''; }
      }
      for (const timer of node.querySelectorAll('[role=timer]')) {
        // Fill the renderer's slots without replacing its boxes or authored labels.
        // Fixed sample values keep public previews and thumbnail captures deterministic.
        const parts = { d: '2', h: '14', m: '00', s: '00' };
        for (const slot of timer.querySelectorAll('.wc-count')) {
          slot.textContent = parts[slot.dataset.unit] ?? '2d 14:00:00';
        }
        timer.setAttribute('aria-label', 'Example countdown, not a live deadline');
        timer.setAttribute('title', 'Example countdown. Set your own campaign deadline.');
      }
      // All actions stay in the showcase toolbar. Samples cannot navigate or submit.
      for (const control of node.querySelectorAll('input,select,textarea,button')) { control.disabled = true; control.removeAttribute('name'); }
      for (const link of node.querySelectorAll('a')) { link.removeAttribute('href'); link.removeAttribute('target'); }
      const css = rendererApi.SHADOW_CSS + '\n.wc-root{max-block-size:none}';
      const html = `<style>${css}</style>${node.outerHTML}`;
      screens.push({ width: design.tokens?.width || '28rem', design: design.id, screen: step.id + (variant ? '/' + variant.id : ''), name: `${design.name} · ${step.name}${variant ? ` · ${variant.heading}` : ''}`, type: design.display_type, tier: design.tier === 'free' ? 'Free' : 'Pro', html });
    }
    const fonts = `<style data-preview-fonts>${previewFonts(pack.templates.filter(design => !designId || design.id === designId))}</style>`;
    const title = designId ? pack.templates.find(design => design.id === designId).name : pack.name;
    const revision = createHash('sha256').update(JSON.stringify(pack)).update(renderer).digest('hex');
    if (designOnly) return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="wconvert-embed" content="design-only:1"><title>${escape(title)} · Design preview</title>
${fonts}
<style>*,*:before,*:after{box-sizing:border-box}html{background:transparent;overflow-x:hidden}body{margin:0;background:transparent;color:#222;font:16px/1.5 system-ui;overflow-x:hidden}main{width:100%;min-width:0;overflow-x:clip}#frame{width:100%;max-width:100%;margin-inline:auto}#frame.phone{width:320px}#frame.phone[data-display=popup],#frame.phone[data-display=slide_in]{padding-inline:16px}#sample{display:block;width:100%;max-width:100%;container-type:inline-size}#sample[hidden]{display:none}#error{margin:16px}main:focus-visible{outline:2px solid #555;outline-offset:-2px}</style>
<main aria-label="${escape(title)} — read-only design preview" tabindex="0"><p id="error" role="alert" hidden></p><div id="frame"><div id="sample"></div></div></main>
${screens.map((s, i) => `<template id="view-${i}">${s.html}</template>`).join('')}
<script>(${previewController.toString()})(${JSON.stringify(screens.map(({design,screen,type,width}) => ({design,screen,type,width}))).replace(/</g, '\\u003c')},true);</script></html>`;
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escape(title)} · WConvert designs</title>
${fonts}
<style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:#f2f5f3;color:#183d35;font:16px/1.5 system-ui}main{max-width:1200px;margin:auto;padding:24px}h1{font-size:clamp(24px,4vw,36px);letter-spacing:-.03em;margin:8px 0}p{max-width:65ch}nav{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}button,select{font:inherit;min-height:40px;border:1px solid #758c84;border-radius:8px;padding:7px 12px;background:white;color:inherit}button{cursor:pointer}button[aria-pressed=true]{background:#205b52;color:white}button:focus-visible,select:focus-visible{outline:3px solid #985600;outline-offset:3px}nav label{display:grid;grid-template-columns:max-content minmax(0,1fr);align-items:center;gap:8px;width:100%;min-width:0}section{background:#e5eae6;border:1px solid #c7d3cc;border-radius:16px;padding:24px;overflow:auto}#sample{display:block;margin:auto;max-width:100%;width:100%;container-type:inline-size}#sample[hidden]{display:none}#frame{width:100%;max-width:100%;margin:auto}#frame.phone{width:320px}#frame.phone[data-display=popup],#frame.phone[data-display=slide_in]{padding-inline:16px}small{display:block;margin:16px 0}select{width:100%;min-width:0;max-width:100%}.embed{padding:12px}.embed header,.embed .revision{display:none}.embed nav{margin:8px 0}.embed section{padding:12px}.embed .disclosure{font-size:13px;margin:0 0 8px}.embed small{font-size:12px;margin:8px 0}@media(max-width:500px){main{padding:16px}section{padding:12px}nav label{grid-template-columns:minmax(0,1fr)}}</style>
<main class="${embed ? 'embed' : 'full'}"><header><small>WConvert · ${escape(pack.version)}</small><h1>${escape(pack.name)}</h1><p>${escape(pack.description)}</p></header><p class="disclosure">Read-only preview. No details are submitted, emails sent, purchases made or designs installed.</p><nav aria-label="Preview controls"><label>Design and screen <select id="screen">${screens.map((s, i) => `<option value="${i}">${escape(s.name)} · ${s.tier}</option>`).join('')}</select></label><button id="desktop" aria-pressed="true">Desktop</button><button id="mobile" aria-pressed="false">Mobile</button><button id="direction" aria-pressed="false">Right to left</button></nav><p id="error" role="alert" hidden></p><p id="format" aria-live="polite"></p><section aria-label="Design preview"><div id="frame"><div id="sample"></div></div></section><small>Sample content and example countdowns. Review your wording, destinations and campaign dates in the editor.</small><details class="revision"><summary>Preview revision</summary><small>${revision}</small></details></main>
${screens.map((s, i) => `<template id="view-${i}">${s.html}</template>`).join('')}
<script>(${previewController.toString()})(${JSON.stringify(screens.map(({design,screen,type,width}) => ({design,screen,type,width}))).replace(/</g, '\\u003c')});</script></html>`;
  } finally { dom.window.close(); }
}
