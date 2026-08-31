import { afterEach, describe, expect, it } from 'vitest';
import { createPanel } from '@loader/inspect/panel';
import { funnel, type Labels, type ServerOptin, type ServerReport } from '@loader/inspect/report';
import type { Arrival } from '@loader/inspect/arrival';
import type { EntryReport } from '@loader/inspect/explain';

/**
 * The panel, against the three things it must not get wrong.
 *
 * **It must not cover the page it explains** (WCAG 2.2 SC 2.4.11): a focused
 * element must not be entirely hidden by author content, and this is a
 * fixed-position box on a page whose whole point is that a popup is about to
 * appear on it.
 *
 * **It must not spell a merchant-facing word of its own**, because `make-pot`
 * cannot see a string in a TypeScript bundle.
 *
 * **It must draw three marks and not two.** A cross beside a rule a consent
 * plugin withheld teaches a merchant to go and fix a rule that is fine.
 */
const ARRIVAL: Arrival = {
  payloadFound: true,
  entries: 1,
  loaderFound: true,
  loaderBeforePayload: false,
  deferred: true,
};

const LABELS: Labels = {
  title: 'Why each popup did or did not show',
  intro: 'This page only.',
  close: 'Close',
  collapse: 'Collapse',
  expand: 'Expand',
  nothing: 'No Optins yet.',
  stopped: { blocked: 'Needs consent this visit has not given.', showing: 'Showing now.' },
  answer: { yes: 'Holds', no: 'Does not hold', unknown: 'Not evaluated', unsupported: 'No module here' },
  sections: { targeting: 'Where', triggers: 'When', conditions: 'Who', include: 'On', exclude: 'Never on', server_only: 'Never reached the browser.' },
  arrival: { aggregated: 'Combined into a bundle.', defer: 'defer removed.', order: 'Above its data.' },
  rules: { device: 'Device', cart_has_items: 'Has something in their cart', time_on_page: 'Time on the page' },
};

const optin = (over: Partial<ServerOptin> = {}): ServerOptin => ({
  id: 'A',
  name: 'Welcome discount',
  published: true,
  suspended: null,
  targeting: { admits: true, reason: null, logged_in: null, include: [], exclude: [] },
  ...over,
});

const entry = (over: Partial<EntryReport> = {}): EntryReport => ({
  id: 'A',
  standing: 'blocked',
  overlay: true,
  triggers: [{ rule: { type: 'time_on_page' }, answer: null, unsupported: false }],
  conditions: [
    { rule: { type: 'device' }, answer: true, unsupported: false },
    { rule: { type: 'cart_has_items' }, answer: null, unsupported: false },
  ],
  lostArbitration: false,
  ...over,
});

function draw(optins: ServerOptin[] = [optin()], browser: EntryReport[] = [entry()]) {
  const server: ServerReport = { request: {}, optins, labels: LABELS };
  const panel = createPanel(LABELS);

  panel.render(funnel(server, browser, new Set(browser.map((each) => each.id)), ARRIVAL));

  const root = document.getElementById('wconvert-inspector-panel')?.shadowRoot;

  if (root == null) {
    throw new Error('the panel drew no shadow root');
  }

  return { panel, root };
}

afterEach(() => document.getElementById('wconvert-inspector-panel')?.remove());

describe('the panel', () => {
  /**
   * **Open, not closed.** This is a diagnostic: a closed root would put the
   * report out of reach of the devtools of the person debugging with it.
   */
  it('renders into an open shadow root, so it can be inspected', () => {
    const { root } = draw();

    expect(root.mode).toBe('open');
    expect(root.querySelector('.panel')).not.toBeNull();
  });

  /**
   * ==========================================================================
   * WCAG 2.2 SC 2.4.11 — FOCUS NOT OBSCURED (AA).
   * ==========================================================================
   * A focused element must not be ENTIRELY hidden by author content. This is a
   * fixed box over a page whose whole point is that a popup is about to appear
   * on it, so it is capped well short of the viewport, it scrolls internally,
   * and it can be got out of the way.
   */
  it('is capped well short of the viewport and scrolls inside itself', () => {
    const { root } = draw();
    const css = root.querySelector('style')?.textContent ?? '';

    expect(css).toMatch(/max-block-size:\s*60vh/);
    expect(css).toMatch(/\.body\s*\{[^}]*overflow:\s*auto/);
    // Logical properties, so it lands on the correct side of a Persian page.
    expect(css).toMatch(/inset-inline-end/);
    expect(css).not.toMatch(/\bright:\s/);
  });

  it('can be collapsed and dismissed', async () => {
    const { root } = draw();
    const [toggle, close] = [...root.querySelectorAll('button')];

    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    toggle.click();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect((root.querySelector('.body') as HTMLElement).hidden).toBe(true);

    close.click();

    expect(document.getElementById('wconvert-inspector-panel')).toBeNull();
  });

  /**
   * ==========================================================================
   * THREE MARKS, NEVER TWO.
   * ==========================================================================
   * `null` is NOT EVALUATED. A red cross beside a rule a consent plugin
   * withheld teaches the merchant to go and fix a rule that is fine.
   */
  it('draws a third mark for a rule that was never evaluated', () => {
    const { root } = draw();
    const marks = [...root.querySelectorAll('.item span:first-child')].map((node) => node.className);

    expect(marks).toContain('yes');
    expect(marks).toContain('unknown');
    expect(marks).not.toContain('no');
    expect(root.textContent).toContain('Not evaluated');
  });

  it('says which rule, in the vocabulary’s own words', () => {
    const { root } = draw();

    expect(root.textContent).toContain('Has something in their cart');
    expect(root.textContent).not.toContain('cart_has_items');
  });

  /**
   * The Optin list's own sentence, carried verbatim — the two screens must not
   * be able to disagree about why an Optin is suspended, and the list's
   * sentence already names the missing plugin.
   */
  it('repeats the Optin list’s suspension sentence rather than minting one', () => {
    const { root } = draw(
      [optin({ suspended: 'Suspended — the “Has something in their cart” rule needs WooCommerce' })],
      [],
    );

    expect(root.textContent).toContain('rule needs WooCommerce');
  });

  /** An Optin stopped on the server has no browser half, and it says so. */
  it('says there is nothing more to report about one that never arrived', () => {
    const { root } = draw([optin({ published: false })], []);

    expect(root.textContent).toContain('Never reached the browser.');
    expect(root.querySelector('.item')).toBeNull();
  });

  /** ADR 0004's failure modes, named rather than left to be debugged. */
  it('names a stripped defer and a relocated loader', () => {
    const server: ServerReport = { request: {}, optins: [optin()], labels: LABELS };
    const panel = createPanel(LABELS);

    panel.render(
      funnel(server, [entry()], new Set(['A']), {
        ...ARRIVAL,
        deferred: false,
        loaderBeforePayload: true,
      }),
    );

    const root = document.getElementById('wconvert-inspector-panel')?.shadowRoot as ShadowRoot;

    expect(root.textContent).toContain('defer removed.');
    expect(root.textContent).toContain('Above its data.');
  });

  it('names an aggregated loader, which is the case where the tag is gone', () => {
    const server: ServerReport = { request: {}, optins: [optin()], labels: LABELS };
    const panel = createPanel(LABELS);

    panel.render(funnel(server, [entry()], new Set(['A']), { ...ARRIVAL, loaderFound: false }));

    const root = document.getElementById('wconvert-inspector-panel')?.shadowRoot as ShadowRoot;

    expect(root.textContent).toContain('Combined into a bundle.');
  });
});
