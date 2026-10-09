import type { Destination, DestinationsPayload } from './api';
import { setupProblems } from './status';

/**
 * Whether this one route is a sending issue right now.
 *
 * **A live campaign feeding an unfinished route is one.** It badges "Needs
 * setup" on its card, but this used to read only outages, skips and
 * availability — so a live campaign bound to a lead-magnet email with no file
 * link sent nothing while the bell said "No campaign or sending issues." and
 * Leads offered no Sending issues view. Only LIVE use counts: an unfinished
 * route no published campaign uses loses nothing yet, and its card already
 * says what to finish.
 *
 * `types` and `connections` may be absent from a payload a test or an older
 * read hands over; with neither, no setup problem can be read, which is the
 * old answer rather than a throw in the header.
 */
export function hasSendingIssue(destination: Destination, data: Pick<DestinationsPayload, 'failures'> & Partial<Pick<DestinationsPayload, 'types' | 'connections'>>): boolean {
  if (destination.health.consecutive_failures > 0 || destination.health.skipped_captures > 0 || destination.availability !== 'ready') return true;
  if (data.failures.some((failure) => failure.destination === destination.id)) return true;
  if (destination.usage?.some((use) => use.live) !== true) return false;
  const type = data.types?.find((candidate) => candidate.id === destination.type);
  return setupProblems(destination, type, data.connections ?? []).length > 0;
}

/** Count affected routes once, not failures plus routes or undelivered Leads. */
export function issueCount(data: DestinationsPayload): number {
  const affected = new Set(data.failures.map((failure) => failure.destination));
  for (const destination of data.destinations) {
    if (hasSendingIssue(destination, data)) affected.add(destination.id);
  }
  return affected.size;
}
