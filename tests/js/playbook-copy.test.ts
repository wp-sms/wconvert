import { treeFixture } from './support/journey';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@renderer/render';
import type { TemplateTree } from '@renderer/types';

/**
 * **Playbook copy carries no markup** (ADR 0013).
 *
 * The renderer writes it with `textContent` and never touches `innerHTML`. The
 * one case that genuinely needs a link inside a sentence — fine print, and the
 * consent wording beside it — expresses it as **structure rather than markup**:
 * a text with a `%s` placeholder plus a `{label, href}`, and the renderer
 * splits on the placeholder and constructs the `<a>` itself.
 *
 * A [[Playbook]] is data, and a remote one is data from off-site. That is the
 * exact input class "content, never capability" exists to constrain, and it is
 * why the guarantee is a SHAPE rather than a sanitiser: a sanitiser is a thing
 * that can have a bug where a `textContent` renderer cannot.
 */

const words = (text: string): TemplateTree => (treeFixture({
  steps: [{ type: 'stack', children: [{ type: 'heading', role: 'headline', text }] }],
}));

describe("a Playbook's words", () => {
  it('render as text even when they look like markup', () => {
    const root = render(words('<img src=x onerror="alert(1)"> & <b>bold</b>'), {});
    const heading = root.querySelector('[data-role="headline"]');

    expect(heading?.textContent).toBe('<img src=x onerror="alert(1)"> & <b>bold</b>');
    expect(heading?.querySelector('img')).toBeNull();
    expect(heading?.querySelector('b')).toBeNull();
  });

  /**
   * The one link, built as structure. The `<a>` is constructed rather than
   * parsed, so the label is text too — and only the FIRST `%s` is the link,
   * because a sentence carries one link.
   */
  it('build their one link as a constructed anchor, never as parsed markup', () => {
    const root = render(
      treeFixture({
        steps: [{
          type: 'stack',
          children: [{
            type: 'text',
            role: 'fine_print',
            text: 'See our %s for details.',
            link: { label: '<b>Privacy Policy</b>', href: 'https://example.test/privacy' },
          }],
        }],
      }),
      {},
    );

    const anchor = root.querySelector('a.wc-link');

    expect(anchor?.textContent).toBe('<b>Privacy Policy</b>');
    expect(anchor?.querySelector('b')).toBeNull();
    expect(anchor?.getAttribute('href')).toBe('https://example.test/privacy');
  });

  /**
   * A link the site never resolved renders NOTHING — never a dead `#`, and
   * never a label glued to the end of the sentence. A [[Playbook]] supplies
   * the wording and the site supplies the destination, so a site with no
   * privacy policy configured has no link to offer (ADR 0032).
   */
  it('render no anchor at all where the site resolved no destination', () => {
    const root = render(
      treeFixture({
        steps: [{
          type: 'stack',
          children: [{ type: 'text', role: 'fine_print', text: 'See our %s.', link: { label: 'Privacy Policy' } }],
        }],
      }),
      {},
    );

    expect(root.querySelector('a')).toBeNull();
    expect(root.querySelector('[data-role="fine_print"]')?.textContent).toBe('See our.');
  });
});

/**
 * **No code path reaches `innerHTML`** — asserted at the source, because it is
 * a property of the source rather than of any one render.
 *
 * The renderer is the sink that matters: it draws copy that may have arrived
 * from off-site, inside the ≤8KB loader on the hot path. The admin tree is
 * scanned too, because it imports the same renderer and draws the same words
 * into a gallery card — an `innerHTML` there is the same input reaching the
 * same class of sink, on a page with `manage_options` behind it.
 *
 * Matches the ASSIGNMENT rather than the word, so these files may keep
 * documenting the boundary they enforce — the same distinction
 * `bin/pro-php-scan.php` draws by tokenising rather than grepping, and the
 * reason `renderer-manifest-parity.test.ts` matches a module specifier rather
 * than a mention.
 */
describe('the trees that draw a Playbook’s words', () => {
  const SCANNED = ['resources/renderer/src', 'resources/loader/src', 'resources/admin/src'];

  const WRITES_HTML = /\b(innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML)\b\s*[=:(]/;

  it.each(SCANNED)('never assigns HTML: %s', (dir) => {
    const root = resolve(import.meta.dirname, '../..', dir);
    const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((file) => /\.tsx?$/.test(file));

    // An empty scan root is a tree this check cannot speak for, not a tree
    // with nothing wrong in it (ADR 0029's posture).
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((file) => WRITES_HTML.test(readFileSync(resolve(root, file), 'utf8')))).toEqual([]);
  });
});
