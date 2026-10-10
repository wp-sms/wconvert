import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import fixture from '../fixtures/journey-graph-enquiry.json';
import { JourneyArrivalSummary } from '../../resources/admin/src/builder/JourneyArrivalSummary';

afterEach(cleanup);
const tree = fixture as TemplateTree;
it('distinguishes completing and skipping the incoming screen and opens the exact path', async () => {
  const select = vi.fn(), user = userEvent.setup();
  const garden = tree.steps.findIndex(step => step.id === 'garden');
  const next = tree.graph!.edges.find(edge => edge.from === 'garden' && edge.kind === 'default')!.to;
  render(<JourneyArrivalSummary tree={tree} step={tree.steps.findIndex(step => step.id === next)} onSelectPath={select} />);
  await user.click(screen.getByText('Arrives from Garden details'));
  await user.click(screen.getByRole('button', { name: 'Garden details When that screen is skipped' }));
  expect(select).toHaveBeenLastCalledWith(garden, 'hidden');
  await user.click(screen.getByRole('button', { name: 'Garden details After completing that screen' }));
  expect(select).toHaveBeenLastCalledWith(garden, 0);
});
it('identifies the actual entry even when it is not first in storage order', () => {
  render(<JourneyArrivalSummary tree={tree} step={tree.steps.findIndex(step => step.id === tree.graph!.entry)} onSelectPath={() => {}} />);
  expect(screen.getByText('First screen · visitors start here when display rules match.')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
