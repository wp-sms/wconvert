import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../resources/templates/manifest.json';
import { DOCUMENT_CSS, SHADOW_CSS } from '@renderer/css';
import { SAFE_SCHEMES, render } from '@renderer/render';
import type { TemplateTree } from '@renderer/types';

/**
 * The template vocabulary, asserted against the one renderer that implements
 * it.
 *
 * Same arrangement the rule manifest has, and for the same reason: the
 * manifest is what PHP validates a tree against, and the renderer is what
 * draws one. A member declared in the manifest with nothing to draw it is a
 * node validation lets through and the visitor never sees.
 *
 * **It is a behavioural check, not a list against a list.** There is no
 * exported vocabulary array in the renderer to compare with, deliberately —
 * that would be a second spelling of the switch — so this asks the renderer to
 * render one of each and looks at what came back.
 */

/** The least content each leaf needs before it has anything to draw. */
const MINIMAL: Readonly<Record<string, object>> = {
  heading: { text: 'x' },
  text: { text: 'x' },
  image: { src: '/x.png', alt: '' },
  field: { name: 'email' },
  button: { label: 'x' },
  consent: { text: 'x' },
};

/** The step's own element, one inside the root the renderer returns. */
const renderStep = (node: object): Element | null =>
  render({ steps: [node] } as TemplateTree, {}).firstElementChild;

const CSS = SHADOW_CSS + DOCUMENT_CSS;

describe('every member the manifest declares', () => {
  it.each(Object.keys(manifest.layouts))('has a layout the renderer draws: %s', (type) => {
    const layout = renderStep({ type, children: [], start: [], end: [] });

    expect(layout?.className).toBe(`wc-${type}`);
    // `split` is the one layout with a fixed shape: two panes, always, so a
    // pane left empty still holds its side of the design.
    expect(layout?.children).toHaveLength(type === 'split' ? 2 : 0);
  });

  it.each(Object.keys(manifest.nodes))('has a leaf the renderer draws: %s', (type) => {
    expect(renderStep({ type: 'stack', children: [{ type, ...MINIMAL[type] }] })?.children).toHaveLength(1);
  });

  it.each(manifest.fields)('has a field kind the renderer draws: %s', (name) => {
    expect(renderStep({ type: 'stack', children: [{ type: 'field', name }] })?.querySelector('input')).not.toBeNull();
  });

  /**
   * **Every leaf the manifest lets hide, the renderer hides.**
   *
   * The settings panel edits slot content and slot visibility and never
   * arrangement (ADR 0010), so a merchant switches the fine print off rather
   * than deleting it — and a `consent` node ships hidden, which is how
   * ADR 0032's "off by default" and "the panel never changes arrangement" are
   * both true at once.
   *
   * The renderer honours `hidden` on ANY node it is handed, and that is the
   * layering rather than a gap: which leaves may carry the key is the
   * manifest's answer, enforced where the tree is validated on the way in
   * (`tests/unit/Template/TemplateVocabularyTest.php`). A renderer that
   * re-asked would be a second spelling of the vocabulary, which is the thing
   * this file exists to prevent.
   */
  it.each(Object.entries(manifest.nodes).filter(([, node]) => node.params.includes('hidden')))(
    'hides a leaf the manifest lets hide: %s',
    (type) => {
      expect(
        renderStep({ type: 'stack', children: [{ type, ...MINIMAL[type], hidden: true }] })?.children,
      ).toHaveLength(0);
    },
  );

  it('draws nothing for a type it declares nowhere', () => {
    expect(renderStep({ type: 'stack', children: [{ type: 'marquee' }] })?.children).toHaveLength(0);
  });
});

/**
 * Tokens are the other half of the vocabulary, and an unconsumed one is worse
 * than a missing one: it rides the payload on every page view, is offered in
 * the settings panel, and changes nothing on screen.
 */
describe('every token the manifest declares', () => {
  it.each(Object.keys(manifest.tokens))('is read by the stylesheet: %s', (token) => {
    expect(CSS).toContain(`var(--wc-${token}`);
  });

  it('is the only custom property the stylesheet reads, beside the declared layout params', () => {
    const params = Object.values(manifest.layouts).flatMap((layout) => layout.params);
    const declared = new Set([...Object.keys(manifest.tokens), ...params]);
    const read = [...CSS.matchAll(/var\(--wc-([a-z-]+)/g)].map((match) => match[1]);

    expect([...new Set(read)].filter((name) => !declared.has(name))).toEqual([]);
  });
});

/**
 * The scheme allowlist is ONE rule that has to hold in two languages: PHP
 * validates an href at write (ADR 0013), and the renderer validates again
 * because the admin renders a tree through this module before any write has
 * happened. Two hand-maintained lists is the drift the manifest arrangement
 * exists to prevent, so the list lives in the manifest and both sides are
 * asserted against it.
 */
describe('the link scheme allowlist', () => {
  it('is the manifest is, on both sides of the boundary', () => {
    expect([...SAFE_SCHEMES].sort()).toEqual([...manifest.schemes].map((scheme) => `${scheme}:`).sort());
  });
});

/**
 * **The loader must never import the manifest.** An unrecognised node is
 * skipped by the renderer's own switch, so the lookup buys nothing — and the
 * import would inline the whole vocabulary into a bundle held to 8KB gzipped.
 * The same rule the rule manifest has (README, *The rule manifest*), and until
 * now the same rule with nothing asserting it.
 */
describe('the shipped trees', () => {
  const SHIPPED = ['resources/renderer/src', 'resources/loader/src'];

  /**
   * Matches a module SPECIFIER, not a mention. The same distinction
   * `bin/pro-php-scan.php` draws by tokenising rather than grepping: free may
   * document the boundary without tripping the guard that enforces it, and
   * these files document it at length.
   */
  const IMPORTS_THE_MANIFEST = /(?:from|import|require)\s*\(?\s*['"][^'"]*templates\/manifest\.json['"]/;

  it.each(SHIPPED)('does not import the template manifest: %s', (dir) => {
    const root = resolve(import.meta.dirname, '../..', dir);
    const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.ts'));

    // An empty scan root is a tree this check cannot speak for, not a tree
    // with nothing wrong in it — the same fail-closed posture the source
    // contract takes (ADR 0029).
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((file) => IMPORTS_THE_MANIFEST.test(readFileSync(resolve(root, file), 'utf8')))).toEqual([]);
  });
});
