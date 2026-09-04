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
  stopped: {
    blocked: 'Needs consent this visit has not given.',
    showing: 'Showing now.',
    before_window: 'Scheduled. It starts in %s.',
    after_window: 'Its schedule ended %s ago.',
  },
  answer: { yes: 'Holds', no: 'Does not hold', unknown: 'Not evaluated', unsupported: 'No module here' },
  sections: { targeting: 'Where', triggers: 'When', conditions: 'Who', include: 'On', exclude: 'Never on', server_only: 'Never reached the browser.' },
  gates: {
    published: 'Published',
    suspended: 'Not suspended',
    targeting: 'Allowed on this page',
    payload: 'Reached the browser',
    schedule: 'Inside its schedule',
    frequency: 'Allowance not spent',
    consent: 'Consent given',
    trigger: 'Has a trigger this site can fire',
    conditions: 'Conditions hold',
    fired: 'A trigger fired',
    won: 'Won the page view',
  },
  arrival: { aggregated: 'Combined into a bundle.', defer: 'defer removed.', order: 'Above its data.' },
  rules: { device: 'Device', cart_has_items: 'Has something in their cart', time_on_page: 'Time on the page' },
};

const optin = (over: Partial<ServerOptin> = {}): ServerOptin => ({
  id: 'A',
  name: 'Welcome discount',
  published: true,
  suspended: null,
  schedule: null,
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
  schedule: null,
  siteCapped: false,
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

  /**
   * ==========================================================================
   * THE FUNNEL RENDERS, AND IT NAMES WHAT IS ALREADY FINE.
   * ==========================================================================
   * The gate labels were minted in PHP and read by nothing: the report
   * returned one string that named a STAGE for some stops and a CAUSE for
   * others, so the panel had no gate to draw. "This browser has already had
   * its allowance" answers what stopped it; the gates answer what is already
   * fine, which is most of what a merchant debugging a popup needs.
   */
  it('draws every gate, marking the ones it passed and the one that closed', () => {
    const { root } = draw([optin()], [entry({ standing: 'blocked' })]);
    const gates = [...root.querySelectorAll('.gate')].map((g) => [
      g.className.replace('gate ', ''),
      g.textContent,
    ]);

    expect(gates).toHaveLength(11);
    // Everything up to consent opened...
    expect(gates[0]).toEqual(['gate--open', '✓Published']);
    expect(gates[3]).toEqual(['gate--open', '✓Reached the browser']);
    expect(gates[4]).toEqual(['gate--open', '✓Inside its schedule']);
    // ...consent is where it stopped...
    expect(gates[6]).toEqual(['gate--shut', '✕Consent given']);
    // ...and nothing past it was ever asked.
    expect(gates[7]).toEqual(['gate', '·Has a trigger this site can fire']);
  });

  /** An Optin that is showing passed all eleven, and none is marked closed. */
  it('marks nothing closed for one that is showing', () => {
    const { root } = draw([optin()], [entry({ standing: 'ready' })]);

    expect(root.querySelectorAll('.gate--open')).toHaveLength(11);
    expect(root.querySelector('.gate--shut')).toBeNull();
  });

  /**
   * ==========================================================================
   * "WHY DIDN'T IT SHOW?" — "IT STARTS ON FRIDAY."
   * ==========================================================================
   * The engine's word for an Optin outside its window is `capped`, the same as
   * for one whose allowance is spent (ADR 0047). This is the sentence beside
   * the word, and it is the whole reason no seventh `Standing` was minted.
   */
  it('says how long until a scheduled Optin starts', () => {
    const { root } = draw(
      [optin({ schedule: { starts: '3 days', ends: null } })],
      [entry({ standing: 'capped', schedule: 'before' })],
    );

    expect(root.textContent).toContain('Scheduled. It starts in 3 days.');
    expect(root.textContent).not.toContain('%s');
  });

  it('says how long ago a finished campaign ended', () => {
    const { root } = draw(
      [optin({ schedule: { starts: '2 weeks', ends: '4 hours' } })],
      [entry({ standing: 'capped', schedule: 'after' })],
    );

    expect(root.textContent).toContain('Its schedule ended 4 hours ago.');
  });

  /**
   * It is INSIDE the disclosure. The collapsed row is what a merchant scans to
   * find the Optin they care about, and eleven rows per Optin there would bury
   * it.
   */
  it('keeps the funnel out of the collapsed summary', () => {
    const { root } = draw();

    expect(root.querySelector('summary .gate')).toBeNull();
    expect(root.querySelector('details .gates')).not.toBeNull();
  });

  /**
   * ==========================================================================
   * WCAG 2.2 SC 2.4.11 — IT GETS OUT OF THE WAY, IT DOES NOT MERELY SIT IN A
   * CORNER.
   * ==========================================================================
   * Capping the panel at 60vh and putting it bottom-right is necessary and is
   * not sufficient. Measured on a real page: tabbing the theme's own
   * navigation put three links ENTIRELY behind it, which is the failure this
   * criterion names.
   *
   * jsdom computes no layout, so the rectangles are stubbed — what is under
   * test is the RULE (entirely behind → collapse; partly visible → leave it),
   * and the browser pass is what measured the fault in the first place.
   */
  const focusBehind = (root: ShadowRoot, box: Partial<DOMRect>) => {
    const link = document.createElement('a');

    link.href = '#';
    link.getBoundingClientRect = () => ({ left: 100, right: 200, top: 100, bottom: 120, ...box }) as DOMRect;
    document.body.append(link);

    (root.querySelector('.panel') as HTMLElement).getBoundingClientRect = () =>
      ({ left: 50, right: 300, top: 50, bottom: 400 }) as DOMRect;

    link.focus();

    return link;
  };

  it('collapses when focus lands somewhere it completely covers', () => {
    const { root } = draw();

    expect((root.querySelector('.body') as HTMLElement).hidden).toBe(false);

    focusBehind(root, {});

    expect((root.querySelector('.body') as HTMLElement).hidden).toBe(true);
    // And the control says so, so the merchant can put it back.
    expect(root.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
  });

  /**
   * A focused element only PARTLY behind the panel still shows a focus ring,
   * and collapsing for that would make the panel flicker away on most of the
   * page. "Entirely" is the whole of the criterion.
   */
  it('stays open when the focused element is only partly behind it', () => {
    const { root } = draw();

    focusBehind(root, { left: 10, right: 120 });

    expect((root.querySelector('.body') as HTMLElement).hidden).toBe(false);
  });

  /**
   * **It does not restore itself.** Content that pops back is content the
   * criterion is still about, so the merchant re-opens it with the toggle.
   */
  it('does not reopen when focus moves away again', () => {
    const { root } = draw();

    focusBehind(root, {});
    document.body.focus();

    expect((root.querySelector('.body') as HTMLElement).hidden).toBe(true);
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
