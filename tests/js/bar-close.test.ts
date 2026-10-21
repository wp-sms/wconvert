import { describe, expect, it } from 'vitest';
import { closeButton, shell } from '@renderer/mount';
import { treeFixture } from './support/journey';

const template = {
  tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'heading', role: 'headline', text: 'Ten percent off your first order' }] }] }),
  tokens: {},
};

/*
 * Where the control sits is layout, which jsdom does not do; a real browser
 * checks that (tools/visual-tests). What jsdom can hold is the contract the
 * shared stylesheet keys on: only a bar's control is marked as a bar's.
 */
describe('the close control', () => {
  it('is marked as a bar’s on a floating bar and on no other surface', () => {
    const marked = Object.fromEntries((['floating_bar', 'popup', 'slide_in', 'fullscreen'] as const).map(displayType => {
      const chrome = closeButton(() => undefined);
      shell(template, chrome, { template, displayType, shadowMode: 'open' });
      return [displayType, chrome.dataset.bar !== undefined];
    }));

    expect(marked).toEqual({ floating_bar: true, popup: false, slide_in: false, fullscreen: false });
  });
});
