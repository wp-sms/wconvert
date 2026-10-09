import { treeFixture } from './support/journey';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ruleTypes } from './support/rule-types';
const api = vi.hoisted(() => ({ getOptin: vi.fn(), getRules: vi.fn(), readDestinations: vi.fn() }));
vi.mock('../../resources/admin/src/builder/api', () => ({ getOptin: api.getOptin, getRules: api.getRules }));
vi.mock('../../resources/admin/src/destinations/api', () => ({ readDestinations: api.readDestinations }));
const { default: CampaignDetails } = await import('../../resources/admin/src/optins/CampaignDetails');
const config = (action: 'submit' | 'link') => ({ display_type: 'inline', targeting: { logged_in: false }, template: { tokens: {}, tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'button', action, href: 'https://example.test/offer' }] }] }) } });
beforeEach(() => {
  vi.clearAllMocks();
  api.getRules.mockResolvedValue(ruleTypes());
  api.readDestinations.mockResolvedValue({ destinations: [], types: [], connections: [] });
});
it('groups the saved configuration as who it shows to, where, and after signup', async () => {
  api.getOptin.mockResolvedValue({ config: config('submit') });
  render(<CampaignDetails id="A" />);
  expect(await screen.findByRole('heading', { name: 'Shows to' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Where' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'After signup' })).toBeInTheDocument();
  expect(screen.getByText('Who sees it?')).toBeInTheDocument();
  expect(screen.getByText(/Where you place its block or shortcode/)).toBeInTheDocument();
  expect(screen.getByText('New leads are saved in WConvert.')).toBeInTheDocument();
  expect(screen.queryByText(/No lead is saved/)).toBeNull();
  expect(api.getOptin).toHaveBeenCalledWith('A');
});
it('names click targets without claiming they capture a lead', async () => {
  api.getOptin.mockResolvedValue({ config: config('link') });
  render(<CampaignDetails id="B" />);
  expect(await screen.findByText('https://example.test/offer')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'After a click' })).toBeInTheDocument();
  expect(screen.getByText(/No lead is saved/)).toBeInTheDocument();
  expect(screen.queryByText('New leads are saved in WConvert.')).toBeNull();
});
it('offers one way to try again after a failed context read', async () => {
  api.getOptin.mockRejectedValueOnce(new Error('Read failed')).mockResolvedValue({ config: config('submit') });
  render(<CampaignDetails id="A" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Read failed');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'After signup' })).toBeInTheDocument();
});
