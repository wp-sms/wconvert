import { useEffect, useState } from 'react';
import { readDestinations, type DestinationsPayload } from '../destinations/api';

/** One destination a submission never reached: its name (null once removed, '' if unnamed), why, and when. */
export interface NotSent {
  destination: string | null;
  error: string;
  at: string;
}

/**
 * **"Not sent", and never "Sent"** (ADR 0008, amended by 0132 through 0071).
 *
 * The failure ring is the only per-submission evidence there is: the latest
 * 200 terminal failures, a Lead id and an error each. Joining it here lets a
 * row and its detail say what Sending issues already knows. Absence from the
 * ring proves nothing — it may have landed, still be queued, or have aged out —
 * so nothing on screen reads a missing entry as a success.
 *
 * One entry per destination, the latest: the detail says where a submission
 * did not go, not how many times it was turned away.
 */
export function notSentByLead(payload: Pick<DestinationsPayload, 'failures' | 'destinations'>): Map<string, NotSent[]> {
  const labels = new Map(payload.destinations.map((destination) => [destination.id, destination.label.trim()]));
  const byLead = new Map<string, Map<string, NotSent>>();
  for (const failure of payload.failures) {
    const routes = byLead.get(failure.lead) ?? new Map<string, NotSent>();
    const held = routes.get(failure.destination);
    if (held === undefined || failure.at > held.at) {
      // A removed route is named for what it is, never by its ID (ADR 0131).
      routes.set(failure.destination, { destination: labels.get(failure.destination) ?? null, error: failure.error, at: failure.at });
    }
    byLead.set(failure.lead, routes);
  }
  return new Map([...byLead].map(([lead, routes]) => [lead, [...routes.values()]]));
}

/**
 * The ring, read once per `refreshKey`. A failed read leaves rows unmarked
 * rather than drawing a second error: the header's Sending issues action is
 * the door for a destination problem, and a missing badge claims nothing.
 */
export function useNotSent(refreshKey: number): Map<string, NotSent[]> {
  const [notSent, setNotSent] = useState<Map<string, NotSent[]>>(() => new Map());
  useEffect(() => {
    let active = true;
    readDestinations().then((payload) => {
      if (active) setNotSent(notSentByLead(payload));
    }).catch(() => { /* See above: no badge is not a claim. */ });
    return () => { active = false; };
  }, [refreshKey]);
  return notSent;
}
