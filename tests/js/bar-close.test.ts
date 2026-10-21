import { afterEach, describe, expect, it } from 'vitest';
import { closeButton, shell } from '@renderer/mount';
import { mountPopover } from '../../pro/modules/display-types/loader/popover';
import { treeFixture } from './support/journey';

const template = {
  tree: treeFixture({
    steps: [
      { type: 'stack', children: [{ type: 'heading', role: 'headline', text: 'Ten percent off your first order' }] },
      { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Request received' }] },
    ],
  }),
  tokens: {},
};

afterEach(() => document.body.replaceChildren());

/*
 * Where the control sits and what gets room beside it is layout, which jsdom
 * does not do; tools/visual-tests/close-reserve.mjs checks that in a browser
 * (ADR 0158). What jsdom can hold is the contract around it.
 */
describe('the close control', () => {
  it('is handed to decorate with every step shell renders, including a swapped one', () => {
    const seen: Array<[HTMLElement, HTMLElement]> = [];
    const chrome = closeButton(() => undefined);
    const parts = shell(template, chrome, { template, decorate: (root, control) => seen.push([root, control]) });

    const next = parts.step(1);

    expect(seen.map(([root]) => root)).toEqual([expect.any(HTMLElement), next]);
    expect(seen.every(([root, control]) => control === chrome && root.contains(chrome) === (root === next))).toBe(true);
  });

  it('is marked as a bar’s on a floating bar and on no other Pro surface', () => {
    const marked = Object.fromEntries((['floating_bar', 'slide_in', 'fullscreen'] as const).map(displayType => {
      mountPopover({ template, displayType, shadowMode: 'open' }).show();
      const control = [...document.querySelectorAll('*')].map(element => element.shadowRoot?.querySelector('.wc-close')).find(Boolean);
      document.body.replaceChildren();
      return [displayType, control instanceof HTMLElement && control.dataset.bar !== undefined];
    }));

    expect(marked).toEqual({ floating_bar: true, slide_in: false, fullscreen: false });
  });
});
