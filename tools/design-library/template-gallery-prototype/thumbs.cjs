// PROTOTYPE: catalogue-style pictures for every design an online or locked card would show.
// Mirrors tools/design-library/build/design-gallery.mjs: the design's own tree and sample words,
// a tight crop of its box at native width in a 1176px frame, captured at 2x, resized to 600w / 1200w WebP.
const { chromium } = require('/Users/navidkashani/Local Sites/wconvert/app/public/wp-content/plugins/wconvert/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PLUGIN = '/Users/navidkashani/Local Sites/wconvert/app/public/wp-content/plugins/wconvert';
const OUT = path.join(__dirname, 'thumbs'); fs.mkdirSync(OUT, { recursive: true });
const camp = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'tools/design-library/out/all-campaigns.json'), 'utf8'));
const bundled = new Set(fs.readdirSync(path.join(PLUGIN, 'resources/playbooks')).map(f => f.replace(/\.php$/, '')));
const need = [...new Set(camp.filter(c => !(bundled.has(c.id) && c.tier === 'free' && c.design_tier === 'free')).map(c => c.template_id))];
const files = {};
const dirs = ['resources/templates/library', 'tools/design-library/hosted/templates', ...fs.readdirSync(path.join(PLUGIN, 'pro/modules')).map(m => `pro/modules/${m}/templates`)];
for (const d of dirs) { const a = path.join(PLUGIN, d); if (!fs.existsSync(a)) continue; for (const f of fs.readdirSync(a).filter(f => f.endsWith('.json'))) { try { const j = JSON.parse(fs.readFileSync(path.join(a, f), 'utf8')); files[j.id] = j; } catch {} } }
const renderer = fs.readFileSync(path.join(PLUGIN, 'tools/design-library/out/renderer.iife.js'), 'utf8');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
  await p.setContent('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Instrument+Serif:ital@0;1&family=Bebas+Neue&family=Cormorant+Garamond:ital@0;1&family=Archivo+Black&display=swap"><style>body{margin:0;background:transparent}#frame{width:1176px;padding:12px}</style><div id="frame"></div>');
  await p.addScriptTag({ content: renderer });
  let n = 0;
  for (const id of need) {
    const out = path.join(OUT, id + '.json'); if (fs.existsSync(out)) continue;
    const d = files[id]; if (!d) continue;
    await p.evaluate(d => {
      const px = (v, f) => { const m = /^\s*([\d.]+)(rem|px)\s*$/.exec(String(v || '')); return m ? (m[2] === 'rem' ? +m[1] * 16 : +m[1]) : f; };
      const frame = document.getElementById('frame'); frame.innerHTML = '';
      const box = document.createElement('div'); box.id = 'sample';
      const native = ['popup', 'slide_in', 'inline'].includes(d.display_type);
      box.style.width = native ? Math.min(px(d.tokens.width, d.display_type === 'slide_in' ? 416 : 448), 1176) + 'px' : '1176px';
      const host = document.createElement('div'), sh = host.attachShadow({ mode: 'open' }), st = document.createElement('style');
      st.textContent = WConvertRenderer.SHADOW_CSS; sh.appendChild(st);
      const r = WConvertRenderer.render(d.tree, native || d.display_type === 'floating_bar' ? Object.assign({}, d.tokens, { width: '100%' }) : d.tokens, 0);
      if (d.display_type === 'fullscreen' && WConvertRenderer.decorateFullscreen) try { WConvertRenderer.decorateFullscreen(r, d.tokens.width, '32rem'); } catch (e) {}
      r.style.maxBlockSize = 'none';
      sh.appendChild(r); box.appendChild(host); frame.appendChild(box);
    }, d);
    await p.evaluate(async () => { await document.fonts.ready; await new Promise(r => setTimeout(r, 120)); });
    const el = p.locator('#sample');
    const png = (await el.screenshot({ type: 'png', animations: 'disabled' })).toString('base64');
    const enc = await p.evaluate(async ({ png }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
      const go = (w, q) => { const c = document.createElement('canvas'); c.width = w; c.height = Math.round(img.naturalHeight * w / img.naturalWidth); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); return { uri: c.toDataURL('image/webp', q), w: c.width, h: c.height }; };
      const a = go(600, .82), b2 = go(1200, .8);
      return { w: a.w, h: a.h, x1: a.uri, x2: b2.uri };
    }, { png });
    fs.writeFileSync(out, JSON.stringify(enc)); n++;
  }
  console.log('made', n, 'of', need.length);
  await b.close();
})();
