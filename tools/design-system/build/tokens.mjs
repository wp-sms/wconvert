/**
 * `tokens.css` — the token layer, lifted out of the admin's own stylesheet.
 *
 * **Lifted, never retyped.** ADR 0037 puts WSMS's token NAMES against
 * WConvert's VALUES, and the whole point of that split is that one file
 * decides both. A design system holding a second copy of the palette is a
 * design system that will disagree with the product on the day somebody
 * changes a hex — so this reads `index.css` and fails loudly if the blocks it
 * expects have moved, rather than emitting a stale file.
 *
 * Three blocks come out:
 *
 * - `@theme inline { … }` — the Tailwind theme, which is what maps a utility
 *   name onto a custom property.
 * - `@theme static { … }` — the TYPE SCALE, which is a separate block because
 *   its values are literal rather than references to `:root` (`inline` stops a
 *   custom property being emitted at all, and hand-written CSS in `index.css`
 *   reads `var(--text-heading)` directly).
 * - `:root { … }` — the values themselves.
 *
 * A plain-CSS mirror of the last two is appended, so the file also stands alone
 * in a canvas that has no Tailwind to interpret `@theme`.
 *
 * **The type scale was missing from this mirror until ADR 0066**, which is
 * exactly the failure this program exists to prevent — the design system showed
 * a palette, a radius and three control heights beside not one of the eight
 * type roles, so the axis ADR 0037 added in the same breath as the colours was
 * the one axis a reader could not check.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRATCH = resolve(HERE, '..');
const PLUGIN = process.env.WCONVERT_PLUGIN ?? process.cwd();

const source = readFileSync(resolve(PLUGIN, 'resources/admin/src/index.css'), 'utf8');

/** One top-level block, by the line it opens on. Braces are counted, not matched by regex. */
function block(opener) {
  const start = source.indexOf(`\n${opener}`);

  if (start === -1) {
    throw new Error(`index.css no longer contains a top-level '${opener}' — tokens.css cannot be generated from a guess`);
  }

  let depth = 0;

  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;

      if (depth === 0) {
        return source.slice(start + 1, i + 1);
      }
    }
  }

  throw new Error(`unbalanced braces after '${opener}'`);
}

const theme = block('@theme inline {');
const scale = block('@theme static {');
const root = block(':root {');

/*
 * The plain-CSS mirror. `@theme inline` is Tailwind's, and a canvas that only
 * parses CSS reads it as an unknown at-rule and drops every declaration in it —
 * so the custom properties are restated under a real `:root` selector. It is a
 * mirror rather than a second source: it is written from the block above, in
 * this file, on every build.
 */
const declarations = [...`${root}${scale}`.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
  .map(([, name, value]) => `  ${name}: ${value.trim().replace(/\s+/g, ' ')};`)
  .join('\n');

const out = `/*
 * WConvert admin — the token layer.
 *
 * GENERATED from resources/admin/src/index.css by scratchpad/build/tokens.mjs.
 * Do not edit: changing a token here changes nothing until it changes there.
 * ADR 0037 — the names are WP SMS's, the values are WConvert's.
 */

${theme}

${scale}

${root}

/*
 * The same values again, as plain CSS.
 *
 * The block above is Tailwind's \`@theme\`, which a plain CSS parser reads as an
 * unknown at-rule and discards whole. This is what makes the file render on its
 * own, and it is generated from the block above rather than maintained beside
 * it.
 */
:root {
${declarations}
}
`;

writeFileSync(resolve(SCRATCH, 'out/tokens.css'), out);

console.log(
  `  tokens.css (${theme.split('\n').length + scale.split('\n').length + root.split('\n').length} lines lifted, ${declarations.split('\n').length} properties mirrored)`
);
