import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

/** Exact shipping faces, embedded only in offline comparisons; no second font manifest. */
export function bundledFontComparison(root) {
  const source = JSON.parse(execFileSync('php', ['-r',
    "define('ABSPATH', '/'); require $argv[1] . '/vendor/autoload.php'; echo json_encode(['families' => \\WConvert\\Template\\BundledFonts::families(), 'style' => \\WConvert\\Template\\BundledFonts::styleTag(\\WConvert\\Template\\BundledFonts::families())]);", root], {encoding:'utf8'}));
  const files = [];
  const css = source.style.replace(/^<style[^>]*>|<\/style>$/g, '').replace(/url\("resources\/template-fonts\/([^"/]+\.woff2)"\)/g, (_match, file) => {
    const bytes = readFileSync(resolve(root, 'resources/template-fonts', file));
    files.push({file, sha256:createHash('sha256').update(bytes).digest('hex')});
    return `url("data:font/woff2;base64,${bytes.toString('base64')}")`;
  });
  if (!files.length || /url\("(?!data:font\/woff2;base64,)/.test(css)) throw Error('Bundled font comparison contains a nonlocal face');
  const familiesIn = entry => (entry.tree?.fonts ?? []).map(font=>font.family).filter(family=>source.families.some(bundled=>bundled.toLowerCase()===family.toLowerCase()));
  return {families:source.families, files, familiesIn, cssFor(entry) {
    const wanted=new Set(familiesIn(entry).map(family=>family.toLowerCase()));
    return [...css.matchAll(/@font-face\{font-family:"([^"]+)";[^}]+\}/g)].filter(match=>wanted.has(match[1].toLowerCase())).map(match=>match[0]).join('');
  }};
}
