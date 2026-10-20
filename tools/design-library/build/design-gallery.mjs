import { chromium } from 'playwright';
import { publicPreview } from './public-preview.mjs';

/** Capture actual rendered content, including its full height, without network access. */
export async function galleryArtwork(packs, renderer) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
    await page.route('**/*', route => route.abort());
    for (const entry of packs) {
      const pack = JSON.parse(entry.json);
      entry.gallery = [];
      for (const design of pack.templates) {
        const embed = publicPreview(pack, renderer, entry.media, { designId: design.id, embed: true });
        await page.setContent(embed);
        await page.evaluate(async () => { await document.fonts.ready; });
        // Shadow DOM images are data URLs. Wait for decoding, not an arbitrary delay.
        await page.evaluate(async () => {
          const templates = [...document.querySelectorAll('template')];
          await Promise.all(templates.flatMap(t => [...t.content.querySelectorAll('img')]).map(image => {
            const probe = new Image(); probe.src = image.src; return probe.decode();
          }));
        });
        const sample = page.locator('#sample');
        const box = await sample.boundingBox();
        if (!box || box.height < 1 || box.height > 8192) throw Error(`Unusable thumbnail dimensions: ${design.id}`);
        const bytes = await sample.screenshot({ type: 'jpeg', quality: 85, animations: 'disabled' });
        const dimensions = await page.evaluate(async base64 => {
          const image = new Image(); image.src = 'data:image/jpeg;base64,' + base64; await image.decode();
          return { width: image.naturalWidth, height: image.naturalHeight };
        }, bytes.toString('base64'));
        const step = design.tree.steps[0], result = step.results?.[0];
        entry.gallery.push({
          id: design.id, embed,
          thumbnail: {
            bytes, ...dimensions, partial: false,
            screen_id: step.id + (result ? '/' + result.id : ''),
            alt: `${design.name} — ${step.name}${result ? ` — ${result.heading}` : ''}. Sample design content.`,
          },
        });
      }
    }
    return packs;
  } finally { await browser.close(); }
}
