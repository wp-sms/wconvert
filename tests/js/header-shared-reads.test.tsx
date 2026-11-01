import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The bell goes after the screen, and shares its reads (#395).
 *
 * Every screen used to start with the bell's three reads queued ahead of its
 * own; Leads read destinations three times. These run the real `optins/api`
 * and `destinations/api` against a fake `apiFetch` that runs middleware as
 * WordPress's does, and count what reaches the server.
 */
type Options = { path?: string; method?: string };
type Next = (options: Options) => Promise<unknown>;
const fake = vi.hoisted(() => {
  const middlewares: Array<(options: Options, next: Next) => Promise<unknown>> = [];
  const handler = vi.fn<(options: Options) => Promise<unknown>>();
  const run = (index: number, options: Options): Promise<unknown> =>
    index < middlewares.length ? middlewares[index](options, (next) => run(index + 1, next)) : handler(options);
  const apiFetch = Object.assign((options: Options) => run(0, options), {
    use: (middleware: (options: Options, next: Next) => Promise<unknown>) => { middlewares.push(middleware); },
  });
  return { apiFetch, handler };
});
vi.mock('@wordpress/api-fetch', () => ({ default: fake.apiFetch }));
const log = vi.hoisted(() => ({ readLog: vi.fn(), readRetention: vi.fn(), saveRetention: vi.fn(), eraseIdentifier: vi.fn(), canExport: vi.fn(), exportLeads: vi.fn() }));
vi.mock('../../resources/admin/src/leads/api', () => log);

const { HeaderTools } = await import('../../resources/admin/src/shell/HeaderTools');
const { App } = await import('../../resources/admin/src/App');
const { listOptins } = await import('../../resources/admin/src/optins/api');
const { resetRequestActivity } = await import('../../resources/admin/src/lib/requestActivity');

const SUSPENDED = {
  id: '01JQ00000000000000000000AA', name: 'Spring sale', goal: 'grow_email_list', parent_id: null,
  published_at: '2026-09-01 10:00:00', has_unpublished_changes: false, deleted_at: null,
  suspended: 'WooCommerce is inactive.', arms: [],
};
const DESTINATIONS = { types: [], destinations: [], connections: [], failures: [] };

const requests = (path: string) => fake.handler.mock.calls.filter(([options]) => (options.path ?? '').split('?')[0] === path);
const route = (options: Options): Promise<unknown> => {
  const path = (options.path ?? '').split('?')[0];
  if (options.method && options.method !== 'GET') return Promise.resolve({});
  if (path === '/wconvert/v1/optins') return Promise.resolve([SUSPENDED]);
  if (path === '/wconvert/v1/destinations') return Promise.resolve(DESTINATIONS);
  if (path === '/wconvert/v1/protection') return Promise.resolve({ rules_configured: false, rules_available: true });
  return Promise.resolve([]);
};

beforeEach(() => {
  resetRequestActivity();
  fake.handler.mockReset();
  fake.handler.mockImplementation(route);
  window.history.replaceState({}, '', '#');
});

afterEach(() => {
  resetRequestActivity();
});

it('waits for the screen’s read, then uses its list instead of reading another', async () => {
  let finish!: () => void;
  fake.handler.mockImplementationOnce(() => new Promise((done) => { finish = () => done([SUSPENDED]); }));
  const screenRead = listOptins();
  render(<HeaderTools />);

  await new Promise((wait) => setTimeout(wait, 400));
  expect(fake.handler).toHaveBeenCalledTimes(1);

  finish();
  await screenRead;
  expect(await screen.findByRole('button', { name: 'Notifications, 1 issue' })).toBeInTheDocument();
  expect(requests('/wconvert/v1/optins')).toHaveLength(1);
  expect(requests('/wconvert/v1/destinations')).toHaveLength(1);
  expect(requests('/wconvert/v1/protection')).toHaveLength(1);
});

it('reads again once anything has changed', async () => {
  await listOptins();
  render(<HeaderTools />);
  await screen.findByRole('button', { name: 'Notifications, 1 issue' });
  expect(requests('/wconvert/v1/optins')).toHaveLength(1);

  await fake.apiFetch({ path: `/wconvert/v1/optins/${SUSPENDED.id}/unpublish`, method: 'POST' });
  await userEvent.click(screen.getByRole('button', { name: 'Notifications, 1 issue' }));

  await waitFor(() => expect(requests('/wconvert/v1/optins')).toHaveLength(2));
});

it('reads destinations and the list once on Leads, for the bell, the count and the log', async () => {
  log.readLog.mockResolvedValue({ submissions: 0, grouped: false, leads: [], groups: [], next_cursor: null, snapshot: '01J99999990000000000000000' });
  log.readRetention.mockResolvedValue({ days: null, max_days: 3650 });
  log.canExport.mockReturnValue(true);
  window.history.replaceState({}, '', '#leads');
  render(<App />);

  await waitFor(() => expect(requests('/wconvert/v1/protection')).toHaveLength(1), { timeout: 4000 });
  expect(requests('/wconvert/v1/destinations')).toHaveLength(1);
  expect(requests('/wconvert/v1/optins')).toHaveLength(1);
  expect(requests('/wconvert/v1/optins')[0][0].path).toContain('include_deleted=1');
});
