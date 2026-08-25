import { describe, expect, it } from 'vitest';
import manifest from '../../resources/templates/manifest.json';
import { DOCUMENT_CSS, SHADOW_CSS } from '@renderer/css';
import { render } from '@renderer/render';
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
