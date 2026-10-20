/** Internal review chrome only. Never included in renderer or public previews. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const library = resolve(import.meta.dirname, '..');
export function studioPage(html, page, root = process.env.WCONVERT_PLUGIN ?? resolve(library, '../..')) {
  const source = readFileSync(resolve(root, 'resources/admin/src/index.css'), 'utf8');
  const blocks = [':root {', '@theme static {'].map(opener => {
    const start = source.indexOf('\n' + opener);
    if (start < 0) throw new Error(`Studio theme: missing ${opener}`);
    let depth = 0;
    for (let i = source.indexOf('{', start); i < source.length; i++) {
      if (source[i] === '{') depth++;
      if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
    }
    throw new Error('Studio theme: unbalanced token block');
  });
  const declarations = blocks.flatMap(block => [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => `${name}:${value.trim()};`)).join('\n');
  const assets = resolve(library, 'out/studio-assets');
  mkdirSync(assets, { recursive: true });
  writeFileSync(resolve(assets, 'OFL-DM-Sans.txt'), readFileSync(resolve(root, 'resources/admin/src/assets/fonts/OFL-DM-Sans.txt')));
  const fonts = [400, 500, 600, 700].map(weight => {
    const bytes = readFileSync(resolve(root, `resources/admin/src/assets/fonts/dm-sans-${weight}.ttf`));
    const name = `dm-sans-${weight}-${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}.ttf`;
    writeFileSync(resolve(assets, name), bytes);
    return `@font-face{font-family:'DM Sans';font-style:normal;font-weight:${weight};font-display:swap;src:url('studio-assets/${name}') format('truetype')}`;
  }).join('\n');
  // Legacy chrome used --muted for text; the admin reserves it for a surface.
  html = html.replaceAll('var(--muted)', 'var(--muted-foreground)');
  if (!/name=["']viewport["']/.test(html)) html = '<meta name="viewport" content="width=device-width,initial-scale=1">' + html;
  const css = readFileSync(resolve(library, 'studio/chrome.css'), 'utf8');
  const tabs = [['pilot', 'Setups', 'pilot.html'], ['designs', 'Designs', 'library-review.html'], ['collections', 'Collections', 'collection-studio.html'], ['bench', 'Workbench', 'bench.html']];
  const section = ['library-review', 'starting-points', 'gallery', 'flagships', 'roadmap'].includes(page) ? 'designs' : page;
  const nav = `<nav class="studio-nav" aria-label="Studio navigation"><a class="studio-brand" href="pilot.html">WConvert <span>Template studio</span></a><div class="studio-links">${tabs.map(([id, title, href]) => `<a href="${href}"${id === section ? ' aria-current="page"' : ''}>${title}</a>`).join('')}</div><span class="studio-internal">Internal review</span></nav>`;
  if (!/<header\b/.test(html)) throw new Error(`Studio theme: missing page header in ${page}`);
  return html.replace(/<header\b/, () => `<style id="studio-theme">${fonts}\n:root:root{${declarations}}\n${css}</style>${nav}<header`);
}
