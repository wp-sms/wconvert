import { treeFixture } from './support/journey';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ruleTypes } from './support/rule-types';
const api = vi.hoisted(() => ({ getOptin: vi.fn(), getRules: vi.fn(), readDestinations: vi.fn(), resolveObjects: vi.fn() }));
vi.mock('../../resources/admin/src/builder/api', () => ({ getOptin: api.getOptin, getRules: api.getRules }));
vi.mock('../../resources/admin/src/destinations/api', () => ({ readDestinations: api.readDestinations }));
vi.mock('../../resources/admin/src/builder/rules/objects', () => ({ resolveObjects: api.resolveObjects }));
const { default: CampaignDetails } = await import('../../resources/admin/src/optins/CampaignDetails');
const config = (action: 'submit' | 'link', extra: Record<string, unknown> = {}) => ({ display_type: 'inline', targeting: { logged_in: false }, template: { tokens: {}, tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'button', action, href: 'https://example.test/offer' }] }] }) }, ...extra });
const onPages = (...ids: string[]) => config('submit', { display_type: 'popup', targeting: { mode: 'selected', include: ids.map((value) => ({ type: 'post', value })) } });
/** The answer beside one label in the icon list. */
const fact = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;
beforeEach(() => {
  vi.clearAllMocks();
  api.getRules.mockResolvedValue(ruleTypes());
  api.readDestinations.mockResolvedValue({ destinations: [], types: [], connections: [] });
  api.resolveObjects.mockResolvedValue([]);
});
it('reads how it runs as one icon list', async () => {
  api.getOptin.mockResolvedValue({ config: config('submit') });
  render(<CampaignDetails id="A" />);
  const section = await screen.findByRole('region', { name: 'How it runs' });
  expect([...section.querySelectorAll('dt')].map((term) => term.textContent)).toEqual(
    ['Who', 'Where', 'Opens', 'How often', 'Runs', 'Leads go to'],
  );
  expect(section.querySelectorAll('dt svg')).toHaveLength(6);
  expect(fact('Where')).toHaveTextContent('Where you place its block or shortcode');
  expect(fact('Leads go to')).toHaveTextContent('Kept in WConvert only');
  expect(screen.queryByText(/Nowhere/)).toBeNull();
  expect(screen.queryByText(/No lead is saved/)).toBeNull();
  expect(api.getOptin).toHaveBeenCalledWith('A');
});
it('names the pages it shows on', async () => {
  api.getOptin.mockResolvedValue({ config: onPages('2', '7') });
  api.resolveObjects.mockImplementation(async (kind: string, ids: string[]) =>
    kind === 'post' ? ids.map((id) => ({ id, title: id === '2' ? 'Home page' : 'Shop' })) : []);
  render(<CampaignDetails id="A" />);
  await screen.findByRole('region', { name: 'How it runs' });
  expect(fact('Where')).toHaveTextContent(/^Home page or Shop$/);
  expect(api.resolveObjects).toHaveBeenCalledWith('post', ['2', '7']);
});
it('names three pages and counts the rest', async () => {
  api.getOptin.mockResolvedValue({ config: onPages('1', '2', '3', '4', '5') });
  api.resolveObjects.mockImplementation(async (_kind: string, ids: string[]) => ids.map((id) => ({ id, title: `Page ${id}` })));
  render(<CampaignDetails id="A" />);
  await screen.findByRole('region', { name: 'How it runs' });
  expect(fact('Where')).toHaveTextContent(/^Page 1, Page 2, Page 3 \+2 more$/);
  expect(api.resolveObjects).toHaveBeenCalledWith('post', ['1', '2', '3']);
});
it('falls back to the count when the pages cannot be named', async () => {
  api.getOptin.mockResolvedValue({ config: onPages('2', '7') });
  api.resolveObjects.mockRejectedValue(new Error('Search failed'));
  render(<CampaignDetails id="A" />);
  await screen.findByRole('region', { name: 'How it runs' });
  expect(fact('Where')).toHaveTextContent('2 selected pages');
});
it('names a bound destination and flags its problems', async () => {
  api.getOptin.mockResolvedValue({ config: config('submit', { destinations: ['gone'] }) });
  render(<CampaignDetails id="A" />);
  await screen.findByRole('region', { name: 'How it runs' });
  expect(fact('Leads go to').parentElement).toHaveAttribute('data-tone', 'warning');
  expect(fact('Leads go to')).not.toHaveTextContent('Kept in WConvert only');
});
it('names click targets without claiming they capture a lead', async () => {
  api.getOptin.mockResolvedValue({ config: config('link') });
  render(<CampaignDetails id="B" />);
  await screen.findByRole('region', { name: 'How it runs' });
  const targets = fact('Visitors go to');
  expect(within(targets).getByRole('listitem')).toHaveTextContent('https://example.test/offer');
  expect(targets).toHaveTextContent(/No lead is saved/);
  expect(screen.queryByText('Leads go to')).toBeNull();
});
it('offers one way to try again after a failed context read', async () => {
  api.getOptin.mockRejectedValueOnce(new Error('Read failed')).mockResolvedValue({ config: config('submit') });
  render(<CampaignDetails id="A" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Read failed');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('region', { name: 'How it runs' })).toBeInTheDocument();
});
