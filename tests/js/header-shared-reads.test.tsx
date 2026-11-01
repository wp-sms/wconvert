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

const { HeaderTools } = await import('../../resources/admin/src/shell/HeaderTools');
const { App } = await import('../../resources/admin/src/App');
const { listOptins } = await import('../../resources/admin/src/optins/api');
const { resetRequestActivity, track } = await import('../../resources/admin/src/lib/requestActivity');

const SUSPENDED = {
  id: '01JQ00000000000000000000AA', name: 'Spring sale', goal: 'grow_email_list', parent_id: null,
  published_at: '2026-09-01 10:00:00', has_unpublished_changes: false, deleted_at: null,
  suspended: 'WooCommerce is inactive.', arms: [],
};
const DESTINATIONS = { types: [], destinations: [], connections: [], failures: [] };
const FAILING = {
  ...DESTINATIONS,
  destinations: [{ id: 'mail', label: 'Newsletter', type: 'mailchimp', availability: 'ready', usage: [],
    health: { consecutive_failures: 2, skipped_captures: 0, last_error_at: '2026-10-01 10:00:00', last_skipped_at: null } }],
  failures: [{ destination: 'mail', at: '2026-10-04 10:00:00' }],
};
const numbers = { headline: 12, conversions: 12, impressions: 100, dismissals: 0, deliveries: null, conversion_rate: 0.12,
  by_day: { '2026-09-13': 12 }, conversion_by_day: { '2026-09-13': 12 }, impression_by_day: { '2026-09-13': 100 } };
const REPORT = {
  from: '2026-08-15', to: '2026-09-13', days: 30, complete_days: true, today: '2026-09-14',
  goals: [{ ...numbers, goal: 'grow_email_list', label: 'Grow my email list', action: 'submit', result_label: 'Email submissions',
    rate_label: 'Email submission rate', headline_label: 'Email submissions', undelivered_conversions: null, measurement: '',
    optins: [{ ...numbers, id: SUSPENDED.id, name: 'Spring sale', parent_id: null, published_at: null, status: 'published' }] }],
  impact: [{ id: 'leads', label: 'Submissions', note: '', count: 12, goals: ['grow_email_list'] }],
};
let destinations: unknown = DESTINATIONS;

const requests = (path: string) => fake.handler.mock.calls.filter(([options]) => (options.path ?? '').split('?')[0] === path);
const route = (options: Options): Promise<unknown> => {
  const path = (options.path ?? '').split('?')[0];
  // The lead log reads by POST, so its filters stay out of URLs: that is a read, not a change.
  if (path === '/wconvert/v1/leads/query') return Promise.resolve({ submissions: 0, grouped: false, leads: [], groups: [], next_cursor: null, snapshot: '01J99999990000000000000000' });
  if (path === '/wconvert/v1/leads/retention') return Promise.resolve({ days: null, max_days: 3650 });
  if (options.method && options.method !== 'GET') return Promise.resolve({});
  if (path === '/wconvert/v1/optins') return Promise.resolve([SUSPENDED]);
  if (path === '/wconvert/v1/destinations') return Promise.resolve(destinations);
  if (path === '/wconvert/v1/monthly-targets') return Promise.resolve({ month: '2026-09', from: '2026-09-01', end: '2026-09-30', through: '2026-09-13', previous_month: '2026-08', previous_targets: {}, max_target: 100000000, metrics: [] });
  if (path === '/wconvert/v1/dashboard') return Promise.resolve({ ...REPORT, previous: REPORT });
  if (path === '/wconvert/v1/protection') return Promise.resolve({ rules_configured: false, rules_available: true });
  return Promise.resolve([]);
};

beforeEach(() => {
  destinations = DESTINATIONS;
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

it('reads destinations and the list once on Leads, for the bell, the count and the log’s own POST query', async () => {
  window.history.replaceState({}, '', '#leads');
  render(<App />);

  await waitFor(() => expect(requests('/wconvert/v1/protection')).toHaveLength(1), { timeout: 4000 });
  expect(requests('/wconvert/v1/destinations')).toHaveLength(1);
  expect(requests('/wconvert/v1/optins')).toHaveLength(1);
  expect(requests('/wconvert/v1/optins')[0][0].path).toContain('include_deleted=1');
});

it('shares one destinations read on Analytics when sending needs attention, for the report and the bell', async () => {
  destinations = FAILING;
  window.history.replaceState({}, '', '#analytics');
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Sending needs attention' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Notifications, 2 issues' }, { timeout: 4000 })).toBeInTheDocument();
  expect(requests('/wconvert/v1/destinations')).toHaveLength(1);
});

it('waits for a screen’s code to arrive before the bell reads', async () => {
  let arrive!: () => void;
  void track(new Promise<void>((done) => { arrive = done; }));
  render(<HeaderTools />);

  await new Promise((wait) => setTimeout(wait, 400));
  expect(fake.handler).not.toHaveBeenCalled();

  arrive();
  await waitFor(() => expect(requests('/wconvert/v1/protection')).toHaveLength(1));
});
