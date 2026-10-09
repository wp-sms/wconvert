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
const leadsApi = vi.hoisted(() => ({ readLog: vi.fn() }));
vi.mock('../../resources/admin/src/leads/api', async (original) => ({ ...(await original<typeof import('../../resources/admin/src/leads/api')>()), ...leadsApi }));
const optinsApi = vi.hoisted(() => ({ listOptins: vi.fn() }));
vi.mock('../../resources/admin/src/optins/api', async (original) => ({ ...(await original<typeof import('../../resources/admin/src/optins/api')>()), ...optinsApi }));

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
 * Opens a card's settings — its **Edit** dialog, titled with the route's name
 * — and returns the dialog. They used to fold open under every card.
 */
const edit = async (route: string): Promise<HTMLElement> => {
  const card = regionFor(await screen.findByRole('heading', { name: route }));
  await userEvent.click(within(card).getByRole('button', { name: 'Edit' }));
  return screen.findByRole('dialog', { name: route });
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
    // A verdict first, and a count on the route that rejected it.
    expect(screen.getByText(/1 submission not sent since/)).toBeInTheDocument();
    expect(screen.getByText(/1 not sent/)).toBeInTheDocument();
    // No ID on screen (ADR 0131), and no raw timestamp.
    expect(screen.queryByText(/01J0000000BBBBBBBBBBBBBBBB/)).toBeNull();
    expect(screen.queryByText('2026-08-25 11:00:00')).toBeNull();
    // The submission opens over the list rather than leaving it.
    leadsApi.readLog.mockResolvedValue({ submissions: 1, grouped: false, leads: [{ id: '01J0000000BBBBBBBBBBBBBBBB', optin_id: 'c1', email: 'kenji@example.jp', phone: null, fields: {}, created_at: '2026-08-25 11:00:00', consent: {} }], groups: [], next_cursor: null, snapshot: 's' });
    optinsApi.listOptins.mockResolvedValue([{ id: 'c1', name: 'Grow the list', arms: [] }]);
    await userEvent.click(screen.getByRole('button', { name: 'View submission' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('kenji@example.jp')).toBeInTheDocument();
    expect(leadsApi.readLog).toHaveBeenCalledWith({ leadId: '01J0000000BBBBBBBBBBBBBBBB' });
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
    await edit('WP SMS contacts');

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
    await edit('Lead magnet email');

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
    await edit('Lead magnet email');

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
    await edit('Lead magnet email');

    await userEvent.clear(await screen.findByLabelText(/Subject line/));
    await userEvent.type(screen.getByLabelText(/Subject line/), 'Your guide');
    await userEvent.click(screen.getByRole('button', { name: 'Save destination' }));

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
    await edit('WP SMS contacts');

    const input = await screen.findByLabelText(/Tags to add/);

    expect(input).toHaveValue('tag-7');

    await userEvent.clear(input);
    await userEvent.type(input, 'tag-7, tag-9 ,');
    await userEvent.click(screen.getByRole('button', { name: 'Save destination' }));

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
    await edit('MailPoet');

    // By NAME. A merchant never sees `3` or `4`.
    const newsletter = await screen.findByLabelText('Newsletter');
    const offers = screen.getByLabelText('Offers');

    expect(newsletter).toBeChecked();
    expect(offers).not.toBeChecked();

    await userEvent.click(offers);
    await userEvent.click(screen.getByRole('button', { name: 'Save destination' }));

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
    await edit('MailPoet');

    await userEvent.click(await screen.findByLabelText('Offers'));
    await userEvent.click(screen.getByRole('button', { name: 'Save destination' }));

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
    await edit('MailPoet');

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
    await edit('WP SMS contacts');

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
    await edit('WP SMS contacts');

    await userEvent.click(await screen.findByRole('button', { name: 'Save destination' }));

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

    const wsms = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    const magnet = regionFor(screen.getByRole('heading', { name: 'Lead magnet email' }));
    const dialog = within(await edit('WP SMS contacts'));

    await userEvent.click(dialog.getByRole('button', { name: 'Save destination' }));

    await waitFor(() => {
      expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    });
    // Escape cannot drop a save in flight.
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'WP SMS contacts' })).toBeInTheDocument();
    // The modal hides the page from the accessibility tree, hence `hidden`.
    expect(within(wsms).getByRole('button', { name: 'Actions for WP SMS contacts', hidden: true })).toBeDisabled();
    expect(within(wsms).getByRole('button', { name: 'Edit', hidden: true })).toBeDisabled();

    // The other Destination is untouched — its Edit and its ⋯ still work.
    expect(within(magnet).getByRole('button', { name: 'Edit', hidden: true })).toBeEnabled();
    expect(within(magnet).getByRole('button', { name: 'Actions for Lead magnet email', hidden: true })).toBeEnabled();
  });

  /**
   * **"Saved just now", beside the Save that did it** (ADR 0131), and the
   * dialog stays open: a merchant fixing one field often has a second. The
   * form is re-seeded from the saved route, so the next Escape asks about
   * the next edit, not one already saved.
   */
  it('says it saved beside Save, stays open, and asks again only about a later edit', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    let finish!: () => void;
    api.saveDestination.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const editing = vi.fn();
    render(<Destinations onEditingStateChange={editing} />);
    const dialog = within(await edit('WP SMS contacts'));
    await userEvent.type(dialog.getByRole('textbox', { name: 'Name' }), ' edited');
    await waitFor(() => expect(editing).toHaveBeenLastCalledWith(expect.objectContaining({ dirty: true })));
    await userEvent.click(dialog.getByRole('button', { name: 'Save destination' }));
    await waitFor(() => expect(editing).toHaveBeenLastCalledWith(expect.objectContaining({ busy: true })));
    await act(async () => finish());
    expect(await dialog.findByText('Saved just now')).toBeVisible();
    expect(api.saveDestination).toHaveBeenCalledWith(expect.objectContaining({ id: HEALTHY.id, label: 'WP SMS contacts edited' }));
    expect(dialog.getByRole('button', { name: 'Done' })).toBeVisible();
    await waitFor(() => expect(editing).toHaveBeenLastCalledWith(expect.objectContaining({ busy: false, dirty: false })));

    // Nothing unsaved, so Escape just closes — no "Discard changes?".
    await userEvent.type(dialog.getByRole('textbox', { name: 'Tags to add' }), ', more');
    expect(dialog.queryByText('Saved just now')).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(dialog.getByText('Discard changes?')).toBeVisible();
  });

  /**
   * **A failed save is said beside the Save that failed**, in the dialog that
   * still holds the draft — never at the top of the page, and never on a card
   * after the draft it was about has been dismissed (ADR 0039).
   */
  it('reports a failed save beside its Save and keeps the draft', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    api.saveDestination.mockRejectedValue(new Error('That file link is not reachable.'));

    render(<Destinations />);
    const dialog = within(await edit('Lead magnet email'));

    await userEvent.clear(dialog.getByLabelText(/Subject line/));
    await userEvent.type(dialog.getByLabelText(/Subject line/), 'Your guide');
    await userEvent.click(dialog.getByRole('button', { name: 'Save destination' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('That file link is not reachable.');
    expect(dialog.getByLabelText(/Subject line/)).toHaveValue('Your guide');
    expect(dialog.queryByText('Saved just now')).toBeNull();
    expect(screen.getAllByText('That file link is not reachable.')).toHaveLength(1);

    // Cancel is the explicit discard; only Escape, ✕ and an outside click ask.
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('That file link is not reachable.')).toBeNull();
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

    const wsms = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));

    await choose('WP SMS contacts', 'Send stored submissions again', wsms);
    await userEvent.click(screen.getByRole('button', { name: 'Send again' }));

    expect(await within(wsms).findByText(/4 submissions queued to send again/)).toBeInTheDocument();

    // Saving anything at all re-reads the payload, and the report is a fact
    // about the moment before that read.
    const dialog = within(await edit('Lead magnet email'));
    await userEvent.click(dialog.getByRole('button', { name: 'Save destination' }));

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
    await edit('MailPoet');

    const name = await screen.findByLabelText('Name');

    expect(name).toHaveValue('MailPoet');

    await userEvent.clear(name);
    await userEvent.type(name, 'Newsletter signups');
    await userEvent.click(screen.getByRole('button', { name: 'Save destination' }));

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
    await edit('MailPoet');

    expect(await screen.findByLabelText('Name')).toHaveValue('MailPoet');
    expect(screen.getByRole('button', { name: 'Save destination' })).toBeInTheDocument();
  });

  /**
   * Where the leads land, under the name — and the type only where it is not
   * the name already ("MailPoet / MailPoet" said one thing twice).
   */
  it('says where a configured route lands, without repeating its name', async () => {
    render(<Destinations />);

    const card = regionFor(await screen.findByRole('heading', { name: 'MailPoet' }));
    expect(within(card).getByText('Newsletter')).toBeVisible();
    expect(within(card).getAllByText(/MailPoet/)).toHaveLength(1);
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

    expect(await screen.findByText('Not pointed at anything')).toBeInTheDocument();
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

    // Bound, or bindings unknown, and never sent: true either way.
    expect(await screen.findByText('No sends yet')).toBeInTheDocument();
    expect(screen.queryByText('Nothing has been pushed here yet.')).toBeNull();
  });

  /**
   * **"Not used yet" said two things.** A route no campaign has chosen is not
   * waiting for a submission; it is waiting for the merchant — so the badge
   * says which, and the card says where to go next.
   */
  it('says a route no campaign uses is not in a campaign, and where to choose it', async () => {
    api.readDestinations.mockResolvedValue({
      types: [WSMS_READY],
      destinations: [{ ...HEALTHY, usage: [], health: { ...HEALTHY.health, last_success_at: null } }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByText('Not in a campaign')).toBeInTheDocument();
    expect(screen.getByText(/Not in a campaign yet/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to campaigns' })).toHaveAttribute('href', '#optins');
    expect(screen.queryByText('No sends yet')).toBeNull();
  });

  it('says who uses a route and how many of them are live', async () => {
    api.readDestinations.mockResolvedValue({
      types: [LEAD_MAGNET],
      destinations: [{ ...LEAD_MAGNET_BOUND, label: 'Welcome email', usage: [
        { id: 'a', name: 'Spring guide', draft: false, live: true },
        { id: 'b', name: 'Winter guide', draft: true, live: false },
      ] }],
      connections: [],
      failures: [],
    });

    render(<Destinations />);

    expect(await screen.findByText('Lead magnet email · Used by 2 campaigns (1 live)')).toBeVisible();
    // Working, not "Success recorded": the record is the Last sent line.
    expect(screen.getByText('Working')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Go to campaigns' })).toBeNull();
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
  /**
   * **The card is health; the settings are a dialog.** Nothing to edit is
   * drawn on the card, Edit opens the route's own dialog — titled with its
   * name, its badge and its type — and Cancel discards the draft and returns
   * focus to Edit.
   */
  it('keeps the card to health and edits in a dialog that Cancel discards', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    render(<Destinations />);
    const region = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    expect(within(region).queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(within(region).queryByRole('button', { name: 'Send again' })).toBeNull();
    expect(within(region).getByText(/Last sent/)).toBeVisible();
    const editButton = within(region).getByRole('button', { name: 'Edit' });
    expect(editButton).toHaveAccessibleDescription('WP SMS contacts');
    await userEvent.click(editButton);
    const dialog = screen.getByRole('dialog', { name: 'WP SMS contacts' });
    // The meta line is the type; the usage notice says who else is affected.
    expect(dialog).toHaveAccessibleDescription('WP SMS contacts');
    expect(within(dialog).getByText('Working')).toBeVisible();
    expect(within(dialog).getByText('Campaigns using this destination')).toBeVisible();
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Newsletter signups');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(editButton).toHaveFocus();
    await userEvent.click(editButton);
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Name' })).toHaveValue('WP SMS contacts');
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
    // One sentence of effect; what a success does not prove is the result's to say.
    expect(dialog.getByRole('button', { name: 'Send test' })).toHaveAccessibleDescription(/^Only this email address.*Use an address you own\. The test really sends — it may add a contact or send an email — but creates no lead\.$/);
    expect(screen.queryByText(/inbox delivery/)).toBeNull();
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

  it('preserves the sample on transport failure', async () => {
    api.testSend.mockRejectedValueOnce({ message: 'The request failed. Try again.' });
    render(<Destinations />);
    await choose('WP SMS contacts', 'Send a test');
    const dialog = within(screen.getByRole('dialog'));
    // Settings are edited in a modal of their own, so a test from the card
    // can only ever be of the saved route — there is no unsaved draft to warn of.
    expect(dialog.queryByText(/Uses the saved settings/)).toBeNull();
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

  it('leaves what the test answered on the card it was about', async () => {
    api.testSend.mockResolvedValue({ outcome: 'success', message: 'The saved route accepted the sample.' });
    api.readDestinations.mockResolvedValue({ ...TWO_DESTINATIONS, test_sample: { email: 'merchant@example.com', fields: ['email'] } });
    render(<Destinations />);
    const card = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    await choose('WP SMS contacts', 'Send a test', card);
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Send test' }));
    await userEvent.click(await dialog.findByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(card).getByText('The saved route accepted the sample.')).toBeVisible();
    expect(within(regionFor(screen.getByRole('heading', { name: 'Lead magnet email' }))).queryByText('The saved route accepted the sample.')).toBeNull();
    expect(within(card).getByRole('button', { name: 'Actions for WP SMS contacts' })).toHaveFocus();
  });

});

describe('destination recovery entry points', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('offers recovery beside skipped submissions, on the card itself', async () => {
    api.readDestinations.mockResolvedValue({ ...TWO_DESTINATIONS, destinations: [{
      ...HEALTHY, health: { ...HEALTHY.health, skipped_captures: 12, last_skipped_at: '2026-08-25 12:00:00' },
    }] });
    api.rePush.mockResolvedValue({ jobs: 12, capped: false, since: HEALTHY.health.last_success_at });
    render(<Destinations />);
    const region = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    expect(screen.queryByRole('dialog')).toBeNull();
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
    // Focused, not opened: a link to a route is not a request to edit it, and
    // the card's own issue line carries the fix where there is one.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(regionFor(heading)).getByRole('button', { name: 'Edit' })).toBeVisible();
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
    expect(screen.getByRole('button', { name: 'View submission' })).toHaveAttribute('aria-haspopup', 'dialog');
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

  /**
   * **Recent sends are a dialog behind ⋯, read only when asked**, and each
   * row leads to the submission it was for — outcome and time alone left the
   * merchant nowhere to go from "Needs attention".
   */
  it('reads recent sends only when asked, with readable times, words and the submission', async () => {
    api.readDestinations.mockResolvedValue(TWO_DESTINATIONS);
    api.readRecentAttempts.mockRejectedValueOnce({ message: 'Recent sends could not be read.' })
      .mockResolvedValueOnce({ attempts: [{ id: 1, lead: '01J0000000BBBBBBBBBBBBBBBB', submission: 's', attempt: 2, at: '2026-08-25 12:00:00', status: 'done', outcome: 'retry_scheduled' }] });
    render(<Destinations />);
    const region = regionFor(await screen.findByRole('heading', { name: 'WP SMS contacts' }));
    expect(api.readRecentAttempts).not.toHaveBeenCalled();
    await choose('WP SMS contacts', 'Recent sends', region);
    const dialog = within(await screen.findByRole('dialog', { name: 'WP SMS contacts' }));
    expect(await dialog.findByText('Recent sends could not be read.')).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Try again' }));
    expect(await dialog.findByText('Will retry')).toBeVisible();
    expect(dialog.getByText(/Aug 25/)).toBeVisible();
    expect(dialog.queryByText(/Attempt/)).toBeNull();
    expect(dialog.getByRole('link', { name: 'View submission' })).toHaveAttribute('href', leadsHref({ leadId: '01J0000000BBBBBBBBBBBBBBBB' }));
    expect(screen.queryByText(/01J0000000BBBBBBBBBBBBBBBB/)).toBeNull();
    await userEvent.click(dialog.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(region).getByRole('button', { name: 'Actions for WP SMS contacts' })).toHaveFocus();
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
    expect(screen.queryByRole('heading', { name: 'Accounts' })).toBeNull();
  });

  /**
   * **An empty screen carries its own way forward** (§20, ADR 0039): the
   * button sat in a page header the merchant had already read past, and the
   * heading drops its copy until a route exists — one primary action.
   */
  it('puts Add in the empty state, and only there', async () => {
    render(<Destinations />);
    const empty = (await screen.findByText('Leads are kept in WConvert only')).closest('section')!;
    expect(screen.getAllByRole('button', { name: 'Add a destination' })).toHaveLength(1);
    await userEvent.click(within(empty).getByRole('button', { name: 'Add a destination' }));
    expect(await screen.findByRole('dialog', { name: 'Add a destination' })).toBeVisible();
  });

  /**
   * **Add no longer closes into nothing.** The new route's card takes focus,
   * and says what it still needs — a campaign — with the way there.
   */
  it('focuses the new card after Add and points it at the campaigns', async () => {
    const NEW = { ...LEAD_MAGNET_BOUND, id: '01J0000000NNNNNNNNNNNNNNNN', label: 'Welcome email', usage: [], health: { ...HEALTHY.health, last_success_at: null } };
    api.saveDestination.mockResolvedValue({ destinations: [NEW] });
    render(<Destinations />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a destination' }));
    api.readDestinations.mockResolvedValue({ types: [MAILPOET_READY, LEAD_MAGNET], destinations: [NEW], connections: [], failures: [] });
    await userEvent.click(await screen.findByRole('button', { name: 'Lead magnet email' }));
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.type(dialog.getByLabelText(/Link to the file/), 'https://example.com/guide.pdf');
    await userEvent.click(dialog.getByRole('button', { name: 'Add destination' }));
    const heading = await screen.findByRole('heading', { name: 'Welcome email' });
    await waitFor(() => expect(heading).toHaveFocus());
    const card = regionFor(heading);
    expect(within(card).getByText(/Lead magnet email · Not in a campaign yet/)).toBeVisible();
    expect(within(card).getByRole('link', { name: 'Go to campaigns' })).toHaveAttribute('href', '#optins');
  });
});

/**
 * ============================================================================
 * THE PAGE IS FOR DESTINATIONS; ACCOUNTS ARE THE MEANS.
 * ============================================================================
 * Destinations come first with Add on their own heading, accounts follow them
 * behind one Connect menu, and the page header carries nothing on Settings.
 */
describe('the order of the screen', () => {
  const REMOTE = { ...MAILPOET_READY, id: 'mailchimp', label: 'Mailchimp', needs_connection: true, connection_schema: { api_key: { type: 'password', label: 'API key' } } };
  const BREVO = { ...REMOTE, id: 'brevo', label: 'Brevo' };

  beforeEach(() => {
    vi.clearAllMocks();
    api.readDestinations.mockResolvedValue({ types: [WSMS_READY, REMOTE, BREVO], destinations: [HEALTHY], connections: [], failures: [] });
  });

  it('draws destinations before accounts, with Add on the destinations heading and no Refresh', async () => {
    render(<Destinations />);
    const destinations = await screen.findByRole('heading', { name: 'Destinations' });
    const accounts = await screen.findByRole('heading', { name: 'Accounts' });
    expect(destinations.compareDocumentPosition(accounts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Sign in once per service. Destinations above use these accounts.')).toBeVisible();
    const add = screen.getByRole('button', { name: 'Add a destination' });
    expect(add.compareDocumentPosition(screen.getByRole('heading', { name: 'WP SMS contacts' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Refresh/ })).toBeNull();
    // Nothing wrong, so nothing to check.
    expect(screen.queryByRole('link', { name: /sending issue/ })).toBeNull();
    // One door, not one per service.
    expect(screen.queryByRole('button', { name: 'Connect Mailchimp' })).toBeNull();
  });

  it('links to the sending issues only when there are some, and counts them', async () => {
    api.readDestinations.mockResolvedValue({ types: [WSMS_READY], destinations: [
      { ...HEALTHY, health: { ...HEALTHY.health, consecutive_failures: 2, last_error: 'Timeout' } },
    ], connections: [], failures: [] });
    render(<Destinations />);
    expect(await screen.findByRole('link', { name: '1 sending issue' })).toHaveAttribute('href', '#leads?view=issues');
  });

  it('keeps Refresh on the sending issues view, and never says Refreshing on a first load', async () => {
    let answer!: (value: unknown) => void;
    api.readDestinations.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    render(<Destinations mode="issues" />);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    expect(screen.queryByText('Refreshing…')).toBeNull();
    await act(async () => answer({ types: [WSMS_READY], destinations: [HEALTHY], connections: [], failures: [] }));
    expect(await screen.findByRole('button', { name: 'Refresh' })).toBeEnabled();
  });

  /**
   * **A connection ends on its next step.** Pasting a key used to close the
   * dialog into nothing — the account sends nowhere until a destination runs
   * over it — so the result offers that destination, with the account chosen.
   */
  it('connects an account from one menu, then offers a destination over it', async () => {
    const ACCOUNT = { id: 'account-1', type: 'mailchimp', label: 'Mailchimp', credentials: { api_key: true } };
    api.saveConnection.mockResolvedValue({ connection: ACCOUNT });
    render(<Destinations />);
    await userEvent.click(await screen.findByRole('button', { name: 'Connect an account' }));
    expect(screen.getByRole('menuitem', { name: 'Brevo' })).toBeInTheDocument();
    api.readDestinations.mockResolvedValue({ types: [WSMS_READY, REMOTE, BREVO], destinations: [HEALTHY], connections: [ACCOUNT], failures: [] });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mailchimp' }));
    const connect = within(screen.getByRole('dialog', { name: 'Connect Mailchimp' }));
    await userEvent.type(connect.getByLabelText('API key'), 'key');
    await userEvent.click(connect.getByRole('button', { name: 'Check and save account' }));
    const result = within(await screen.findByRole('dialog', { name: 'Mailchimp' }));
    expect(result.getByRole('status')).toHaveTextContent('Connected. Add a destination to choose where in Mailchimp new leads go.');
    await userEvent.click(result.getByRole('button', { name: 'Add a Mailchimp destination' }));
    const add = within(await screen.findByRole('dialog', { name: 'New Mailchimp destination' }));
    expect(add.getByRole('combobox')).toHaveValue('account-1');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    // Back reaches the service list rather than dead-ending.
    await userEvent.click(add.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('dialog', { name: 'Add a destination' })).toBeVisible();
  });

  it('closes an edit of an existing account without offering a new destination', async () => {
    const ACCOUNT = { id: 'account-1', type: 'mailchimp', label: 'Main account', credentials: { api_key: true } };
    api.readDestinations.mockResolvedValue({ types: [REMOTE], destinations: [], connections: [ACCOUNT], failures: [] });
    api.saveConnection.mockResolvedValue({ connection: ACCOUNT });
    render(<Destinations />);
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Main account' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Main account' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Check and save account' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: /Add a Mailchimp destination/ })).toBeNull();
  });
});

/**
 * ============================================================================
 * "NEEDS SETUP" IS A BADGE AND A LINE, AND IT IS A SENDING ISSUE WHEN LIVE.
 * ============================================================================
 */
describe('a route that needs setup', () => {
  const NEEDS = {
    types: [{ ...LEAD_MAGNET, requirements: { capture_any_of: ['email'], settings: { file_url: { label: 'Link to the file', type: 'url' } }, fields: ['email'], mapped_fields: {} } }],
    destinations: [{ ...LEAD_MAGNET_BOUND, label: 'Welcome email', settings: { ...LEAD_MAGNET_BOUND.settings, file_url: '' },
      health: { ...HEALTHY.health, last_success_at: null }, usage: [{ id: 'a', name: 'Spring guide', draft: false, live: true }] }],
    connections: [],
    failures: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.readDestinations.mockResolvedValue(NEEDS);
  });

  /** §8: status true of a row is a badge. The box under it said it again. */
  it('says why in one unboxed line, with Finish setup opening Edit at the empty field', async () => {
    render(<Destinations />);
    const card = regionFor(await screen.findByRole('heading', { name: 'Welcome email' }));
    expect(within(card).getByText('Needs setup')).toBeVisible();
    const line = within(card).getByText(/Complete “Link to the file” before this destination can send\./);
    expect(line.closest('[data-slot="alert"], [role="status"]')).toBeNull();
    await userEvent.click(within(line).getByRole('button', { name: 'Finish setup' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Welcome email' }));
    await waitFor(() => expect(dialog.getByLabelText(/Link to the file/)).toHaveFocus());
    // Save is refused, and says why, until the route could send.
    const save = dialog.getByRole('button', { name: 'Save destination' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveAccessibleDescription(/Complete “Link to the file” before this destination can send\./);
    await userEvent.click(save);
    expect(api.saveDestination).not.toHaveBeenCalled();
    await userEvent.type(dialog.getByLabelText(/Link to the file/), 'https://example.com/guide.pdf');
    expect(save).not.toHaveAttribute('aria-disabled');
  });

  it('keeps the boxed alert for an outage', async () => {
    api.readDestinations.mockResolvedValue({ ...NEEDS, destinations: [{ ...NEEDS.destinations[0], health: { ...HEALTHY.health, consecutive_failures: 2, last_error: 'Timeout' } }] });
    render(<Destinations />);
    expect((await screen.findByText(/2 failures in a row/)).closest('[role="status"]')).not.toBeNull();
  });

  it('is listed with the sending issues while a live campaign uses it', async () => {
    const counted = vi.fn();
    render(<Destinations mode="issues" onIssueCount={counted} />);
    expect(await screen.findByRole('heading', { name: 'Welcome email' })).toBeVisible();
    expect(screen.queryByText('No known sending issues')).toBeNull();
    await waitFor(() => expect(counted).toHaveBeenLastCalledWith(1));
    // No Finish setup on the issues view: its door is the card's footer link.
    expect(screen.queryByRole('button', { name: 'Finish setup' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Fix sending setup' })).toHaveAttribute('href', destinationHref(LEAD_MAGNET_BOUND.id));
  });

  /** A lead-magnet email has no account, and still could be added unable to send. */
  it('refuses to add a route of any type while a required setting is empty', async () => {
    api.readDestinations.mockResolvedValue({ ...NEEDS, destinations: [] });
    render(<Destinations />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a destination' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Lead magnet email' }));
    const dialog = within(screen.getByRole('dialog'));
    const add = dialog.getByRole('button', { name: 'Add destination' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).toHaveAccessibleDescription('Complete “Link to the file” before this destination can send.');
    await userEvent.click(add);
    expect(api.saveDestination).not.toHaveBeenCalled();
  });
});
