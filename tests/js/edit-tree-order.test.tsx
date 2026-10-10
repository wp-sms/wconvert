import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { EditTree } from '../../resources/admin/src/builder/EditTree';
import fixture from '../fixtures/journey-graph-enquiry.json';

it('lists screens in the same path order as the Flow map', () => {
  render(<EditTree tree={fixture as unknown as TemplateTree} step={2} onSelect={() => {}} />);
  const names = ['Interests', 'Garden details', 'Indoor details', 'Balcony details', 'One enquiry', 'Received'];
  const at = names.map(name => screen.getByText(name, { exact: true }));
  for (let index = 1; index < at.length; index++) {
    expect(at[index - 1].compareDocumentPosition(at[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
});
