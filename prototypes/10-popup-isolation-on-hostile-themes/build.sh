#!/bin/zsh
# THROWAWAY build for prototype #10. Bundles the harness loader, emits the
# reference render, and prints the size table each isolation strategy would add
# to the real loader.
set -e
cd "$(dirname "$0")"
mkdir -p dist
esb() { npx --yes esbuild@0.28.2 "$@"; }

# The harness bundle: every mode in one file, unminified, so a failure is readable.
esb src/proto.js --bundle --format=iife --target=es2019 --outfile=dist/proto.js --log-level=error

# The reference render: same markup, same CSS, no theme.
node --input-type=module -e "
import { MARKUP, CSS } from './src/template.js';
import { writeFileSync } from 'node:fs';
writeFileSync('dist/reference.css', CSS.replace(/@R@/g, 'html').replace(/@Z@/g, '2147483646'));
writeFileSync('dist/reference.html', MARKUP);
"

build() { # name entry
  esb "$2" --bundle --minify --format=iife --target=es2019 --outfile="dist/$1.js" --log-level=error
  gzip -9 -c "dist/$1.js" > "dist/$1.js.gz"
  command -v brotli >/dev/null && brotli -q 11 -f -c "dist/$1.js" > "dist/$1.js.br" || : > "dist/$1.js.br"
}
build ship-shadow src/ship/shadow.js
build ship-scoped src/ship/scoped.js
build ship-iframe src/ship/iframe.js
build ship-dialog src/ship/dialog.js

# Globals-exposed copies, so the harness can drive the shipping code directly.
esb src/ship/dialog.js --bundle --format=iife --global-name=SHIPDIALOG --outfile=dist/.t-dialog.js --log-level=error
esb src/ship/shadow.js --bundle --format=iife --global-name=SHIPSHADOW --outfile=dist/.t-shadow.js --log-level=error

printf '\n%-34s %9s %9s %9s\n' 'STRATEGY (container + a11y + CSS)' MINIFIED GZIP BROTLI
printf '%-34s %9s %9s %9s\n' '----------------------------------' --------- --------- ---------
for f in ship-dialog ship-shadow ship-scoped ship-iframe; do
  printf '%-34s %9s %9s %9s\n' "${f#ship-}" \
    "$(wc -c < dist/$f.js | tr -d ' ')" \
    "$(wc -c < dist/$f.js.gz | tr -d ' ')" \
    "$(wc -c < dist/$f.js.br | tr -d ' ')"
done

# What the CSS alone costs once each strategy has rewritten it.
node --input-type=module -e "
import { CSS } from './src/template.js';
import { gzipSync, brotliCompressSync } from 'node:zlib';
const NS = '.wcv-x9f2';
const bang = (c) => c.replace(/([a-zA-Z-]+)\s*:\s*([^;{}]+);/g, (m,p,v) => /!important/.test(v) ? m : p+':'+v.trim()+' !important;');
const min  = (c) => c.replace(/\/\*[^]*?\*\//g,'').replace(/\s*([{}:;,])\s*/g,'\$1').replace(/;}/g,'}').replace(/\s+/g,' ').trim();
const variants = {
  'reference (no isolation)': CSS.replace(/@R@/g,'html').replace(/@Z@/g,'2147483647'),
  'shadow  (:host + all:initial)': ':host{all:initial;direction:inherit}' + CSS.replace(/@R@/g,':host').replace(/@Z@/g,'2147483647'),
  'scoped  (ns + all:revert)': NS+','+NS+' *,'+NS+' *::before,'+NS+' *::after{all:revert;}' + CSS.replace(/@R@/g,NS).replace(/@Z@/g,'2147483647'),
  'scoped  (+ !important on all)': bang(NS+','+NS+' *,'+NS+' *::before,'+NS+' *::after{all:revert;}' + CSS.replace(/@R@/g,NS).replace(/@Z@/g,'2147483647')),
  'iframe  (html, srcdoc-escaped)': CSS.replace(/@R@/g,'html').replace(/@Z@/g,'2147483647'),
};
console.log('');
console.log('CSS ONLY'.padEnd(34) + 'MINIFIED'.padStart(10) + 'GZIP'.padStart(10) + 'BROTLI'.padStart(10));
console.log('-'.repeat(34) + ' ' + '-'.repeat(9) + ' ' + '-'.repeat(9) + ' ' + '-'.repeat(9));
for (const [k,v] of Object.entries(variants)) {
  const m = min(v);
  console.log(k.padEnd(34) + String(m.length).padStart(10) + String(gzipSync(m,{level:9}).length).padStart(10) + String(brotliCompressSync(m).length).padStart(10));
}
"

echo "\nharness bundle: dist/proto.js ($(wc -c < dist/proto.js | tr -d ' ') bytes, unminified)"
