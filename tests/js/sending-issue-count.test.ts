import { expect, it } from 'vitest';
import { issueCount } from '../../resources/admin/src/destinations/issueCount';
import type { DestinationsPayload } from '../../resources/admin/src/destinations/api';

it('counts affected destinations once even when several diagnostics refer to the same route', () => {
  const data = { destinations: [
    { id: 'a', availability: 'ready', health: { consecutive_failures: 3, skipped_captures: 2 } },
    { id: 'b', availability: 'unavailable', health: { consecutive_failures: 0, skipped_captures: 0 } },
    { id: 'c', availability: 'ready', health: { consecutive_failures: 0, skipped_captures: 0 } },
  ], failures: [{ destination: 'a' }, { destination: 'a' }, { destination: 'removed' }] } as DestinationsPayload;
  expect(issueCount(data)).toBe(3);
  expect(issueCount({ ...data, destinations: [], failures: [] })).toBe(0);
});

/**
 * **A live campaign feeding an unfinished route is a sending issue.** It sends
 * nothing, and the bell said "No campaign or sending issues." — the card's
 * "Needs setup" badge was the only place that knew. Unused or draft-only, it
 * loses nothing yet, so it is not counted.
 */
it('counts a route that needs setup only while a live campaign uses it', () => {
  const requirements = { capture_any_of: ['email'], settings: { file_url: { label: 'File URL', type: 'url' } }, fields: ['email'], mapped_fields: {} };
  const route = (id: string, usage: unknown, settings: Record<string, unknown> = {}) => ({
    id, type: 'lead_magnet_email', connection: null, settings, availability: 'ready',
    health: { consecutive_failures: 0, skipped_captures: 0 }, usage,
  });
  const live = [{ id: 'o', name: 'Guide', draft: false, live: true }];
  const data = {
    types: [{ id: 'lead_magnet_email', needs_connection: false, requirements }],
    connections: [],
    destinations: [
      route('live-unfinished', live),
      route('draft-unfinished', [{ id: 'o', name: 'Guide', draft: true, live: false }]),
      route('unused-unfinished', []),
      route('live-finished', live, { file_url: 'https://example.com/guide.pdf' }),
      route('usage-unknown', null),
    ],
    failures: [],
  } as unknown as DestinationsPayload;
  expect(issueCount(data)).toBe(1);

  // An account type saved with no account of its type is a setup problem too.
  const remote = {
    types: [{ id: 'mailchimp', needs_connection: true }],
    connections: [{ id: 'gone', type: 'brevo' }],
    destinations: [{ ...route('no-account', live), type: 'mailchimp', connection: 'gone' }],
    failures: [],
  } as unknown as DestinationsPayload;
  expect(issueCount(remote)).toBe(1);
});
