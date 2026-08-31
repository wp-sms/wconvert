import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
 *
 * **Three: this screen holds more than one Destination at a time, and every
 * per-Destination fact has to be keyed by one.** Busy, the failure a button
 * caused, and the re-push report are each about ONE integration — the shipped
 * version held all three screen-wide, so one slow save froze four regions and
 * one failed save reported at the top of the page (#78, ADR 0039).
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
  icon: 'users',
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

const LEAD_MAGNET = {
  id: 'lead_magnet_email',
  label: 'Lead magnet email',
  icon: 'mail',
  tier: 'free' as const,
  requires: null,
  requires_label: null,
  availability: 'ready' as const,
  needs_connection: false,
  settings_schema: {
    file_url: { type: 'url', label: 'Link to the file', description: 'A link, never an attachment.' },
    subject: { type: 'text', label: 'Subject line' },
    body: { type: 'multiline', label: 'Message', description: 'Write {link} where the download should go.' },
  },
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

const LEAD_MAGNET_BOUND = {
  ...HEALTHY,
  id: '01J0000000CCCCCCCCCCCCCCCC',
  type: 'lead_magnet_email',
  label: 'Lead magnet email',
  settings: {
    file_url: 'https://example.com/guide.pdf',
    subject: 'Your download',
    body: 'Here you go: {link}',
  },
};

/**
 * The region a Destination's heading sits in.
 *
 * `Configured` renders a `Region` with no `label`, because its `RegionHeader`
 * IS the name — which also means the `<section>` has no accessible name and no
 * `region` role to query by. The heading is the anchor instead, and asserting
 * *inside* the section around it is the only way to tell "in that
 * Destination's region" from "somewhere on the page".
 */
const regionFor = (heading: HTMLElement): HTMLElement => {
  const section = heading.closest('section');

  if (section === null) {
    throw new Error(`No region around “${heading.textContent ?? ''}”.`);
  }

  return section;
};

const TWO_DESTINATIONS = {
  types: [WSMS_READY, LEAD_MAGNET],
  destinations: [HEALTHY, LEAD_MAGNET_BOUND],
  connections: [],
  failures: [],
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
   * **The screen draws the schema, not one hard-coded field.**
   *
   * Until #31 it looked up `settings_schema.tags`, rendered one text input and
   * read `SettingsField.type` nowhere — so the second type to declare a field
   * would have rendered none of them. The lead magnet email declares three.
   */
  it('draws every field its type declares, with the control the kind asks for', async () => {
    api.readDestinations.mockResolvedValue({
      types: [LEAD_MAGNET],
      destinations: [LEAD_MAGNET_BOUND],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    // A URL input, a text input and a textarea — one per declared field.
    expect(await screen.findByLabelText(/Link to the file/)).toHaveAttribute('type', 'url');
    expect(screen.getByLabelText(/Subject line/)).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText(/Message/).tagName).toBe('TEXTAREA');
  });

  /** What is stored comes back into the controls, so a save is an edit rather than a retype. */
  it('seeds each control from what is stored', async () => {
    api.readDestinations.mockResolvedValue({
      types: [LEAD_MAGNET],
      destinations: [LEAD_MAGNET_BOUND],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByLabelText(/Link to the file/)).toHaveValue('https://example.com/guide.pdf');
    expect(screen.getByLabelText(/Message/)).toHaveValue('Here you go: {link}');
  });

  /**
   * **A string field round-trips as a string**, where `ids` round-trips as a
   * list. That split is the only thing the value shapes differ on, and getting
   * it backwards would store the lead magnet's URL as a one-element array.
   */
  it('saves a string field as a string', async () => {
    api.readDestinations.mockResolvedValue({
      types: [LEAD_MAGNET],
      destinations: [LEAD_MAGNET_BOUND],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    await userEvent.clear(await screen.findByLabelText(/Subject line/));
    await userEvent.type(screen.getByLabelText(/Subject line/), 'Your guide');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.saveDestination).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: {
            file_url: 'https://example.com/guide.pdf',
            subject: 'Your guide',
            body: 'Here you go: {link}',
          },
        })
      );
    });
  });

  /**
   * **WSMS's round-trip survives byte for byte**, which is the one thing the
   * generalisation could break: `tags` is a LIST, and the comma-separated text
   * input that has always edited it must still split back into one.
   */
  it('still round-trips the WSMS tag list as a list of ids', async () => {
    render(<Destinations />);

    const input = await screen.findByLabelText(/Tags to add/);

    expect(input).toHaveValue('tag-7');

    await userEvent.clear(input);
    await userEvent.type(input, 'tag-7, tag-9 ,');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.saveDestination).toHaveBeenCalledWith(
        expect.objectContaining({ settings: { tags: ['tag-7', 'tag-9'] } })
      );
    });
  });

  /**
   * A kind this bundle has never heard of — a Pro type's, or a later
   * version's — gets a text input rather than nothing. The same `default` case
   * `builder/controls.tsx` has, for the same reason: a degraded control is
   * editable, an absent one is a setting nobody can reach.
   */
  it('falls back to a text input for a field kind it does not know', async () => {
    api.readDestinations.mockResolvedValue({
      types: [
        {
          ...WSMS_READY,
          settings_schema: { whatever: { type: 'a_kind_from_pro', label: 'Something new' } },
        },
      ],
      destinations: [{ ...HEALTHY, settings: { whatever: 'a value' } }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByLabelText(/Something new/)).toHaveAttribute('type', 'text');
  });

  /**
   * A settings key the type no longer declares is left alone rather than
   * dropped. The bag is opaque to the REST layer, so a screen that silently
   * discarded what it could not draw would be the one place that opacity bites.
   */
  it('leaves a stored setting it cannot draw untouched on save', async () => {
    api.readDestinations.mockResolvedValue({
      types: [WSMS_READY],
      destinations: [{ ...HEALTHY, settings: { tags: ['tag-7'], from_an_older_version: 'keep me' } }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.saveDestination).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: { tags: ['tag-7'], from_an_older_version: 'keep me' },
        })
      );
    });
  });

  /**
   * A truncated replay must never read as a complete one — the operator would
   * believe the window is closed and never look again (ADR 0008).
   */
  it('says out loud when a re-push hit its per-run limit', async () => {
    api.rePush.mockResolvedValue({ jobs: 10000, capped: true, since: '2026-08-22 10:00:00' });

    render(<Destinations />);

    await userEvent.click(await screen.findByRole('button', { name: /Re-push leads/ }));

    await waitFor(() => {
      expect(screen.getByText(/per-run limit/)).toBeInTheDocument();
    });

    expect(api.rePush).toHaveBeenCalledWith(HEALTHY.id);
  });

  /**
   * **Busy is per row.** One screen-wide boolean was handed to every region
   * and to the types list, so a merchant saving the tags on one integration
   * watched Save, Re-push, Remove and every Add button on the screen go dead
   * for the length of that one request — with nothing saying why, because the
   * request was four regions away (#78, ADR 0039).
   */
  it('disables only the destination that is saving', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    // A save that never settles, so the busy window stays open to look at.
    api.saveDestination.mockReturnValue(new Promise(() => {}));

    render(<Destinations />);

    const wsms = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    const magnet = regionFor(screen.getByRole('heading', { name: 'Lead magnet email' }));

    await userEvent.click(within(wsms).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(wsms).getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    // The other Destination is untouched — all three of its controls still work.
    expect(within(magnet).getByRole('button', { name: 'Save' })).not.toBeDisabled();
    expect(within(magnet).getByRole('button', { name: /Re-push leads/ })).not.toBeDisabled();
    expect(within(magnet).getByRole('button', { name: 'Remove' })).not.toBeDisabled();
  });

  /**
   * **A failure renders in the region that produced it.** The shipped version
   * held one `error` and rendered it in a region of its own above all the
   * others, so a failed save on the third Destination reported at the top of
   * the screen and the merchant had to guess which row it was about — the
   * placement failure ADR 0039 exists to name.
   */
  it('reports a failed save in the destination that failed, and nowhere else', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    api.saveDestination.mockRejectedValue(new Error('That file link is not reachable.'));

    render(<Destinations />);

    const magnet = regionFor(await screen.findByRole('heading', { name: 'Lead magnet email' }));

    await userEvent.click(within(magnet).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(magnet).getByText('That file link is not reachable.')).toBeInTheDocument();
    });

    // Once, in that one region. Not above the page, and not beside the
    // Destination that is delivering fine.
    expect(screen.getAllByText('That file link is not reachable.')).toHaveLength(1);
    expect(
      within(regionFor(screen.getByRole('heading', { name: 'WP SMS contacts' })))
        .queryByText('That file link is not reachable.'),
    ).not.toBeInTheDocument();
  });

  /**
   * **A re-push report does not outlive the read that makes it stale.**
   * `setReports` only ever adds and `refresh()` never cleared it, so the count
   * a merchant read after replaying one integration stayed under that
   * Destination for the rest of the session — including after later refreshes
   * had moved the health sitting beside it (#78, ADR 0039).
   */
  it('drops a re-push report on the next read', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    api.rePush.mockResolvedValue({ jobs: 4, capped: false, since: '2026-08-22 10:00:00' });
    api.saveDestination.mockResolvedValue(undefined);

    render(<Destinations />);

    const wsms = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));

    await userEvent.click(within(wsms).getByRole('button', { name: /Re-push leads/ }));

    expect(await within(wsms).findByText(/4 Leads queued for re-pushing/)).toBeInTheDocument();

    // Saving anything at all re-reads the payload, and the report is a fact
    // about the moment before that read.
    await userEvent.click(
      within(regionFor(screen.getByRole('heading', { name: 'Lead magnet email' })))
        .getByRole('button', { name: 'Save' }),
    );

    await waitFor(() => {
      expect(screen.queryByText(/queued for re-pushing/)).not.toBeInTheDocument();
    });
  });
});
