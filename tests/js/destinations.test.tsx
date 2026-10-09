import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { destinationHref, leadsHref } from '../../resources/admin/src/nav';

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
  testConnection: vi.fn(),
  testSend: vi.fn(),
  readSelectedSchema: vi.fn(async () => ({ settings_schema: {} })),
  readRecentAttempts: vi.fn(),
  checkConnection: vi.fn(),
  deleteConnection: vi.fn(),
  saveConnection: vi.fn(),
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

const MAILPOET_READY = {
  id: 'mailpoet',
  label: 'MailPoet',
  icon: 'mail-plus',
  tier: 'free' as const,
  requires: 'mailpoet',
  requires_label: 'MailPoet',
  availability: 'ready' as const,
  needs_connection: false,
  settings_schema: {
    lists: {
      type: 'ids',
      label: 'Lists to add to',
      description: 'Added, never removed.',
      options: [
        { value: '3', label: 'Newsletter' },
        { value: '4', label: 'Offers' },
      ],
    },
  },
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
  // Resolved on the server, per Destination. WSMS's tags are the merchant's
  // own strings, so they come back as themselves.
  target: 'tag-7',
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

const MAILPOET_BOUND = {
  ...HEALTHY,
  id: '01J0000000DDDDDDDDDDDDDDDD',
  type: 'mailpoet',
  label: 'MailPoet',
  settings: { lists: ['3'] },
  target: 'Newsletter',
};

const LEAD_MAGNET_BOUND = {
  ...HEALTHY,
  id: '01J0000000CCCCCCCCCCCCCCCC',
  type: 'lead_magnet_email',
  label: 'Lead magnet email',
  // **Null, and not empty.** Its URL, subject and body are configuration
  // rather than a target: this type selects nothing, and is perfectly
  // configured.
  target: null,
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

/**
 * A card's settings are the one collapsible (§21), a `<summary>` rather than
 * a button, so they are found by their title.
 */
const settingsToggle = (scope: HTMLElement): HTMLElement =>
  within(scope).getByText('Settings', { selector: '.wconvert-disclosure__title' }).closest('summary')!;

const openAllSettings = async () => {
  for (const title of await screen.findAllByText('Settings', { selector: '.wconvert-disclosure__title' })) {
    await userEvent.click(title.closest('summary')!);
  }
};

/** Opens a card's ⋯ and picks one of its actions. */
const choose = async (route: string, item: string | RegExp, scope: HTMLElement = document.body) => {
  await userEvent.click(await within(scope).findByRole('button', { name: `Actions for ${route}` }));
  await userEvent.click(await screen.findByRole('menuitem', { name: item }));
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

  it('shows when a destination last sent successfully, in the site’s words', async () => {
    render(<Destinations />);

    // Through lib/format, never the stored MySQL string.
    expect(await screen.findByText(/^Last sent Aug 25/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-08-25 10:00:00/)).toBeNull();
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
    // Recovery stays on the card for a failing route, not only behind ⋯.
    expect(screen.getByRole('button', { name: 'Send again' })).toBeVisible();
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

    render(<Destinations mode="issues" />);

    expect(await screen.findByText('That address does not exist.')).toBeInTheDocument();
    // Health is still clean, and says so, beside a Lead that will never land.
    expect(screen.getByText(/Last sent/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'WP SMS contacts' })).toHaveAttribute('href', destinationHref(HEALTHY.id));
    expect(screen.getByRole('link', { name: 'View submission' })).toHaveAttribute('href', leadsHref({ leadId: '01J0000000BBBBBBBBBBBBBBBB' }));
    // No ID on screen (ADR 0131), and no raw timestamp.
    expect(screen.queryByText(/01J0000000BBBBBBBBBBBBBBBB/)).toBeNull();
    expect(screen.queryByText('2026-08-25 11:00:00')).toBeNull();
  });

  it('explains an unavailable type rather than offering to sell it', async () => {
    // A paid install meeting a higher rung's type (ADR 0116).
    window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
    onTestFinished(() => { delete window.wconvertAdmin; });
    api.readDestinations.mockResolvedValue({
      types: [{ ...WSMS_READY, availability: 'unavailable' as const }, MAILCHIMP_LOCKED],
      destinations: [],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    // The LABEL, never the slug: "Needs wsms on this site" is copy no
    // merchant can act on and no translator can repair from their end.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a destination' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Add a destination' }));
    expect(await screen.findByText('Needs WP SMS on this site.')).toBeInTheDocument();

    // And the two absent states stay apart. Collapsing them is what shows a
    // paying customer an advertisement for Pro, and offers a merchant a WP SMS
    // licence we do not sell (ADR 0026).
    //
    // The product is named by the tier manifest rather than by a literal —
    // this was the last hardcoded "Pro" on the screen, and `tiers.json` is
    // what makes a second rung a manifest edit (ADR 0056). With no localised
    // settings object here it falls back to the word the product has always
    // used, which is `tierProductName`'s documented last resort.
    expect(screen.getByText('Included with WConvert Pro.')).toBeInTheDocument();
    expect(screen.queryByText(/Needs null/)).not.toBeInTheDocument();
  });

  /** A free install lists only what it can set up, and explains the rest (ADR 0116). */
  it('lists no type a free install would have to buy', async () => {
    api.readDestinations.mockResolvedValue({
      types: [{ ...WSMS_READY, availability: 'unavailable' as const }, MAILCHIMP_LOCKED],
      destinations: [],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a destination' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Add a destination' }));
    expect(await screen.findByText('Needs WP SMS on this site.')).toBeInTheDocument();
    expect(screen.queryByText('Mailchimp')).not.toBeInTheDocument();
    expect(screen.queryByText(/Included with/)).not.toBeInTheDocument();
  });

  /** A route saved under Pro keeps its card on free, and sells nothing (ADR 0116). */
  it('names no product on a saved route whose type a free install lacks', async () => {
    api.readDestinations.mockResolvedValue({
      types: [MAILCHIMP_LOCKED],
      destinations: [{ ...HEALTHY, type: 'mailchimp', label: 'Mailchimp audience', availability: 'locked' as const }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByText('This destination type isn’t available on this site, so submissions are kept in WConvert and not sent.')).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.queryByText(/WConvert Pro/)).not.toBeInTheDocument();
  });

  /**
   * **One badge vocabulary for Settings and the Campaign editor.** A route
   * whose required setting is empty cannot send, and saying "Not used yet"
   * about it reads as healthy-but-idle.
   */
  it('marks a route with an empty required setting as needing setup', async () => {
    api.readDestinations.mockResolvedValue({
      types: [{ ...MAILPOET_READY, requirements: { capture_any_of: ['email'], settings: { lists: { label: 'Lists to add to', type: 'ids' } }, fields: ['email'], mapped_fields: {} } }],
      destinations: [{ ...MAILPOET_BOUND, settings: { lists: [] }, target: '', health: { ...HEALTHY.health, last_success_at: null } }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByText('Needs setup')).toBeInTheDocument();
    expect(screen.queryByText('Not used yet')).not.toBeInTheDocument();

    // The issue carries its fix: the settings open at the field that is missing.
    expect(screen.getByText('Choose “Lists to add to” before this destination can send.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Newsletter' })).toHaveFocus());
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

    expect(await screen.findByText(/12 submissions weren’t sent/)).toBeInTheDocument();
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
    await openAllSettings();

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
    await openAllSettings();

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
    await openAllSettings();

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
    await openAllSettings();

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
   * **The same `ids` kind, drawn as names, and stored as exactly the same
   * list.**
   *
   * MailPoet's list ids are integers a merchant would have to read off a URL,
   * so its `settingsSchema()` enumerates the options and this draws them as
   * checkboxes (#87). The stored shape does not change — that is the whole
   * design: `options` answers whether the server could name the choices, and
   * `type` still answers what shape the value is, so `toDraft`/`fromDraft`
   * stay one code path.
   */
  it('draws an ids field with options as named checkboxes and stores the same list', async () => {
    api.readDestinations.mockResolvedValue({
      types: [MAILPOET_READY],
      destinations: [MAILPOET_BOUND],
      connections: [],
      failures: [],
    });

    render(<Destinations />);
    await openAllSettings();

    // By NAME. A merchant never sees `3` or `4`.
    const newsletter = await screen.findByLabelText('Newsletter');
    const offers = screen.getByLabelText('Offers');

    expect(newsletter).toBeChecked();
    expect(offers).not.toBeChecked();

    await userEvent.click(offers);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.saveDestination).toHaveBeenCalledWith(
        // In the order the SERVER offered, not in click order — so saving the
        // same set twice produces the same value.
        expect.objectContaining({ settings: { lists: ['3', '4'] } })
      );
    });
  });

  /**
   * **A configured list the server did not offer survives a save.**
   *
   * A merchant binned a MailPoet list, or deleted one outright: its id is
   * still in `settings` and there is no checkbox for it. Rebuilding the value
   * from the options alone would delete it the first time anybody ticked any
   * box — silently, on a screen whose subject is health.
   *
   * It is the same posture `fromDraft` already takes for a stored KEY the type
   * no longer declares, one level up, and for the same reason: a settings bag
   * is opaque, and the screen that cannot draw something must not be the
   * screen that destroys it.
   */
  it('keeps a stored list id that is not among the offered options', async () => {
    api.readDestinations.mockResolvedValue({
      types: [MAILPOET_READY],
      // `9` was a list once. Nothing on screen can represent it.
      destinations: [{ ...MAILPOET_BOUND, settings: { lists: ['9', '3'] } }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);
    await openAllSettings();

    await userEvent.click(await screen.findByLabelText('Offers'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.saveDestination).toHaveBeenCalledWith(
        expect.objectContaining({ settings: { lists: ['9', '3', '4'] } })
      );
    });
  });

  /**
   * The same field on a site whose provider could not be reached: no options,
   * so it lands back on the text input the `ids` kind has always had.
   *
   * A degraded control is editable; an absent one is a setting nobody can
   * reach, and this is the path a merchant hits while MailPoet is deactivated.
   */
  it('falls back to the text input when a list field carries no options', async () => {
    api.readDestinations.mockResolvedValue({
      types: [
        {
          ...MAILPOET_READY,
          settings_schema: { lists: { type: 'ids', label: 'Lists to add to' } },
        },
      ],
      destinations: [MAILPOET_BOUND],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByLabelText(/Lists to add to/)).toHaveValue('3');
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
    await openAllSettings();

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
  it('says out loud when sending again hit its per-run limit', async () => {
    api.rePush.mockResolvedValue({ jobs: 10000, capped: true, since: '2026-08-22 10:00:00' });

    render(<Destinations />);

    await choose('WP SMS contacts', 'Send stored submissions again');
    await userEvent.click(screen.getByRole('button', { name: 'Send again' }));

    await waitFor(() => {
      expect(screen.getByText(/limit for one run/)).toBeInTheDocument();
    });
    expect(screen.getByText(/10,000 submissions queued/)).toBeInTheDocument();

    expect(api.rePush).toHaveBeenCalledWith(HEALTHY.id);
  });

  /**
   * **Busy is per row.** One screen-wide boolean was handed to every region
   * and to the types list, so a merchant saving the tags on one integration
   * watched Save, Send again, Remove and every Add button on the screen go dead
   * for the length of that one request — with nothing saying why, because the
   * request was four regions away (#78, ADR 0039).
   */
  it('disables only the destination that is saving', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    // A save that never settles, so the busy window stays open to look at.
    api.saveDestination.mockReturnValue(new Promise(() => {}));

    render(<Destinations />);
    await openAllSettings();

    const wsms = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    const magnet = regionFor(screen.getByRole('heading', { name: 'Lead magnet email' }));

    await userEvent.click(within(wsms).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(wsms).getByRole('button', { name: 'Saving…' })).toBeDisabled();
    });
    expect(within(wsms).getByRole('button', { name: 'Actions for WP SMS contacts' })).toBeDisabled();

    // The other Destination is untouched — its Save and its ⋯ still work.
    expect(within(magnet).getByRole('button', { name: 'Save' })).not.toBeDisabled();
    expect(within(magnet).getByRole('button', { name: 'Actions for Lead magnet email' })).not.toBeDisabled();
  });

  it('keeps navigation and the first route busy when a second route finishes first', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    let finishFirst!: () => void;
    api.saveDestination.mockImplementation(({ id }: { id: string }) => id === HEALTHY.id
      ? new Promise<void>((resolve) => { finishFirst = resolve; }) : Promise.resolve());
    const editing = vi.fn();
    render(<Destinations onEditingStateChange={editing} />);
    await openAllSettings();
    const first = within(regionFor(screen.getByRole('heading', { name: 'WP SMS contacts' })));
    const second = within(regionFor(screen.getByRole('heading', { name: 'Lead magnet email' })));
    await userEvent.click(first.getByRole('button', { name: 'Save' }));
    await userEvent.click(second.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(second.getByRole('button', { name: 'Save' })).toBeEnabled());
    expect(first.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    // Said beside the Save that did it, and only there.
    expect(second.getByText('Saved just now')).toBeInTheDocument();
    expect(first.queryByText('Saved just now')).toBeNull();
    expect(editing).toHaveBeenLastCalledWith(expect.objectContaining({ busy: true }));
    await act(async () => finishFirst());
    await waitFor(() => expect(editing).toHaveBeenLastCalledWith(expect.objectContaining({ busy: false })));
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
    await openAllSettings();

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
   * **A send-again report does not outlive the read that makes it stale.**
   * `setReports` only ever adds and `refresh()` never cleared it, so the count
   * a merchant read after replaying one integration stayed under that
   * Destination for the rest of the session — including after later refreshes
   * had moved the health sitting beside it (#78, ADR 0039).
   */
  it('drops a send-again report on the next read', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    api.rePush.mockResolvedValue({ jobs: 4, capped: false, since: '2026-08-22 10:00:00' });
    api.saveDestination.mockResolvedValue(undefined);

    render(<Destinations />);
    await openAllSettings();

    const wsms = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));

    await choose('WP SMS contacts', 'Send stored submissions again', wsms);
    await userEvent.click(screen.getByRole('button', { name: 'Send again' }));

    expect(await within(wsms).findByText(/4 submissions queued to send again/)).toBeInTheDocument();

    // Saving anything at all re-reads the payload, and the report is a fact
    // about the moment before that read.
    await userEvent.click(
      within(regionFor(screen.getByRole('heading', { name: 'Lead magnet email' })))
        .getByRole('button', { name: 'Save' }),
    );

    await waitFor(() => {
      expect(screen.queryByText(/queued to send again/)).not.toBeInTheDocument();
    });
  });
});

/**
 * ============================================================================
 * A DESTINATION IS A NAMED ROUTE, AND THE SCREEN USED TO HIDE THAT.
 * ============================================================================
 * `CONTEXT.md` has always said a Destination is configured once, site-wide,
 * and *includes whatever selects the target inside the remote system* — so
 * *"newsletter signups go to the Newsletter list, product announcements go to
 * Product updates"* is **two MailPoet Destinations** bound to different
 * [[Optin]]s. The PHP assumed it throughout; the admin forbade it three ways
 * over, and this describes the three.
 *
 * 1. *Add* went dead once one Destination of the type existed.
 * 2. Every route was named after its TYPE, and nothing could rename it — so
 *    two MailPoet routes would both read "MailPoet".
 * 3. Nothing anywhere said what a route was pointed at.
 */
describe('a destination is a named route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    api.readDestinations.mockResolvedValue({
      types: [MAILPOET_READY],
      destinations: [MAILPOET_BOUND],
      connections: [],
      failures: [],
    });
  });

  /**
   * **The defect that made the other two matter.** A merchant with one MailPoet
   * route could not create the second, which is the exact move the model
   * requires — and `DestinationController::targetOf()`'s own comment says two
   * Mailchimp audiences are two Destinations over one Connection, so the PHP
   * already assumed what the button prevented.
   */
  it('offers Add even where a destination of that type is already configured', async () => {
    render(<Destinations />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a destination' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Add a destination' }));

    expect(await screen.findByRole('button', { name: 'MailPoet' })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('dialog', { name: 'Add a destination' })).toBeVisible();
    expect(api.saveDestination).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add a destination' })).toHaveFocus();
  });

  /**
   * **Named and pointed in one step, before it exists.** *Add* used to post
   * `label: type.label` and an empty settings bag, so a merchant got a second
   * Destination called "MailPoet" pointed at nothing and then had to find the
   * form under it.
   */
  it('names and points a new route in one step', async () => {
    render(<Destinations />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a destination' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Add a destination' }));

    await userEvent.click(await screen.findByRole('button', { name: 'MailPoet' }));

    const dialog = await screen.findByRole('dialog');

    // The name is pre-filled from the type and FOLLOWS the target while the
    // merchant has not typed one of their own.
    expect(within(dialog).getByLabelText('Name')).toHaveValue('MailPoet');
    expect(within(dialog).getByLabelText('Name')).toHaveFocus();
    expect(api.saveDestination).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByLabelText('Offers'));

    expect(within(dialog).getByLabelText('Name')).toHaveValue('MailPoet — Offers');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add destination' }));

    await waitFor(() => {
      expect(api.saveDestination).toHaveBeenCalledWith({
        type: 'mailpoet',
        label: 'MailPoet — Offers',
        connection: null,
        settings: { lists: ['4'] },
      });
    });
  });

  /**
   * **Pre-filled and editable, never derived.** Merchants name routes after
   * their own intent — *"Black Friday signups"* — which no derivation could
   * guess, and a name the merchant cannot change is defect 2 written a second
   * time.
   */
  it('keeps a name the merchant typed when the target changes under it', async () => {
    render(<Destinations />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a destination' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Add a destination' }));

    await userEvent.click(await screen.findByRole('button', { name: 'MailPoet' }));

    const dialog = await screen.findByRole('dialog');

    await userEvent.clear(within(dialog).getByLabelText('Name'));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Black Friday signups');
    await userEvent.click(within(dialog).getByLabelText('Newsletter'));

    expect(within(dialog).getByLabelText('Name')).toHaveValue('Black Friday signups');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add destination' }));

    await waitFor(() => {
      expect(api.saveDestination).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Black Friday signups' }),
      );
    });
  });

  /**
   * **The dialog survives a failed save**, because the merchant's typed name
   * is in it — dropping it on a 500 would make them retype to find out whether
   * the second attempt fails too.
   */
  it('stays open and says why when the save fails', async () => {
    api.saveDestination.mockRejectedValue(new Error('MailPoet is not answering.'));

    render(<Destinations />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a destination' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Add a destination' }));

    await userEvent.click(await screen.findByRole('button', { name: 'MailPoet' }));

    const dialog = await screen.findByRole('dialog');

    await userEvent.clear(within(dialog).getByLabelText('Name'));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Black Friday signups');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add destination' }));

    expect(await within(dialog).findByText('MailPoet is not answering.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Black Friday signups');
  });

  /**
   * **Renaming round-trips, and it needed no storage work**: `label` was
   * already accepted by the route and `Destination::$label` already went
   * through `toArray()` and the option. What did not exist was a control that
   * sent one.
   *
   * The binding survives because an Optin holds ULIDs and nothing else.
   */
  it('renames a configured route', async () => {
    render(<Destinations />);
    await openAllSettings();

    const name = await screen.findByLabelText('Name');

    expect(name).toHaveValue('MailPoet');

    await userEvent.clear(name);
    await userEvent.type(name, 'Newsletter signups');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.saveDestination).toHaveBeenCalledWith(
        expect.objectContaining({ id: MAILPOET_BOUND.id, label: 'Newsletter signups' }),
      );
    });
  });

  /**
   * **A route with no schema is still renameable.** The settings body used to
   * be gated on the schema having fields — right while there was nothing to
   * save but the fields, and wrong the moment the NAME became one of them. A
   * webhook declaring no settings is a route like any other.
   */
  it('offers a name and a Save on a type that declares no fields at all', async () => {
    api.readDestinations.mockResolvedValue({
      types: [{ ...MAILPOET_READY, settings_schema: {} }],
      destinations: [{ ...MAILPOET_BOUND, target: null }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);
    await openAllSettings();

    expect(await screen.findByLabelText('Name')).toHaveValue('MailPoet');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  /** Where the leads land, first, on the card that configures the route. */
  it('says where a configured route lands', async () => {
    render(<Destinations />);

    expect(await screen.findByText('Sending to Newsletter.')).toBeInTheDocument();
  });

  /**
   * **The three states are not one.** A type that selects nothing — the
   * lead-magnet email — is perfectly configured, and a line saying it is not
   * pointed anywhere reports a fault against an integration that delivers.
   */
  it('says nothing about a destination whose type selects nothing', async () => {
    api.readDestinations.mockResolvedValue({
      types: [LEAD_MAGNET],
      destinations: [LEAD_MAGNET_BOUND],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    await screen.findByRole('heading', { name: 'Lead magnet email' });

    expect(screen.queryByText(/Sending to/)).toBeNull();
    expect(screen.queryByText(/Not pointed/)).toBeNull();
  });

  it('says so where a route selects something and nothing is chosen', async () => {
    api.readDestinations.mockResolvedValue({
      types: [MAILPOET_READY],
      destinations: [{ ...MAILPOET_BOUND, settings: { lists: [] }, target: '' }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByText('Not pointed at anything yet.')).toBeInTheDocument();
  });
});

/**
 * ============================================================================
 * THE SCREEN DOES NOT SAY THE SAME THING TWICE.
 * ============================================================================
 * ADR 0039's density rule, and the second half of it: a screen that repeats
 * itself teaches the merchant to stop reading it.
 */
describe('what a never-used destination says', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    api.readDestinations.mockResolvedValue({
      types: [WSMS_READY],
      destinations: [HEALTHY],
      connections: [],
      failures: [],
    });
  });

  it('shows the badge and not the sentence that repeats it', async () => {
    api.readDestinations.mockResolvedValue({
      types: [WSMS_READY],
      destinations: [{ ...HEALTHY, health: { ...HEALTHY.health, last_success_at: null } }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByText('Not used yet')).toBeInTheDocument();
    expect(screen.queryByText('Nothing has been pushed here yet.')).toBeNull();
  });

  /** And the one that says something the badge does not still shows. */
  it('still shows the last successful send where there has been one', async () => {
    render(<Destinations />);

    expect(await screen.findByText(/^Last sent Aug 25/)).toBeInTheDocument();
  });
});

/**
 * ============================================================================
 * TESTING A DESTINATION FROM THE SCREEN.
 * ============================================================================
 * Two verbs, three outcomes, and one rendering rule that is a decision rather
 * than styling: a Destination whose type this install cannot run has **not
 * failed**. Drawing that in red tells a merchant with no WP SMS that their WP
 * SMS Destination is broken when the plugin is simply not installed — the same
 * collapse ADR 0026 refuses one layer up.
 */
describe('testing a destination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.testSend.mockReset();
    api.readDestinations.mockResolvedValue({
      types: [WSMS_READY],
      destinations: [HEALTHY],
      connections: [],
      failures: [],
      test_sample: { email: 'merchant@example.com', fields: ['email'] },
    });
  });

  /**
   * **Neither verb is offered where it means nothing, and neither is pressed
   * to learn it is refused** (ADR 0042, §14). A type with no credentials has
   * no Test connection at all; a route this install cannot run keeps both in
   * ⋯, refused, with the reason under each.
   */
  it('offers only Send a test where the type has no credentials', async () => {
    render(<Destinations />);

    await userEvent.click(await screen.findByRole('button', { name: 'Actions for WP SMS contacts' }));
    expect(screen.getByRole('menuitem', { name: 'Send a test' })).toBeInTheDocument();

    // Every free type is in this state. An item whose only possible answer is
    // "nothing to check" teaches the merchant that the screen is guessing.
    expect(screen.queryByRole('menuitem', { name: /Test connection/ })).toBeNull();
  });

  it('offers both verbs where there are credentials to check', async () => {
    api.readDestinations.mockResolvedValue({
      types: [{ ...WSMS_READY, needs_connection: true }],
      destinations: [{ ...HEALTHY, connection: 'account-1' }],
      connections: [{ id: 'account-1', type: 'wsms', label: 'Main', credentials: {} }],
      failures: [],
    });

    render(<Destinations />);

    await userEvent.click(await screen.findByRole('button', { name: 'Actions for WP SMS contacts' }));
    expect(screen.getByRole('menuitem', { name: 'Test connection' })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('menuitem', { name: 'Send a test' })).not.toHaveAttribute('aria-disabled');
  });

  it('refuses both on a Destination this install cannot run, and says why', async () => {
    api.readDestinations.mockResolvedValue({
      types: [{ ...WSMS_READY, availability: 'unavailable' as const, needs_connection: true }],
      destinations: [{ ...HEALTHY, availability: 'unavailable' as const }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    await userEvent.click(await screen.findByRole('button', { name: 'Actions for WP SMS contacts' }));
    const send = screen.getByRole('menuitem', { name: /Send a test/ });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    expect(send).toHaveAccessibleDescription('Not running on this site.');
    expect(screen.getByRole('menuitem', { name: /Test connection/ })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(send);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuses Send a test until setup is finished, as the campaign editor does', async () => {
    api.readDestinations.mockResolvedValue({
      types: [{ ...MAILPOET_READY, requirements: { capture_any_of: ['email'], settings: { lists: { label: 'Lists to add to', type: 'ids' } }, fields: ['email'], mapped_fields: {} } }],
      destinations: [{ ...MAILPOET_BOUND, settings: { lists: [] }, target: '' }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    await userEvent.click(await screen.findByRole('button', { name: 'Actions for MailPoet' }));
    expect(screen.getByRole('menuitem', { name: /Send a test/ })).toHaveAccessibleDescription('Finish setup first.');
  });

  it('shows what the test answered, in the provider’s own words', async () => {
    api.testSend.mockResolvedValue({
      outcome: 'failed',
      message: "Sarah's key & the <audience> it opens were refused",
    });

    render(<Destinations />);

    await choose('WP SMS contacts', 'Send a test');
    const dialog = within(screen.getByRole('dialog'));
    expect(api.testSend).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole('button', { name: 'Send test' }));

    expect(
      await dialog.findByText("Sarah's key & the <audience> it opens were refused")
    ).toBeInTheDocument();
  });

  /**
   * **The screen is not re-read after a test**, and that is the point rather
   * than an optimisation: a test records nothing, so there is nothing new to
   * read — and the read would clear the one thing the merchant pressed the
   * button for.
   */
  it('does not re-read the screen after a test', async () => {
    api.testSend.mockResolvedValue({ outcome: 'success', message: 'The test reached WP SMS contacts.' });

    render(<Destinations />);

    await screen.findByRole('button', { name: 'Actions for WP SMS contacts' });

    const readsBefore = api.readDestinations.mock.calls.length;

    await choose('WP SMS contacts', 'Send a test');
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Send test' }));
    await dialog.findByText('The test reached WP SMS contacts.');

    expect(api.readDestinations).toHaveBeenCalledTimes(readsBefore);
  });

  it('renders a type this install cannot run as a note, never as a failure', async () => {
    api.testSend.mockResolvedValue({
      outcome: 'skipped',
      message: 'This Destination’s type is not available on this site.',
    });

    render(<Destinations />);

    await choose('WP SMS contacts', 'Send a test');
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Send test' }));

    const note = await dialog.findByText('This Destination’s type is not available on this site.');

    // The destructive palette is what the screen reserves for a real failure.
    expect(note.closest('[class*="destructive"]')).toBeNull();
  });
  it('keeps health visible while settings are closed and preserves edits on reopening', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    render(<Destinations />);
    const region = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    const settings = settingsToggle(region);
    expect(settings.closest('details')).not.toHaveAttribute('open');
    expect(within(region).queryByRole('button', { name: 'Send again' })).toBeNull();
    expect(within(region).getByRole('textbox', { name: 'Name' })).not.toBeVisible();
    expect(within(region).getByText(/Last sent/)).toBeVisible();
    await userEvent.click(settings);
    const name = within(region).getByRole('textbox', { name: 'Name' });
    expect(name).toBeVisible();
    await userEvent.clear(name);
    await userEvent.type(name, 'Newsletter signups');
    await userEvent.click(settings);
    await userEvent.click(settings);
    expect(within(region).getByRole('textbox', { name: 'Name' })).toHaveValue('Newsletter signups');
    await userEvent.click(within(region).getByRole('button', { name: 'Cancel' }));
    expect(settings).toHaveFocus();
    expect(settings.closest('details')).not.toHaveAttribute('open');
    await userEvent.click(settings);
    expect(within(region).getByRole('textbox', { name: 'Name' })).toHaveValue('WP SMS contacts');
    expect(api.saveDestination).not.toHaveBeenCalled();
  });

  it('shows the suggested address and saved route before sending, and allows cancellation', async () => {
    render(<Destinations />);
    const trigger = await screen.findByRole('button', { name: 'Actions for WP SMS contacts' });
    await choose('WP SMS contacts', 'Send a test');
    const dialog = within(screen.getByRole('dialog'));
    // The subject is the title; what it is and where it lands is the meta line.
    expect(dialog.getByRole('heading', { name: 'WP SMS contacts' })).toBeVisible();
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('WP SMS contacts · tag-7');
    expect(dialog.getByRole('textbox', { name: 'Test email address' })).toHaveValue('merchant@example.com');
    expect(dialog.getByRole('button', { name: 'Send test' })).toHaveAccessibleDescription(/Only this email address.*create or update a contact.*does not confirm subscription or inbox delivery/);
    expect(api.testSend).not.toHaveBeenCalled();
    expect(api.testConnection).not.toHaveBeenCalled();
    expect(api.rePush).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(api.testSend).not.toHaveBeenCalled();
  });

  it('asks before Escape throws a typed address away', async () => {
    render(<Destinations />);
    await choose('WP SMS contacts', 'Send a test');
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.type(dialog.getByRole('textbox', { name: 'Test email address' }), 'x');
    await userEvent.keyboard('{Escape}');
    expect(dialog.getByText('Discard changes?')).toBeVisible();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sends only the explicitly confirmed sample and requires another preparation before a repeat', async () => {
    api.testSend.mockResolvedValue({ outcome: 'success', message: 'The provider accepted this sample.' });
    render(<Destinations />);
    await choose('WP SMS contacts', 'Send a test');
    const dialog = within(screen.getByRole('dialog'));
    const address = dialog.getByRole('textbox', { name: 'Test email address' });
    await userEvent.clear(address);
    await userEvent.type(address, 'seed@example.com');
    await userEvent.click(dialog.getByRole('button', { name: 'Send test' }));
    expect(await dialog.findByText('The provider accepted this sample.')).toBeVisible();
    expect(api.testSend).toHaveBeenCalledExactlyOnceWith(HEALTHY.id, 'seed@example.com');
    expect(dialog.queryByRole('button', { name: 'Send test' })).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: 'Send another' }));
    expect(api.testSend).toHaveBeenCalledOnce();
    expect(address).toBeEnabled();
    expect(address).toHaveFocus();
  });

  it('does not silently send a blank sample when profile metadata is absent', async () => {
    api.readDestinations.mockResolvedValue({ ...TWO_DESTINATIONS, destinations: [HEALTHY] });
    render(<Destinations />);
    await choose('WP SMS contacts', 'Send a test');
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('textbox', { name: 'Test email address' })).toHaveValue('');
    await userEvent.click(dialog.getByRole('button', { name: 'Send test' }));
    expect(api.testSend).not.toHaveBeenCalled();
  });

  it('preserves the sample on transport failure and explains that unsaved settings are excluded', async () => {
    api.testSend.mockRejectedValueOnce({ message: 'The request failed. Try again.' });
    render(<Destinations />);
    const region = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    await userEvent.click(settingsToggle(region));
    await userEvent.type(within(region).getByRole('textbox', { name: 'Tags to add' }), ', another-tag');
    await choose('WP SMS contacts', 'Send a test', region);
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/Uses the saved settings/)).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Send test' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('The request failed. Try again.');
    expect(dialog.getByRole('textbox', { name: 'Test email address' })).toHaveValue('merchant@example.com');
    expect(api.testSend).toHaveBeenCalledOnce();
    expect(api.saveDestination).not.toHaveBeenCalled();
  });

  it('keeps a pending test open and prevents a duplicate send', async () => {
    let finish!: (report: { outcome: string; message: string }) => void;
    api.testSend.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<Destinations />);
    await choose('WP SMS contacts', 'Send a test');
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Send test' }));
    const sending = dialog.getByRole('button', { name: 'Sending test…' });
    expect(sending).toBeDisabled();
    expect(dialog.getByRole('textbox', { name: 'Test email address' })).toBeDisabled();
    await userEvent.click(sending);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(api.testSend).toHaveBeenCalledOnce();
    await act(async () => finish({ outcome: 'success', message: 'Accepted.' }));
    expect(dialog.getByRole('button', { name: 'Done' })).toBeEnabled();
  });

  it('does not erase a failed settings save when a test of the saved route succeeds', async () => {
    api.saveDestination.mockRejectedValueOnce({ message: 'Your settings were not saved.' });
    api.testSend.mockResolvedValue({ outcome: 'success', message: 'The saved route accepted the sample.' });
    render(<Destinations />);
    const card = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    const region = within(card);
    await userEvent.click(settingsToggle(card));
    await userEvent.type(region.getByRole('textbox', { name: 'Name' }), ' edited');
    await userEvent.click(region.getByRole('button', { name: 'Save' }));
    expect(await region.findByText('Your settings were not saved.')).toBeVisible();
    expect(region.queryByText('Saved just now')).toBeNull();
    await choose('WP SMS contacts', 'Send a test', card);
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Send test' }));
    await userEvent.click(await dialog.findByRole('button', { name: 'Done' }));
    expect(region.getByText('Your settings were not saved.')).toBeVisible();
    expect(region.getByRole('textbox', { name: 'Name' })).toHaveValue('WP SMS contacts edited');
  });

});

describe('destination recovery entry points', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('offers recovery beside skipped submissions with Settings still closed', async () => {
    api.readDestinations.mockResolvedValue({ ...TWO_DESTINATIONS, destinations: [{
      ...HEALTHY, health: { ...HEALTHY.health, skipped_captures: 12, last_skipped_at: '2026-08-25 12:00:00' },
    }] });
    api.rePush.mockResolvedValue({ jobs: 12, capped: false, since: HEALTHY.health.last_success_at });
    render(<Destinations />);
    const region = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    expect(settingsToggle(region).closest('details')).not.toHaveAttribute('open');
    const replay = within(region).getByRole('button', { name: 'Send again' });
    expect(replay).toHaveAccessibleDescription(/since its last success/);
    expect(api.rePush).not.toHaveBeenCalled();
    await userEvent.click(replay);
    expect(api.rePush).not.toHaveBeenCalled();
    const confirm = await screen.findByRole('alertdialog', { name: 'Send stored submissions again?' });
    expect(confirm).toHaveTextContent(/since its last success on Aug 25, 2026.*published version/);
    // Sending again is not destructive, so it is not red (ADR 0131).
    expect(within(confirm).getByRole('button', { name: 'Send again' })).not.toHaveAttribute('data-variant', 'destructive');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Send again' }));
    expect(api.rePush).toHaveBeenCalledExactlyOnceWith(HEALTHY.id);
    expect(await within(region).findByText(/12 submissions queued/)).toBeVisible();
  });

  it('refuses Send again beside skipped submissions while the route cannot run, and says why', async () => {
    api.readDestinations.mockResolvedValue({ ...TWO_DESTINATIONS, types: [{ ...WSMS_READY, availability: 'unavailable' as const }], destinations: [{
      ...HEALTHY, availability: 'unavailable' as const, health: { ...HEALTHY.health, skipped_captures: 3, last_skipped_at: '2026-08-25 12:00:00' },
    }] });
    render(<Destinations />);
    const region = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    const replay = within(region).getByRole('button', { name: 'Send again' });
    expect(replay).toHaveAttribute('aria-disabled', 'true');
    expect(replay).toHaveAccessibleDescription(/Not running on this site\./);
    await userEvent.click(replay);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('opens and focuses the destination named by a failure link', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    render(<Destinations destinationId={LEAD_MAGNET_BOUND.id} />);
    const heading = await screen.findByRole('heading', { name: 'Lead magnet email' });
    // Finding the rendered heading can precede the effect that moves focus.
    await waitFor(() => expect(heading).toHaveFocus());
    const region = regionFor(heading);
    await waitFor(() => expect(settingsToggle(region).closest('details')).toHaveAttribute('open'));
    expect(within(region).getByRole('textbox', { name: 'Link to the file' })).toHaveValue('https://example.com/guide.pdf');
    expect(api.rePush).not.toHaveBeenCalled();
    expect(api.testSend).not.toHaveBeenCalled();
  });

  it('labels a removed route honestly, with no ID, while keeping the exact submission link', async () => {
    api.readDestinations.mockResolvedValue({ ...TWO_DESTINATIONS, failures: [{
      destination: 'removed-route', lead: '01J0000000BBBBBBBBBBBBBBBB', at: '2026-08-25 12:00:00', error: 'Rejected.',
    }] });
    render(<Destinations mode="issues" destinationId="removed-route" />);
    expect(await screen.findByText('This destination is no longer available')).toBeVisible();
    expect(screen.getByText('Removed destination')).toBeVisible();
    expect(screen.queryByText('removed-route')).toBeNull();
    expect(screen.getByRole('link', { name: 'View submission' })).toHaveAttribute('href', leadsHref({ leadId: '01J0000000BBBBBBBBBBBBBBBB' }));
    expect(screen.getByRole('link', { name: 'Show all destinations' })).toHaveAttribute('href', destinationHref());
  });

  it('pages a long failure ring rather than drawing all of it', async () => {
    api.readDestinations.mockResolvedValue({ ...TWO_DESTINATIONS, failures: Array.from({ length: 30 }, (_, index) => ({
      destination: HEALTHY.id, lead: `lead-${index}`, at: '2026-08-25 12:00:00', error: `Rejected ${index}.`,
    })) });
    render(<Destinations mode="issues" />);
    expect(await screen.findByText('Rejected 0.')).toBeVisible();
    expect(screen.queryByText('Rejected 25.')).toBeNull();
    expect(screen.getByText('Page 1 of 2')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Rejected 25.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('reads recent sends only when asked, with readable times and words', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    api.readRecentAttempts.mockRejectedValueOnce({ message: 'Recent sends could not be read.' })
      .mockResolvedValueOnce({ attempts: [{ id: 1, lead: 'l', submission: 's', attempt: 2, at: '2026-08-25 12:00:00', status: 'done', outcome: 'retry_scheduled' }] });
    render(<Destinations />);
    const region = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    expect(api.readRecentAttempts).not.toHaveBeenCalled();
    await userEvent.click(within(region).getByText('Recent sends', { selector: '.wconvert-disclosure__title' }).closest('summary')!);
    expect(await within(region).findByText('Recent sends could not be read.')).toBeVisible();
    await userEvent.click(within(region).getByRole('button', { name: 'Try again' }));
    expect(await within(region).findByText('Will retry')).toBeVisible();
    expect(within(region).getByText(/^Aug 25/)).toBeVisible();
    expect(within(region).queryByText(/Attempt/)).toBeNull();
  });

  it('retries an initial read failure without issuing a recovery or test action', async () => {
    api.readDestinations.mockRejectedValueOnce({ message: 'Destinations could not be loaded.' }).mockResolvedValueOnce(TWO_DESTINATIONS);
    render(<Destinations />);
    expect(await screen.findByText('Destinations could not be loaded.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'WP SMS contacts' })).toBeVisible();
    expect(api.rePush).not.toHaveBeenCalled();
    expect(api.testSend).not.toHaveBeenCalled();
    expect(api.testConnection).not.toHaveBeenCalled();
  });
});

describe('connected accounts', () => {
  const REMOTE = { ...MAILPOET_READY, id: 'mailchimp', label: 'Mailchimp', needs_connection: true, connection_schema: { api_key: { type: 'password', label: 'API key' } } };
  const MAIN = { id: 'account-1', type: 'mailchimp', label: 'Main account', credentials: { api_key: true }, checked_at: '2026-08-25 10:00:00', check_outcome: 'success' as const };
  const SECOND = { ...MAIN, id: 'account-2', label: 'Second account' };

  beforeEach(() => {
    vi.clearAllMocks();
    api.readDestinations.mockResolvedValue({
      types: [REMOTE],
      destinations: [{ ...MAILPOET_BOUND, type: 'mailchimp', label: 'Spring list', connection: MAIN.id }],
      connections: [MAIN, SECOND],
      failures: [],
    });
  });

  it('checks one account without freezing the others, and dates the last check readably', async () => {
    api.checkConnection.mockReturnValue(new Promise(() => {}));
    render(<Destinations />);
    const first = (await screen.findByText('Main account', { selector: 'bdi' })).closest('li')!;
    const second = screen.getByText('Second account', { selector: 'bdi' }).closest('li')!;
    expect(within(first).getByText(/^Aug 25/)).toBeVisible();
    expect(screen.queryByText(/2026-08-25 10:00:00/)).toBeNull();
    await userEvent.click(within(first).getByRole('button', { name: 'Check' }));
    expect(within(first).getByRole('button', { name: 'Checking…' })).toBeDisabled();
    expect(within(second).getByRole('button', { name: 'Check' })).toBeEnabled();
    expect(api.checkConnection).toHaveBeenCalledExactlyOnceWith(MAIN.id);
  });

  it('refuses to remove an account a destination still uses, and says why', async () => {
    render(<Destinations />);
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Main account' }));
    const remove = screen.getByRole('menuitem', { name: /Remove/ });
    expect(remove).toHaveAttribute('aria-disabled', 'true');
    expect(remove).toHaveAccessibleDescription(/Used by 1 destination/);
    await userEvent.click(remove);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('removes an unused account behind a confirm that says what survives', async () => {
    api.deleteConnection.mockResolvedValue(undefined);
    render(<Destinations />);
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Second account' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove this account?' });
    expect(confirm).toHaveTextContent('Leads already in WConvert stay.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove account' }));
    await waitFor(() => expect(api.deleteConnection).toHaveBeenCalledExactlyOnceWith(SECOND.id));
  });
});

describe('adding a destination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.readDestinations.mockResolvedValue({ types: [MAILPOET_READY, LEAD_MAGNET], destinations: [], connections: [], failures: [] });
  });

  it('goes Back to the service list from setup instead of dead-ending', async () => {
    render(<Destinations />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a destination' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Add a destination' }));
    await userEvent.click(await screen.findByRole('button', { name: 'MailPoet' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('heading', { name: 'New MailPoet destination' })).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Back' }));
    expect(dialog.getByRole('button', { name: 'Lead magnet email' })).toBeVisible();
    expect(dialog.getByRole('button', { name: 'MailPoet' })).toHaveFocus();
    expect(api.saveDestination).not.toHaveBeenCalled();
  });

  it('asks before Escape throws away a name the merchant typed', async () => {
    render(<Destinations />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a destination' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Add a destination' }));
    await userEvent.click(await screen.findByRole('button', { name: 'MailPoet' }));
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), ' signups');
    await userEvent.keyboard('{Escape}');
    expect(dialog.getByText('Discard changes?')).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Keep editing' }));
    expect(dialog.getByLabelText('Name')).toHaveValue('MailPoet signups');
  });

  it('says what fills an empty screen, in the local mode’s own words', async () => {
    render(<Destinations />);
    expect(await screen.findByText('Leads are kept in WConvert only')).toBeVisible();
    // No account region where nothing on the site needs an account.
    expect(screen.queryByText('Connected accounts')).toBeNull();
  });
});
