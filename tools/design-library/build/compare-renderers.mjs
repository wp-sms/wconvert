import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const baseline = process.argv[2];
if (!baseline) throw Error('Pass the renderer.iife.js built from the base revision.');
const current = resolve('tools/design-library/out/renderer.iife.js');
const entries = JSON.parse(readFileSync('tools/design-library/out/pilot.json', 'utf8'));
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const bundle of [baseline, current]) {
    const page = await browser.newPage(); await page.addScriptTag({ path: bundle });
    results.push(await page.evaluate(entries => {
      const R = window.WConvertRenderer;
      const screens = [];
      for (const entry of entries) entry.tree.steps.forEach((screen, index) => {
        for (const variant of screen.results ?? [null]) {
          const root = R.render(entry.tree, entry.tokens, index);
          if (variant) {
            root.querySelector('[data-result-heading]').textContent = variant.heading;
            root.querySelector('[data-result-body]').textContent = variant.body;
            const link = root.querySelector('[data-result-link]'); link.hidden = false;
            link.textContent = variant.link_label || 'Set a destination'; link.removeAttribute('href');
          }
          screens.push({ id: entry.id, screen: index, variant: variant?.id ?? null, html: root.outerHTML });
        }
      });
      return { css: R.SHADOW_CSS, screens };
    }, entries));
    await page.close();
  }
  if (results[0].css !== results[1].css) throw Error('Shared styles changed; visual comparison is required.');
  const changed = results[1].screens.filter((screen, i) => JSON.stringify(screen) !== JSON.stringify(results[0].screens[i]));
  if (changed.length) throw Error(`Screen markup changed: ${changed.map(s => `${s.id}:${s.screen}`).join(', ')}`);
  const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
  console.log(JSON.stringify({ baseline: digest(baseline), current: digest(current), campaigns: entries.length, screens: results[1].screens.length, identical_markup_and_styles: true }, null, 2));
} finally { await browser.close(); }
