import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The Destinations screen, and the two decisions on it that are decisions
 * rather than layout.
 *
 * **One: `unavailable` is explained and never sold.** A merchant with no WP
 * SMS is not missing a tier we can sell them, and collapsing that into
 * "upgrade" shows a paying customer an advertisement for what they already
 * bought (ADR 0026).
 *
 * **Two: the two failure displays are not redundant.**
 * `consecutive_failures` counts OUTAGES; a [[Lead]] rejected for its own sake
 * leaves it at zero and lands in the terminal-failure ring instead. A screen
 * showing only one of them hides exactly one of the two things that go wrong
 * (ADR 0008).
 */
const api = vi.hoisted(() => ({
  readDestinations: vi.fn(),
  saveDestination: vi.fn(),
  deleteDestination: vi.fn(),
  rePush: vi.fn(),
}));

vi.mock('../../resources/admin/src/destinations/api', () => api);

const { Destinations } = await import('../../resources/admin/src/destinations/Destinations');

const WSMS_READY = {
  id: 'wsms',
  label: 'WP SMS contacts',
  icon: 'dashicons-groups',
  tier: 'free' as const,
  requires: 'wsms',
  requires_label: 'WP SMS',
  availability: 'ready' as const,
  needs_connection: false,
  settings_schema: {
    tags: { type: 'ids', label: 'Tags to add', description: 'Added, never removed.' },
  },
};

const MAILCHIMP_LOCKED = {
  ...WSMS_READY,
  id: 'mailchimp',
  label: 'Mailchimp',
  tier: 'pro' as const,
  requires: null,
  requires_label: null,
  availability: 'locked' as const,
};

const HEALTHY = {
  id: '01J0000000AAAAAAAAAAAAAAAA',
  type: 'wsms',
  label: 'WP SMS contacts',
  connection: null,
  settings: { tags: ['tag-7'] },
  availability: 'ready' as const,
  health: {
    last_success_at: '2026-08-25 10:00:00',
    last_error: null,
    last_error_at: null,
    consecutive_failures: 0,
    skipped_captures: 0,
    last_skipped_at: null,
  },
};

describe('the destinations screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    api.readDestinations.mockResolvedValue({
      types: [WSMS_READY],
      destinations: [HEALTHY],
      connections: [],
      failures: [],
    });
  });

  it('shows when a destination last pushed successfully', async () => {
    render(<Destinations />);

    expect(await screen.findByText(/Last successful push: 2026-08-25 10:00:00/)).toBeInTheDocument();
  });

  it('reports consecutive failures as an outage, with the error', async () => {
    api.readDestinations.mockResolvedValue({
      types: [WSMS_READY],
      destinations: [
        {
          ...HEALTHY,
          health: {
            ...HEALTHY.health,
            last_success_at: '2026-08-22 10:00:00',
            last_error: 'Gateway timeout',
            last_error_at: '2026-08-25 10:00:00',
            consecutive_failures: 3,
          },
        },
      ],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByText(/3 failures in a row. Last error: Gateway timeout/)).toBeInTheDocument();
  });

  /**
   * The terminal ring, which is the ONLY place a per-Lead failure is visible:
   * health cannot see one, because a malformed address is not an outage.
   */
  it('lists terminal failures separately from health', async () => {
    api.readDestinations.mockResolvedValue({
      types: [WSMS_READY],
      destinations: [HEALTHY],
      connections: [],
      failures: [
        {
          destination: HEALTHY.id,
          lead: '01J0000000BBBBBBBBBBBBBBBB',
          error: 'That address does not exist.',
          at: '2026-08-25 11:00:00',
        },
      ],
    });

    render(<Destinations />);

    expect(await screen.findByText('That address does not exist.')).toBeInTheDocument();
    // Health is still clean, and says so, beside a Lead that will never land.
    expect(screen.getByText(/Last successful push/)).toBeInTheDocument();
  });

  it('explains an unavailable type rather than offering to sell it', async () => {
    api.readDestinations.mockResolvedValue({
      types: [{ ...WSMS_READY, availability: 'unavailable' as const }, MAILCHIMP_LOCKED],
      destinations: [],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    // The LABEL, never the slug: "Needs wsms on this site" is copy no
    // merchant can act on and no translator can repair from their end.
    expect(await screen.findByText('Needs WP SMS on this site.')).toBeInTheDocument();

    // And the two absent states stay apart. Collapsing them is what shows a
    // paying customer an advertisement for Pro, and offers a merchant a WP SMS
    // licence we do not sell (ADR 0026).
    expect(screen.getByText('Included with Pro.')).toBeInTheDocument();
    expect(screen.queryByText(/Needs null/)).not.toBeInTheDocument();
  });

  /**
   * The "recorded" half of "skipped and recorded, never enqueued". Without it
   * a deactivated WP SMS drops every push with nothing anywhere saying so —
   * the Optin keeps converting and the Leads keep landing (#4).
   */
  it('reports captures that were never sent, separately from outages', async () => {
    api.readDestinations.mockResolvedValue({
      types: [{ ...WSMS_READY, availability: 'unavailable' as const }],
      destinations: [
        {
          ...HEALTHY,
          availability: 'unavailable' as const,
          health: { ...HEALTHY.health, skipped_captures: 12, last_skipped_at: '2026-08-25 12:00:00' },
        },
      ],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByText(/12 captures were not sent/)).toBeInTheDocument();
    // Not an outage: nothing was attempted, so the failure count stays out of it.
    expect(screen.queryByText(/failures in a row/)).not.toBeInTheDocument();
  });

  /**
   * A field's copy comes from its TYPE's `settingsSchema()` — the method that
   * replaces WSMS's five `Supports*` capability interfaces (#4). Hard-coding
   * it here would leave that method with no caller and the collapse
   * unjustified.
   */
  it('labels a setting from the schema its type declares', async () => {
    api.readDestinations.mockResolvedValue({
      types: [{ ...WSMS_READY, settings_schema: { tags: { type: 'ids', label: 'Which tags', description: 'Added, never removed.' } } }],
      destinations: [HEALTHY],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByText(/Which tags/)).toBeInTheDocument();
    expect(screen.getByText(/Added, never removed\./)).toBeInTheDocument();
  });

  /**
   * A truncated replay must never read as a complete one — the operator would
   * believe the window is closed and never look again (ADR 0008).
   */
  it('says out loud when a re-push hit its per-run limit', async () => {
    api.rePush.mockResolvedValue({ jobs: 10000, capped: true, since: '2026-08-22 10:00:00' });

    render(<Destinations />);

    await userEvent.click(await screen.findByRole('button', { name: /Re-push Leads/ }));

    await waitFor(() => {
      expect(screen.getByText(/per-run limit/)).toBeInTheDocument();
    });

    expect(api.rePush).toHaveBeenCalledWith(HEALTHY.id);
  });
});
