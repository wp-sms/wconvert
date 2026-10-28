import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalScreen, OptinBuilder } from '../../resources/admin/src/builder/lazy';

// The deferred chunk is missing from the install: its import rejects (#363).
vi.mock('../../resources/admin/src/builder/deferred', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

it('says the editor did not load and keeps the way back, instead of a blank screen', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const onClose = vi.fn();
  render(<OptinBuilder id="01JQ00000000000000000000AA" onClose={onClose} />);

  expect(await screen.findByText('Part of WConvert didn’t load.')).toBeInTheDocument();
  expect(screen.getByText('Reload the page. If it keeps happening, reinstall the plugin.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Back to Campaigns' }));
  expect(onClose).toHaveBeenCalled();
});

it('says the same in place of the creation flow', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<GoalScreen onCreated={() => {}} />);

  expect(await screen.findByText('Part of WConvert didn’t load.')).toBeInTheDocument();
});
