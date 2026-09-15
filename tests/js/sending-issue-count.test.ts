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
