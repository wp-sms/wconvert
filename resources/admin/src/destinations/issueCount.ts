import type { DestinationsPayload } from './api';

/** Count affected routes once, not failures plus routes or undelivered Leads. */
export function issueCount(data: DestinationsPayload): number {
  const affected = new Set(data.failures.map((failure) => failure.destination));
  for (const destination of data.destinations) {
    if (destination.health.consecutive_failures > 0 || destination.health.skipped_captures > 0 || destination.availability !== 'ready') affected.add(destination.id);
  }
  return affected.size;
}
