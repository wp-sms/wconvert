import { afterEach, expect, it } from 'vitest';
import { unlessFree } from '../../resources/admin/src/goals/availability';
import { journeyReadinessIssues } from '../../resources/admin/src/builder/structure/journeyReadiness';
import type { TemplateTree } from '../../resources/renderer/src/types';

afterEach(() => { delete window.wconvertAdmin; });

const CANT_DISPLAY = 'This design uses elements this site can’t display.';

it('a free install names no product when it explains an absence (ADR 0116 §3)', () => {
  expect(unlessFree('Cart testing requires WConvert Pro and WooCommerce.')).toBe(CANT_DISPLAY);
  window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
  expect(unlessFree('Cart testing requires WConvert Pro and WooCommerce.')).toBe('Cart testing requires WConvert Pro and WooCommerce.');
});

it('a quiz cart result left on a free install says what is missing, not what to buy', () => {
  const tree = { v: 2, submissions: [], steps: [{ id: 'results', name: 'Results', kind: 'result', content: { type: 'stack', children: [] }, results: [
    { id: 'pick', heading: 'Your pick', body: '', product_action: 'add_to_cart', product_ids: [7], href: '/shop', link_label: 'Shop' },
  ] }] } as unknown as TemplateTree;
  const said = journeyReadinessIssues(tree).map(issue => issue.said);
  expect(said).toContain(CANT_DISPLAY);
  expect(said.join(' ')).not.toContain('WConvert Pro');
});
