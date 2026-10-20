import { chromium } from 'playwright';
import { publicPreview } from './public-preview.mjs';
import { cacheKey, cached, codeOf, remember } from './cache.mjs';

const CODE = codeOf(import.meta.url) + codeOf(new URL('./public-preview.mjs', import.meta.url)) + codeOf(new URL('./preview-controls.mjs', import.meta.url));

/** The website's largest card; 2× is twice that, and Open Graph is its own fixed frame. */
export const THUMB_WIDTH = 600;
const OG = { width: 1200, height: 630 };
/** A public preview shows a premium picture, never the original file (ADR 0156). */
export const PREVIEW_IMAGE_EDGE = 640;

/**
 * Capture each design's public artwork in a network-blocked browser: WebP card
 * thumbnails at 1× and 2×, an Open Graph JPEG, and inert previews in which a
 * premium image is replaced by a downscaled copy.
 *
 * Chromium encodes WebP from a canvas, so no image library is needed.
 *
 * @param {Array<{id: string, pack: object, media: Array<{id: string, bytes: Buffer}>}>} designs
 */
export async function galleryArtwork(designs, renderer) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
    await page.route('**/*', route => route.abort());
    const encode = (base64, mime, width, height, type, quality) => page.evaluate(async ({ base64, mime, width, height, type, quality }) => {
      const image = new Image(); image.src = `data:${mime};base64,${base64}`; await image.decode();
      const scale = height ? Math.max(width / image.naturalWidth, height / image.naturalHeight) : width / image.naturalWidth;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width); canvas.height = Math.round(height || image.naturalHeight * scale);
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      // Open Graph crops from the top: a design reads from its headline down.
      context.drawImage(image, (canvas.width - image.naturalWidth * scale) / 2, 0, image.naturalWidth * scale, image.naturalHeight * scale);
      const url = canvas.toDataURL(type, quality);
      if (!url.startsWith(`data:${type};`)) throw new Error(`This browser cannot encode ${type}`);
      return { base64: url.slice(url.indexOf(',') + 1), width: canvas.width, height: canvas.height };
    }, { base64, mime, width, height, type, quality });
    for (const entry of designs) {
      const design = entry.pack.templates[0];
      const key = cacheKey(CODE, renderer, entry.pack, (entry.media ?? []).map(item => [item.id, item.bytes.toString('base64')]));
      const hit = cached('gallery', key);
      if (hit) { entry.gallery = hit; continue; }
      // Downscale premium pictures before any public HTML is built from them.
      const previewMedia = [];
      for (const asset of entry.pack.assets ?? []) {
        const item = entry.media.find(media => media.id === asset.id);
        if (asset.access !== 'premium') { previewMedia.push({ ...item, verified: true }); continue; }
        const edge = Math.min(PREVIEW_IMAGE_EDGE, Math.max(asset.width, asset.height));
        const width = asset.width >= asset.height ? edge : Math.round(edge * asset.width / asset.height);
        const small = await encode(item.bytes.toString('base64'), asset.mime, width, 0, 'image/webp', 0.72);
        previewMedia.push({ id: asset.id, bytes: Buffer.from(small.base64, 'base64'), mime: 'image/webp', verified: false });
      }
      const preview = publicPreview(entry.pack, renderer, previewMedia, { designId: design.id });
      const designOnly = publicPreview(entry.pack, renderer, previewMedia, { designId: design.id, designOnly: true });
      const embed = publicPreview(entry.pack, renderer, previewMedia, { designId: design.id, embed: true });
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
      const png = (await sample.screenshot({ type: 'png', animations: 'disabled' })).toString('base64');
      const thumb1x = await encode(png, 'image/png', THUMB_WIDTH, 0, 'image/webp', 0.82);
      const thumb2x = await encode(png, 'image/png', THUMB_WIDTH * 2, 0, 'image/webp', 0.8);
      const og = await encode(png, 'image/png', OG.width, OG.height, 'image/jpeg', 0.86);
      // A 64-bit difference hash of the card, for the near-duplicate gate.
      const dhash = await page.evaluate(async base64 => {
        const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = 9; canvas.height = 8;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 9, 8);
        const data = context.getImageData(0, 0, 9, 8).data, grey = at => data[at] * 0.299 + data[at + 1] * 0.587 + data[at + 2] * 0.114;
        let bits = '';
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += grey((y * 9 + x) * 4) > grey((y * 9 + x + 1) * 4) ? '1' : '0';
        return [...bits.match(/.{4}/g)].map(nibble => parseInt(nibble, 2).toString(16)).join('');
      }, png);
      const step = design.tree.steps[0], result = step.results?.[0];
      entry.gallery = {
        preview, designOnly, dhash,
        thumb1x: Buffer.from(thumb1x.base64, 'base64'), thumb2x: Buffer.from(thumb2x.base64, 'base64'), og: Buffer.from(og.base64, 'base64'),
        width: thumb1x.width, height: thumb1x.height,
        alt: `${design.name} — ${step.name}${result ? ` — ${result.heading}` : ''}. Sample design content.`,
        screens: design.tree.steps.flatMap(item => (item.results?.length ? item.results : [null]).map(variant => ({
          id: item.id + (variant ? '/' + variant.id : ''), label: item.name + (variant ? ` · ${variant.heading}` : ''),
        }))),
      };
      remember('gallery', key, entry.gallery);
    }
    return designs;
  } finally { await browser.close(); }
}
