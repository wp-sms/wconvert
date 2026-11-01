import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OptinBuilder } from '../../resources/admin/src/builder/lazy';
import { renderExtensions } from '../../resources/admin/src/renderExtensions';

// The builder's chunk, already here; only Pro's loader is still on the way.
vi.mock('../../resources/admin/src/builder/deferred', () => ({
  OptinBuilder: () => <p>The editor</p>,
  GoalScreen: () => <p>Creation</p>,
}));

it('keeps the builder’s skeleton up until Pro’s renderer loader has finished (#397)', async () => {
  let finish!: () => void;
  const registered: string[] = [];
  renderExtensions.load(() => new Promise<void>((done) => { finish = done; }).then(() => { registered.push('journeys'); }));
  render(<OptinBuilder id="01JQ00000000000000000000AA" onClose={() => {}} />);

  await new Promise((wait) => setTimeout(wait, 100));
  expect(screen.queryByText('The editor')).not.toBeInTheDocument();
  expect(registered).toEqual([]);

  finish();
  expect(await screen.findByText('The editor')).toBeInTheDocument();
  expect(registered).toEqual(['journeys']);
});
