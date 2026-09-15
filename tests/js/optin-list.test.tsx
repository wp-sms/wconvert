import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The Optin list, and the one thing on it that is a decision rather than a
 * layout: **a row shows the merchant's word for its [[Goal]], not the id the
 * row stores.**
 *
 * The labels are translatable strings that live in PHP, where
 * `wp i18n make-pot` can see them, so the screen fetches the registry rather
 * than carrying a map of its own — which is also what keeps a Goal spelled
 * once (`tests/unit/Goal/GoalParityTest.php`).
 */
const optins = vi.hoisted(() => ({
  listOptins: vi.fn(),
  publishOptin: vi.fn(),
  unpublishOptin: vi.fn(),
  deleteOptin: vi.fn(),
  createVariant: vi.fn(),
  declareWinner: vi.fn(),
  readCampaignPreviews: vi.fn(),
  duplicateCampaign: vi.fn(),
}));

const stats = vi.hoisted(() => ({ readDashboard: vi.fn() }));
vi.mock('../../resources/admin/src/stats/api', () => stats);

const goals = vi.hoisted(() => ({ listGoals: vi.fn() }));

// The four network calls are stubbed; `statusOf` and `isPublished` are NOT.
// They are pure functions over one row, and a row's STATE is one of the things
// this screen decides — a stubbed `statusOf` would let the list say
// [[Suspended]] because the test said so rather than because the row does.
vi.mock('../../resources/admin/src/optins/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/optins/api')>()),
  ...optins,
}));
vi.mock('../../resources/admin/src/goals/api', () => goals);

const { OptinList } = await import('../../resources/admin/src/optins/OptinList');

const OPTIN = {
  id: '01JQ00000000000000000000AA',
  name: 'Welcome discount',
  goal: 'grow_email_list',
  parent_id: null,
  published_at: null,
  has_unpublished_changes: false,
  deleted_at: null,
  suspended: null,
  // Present on every row including as an empty list, exactly as the route
  // sends it: a key that appeared only on the rows running a test is a key
  // this screen would test for existence, and "absent" and "no test" would be
  // one thing until the day a request half-failed.
  arms: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  optins.readCampaignPreviews.mockResolvedValue([]);
  stats.readDashboard.mockResolvedValue({ days: 30, from: '2026-08-16', to: '2026-09-14', goals: [], impact: [] });
  optins.listOptins.mockResolvedValue([OPTIN]);
  goals.listGoals.mockResolvedValue([
    { id: 'grow_email_list', label: 'Grow my email list', availability: 'ready' },
  ]);
});

/**
 * ============================================================================
 * A SCREEN IS FOUR SITUATIONS, AND THIS ONE HAD TESTS FOR EXACTLY ONE.
 * ============================================================================
 * `shell/loadable.ts` forces every screen to branch on `loading | ready |
 * failed`, so the three states are unavoidable in the code and were untested
 * here, on the Lead log and on the goal screen — nothing at all between the
 * three of them. That is why they drift without anybody noticing, and it is
 * what these are for.
 *
 * The reference implementation is this screen: all three drawn exactly as the
 * shared primitives intend, with the first-failure / refresh-failure split
 * done correctly. Pinning that down is what makes it a reference rather than
 * an accident.
 */
describe('the four situations this screen has to answer', () => {
  it('says it is loading, and never that there is nothing', async () => {
    let land: (rows: unknown) => void = () => undefined;
    optins.listOptins.mockReturnValue(new Promise((resolve) => (land = resolve)));

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByText('Start with one good campaign.')).toBeNull();

    land([OPTIN]);

    expect(await screen.findByText('Welcome discount')).toBeInTheDocument();
  });

  /**
   * **Never reachable from loading.** The empty state is a CLAIM — you have
   * none — and `EmptyState`'s docblock names the creation flow saying it while
   * the answer was still arriving as the bug the type exists to stop.
   */
  it('offers the door out where the site genuinely has no Optins', async () => {
    optins.listOptins.mockResolvedValue([]);

    render(<OptinList onEdit={() => undefined} onCreate={() => undefined} />);

    expect(await screen.findByText('Start with one good campaign.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create your first campaign/ })).toBeInTheDocument();
  });

  it('renders a first failure as the region’s whole content', async () => {
    optins.listOptins.mockRejectedValue(new Error('Sorry, you are not allowed to do that.'));

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('Sorry, you are not allowed to do that.')).toBeInTheDocument();
    // The component's default door, rather than nine call sites spelling it.
    expect(screen.getByText('Reload the page to try again.')).toBeInTheDocument();
  });
});

describe('a row', () => {
  /**
   * **The reason an Optin stopped showing is a description, not fine print.**
   * It was `text-xs` — the only 12px body text in the admin, and the smallest
   * thing on the screen carrying its most important explanatory sentence.
   * {@see Description} is the role, and it renders at `--text-note`.
   */
  it('states the suspension reason next to its status', async () => {
    optins.listOptins.mockResolvedValue([
      {
        ...OPTIN,
        published_at: '2026-01-01T00:00:00+00:00',
        suspended: 'Its Goal is no longer available on this site.',
      },
    ]);

    render(<OptinList onEdit={() => undefined} />);

    const reason = await screen.findByText('Its Goal is no longer available on this site.');

    expect(reason.closest('td')).toHaveTextContent('Not showing');
  });

  it('names its Goal the way the merchant does', async () => {
    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('Grow my email list')).toBeInTheDocument();
    expect(screen.queryByText('grow_email_list')).toBeNull();
  });

  /**
   * **The raw id must mean "this build has no such Goal" and nothing else.**
   *
   * The rows land before `listGoals` resolves, so a cell that falls back
   * immediately showed every merchant `grow_email_list` and then swapped it for
   * *Grow my email list* — teaching them that the `<code>` means "wait". The
   * cell is held until the registry has answered.
   */
  it('never flashes the raw id while the registry is still in flight', async () => {
    type Registry = { id: string; label: string; availability: string }[];
    let answer: (goals: Registry) => void = () => undefined;
    goals.listGoals.mockReturnValue(
      new Promise<Registry>((resolve) => {
        answer = resolve;
      }),
    );

    render(<OptinList onEdit={() => undefined} />);

    // The row is on screen — its name proves the list resolved — and the Goal
    // cell is still empty rather than showing the id it stores.
    expect(await screen.findByText('Welcome discount')).toBeInTheDocument();
    expect(screen.queryByText('grow_email_list')).toBeNull();

    answer([{ id: 'grow_email_list', label: 'Grow my email list', availability: 'ready' }]);

    expect(await screen.findByText('Grow my email list')).toBeInTheDocument();
  });

  /**
   * And once it HAS answered, an id it does not name is shown raw — which is
   * the only honest thing left, and is what the wait above protects.
   */
  it('shows the raw id once the registry has answered and has no such Goal', async () => {
    goals.listGoals.mockResolvedValue([]);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('grow_email_list')).toBeInTheDocument();
  });

  /**
   * An Optin holding a Goal this build does not have shows the raw value: it
   * is the only honest thing left, and blanking it would read as an Optin with
   * no Goal at all.
   */
  it('falls back to the stored value for a Goal this build does not have', async () => {
    optins.listOptins.mockResolvedValue([{ ...OPTIN, goal: 'from_a_plugin_we_lack' }]);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('from_a_plugin_we_lack')).toBeInTheDocument();
  });

  /**
   * The registry is a nicety on this screen. Losing it must not cost the
   * merchant the publish and delete buttons beside it.
   *
   * **Delete is behind the row's overflow menu as of ADR 0039** — a destructive
   * action may not sit adjacent to the safe action it could be mistaken for,
   * and *Unpublish* and *Delete* were two same-sized buttons side by side. So
   * this asserts the menu that holds it rather than the button, which is the
   * same claim about the same row: the actions are still there.
   */
  it('still lists and still acts when the registry cannot be read', async () => {
    goals.listGoals.mockRejectedValue(new Error('nope'));

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('Welcome discount')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'More actions for Welcome discount' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('nope')).toBeNull();
  });
});

/**
 * ============================================================================
 * SUSPENDED IS VISIBLE, AND IT IS SHOWN WITH ITS CAUSE.
 * ============================================================================
 * *"This is the screen a merchant actually looks at when something stopped
 * working"* (ADR 0027). An Optin that quietly does not show is a merchant with
 * nowhere to ask why, so the state alone would be the answer that produces the
 * support ticket rather than the one that prevents it.
 */
describe('a suspended row', () => {
  const SUSPENDED = {
    ...OPTIN,
    published_at: '2026-08-01 09:00:00',
    suspended: 'Suspended — the “Clicks an element” rule needs WConvert Pro, which is not active',
  };

  it('shows the cause rather than a bare state', async () => {
    optins.listOptins.mockResolvedValue([SUSPENDED]);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText(SUSPENDED.suspended)).toBeInTheDocument();
  });

  /**
   * It is still PUBLISHED underneath: the site is holding it back, the
   * merchant did not. Offering Publish would read as "this never went live"
   * and would ask them to undo something they never did.
   */
  it('keeps the unpublish control, because the merchant did not unpublish it', async () => {
    optins.listOptins.mockResolvedValue([SUSPENDED]);

    render(<OptinList onEdit={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: /More actions/ }));
    expect(await screen.findByRole('menuitem', { name: 'Pause campaign' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Publish saved draft' })).toBeNull();
  });

  /**
   * And a running Optin says nothing of the sort.
   *
   * **`Published`, not `published`, as of ADR 0039.** The lower-case word was
   * the machine token `statusOf` returns — a value this bundle computes, never
   * a string anybody wrote, and therefore untranslated in every locale. The
   * state is still what is asserted; the screen now says it in the merchant's
   * language.
   */
  it('is not what an ordinary published row says', async () => {
    optins.listOptins.mockResolvedValue([{ ...SUSPENDED, suspended: null }]);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByRole('row', { name: OPTIN.name })).toHaveTextContent('Live');
    expect(screen.queryByText('Not showing')).toBeNull();
  });
});

describe('saved changes awaiting publication', () => {
  it.each([
    ['published', null],
    ['suspended', 'Suspended — this rule needs a plugin that is not active'],
  ])('publishes changes on a %s row without unpublishing first', async (_, suspended) => {
    const row = { ...OPTIN, published_at: '2026-09-10 10:00:00', has_unpublished_changes: true, suspended };
    optins.listOptins.mockResolvedValueOnce([row]).mockResolvedValue([{ ...row, has_unpublished_changes: false }]);
    optins.publishOptin.mockResolvedValue({ ...row, has_unpublished_changes: false });

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('Unpublished changes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /More actions/ }));
    expect(await screen.findByRole('menuitem', { name: 'Pause campaign' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Publish saved draft' }));
    expect(optins.publishOptin).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Publish saved draft' }));

    expect(optins.publishOptin).toHaveBeenCalledWith(OPTIN.id);
    expect(optins.unpublishOptin).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Unpublished changes')).toBeNull());
  });

  it('offers no update action when the saved and live snapshots match', async () => {
    optins.listOptins.mockResolvedValue([{ ...OPTIN, published_at: '2026-09-10 10:00:00' }]);
    render(<OptinList onEdit={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: /More actions/ }));
    expect(await screen.findByRole('menuitem', { name: 'Pause campaign' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Publish saved draft' })).toBeNull();
  });
});

describe('the door into the eligibility inspector', () => {
  /**
   * ==========================================================================
   * IT ASKS WHICH PAGE, AND THEN GOES THERE. IT NEVER EVALUATES ONE.
   * ==========================================================================
   * A `RequestContext` cannot honestly be built from a URL — `url_to_postid()`
   * returns 0 for archives, terms, the blog index and the shop page — so the
   * merchant does not DESCRIBE a page to the inspector, they OPEN one
   * (ADR 0048). The dialog's entire job is to feed `window.location`: there is
   * no route behind it and no answer comes back to this screen.
   */
  it('asks which page and navigates to it with the parameter on', async () => {
    optins.listOptins.mockResolvedValue([OPTIN]);
    window.wconvertAdmin = { exportUrl: '', homeUrl: 'https://example.test/', inspectParam: 'wconvert-inspect' };

    const assign = vi.fn();

    Object.defineProperty(window, 'location', { value: { assign }, writable: true });

    render(<OptinList onEdit={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: /More actions/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Check visibility' }));

    const field = await screen.findByLabelText('Page to open');

    // Prefilled from `home_url()` rather than from `location.origin`, so a
    // subdirectory install lands on the SITE rather than on the domain root.
    expect(field).toHaveValue('https://example.test/');

    await userEvent.clear(field);
    await userEvent.type(field, 'https://example.test/shop?filter=sale');
    await userEvent.click(screen.getByRole('button', { name: 'Open the page' }));

    // The page's own query string survives: a merchant asking about
    // `?filter=sale` is asking about that page, and appending with a `?` would
    // produce a different one.
    expect(assign).toHaveBeenCalledWith('https://example.test/shop?filter=sale&wconvert-inspect=1');
  });

  /**
   * **The cache sentence is on the dialog, not in the panel.**
   * `DONOTCACHEPAGE` is set during PHP, and a full-page cache holding a file
   * for that URL answers before PHP runs at all — so the symptom is that no
   * panel appears, and a warning inside the panel is one nobody could read.
   */
  it('warns about the cache where the merchant can still read it', async () => {
    optins.listOptins.mockResolvedValue([OPTIN]);
    window.wconvertAdmin = { exportUrl: '', homeUrl: 'https://example.test/', inspectParam: 'wconvert-inspect' };

    render(<OptinList onEdit={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: /More actions/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Check visibility' }));

    expect(await screen.findByText(/a cache is serving that page before WordPress runs/)).toBeInTheDocument();
  });
});

/**
 * =============================================================================
 * A TEST IS ONE CAMPAIGN WITH ARMS UNDER IT, NEVER TWO CAMPAIGNS.
 * =============================================================================
 * This is the entire UI half of ADR 0045. A [[Variant]] is a whole [[Optin]]
 * with its own row and its own counters — which is what makes the counters need
 * nothing at all — and the price of that is that storage would show a merchant
 * running three tests six campaigns. It does not: the list filters to
 * parentless Optins in SQL and each test's arms are drawn beneath their parent.
 */
describe('an A/B test on the list', () => {
  const ARM_B = {
    ...OPTIN,
    id: '01JQ00000000000000000000BB',
    name: 'Welcome discount (B)',
    parent_id: OPTIN.id,
    arms: [],
  };

  const A_TEST = [{ ...OPTIN, arms: [ARM_B] }];

  it('keeps an A/B family together when searching for an arm and can clear unmatched filters', async () => {
    optins.listOptins.mockResolvedValue(A_TEST);
    render(<OptinList onEdit={() => undefined} />);
    await screen.findByRole('button', { name: OPTIN.name });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search Campaigns' }), '(B)');
    expect(screen.getByRole('button', { name: OPTIN.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ARM_B.name })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Live 0' }));
    expect(screen.getByText('No campaigns found')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('button', { name: OPTIN.name })).toBeInTheDocument();
    expect(optins.listOptins).toHaveBeenCalledTimes(1);
  });

  const openTheMenuOn = async (name: RegExp) =>
    userEvent.click(await screen.findByRole('button', { name }));

  beforeEach(() => {
    window.wconvertAdmin = { exportUrl: '', variants: { availability: 'ready', tier: 'pro' } };
  });

  it('draws the arms beneath their parent rather than as campaigns of their own', async () => {
    optins.listOptins.mockResolvedValue(A_TEST);

    render(<OptinList onEdit={() => undefined} />);

    await screen.findByText('Welcome discount (B)');

    const rows = screen.getAllByRole('row');

    // The header, the campaign, and its one arm — never a second campaign.
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('Welcome discount');
    expect(rows[2]).toHaveTextContent('Welcome discount (B)');
  });

  /**
   * On the campaign only. The arms beneath it are already inside it, so a badge
   * on every row would say one thing three times (ADR 0039/0048: a fact true of
   * the group belongs to the group).
   */
  it('marks the campaign as a test and not each arm', async () => {
    optins.listOptins.mockResolvedValue(A_TEST);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findAllByText(/A\/B test · 2 designs/)).toHaveLength(1);
  });

  /**
   * **The split unit is the browser record, not the person** (ADR 0017,
   * ADR 0045). A merchant reading 4.2% against 5.1% deserves to know what the
   * denominator is, and the honest move is to say so where the numbers are
   * rather than to buy validity with a cookie.
   */
  it('says what the two numbers are counting, where they are reported', async () => {
    optins.listOptins.mockResolvedValue(A_TEST);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText(/A\/B assignments use browser storage, not unique people/)).toBeInTheDocument();
  });

  /**
   * And says nothing on a screen with no test on it. A line that is true,
   * permanent and attached to no decision taxes every visit and informs one
   * (ADR 0042).
   */
  it('says nothing about browsers on a screen with no test running', async () => {
    optins.listOptins.mockResolvedValue([OPTIN]);

    render(<OptinList onEdit={() => undefined} />);

    await screen.findByText('Welcome discount');

    expect(screen.queryByText(/A\/B assignments use browser storage, not unique people/)).not.toBeInTheDocument();
  });

  /** A merchant is never asked to name the thing they think of as the other one. */
  it('creates a variant without asking for a name', async () => {
    optins.listOptins.mockResolvedValue([OPTIN]);
    optins.createVariant.mockResolvedValue({ id: ARM_B.id });

    render(<OptinList onEdit={() => undefined} />);

    await openTheMenuOn(/More actions/);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Create A/B test' }));

    expect(optins.createVariant).toHaveBeenCalledWith(OPTIN.id);
  });

  /**
   * ==========================================================================
   * MARKED BEFORE THE CLICK, WITH THE REASON — AND NEVER AS A DEAD CONTROL.
   * ==========================================================================
   * The routes genuinely do not exist on a build without the module (ADR 0015),
   * so an unmarked item would be a 404 a merchant met by pressing something we
   * offered them. It EXPLAINS rather than hiding, because this is a list
   * somebody is reading rather than a creation front door (ADR 0026) — and it
   * is a label rather than a disabled item, because wp.org Guideline 9 fires on
   * showing a real control that cannot be used.
   */
  it('marks A/B testing as premium rather than offering a control that would 404', async () => {
    optins.listOptins.mockResolvedValue([OPTIN]);
    window.wconvertAdmin = {
      exportUrl: '',
      variants: { availability: 'locked', tier: 'pro' },
      tiers: { pro: { name: 'Pro', product_name: 'WConvert Pro' } },
    };

    render(<OptinList onEdit={() => undefined} />);

    await openTheMenuOn(/More actions/);

    expect(
      await screen.findByText('A/B testing is available with WConvert Pro.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /variant/ })).not.toBeInTheDocument();
  });

  /**
   * ==========================================================================
   * ENDING A TEST CONFIRMS, AND SAYS WHAT THE LOSING ARM KEEPS.
   * ==========================================================================
   * It is destructive, so it confirms (ADR 0039). What the sentence carries is
   * the half a merchant would otherwise assume wrongly: the arm that lost is
   * not deleted — its row stays and its counts stay readable (ADR 0020).
   */
  it('confirms before ending a test, and says the losing arm keeps its numbers', async () => {
    optins.listOptins.mockResolvedValue(A_TEST);
    optins.declareWinner.mockResolvedValue(undefined);

    render(<OptinList onEdit={() => undefined} />);

    await openTheMenuOn(/More actions for Welcome discount \(B\)/);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Use this design' }));

    expect(
      await screen.findByText(/Other designs stop showing; their leads and results are kept/),
    ).toBeInTheDocument();
    expect(optins.declareWinner).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Use this design' }));

    expect(optins.declareWinner).toHaveBeenCalledWith(OPTIN.id, ARM_B.id);
  });

  /**
   * **The parent is arm A**, so "keep the one I started with" has to be
   * expressible — otherwise a merchant whose original design won could only end
   * the test by declaring the loser.
   */
  it('lets the campaign itself win', async () => {
    optins.listOptins.mockResolvedValue(A_TEST);
    optins.declareWinner.mockResolvedValue(undefined);

    render(<OptinList onEdit={() => undefined} />);

    await openTheMenuOn(/More actions for Welcome discount$/);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Use this design' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Use this design' }));

    expect(optins.declareWinner).toHaveBeenCalledWith(OPTIN.id, OPTIN.id);
  });

  /**
   * Arms are a flat set under one parent — the payload names one experiment, so
   * a variant of a variant is a shape no test describes and the server refuses
   * one. It is not offered here either, which is the same rule read before the
   * click.
   */
  it('does not offer to test an arm against a variant of its own', async () => {
    optins.listOptins.mockResolvedValue(A_TEST);

    render(<OptinList onEdit={() => undefined} />);

    await openTheMenuOn(/More actions for Welcome discount \(B\)/);

    expect(screen.queryByRole('menuitem', { name: /variant/ })).not.toBeInTheDocument();
  });
});


describe('the Campaigns workspace', () => {
  it('uses conversions and the server result unit, never the delivery headline', async () => {
    stats.readDashboard.mockResolvedValue({ days: 30, from: '2026-08-16', to: '2026-09-14', goals: [{ action: 'submit', result_label: 'Resource requests', optins: [{ id: OPTIN.id, headline: 3, conversions: 7, impressions: 20, conversion_rate: 0.35 }] }] });
    render(<OptinList onEdit={() => undefined} />);
    const row = await screen.findByRole('row', { name: OPTIN.name });
    expect(await within(row).findByRole('link', { name: `View ${OPTIN.name} report` })).toHaveTextContent('7Resource requests');
    expect(stats.readDashboard).toHaveBeenCalledWith(30, true);
    await userEvent.click(within(row).getByRole('button', { name: /More actions/ }));
    expect(await screen.findByRole('menuitem', { name: 'View submissions' })).toHaveAttribute('href', expect.stringContaining('from=2026-08-16'));
  });

  it('keeps campaign controls usable when results fail', async () => {
    stats.readDashboard.mockRejectedValue(new Error('Stats unavailable'));
    const onEdit = vi.fn();
    render(<OptinList onEdit={onEdit} />);
    expect(await screen.findByText(/Results couldn’t load/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Continue editing' }));
    expect(onEdit).toHaveBeenCalledWith(OPTIN.id);
  });

  it('opens details from the name and uses the same campaigns in gallery view', async () => {
    const onEdit = vi.fn();
    render(<OptinList onEdit={onEdit} />);
    await userEvent.click(await screen.findByRole('button', { name: OPTIN.name }));
    expect(await screen.findByRole('dialog', { name: OPTIN.name })).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Gallery view' }));
    expect(screen.getByRole('button', { name: 'Gallery view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('row', { name: OPTIN.name })).toBeInTheDocument();
    expect(optins.listOptins).toHaveBeenCalledTimes(1);
  });

  it('releases the navigation guard before opening a duplicate', async () => {
    let guarded = false;
    const onEdit = vi.fn(() => expect(guarded).toBe(false));
    const onBusyChange = vi.fn((busy: boolean) => { guarded = busy; });
    optins.duplicateCampaign.mockResolvedValue({ id: 'copied-id' });
    render(<OptinList onEdit={onEdit} onBusyChange={onBusyChange} />);
    await userEvent.click(await screen.findByRole('button', { name: /More actions/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate as draft' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith('copied-id'));
    expect(optins.duplicateCampaign).toHaveBeenCalledWith(OPTIN.id, `${OPTIN.name} — copy`);
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
    expect(optins.publishOptin).not.toHaveBeenCalled();
  });
});
