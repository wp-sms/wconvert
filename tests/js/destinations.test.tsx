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
  availability: 'ready' as const,
  needs_connection: false,
};

const MAILCHIMP_LOCKED = { ...WSMS_READY, id: 'mailchimp', label: 'Mailchimp', tier: 'pro' as const, requires: null, availability: 'locked' as const };

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

    expect(await screen.findByText('Needs wsms on this site.')).toBeInTheDocument();
    expect(screen.getByText('Included with Pro.')).toBeInTheDocument();
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
