import { chromium } from 'playwright';
import { cacheKey, cached, codeOf, remember } from './cache.mjs';

const CODE = codeOf(import.meta.url);

/**
 * Text that cannot be read against what is actually behind it (ADR 0156,
 * Phase 5). Token pairs cannot see a photograph, a gradient or an overlay, so
 * this measures pixels: each screen is rendered, every text is made
 * transparent, and the background left behind each text box is compared with
 * that text's own colour. The ratio reported is the one 90% of the box's
 * background meets, so a bright patch behind a pale word counts.
 *
 * WCAG AA: 4.5 for body text, 3 for large text (24px, or 18.66px bold).
 */
export async function contrastReport(designs, renderer) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
    await page.route('**/*', route => route.abort());
    const report = new Map();
    for (const design of designs) {
      const key = cacheKey(CODE, renderer, design);
      const hit = cached('contrast', key);
      if (hit) { report.set(design.id, hit); continue; }
      const failures = [];
      for (const [index, step] of design.tree.steps.entries()) for (const variant of step.results?.length ? step.results : [null]) {
        await page.setContent('<!doctype html><body style="margin:0;background:#ffffff"><div id="sample"></div></body>');
        await page.addScriptTag({ content: renderer });
        await page.evaluate(([tree, tokens, index, variant, required]) => {
          const api = window.WConvertRenderer, node = api.render(tree, tokens, index);
          if (variant) api.previewResult?.(node, variant, required);
          // As the public preview does: the whole design, not the first viewport of it.
          document.getElementById('sample').innerHTML = `<style>${api.SHADOW_CSS}\n.wc-root{max-block-size:none}</style>${node.outerHTML}`;
        }, [design.tree, design.tokens ?? {}, index, variant, step.products_required]);
        // Every picture decoded and laid out first, CSS backgrounds included:
        // a box measured before its image arrives is measured in the wrong place.
        await page.evaluate(async () => {
          const urls = new Set();
          for (const element of document.querySelectorAll('#sample *')) {
            if (element instanceof HTMLImageElement && element.src) urls.add(element.src);
            for (const match of getComputedStyle(element).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(match[1]);
          }
          await Promise.all([...urls].map(url => { const image = new Image(); image.src = url; return image.decode().catch(() => undefined); }));
          await Promise.all([...document.querySelectorAll('#sample img')].map(image => image.decode().catch(() => undefined)));
          await document.fonts.ready;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        const texts = await page.evaluate(() => {
          const sample = document.getElementById('sample');
          const found = [];
          for (const element of sample.querySelectorAll('*')) {
            const own = [...element.childNodes].filter(child => child.nodeType === 3 && child.textContent.trim()).map(child => child.textContent.trim()).join(' ');
            if (!own || element.closest('[hidden],[aria-hidden="true"]')) continue;
            const style = getComputedStyle(element), box = element.getBoundingClientRect();
            // Visually hidden text (a screen-reader label) is not read against anything.
            if (box.width < 4 || box.height < 4 || !element.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })
              || (style.clip && style.clip !== 'auto') || /inset\(50%\)/.test(style.clipPath)) continue;
            const colour = style.color.match(/[\d.]+/g).map(Number);
            if (colour.length > 3 && colour[3] === 0) continue;
            const size = parseFloat(style.fontSize), weight = Number(style.fontWeight) || 400;
            found.push({ text: own.slice(0, 40), colour: colour.slice(0, 3), large: size >= 24 || (size >= 18.66 && weight >= 700),
              x: Math.round(box.left + scrollX), y: Math.round(box.top + scrollY), w: Math.round(box.width), h: Math.round(box.height) });
          }
          const hide = document.createElement('style');
          hide.textContent = '#sample *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important}#sample ::placeholder{color:transparent!important}';
          document.head.append(hide);
          return found;
        });
        if (!texts.length) continue;
        // The page, not the element: fixed bars and corner prompts have no box of their own.
        const shot = (await page.screenshot({ fullPage: true, animations: 'disabled' })).toString('base64');
        const ratios = await page.evaluate(async ([shot, texts]) => {
          const image = new Image(); image.src = 'data:image/png;base64,' + shot; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
          const linear = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
          const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
          return texts.map(text => {
            const w = Math.max(1, Math.min(text.w, canvas.width - text.x)), h = Math.max(1, Math.min(text.h, canvas.height - text.y));
            if (text.x >= canvas.width || text.y >= canvas.height) return null;
            const data = context.getImageData(text.x, text.y, w, h).data, fg = luminance(text.colour), ratios = [];
            for (let at = 0; at < data.length; at += 16) {
              const bg = luminance([data[at], data[at + 1], data[at + 2]]);
              ratios.push((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05));
            }
            ratios.sort((a, b) => a - b);
            return ratios[Math.floor(ratios.length * 0.1)];
          });
        }, [shot, texts]);
        texts.forEach((text, at) => {
          const ratio = ratios[at];
          if (ratio !== null && ratio < (text.large ? 3 : 4.5)) failures.push({ screen: step.id + (variant ? '/' + variant.id : ''), text: text.text, ratio: Math.round(ratio * 100) / 100 });
        });
      }
      report.set(design.id, remember('contrast', key, failures));
    }
    return report;
  } finally { await browser.close(); }
}
