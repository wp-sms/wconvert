/**
 * `shell.css` — the part of the hand-written CSS that is VOCABULARY.
 *
 * `index.css` is 4,528 lines and most of it is one-off screen layout —
 * `.wconvert-builder`, `.wconvert-gallery`, `.wconvert-block`,
 * `.wconvert-themes`, `.wconvert-editor`. None of that is in this bundle on
 * purpose: it is the shape of one screen, not a rule anything else reuses.
 *
 * What IS vocabulary is the handful of rules that decide how a component
 * behaves because of WHERE it is — and those are the rules a card cannot show
 * by rendering a component on its own:
 *
 * - **The `DataTable` skin**, including the below-639px restack into row-cards
 *   that `data-label` feeds (§10, §16).
 * - **The rule that picks a control height** from its container rather than
 *   from a prop (§3). This is the one people reach for `size="sm"` instead of,
 *   so it is here to be read.
 * - **The chosen state of a `ChoiceCard`**, which is one decision about what
 *   "selected" looks like, stated once.
 * - **`.wconvert-measure`**, the one width token every band reads (§1).
 *
 * Selected by SELECTOR rather than by line number, because a line range is a
 * thing that silently means something else after the next edit.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRATCH = resolve(HERE, '..');
const PLUGIN = process.env.WCONVERT_PLUGIN ?? process.cwd();

/** What makes a top-level node vocabulary. */
const VOCABULARY = [
  '.wconvert-table',
  '.wconvert-toolbar',
  '.wconvert-footer',
  '.wconvert-page-actions',
  '.wconvert-measure',
  '.is-chosen',
  '.wc-', // Shared masthead vocabulary from shell/header.css.
];

/** What is one screen's layout, and is excluded even where it mentions the above. */
const LAYOUT = ['.wconvert-builder', '.wconvert-gallery', '.wconvert-editor', '.wconvert-themes', '.wconvert-block'];

const source = ['index.css', 'shell/header.css'].map(file =>
  readFileSync(resolve(PLUGIN, 'resources/admin/src', file), 'utf8')).join('\n');

/**
 * The file as top-level nodes, each carrying the comment that precedes it.
 *
 * The comment is not decoration here: every rule in this file argues for
 * itself in place, and a rule lifted out of its argument is the thing this
 * bundle keeps re-learning.
 */
function nodes(css) {
  const found = [];
  let i = 0;
  let start = 0;

  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      i = css.indexOf('*/', i) + 2;

      continue;
    }

    if (css[i] === '{') {
      let depth = 0;

      for (; i < css.length; i++) {
        if (css[i] === '{') depth++;

        if (css[i] === '}') {
          depth--;

          if (depth === 0) {
            found.push(css.slice(start, i + 1).trim());
            i++;
            start = i;
            break;
          }
        }
      }

      continue;
    }

    if (css[i] === ';' && css.slice(start, i).includes('@import')) {
      start = i + 1;
    }

    i++;
  }

  return found;
}

const kept = nodes(source).filter((node) => {
  /*
   * The chosen state is vocabulary wherever it is written, and it is written
   * on two selectors at once — `.wconvert-gallery__card.is-chosen` beside
   * `.wconvert-choice.is-chosen`, because it is ONE decision about what
   * "selected" looks like. Testing the layout list first dropped it for
   * naming the gallery, which is exactly the rule this bundle wants to show.
   */
  if (node.includes('.is-chosen')) {
    return true;
  }

  if (LAYOUT.some((selector) => node.includes(selector))) {
    return false;
  }

  return VOCABULARY.some((selector) => node.includes(selector));
});

if (kept.length === 0) {
  throw new Error('no vocabulary rules matched — index.css has been restructured and shell.mjs needs re-reading, not re-running');
}

const out = `/*
 * WConvert admin — the vocabulary half of the hand-written CSS.
 *
 * GENERATED from resources/admin/src/index.css by scratchpad/build/shell.mjs.
 * Do not edit. The one-off screen layout in that file — the builder, the
 * gallery, the block tree — is deliberately NOT here: it is the shape of one
 * screen rather than a rule anything reuses.
 */

${kept.join('\n\n')}
`;

writeFileSync(resolve(SCRATCH, 'out/shell.css'), out);

console.log(`  shell.css (${kept.length} rules, ${out.split('\n').length} lines)`);
