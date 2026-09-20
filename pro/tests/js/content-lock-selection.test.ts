import { expect, it } from 'vitest';
import type { BlockInstance } from '@wordpress/blocks';
import { supportedContent } from '../../modules/content-lock/block/selection';
const block = (name: string, innerBlocks: BlockInstance[] = [], attributes = {}): BlockInstance => ({ name, clientId: name, attributes, innerBlocks });
it('accepts static mixed content including nested list and button children', () => {
  expect(supportedContent([block('core/paragraph'), block('core/list', [block('core/list-item', [block('core/list', [block('core/list-item')])])]), block('core/buttons', [block('core/button')])])).toBe(true);
});
it('refuses active, unknown, invalid or locked descendants before transforming', () => {
  for (const selection of [
    [block('core/embed')], [block('core/group', [block('core/paragraph')])],
    [block('core/quote', [block('core/html')])], [block('wconvert/content-lock')],
    [{ ...block('core/paragraph'), isValid: false }], [block('core/paragraph', [], { lock: { move: true } })],
  ]) expect(supportedContent(selection)).toBe(false);
});
