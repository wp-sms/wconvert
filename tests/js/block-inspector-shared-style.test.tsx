import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import type { Template } from '@renderer/types';
import LABELS from '../fixtures/template-labels.json';
import { treeFixture } from './support/journey';
import { BlockInspector } from '../../resources/admin/src/builder/BlockInspector';

/** Stands in for ScopeStyle: draws the element's own looks where ScopeStyle would. */
function Look({ lead }: { width: 'tokens' | 'narrow'; lead?: ReactNode }) {
  return <div>{lead}</div>;
}

const template: Template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'stack', children: [
  { type: 'image', src: 'https://example.test/a.jpg', alt: 'A photo', fit: 'contain' },
] }] }) };

/** #367: Picture fit lives on the element, so under Mobile it says it is shared. */
it.each([['narrow', true], ['tokens', false]] as const)('says element looks are shared while editing %s: %s', async (width, said) => {
  render(<BlockInspector template={template} labels={LABELS as never} path={[0, 'children', 0]} act="click"
    onChange={() => {}} onSwap={() => {}} look={<Look width={width} />} />);
  await userEvent.click(screen.getByRole('tab', { name: 'Style' }));
  expect(screen.queryByText('Same on desktop and mobile.') !== null).toBe(said);
});
