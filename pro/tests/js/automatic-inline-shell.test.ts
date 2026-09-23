import { treeFixture } from '../../../tests/js/support/journey';
import { afterEach, expect, it } from 'vitest';
import { start } from '@loader/shell';
import { explain } from '@loader/inspect/explain';
import { proLoaderFor, presenter } from '../../resources/loader/src/compose';
import { BASIC_MODULES } from '../../resources/loader/src/modules';
import { automaticPlacementState } from '../../modules/inline-placement/loader';
import type { PayloadEntry } from '@loader/types';

const template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'heading', text: 'Hello' }] }] }) };
const entry = (id: string, extra: Partial<PayloadEntry> = {}): PayloadEntry => ({ id, display_type: 'inline', template,
  triggers: [{ type: 'page_load' }], conditions: [], ...{ inline_placement: { position: 'after_content' } }, ...extra });
afterEach(() => { document.querySelectorAll('dialog').forEach(dialog => dialog.close()); document.body.innerHTML = ''; });

it('selects after frequency and schedule checks and leaves manual and overlay rendering independent', () => {
  document.body.innerHTML = '<div hidden data-wconvert-auto="capped"></div><div hidden data-wconvert-auto="future"></div><div hidden data-wconvert-auto="winner"></div><div data-wconvert-optin="manual"></div>';
  const stop = start({ loader: proLoaderFor(BASIC_MODULES), presenter,
    entries: [entry('capped', { priority: 99, frequency: { maxImpressions: 1 } }), entry('future', { priority: 98, starts_at: 9999999999999 }), entry('winner'), entry('manual'), entry('overlay', { display_type: 'popup' })],
    store: { read: () => JSON.stringify({ capped: { i: 1, l: 0 } }), write() {} }, now: () => 1000,
  });
  expect(document.querySelector('[data-wconvert-auto="capped"]')!.childElementCount).toBe(0);
  expect(document.querySelector('[data-wconvert-auto="future"]')!.childElementCount).toBe(0);
  expect(document.querySelector('[data-wconvert-auto="winner"]')).not.toHaveAttribute('hidden');
  expect(document.querySelector('[data-wconvert-optin="manual"]')!.childElementCount).toBe(1);
  expect(document.querySelectorAll('dialog')).toHaveLength(1);
  stop();
});

it('an assigned variant uses its own position but the parent manual anchor takes precedence', () => {
  document.body.innerHTML = '<div hidden data-wconvert-auto="parent"></div><div hidden data-wconvert-auto="variant"></div><div data-wconvert-optin="parent"></div>';
  const stop = start({ loader: proLoaderFor(BASIC_MODULES), presenter,
    entries: [entry('variant', { anchor: 'parent' })], store: { read: () => null, write() {} },
  });
  expect(document.querySelector('[data-wconvert-optin="parent"]')!.childElementCount).toBe(1);
  expect(document.querySelectorAll('[data-wconvert-auto][hidden]')).toHaveLength(2);
  stop();
});

it('a manual A/B arm cannot consume an automatic family anchor when Basic has no arm assignment', () => {
  document.body.innerHTML = '<div hidden data-wconvert-auto="parent"></div>';
  const manualArm = { ...entry('variant', { anchor: 'parent' }), inline_placement: undefined };
  const stop = start({ loader: proLoaderFor(BASIC_MODULES), presenter,
    entries: [entry('parent'), manualArm],
    store: { read: () => null, write() {} },
  });
  expect(document.querySelector('[data-wconvert-auto="parent"]')!.childElementCount).toBe(1);
  stop();
});

it('the inspector uses the same selection and distinguishes missing placement from losing priority', () => {
  document.body.innerHTML = '<div hidden data-wconvert-auto="a"></div><div hidden data-wconvert-auto="b"></div>';
  const report = explain({ entries: [entry('a'), entry('b', { priority: 9 }), entry('missing')], evaluators: new Map([['page_load', { holds: () => true }]]), withheld: new Set(), shown: new Set(), overlayDone: false, state: {}, now: 1000, day: 0 }, { select: presenter.select, placement: automaticPlacementState });
  expect(report.verdict.show.map(item => item.id)).toEqual(['b']);
  expect(report.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'a', lostArbitration: true, placementStatus: 'automatic_ready' }),
    expect.objectContaining({ id: 'b', lostArbitration: false }),
    expect.objectContaining({ id: 'missing', lostArbitration: true, placementStatus: 'automatic_missing' }),
  ]));
});
