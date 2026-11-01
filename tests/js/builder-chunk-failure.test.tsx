import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalScreen, OptinBuilder } from '../../resources/admin/src/builder/lazy';
import { LeadsSection } from '../../resources/admin/src/sections';
import { CampaignThumbnail } from '../../resources/admin/src/optins/designChunks';

// The deferred chunk is missing from the install: its import rejects (#363).
vi.mock('../../resources/admin/src/builder/deferred', () => {
  throw new Error('Failed to fetch dynamically imported module');
});
// A design thumbnail's chunk, gone the same way.
vi.mock('../../resources/admin/src/optins/CampaignDesign', () => {
  throw new Error('Failed to fetch dynamically imported module');
});
// A section's chunk, deleted by an update while the tab stayed open.
vi.mock('../../resources/admin/src/leads/LeadLog', () => {
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

it('says the same in place of a section whose chunk is gone', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<LeadsSection onQueryChange={() => {}} />);

  expect(await screen.findByText('Part of WConvert didn’t load.')).toBeInTheDocument();
  expect(screen.getByText('Reload the page. If it keeps happening, reinstall the plugin.')).toBeInTheDocument();
});

it('costs a thumbnail its picture and never the list it sits in', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(<ul><li>Spring sale<CampaignThumbnail template={{ tree: {} } as never} displayType="popup" /></li></ul>);

  await new Promise((wait) => setTimeout(wait, 100));
  expect(screen.getByText('Spring sale')).toBeInTheDocument();
  expect(container.querySelector('.wconvert-preview-placeholder')).not.toBeNull();
  expect(screen.queryByText('Part of WConvert didn’t load.')).not.toBeInTheDocument();
});
