import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
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
  readProductHealth: vi.fn(),
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

vi.mock('../../resources/admin/src/optins/CampaignDetails', () => ({ default: () => null }));

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
  optins.readProductHealth.mockImplementation(async (ids: string[]) => ids.map(id => ({ id, basis: 'draft', checks: [] })));
  stats.readDashboard.mockResolvedValue({ days: 30, from: '2026-08-16', to: '2026-09-14', goals: [], impact: [] });
  optins.listOptins.mockResolvedValue([OPTIN]);
  goals.listGoals.mockResolvedValue([
    { id: 'grow_email_list', label: 'Grow my email list', availability: 'ready' },
  ]);
});

/**
 * **The one ID on any screen sits behind "For developers"** (ADR 0131): the
 * free page events carry a campaign's ID and nothing else, so it is there —
 * folded away, and nowhere else in Details.
 */
it('copies the full campaign ID from the closed developer disclosure without publishing', async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  render(<OptinList onEdit={vi.fn()} onCreate={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: OPTIN.name }));
  const dialog = await screen.findByRole('dialog', { name: OPTIN.name });
  const disclosure = within(dialog).getByText('For developers').closest('details')!;
  expect(disclosure).not.toHaveAttribute('open');
  // Nothing outside the disclosure prints the ID.
  const outside = [...dialog.querySelectorAll('*')].filter((node) => !disclosure.contains(node) && node.childElementCount === 0);
  expect(outside.some((node) => node.textContent?.includes(OPTIN.id))).toBe(false);
  await user.click(within(dialog).getByText('For developers'));
  await user.click(within(dialog).getByRole('button', { name: 'Copy ID' }));
  expect(write).toHaveBeenCalledWith(OPTIN.id);
  expect(await within(dialog).findByText('Copied.')).toHaveAttribute('role', 'status');
  expect(optins.publishOptin).not.toHaveBeenCalled();
  write.mockRestore();
});

it('names an unnamed campaign without falling back to its ID', async () => {
  optins.listOptins.mockResolvedValue([{ ...OPTIN, name: '' }]);
  render(<OptinList onEdit={vi.fn()} />);
  expect(await screen.findByRole('row', { name: 'Unnamed campaign' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'More actions for Unnamed campaign' })).toBeInTheDocument();
  expect(screen.queryByText(OPTIN.id)).toBeNull();
});

it('still finds a campaign by a pasted ID it never shows', async () => {
  optins.listOptins.mockResolvedValue([OPTIN, { ...OPTIN, id: '01JQ00000000000000000000ZZ', name: 'Other campaign' }]);
  render(<OptinList onEdit={vi.fn()} />);
  await screen.findByRole('row', { name: 'Other campaign' });
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search campaigns' }), OPTIN.id.toLowerCase());
  expect(screen.getByRole('row', { name: OPTIN.name })).toBeInTheDocument();
  expect(screen.queryByRole('row', { name: 'Other campaign' })).toBeNull();
});

it('names a failed action by its campaign, never by its ID', async () => {
  optins.deleteOptin.mockRejectedValue(new Error('Already gone'));
  render(<OptinList onEdit={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: /More actions/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete campaign' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete campaign' }));
  expect(await screen.findByText(`${OPTIN.name}: Already gone`)).toBeInTheDocument();
  expect(screen.queryByText(new RegExp(OPTIN.id))).toBeNull();
});

it('a free install is never asked about products (ADR 0116)', async () => {
  render(<OptinList onEdit={vi.fn()} />);
  expect(await screen.findByRole('button', { name: OPTIN.name })).toBeInTheDocument();
  expect(screen.queryByText('Product checks for this page.')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Check products again' })).not.toBeInTheDocument();
  expect(optins.readProductHealth).not.toHaveBeenCalled();
});

it('opens product warnings with the affected selection and an editor action', async () => {
  window.wconvertAdmin = { exportUrl: '', journeys: true };
  onTestFinished(() => { delete window.wconvertAdmin; });
  optins.readProductHealth.mockResolvedValue([{ id: OPTIN.id, basis: 'published', checks: [{ label: 'Brewing', state: 'warning', message: 'No available products match. Review this result’s filters.' }] }]);
  const edit = vi.fn();
  render(<OptinList onEdit={edit} />);
  await userEvent.click(await screen.findByRole('button', { name: '1 product warning' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Checks the published version against today’s catalog.')).toBeInTheDocument();
  expect(within(dialog).getByText('Brewing')).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Review products' }));
  expect(edit).toHaveBeenCalledWith(OPTIN.id);
});

it('selects the campaign ID for manual copying when clipboard permission is refused', async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
  render(<OptinList onEdit={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: OPTIN.name }));
  await user.click(screen.getByText('For developers'));
  await user.click(screen.getByRole('button', { name: 'Copy ID' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t copy');
  const field = screen.getByRole('textbox', { name: 'Campaign ID' }) as HTMLInputElement;
  expect(field).toHaveFocus(); expect(field.value).toBe(OPTIN.id);
  expect(field.selectionStart).toBe(0); expect(field.selectionEnd).toBe(OPTIN.id.length);
  expect(screen.queryByText('Copied.')).not.toBeInTheDocument();
  write.mockRestore();
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

    expect(await screen.findByRole('status')).toHaveTextContent('Loading campaigns…');
    expect(screen.queryByText('No campaigns yet')).toBeNull();

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

    expect(await screen.findByText('No campaigns yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create your first campaign/ })).toBeInTheDocument();
  });

  it('renders a first failure as the region’s whole content', async () => {
    optins.listOptins.mockRejectedValue(new Error('Sorry, you are not allowed to do that.'));

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('Sorry, you are not allowed to do that.')).toBeInTheDocument();
    // The component's default door, rather than nine call sites spelling it.
    expect(screen.getByText('If it keeps failing, reload the page.')).toBeInTheDocument();
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

    expect(reason.closest('td')).toHaveTextContent('Suspended');
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
   * And once it HAS answered, an id it does not name says so in words. It used
   * to print the stored key, which is the raw-key-on-screen ADR 0131 removes;
   * blanking it would read as an Optin with no Goal at all.
   */
  it('says "Unknown goal" once the registry has answered and has no such Goal', async () => {
    goals.listGoals.mockResolvedValue([]);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('Unknown goal')).toBeInTheDocument();
    expect(screen.queryByText('grow_email_list')).toBeNull();
  });

  it('never prints the stored key of a Goal this build does not have', async () => {
    optins.listOptins.mockResolvedValue([{ ...OPTIN, goal: 'from_a_plugin_we_lack' }]);

    render(<OptinList onEdit={() => undefined} />);

    expect(await screen.findByText('Unknown goal')).toBeInTheDocument();
    expect(screen.queryByText(/from_a_plugin_we_lack/)).toBeNull();
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
    expect(await screen.findByRole('menuitem', { name: 'Unpublish campaign' })).toBeInTheDocument();
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

    expect(await screen.findByRole('row', { name: OPTIN.name })).toHaveTextContent('Published');
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
    expect(await screen.findByRole('menuitem', { name: 'Unpublish campaign' })).toBeInTheDocument();
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
    expect(await screen.findByRole('menuitem', { name: 'Unpublish campaign' })).toBeInTheDocument();
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
   * (ADR 0048). The dialog's entire job is to open that page: there is no
   * route behind it and no answer comes back to this screen. It opens in a new
   * tab, so the admin the merchant came from stays where it was.
   */
  it('asks which page and opens it in a new tab with the parameter on', async () => {
    optins.listOptins.mockResolvedValue([OPTIN]);
    window.wconvertAdmin = { exportUrl: '', homeUrl: 'https://example.test/', inspectParam: 'wconvert-inspect' };
    onTestFinished(() => { delete window.wconvertAdmin; });

    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    onTestFinished(() => open.mockRestore());

    render(<OptinList onEdit={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Why isn’t a campaign showing?' }));

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
    expect(open).toHaveBeenCalledWith('https://example.test/shop?filter=sale&wconvert-inspect=1', '_blank', 'noopener');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /** A page it cannot open says so beside the field, rather than doing nothing. */
  it('keeps an address it cannot open and says why', async () => {
    window.wconvertAdmin = { exportUrl: '', inspectParam: 'wconvert-inspect' };
    onTestFinished(() => { delete window.wconvertAdmin; });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    onTestFinished(() => open.mockRestore());

    render(<OptinList onEdit={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Why isn’t a campaign showing?' }));
    await userEvent.type(await screen.findByLabelText('Page to open'), 'not a page');
    await userEvent.click(screen.getByRole('button', { name: 'Open the page' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a full page address');
    expect(screen.getByLabelText('Page to open')).toHaveValue('not a page');
    expect(open).not.toHaveBeenCalled();
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

    await userEvent.click(await screen.findByRole('button', { name: 'Why isn’t a campaign showing?' }));

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

  it('copies a variants own ID and distinguishes it from the parent campaign', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    optins.listOptins.mockResolvedValue(A_TEST);
    render(<OptinList onEdit={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: ARM_B.name }));
    await user.click(screen.getByText('For developers'));
    await user.click(screen.getByRole('button', { name: 'Copy ID' }));
    expect(write).toHaveBeenCalledWith(ARM_B.id);
    expect(screen.getByRole('textbox', { name: 'Variant ID' })).toHaveValue(ARM_B.id);
    expect(screen.queryByRole('textbox', { name: 'Campaign ID' })).not.toBeInTheDocument();
    expect(screen.getByText(/their campaignId is the campaign this variant belongs to/)).toBeInTheDocument();
    write.mockRestore();
  });

  it('keeps an A/B family together when searching for an arm and can clear unmatched filters', async () => {
    optins.listOptins.mockResolvedValue(A_TEST);
    render(<OptinList onEdit={() => undefined} />);
    await screen.findByRole('button', { name: OPTIN.name });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search campaigns' }), '(B)');
    expect(screen.getByRole('button', { name: OPTIN.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ARM_B.name })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search campaigns' }), ' nothing like this');
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

    expect(await screen.findAllByText(/A\/B test · 2 variants/)).toHaveLength(1);
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

    expect(await screen.findByText(/A\/B tests split visitors by browser, not by person/)).toBeInTheDocument();
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

    expect(screen.queryByText(/A\/B tests split visitors by browser, not by person/)).not.toBeInTheDocument();
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
    // A paid install whose rung lacks A/B testing (ADR 0116).
    window.wconvertAdmin = {
      exportUrl: '',
      installedTier: 'basic',
      variants: { availability: 'locked', tier: 'pro' },
      tiers: { pro: { name: 'Pro', product_name: 'WConvert Pro' } },
    };
    onTestFinished(() => { delete window.wconvertAdmin; });

    render(<OptinList onEdit={() => undefined} />);

    await openTheMenuOn(/More actions/);

    expect(
      await screen.findByText('A/B testing is available with WConvert Pro.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Add another variant|Create A\/B test/ })).not.toBeInTheDocument();
  });

  /** A free install's menu carries no A/B item at all — not even a note (ADR 0116). */
  it('says nothing about A/B testing on a free install', async () => {
    optins.listOptins.mockResolvedValue([OPTIN]);
    window.wconvertAdmin = {
      exportUrl: '',
      installedTier: 'free',
      variants: { availability: 'locked', tier: 'pro' },
    };
    onTestFinished(() => { delete window.wconvertAdmin; });

    render(<OptinList onEdit={() => undefined} />);

    await openTheMenuOn(/More actions/);

    expect(await screen.findByRole('menuitem', { name: 'Duplicate as draft' })).toBeInTheDocument();
    expect(screen.queryByText(/A\/B testing/)).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /A\/B test|variant/ })).not.toBeInTheDocument();
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
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Use this variant' }));

    expect(
      await screen.findByText(/The other variants stop showing; their leads and results are kept/),
    ).toBeInTheDocument();
    expect(optins.declareWinner).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Use this variant' }));

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
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Use this variant' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Use this variant' }));

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

    expect(screen.queryByRole('menuitem', { name: /Add another variant|Create A\/B test/ })).not.toBeInTheDocument();
  });
});


/**
 * Details is one Medium AdminDialog (ADR 0131, decision 6): the campaign and
 * its status in the header, the period's numbers under one name each, and the
 * report and the editor as the footer's two doors.
 */
it('draws Details as the campaign, its numbers, and two doors out', async () => {
  stats.readDashboard.mockResolvedValue({ days: 30, from: '2026-08-16', to: '2026-09-14', goals: [{ action: 'submit', result_label: 'Submissions', optins: [{ id: OPTIN.id, conversions: 1234, impressions: 20000, conversion_rate: 0.0617 }] }] });
  const onEdit = vi.fn();
  render(<OptinList onEdit={onEdit} />);
  await screen.findByRole('link', { name: `View ${OPTIN.name} report` });
  await userEvent.click(screen.getByRole('button', { name: /More actions/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Details' }));
  const dialog = await screen.findByRole('dialog', { name: OPTIN.name });
  expect(dialog).toHaveAttribute('data-size', 'md');
  expect(within(dialog).getByText('Draft')).toBeInTheDocument();
  expect(within(dialog).getByText('Grow my email list')).toBeInTheDocument();
  expect(within(dialog).getByRole('heading', { name: /Last 30 days/ })).toBeInTheDocument();
  expect(within(dialog).getByText('1,234')).toBeInTheDocument();
  expect(within(dialog).getByText('Shown')).toBeInTheDocument();
  expect(within(dialog).getByText('6.2%')).toBeInTheDocument();
  expect(within(dialog).queryByText('Times shown')).toBeNull();
  const footer = dialog.querySelector('footer')!;
  expect(within(footer).getByRole('link', { name: 'View report' })).toHaveAttribute('href', expect.stringContaining('optin='));
  await userEvent.click(within(footer).getByRole('button', { name: 'Open editor' }));
  expect(onEdit).toHaveBeenCalledWith(OPTIN.id);
});

describe('the Campaigns workspace', () => {
  it('sorts by results in the period when asked', async () => {
    const quiet = { ...OPTIN, id: '01JQ00000000000000000000ZZ', name: 'Quiet campaign' };
    optins.listOptins.mockResolvedValue([quiet, OPTIN]);
    stats.readDashboard.mockResolvedValue({ days: 30, from: '2026-08-16', to: '2026-09-14', goals: [{ action: 'submit', result_label: 'Submissions', optins: [{ id: OPTIN.id, conversions: 9, impressions: 90, conversion_rate: 0.1 }, { id: quiet.id, conversions: 1, impressions: 90, conversion_rate: 0.01 }] }] });
    render(<OptinList onEdit={() => undefined} />);
    await screen.findByRole('link', { name: `View ${OPTIN.name} report` });
    expect(screen.getAllByRole('row').slice(1)[0]).toHaveAccessibleName(quiet.name);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort campaigns' }), 'results');
    expect(screen.getAllByRole('row').slice(1)[0]).toHaveAccessibleName(OPTIN.name);
  });

  it('uses conversions and the server result unit, never the delivery headline', async () => {
    stats.readDashboard.mockResolvedValue({ days: 30, from: '2026-08-16', to: '2026-09-14', goals: [{ action: 'submit', result_label: 'Resource requests', optins: [{ id: OPTIN.id, headline: 3, conversions: 7, impressions: 20, conversion_rate: 0.35 }] }] });
    render(<OptinList onEdit={() => undefined} />);
    const row = await screen.findByRole('row', { name: OPTIN.name });
    expect(await within(row).findByRole('link', { name: `View ${OPTIN.name} report` })).toHaveTextContent(/^7Resource requests35(\.0)?% of 20 shown$/);
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
    await userEvent.click(screen.getByRole('radio', { name: 'Gallery view' }));
    expect(screen.getByRole('radio', { name: 'Gallery view' })).toBeChecked();
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


it('does not describe a suspended saved version as live in details', async () => {
  optins.listOptins.mockResolvedValue([{ ...OPTIN, published_at: '2026-09-10', suspended: 'WooCommerce is inactive.', has_unpublished_changes: true }]);
  render(<OptinList onEdit={() => undefined} />);
  await userEvent.click(await screen.findByRole('button', { name: OPTIN.name }));
  const detail = await screen.findByRole('dialog', { name: OPTIN.name });
  expect(within(detail).getByText('Suspended')).toBeInTheDocument();
  expect(within(detail).queryByText(/previous version is still published/)).toBeNull();
  expect(within(detail).getByText(/Resolve the issue before it can show again/)).toBeInTheDocument();
});

it('retains accepted results, dates and drill-down links when a new period fails, then retries', async () => {
  const payload = { days: 30, from: '2026-08-16', to: '2026-09-14', goals: [{ action: 'submit', result_label: 'Submissions', optins: [{ id: OPTIN.id, conversions: 7, impressions: 20, conversion_rate: 0.35 }] }] };
  stats.readDashboard.mockResolvedValueOnce(payload).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ ...payload, days: 7, from: '2026-09-08' });
  render(<OptinList onEdit={() => undefined} />);
  const report = await screen.findByRole('link', { name: `View ${OPTIN.name} report` });
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Results period' }), '7');
  expect(await screen.findByText(/previous period and results remain/)).toBeInTheDocument();
  expect(report).toHaveTextContent('7Submissions');
  expect(report).toHaveAttribute('href', expect.stringContaining('days=30'));
  await userEvent.click(screen.getByRole('button', { name: /More actions/ }));
  expect(await screen.findByRole('menuitem', { name: 'View submissions' })).toHaveAttribute('href', expect.stringContaining('from=2026-08-16'));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(report).toHaveAttribute('href', expect.stringContaining('days=7')));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('makes preview and vocabulary failures recoverable without presenting missing data as a saved empty design', async () => {
  optins.readCampaignPreviews.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue([]);
  goals.listGoals.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue([{ id: OPTIN.goal, label: 'Grow my email list' }]);
  render(<OptinList onEdit={() => undefined} />);
  expect(await screen.findByText(/Design previews couldn’t load/)).toHaveTextContent('Goal names couldn’t load');
  expect(screen.getByText('Goal unavailable')).toBeInTheDocument();
  expect(screen.queryByText(OPTIN.goal)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Grow my email list')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});

it('lets keyboard users move between mutually exclusive views and filters', async () => {
  const live = { ...OPTIN, id: 'live', name: 'Live campaign', published_at: '2026-10-01 10:00:00' };
  optins.listOptins.mockResolvedValue([OPTIN, live]);
  render(<OptinList onEdit={() => undefined} />);
  await screen.findByRole('row', { name: OPTIN.name });
  await userEvent.click(screen.getByRole('radio', { name: 'List view' }));
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('radio', { name: 'Gallery view' })).toBeChecked();
  await userEvent.click(screen.getByRole('radio', { name: 'All' }));
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('radio', { name: 'Published' })).toBeChecked();
  expect(screen.queryByRole('row', { name: OPTIN.name })).toBeNull();
});

it('offers only the statuses some campaign is in', async () => {
  render(<OptinList onEdit={() => undefined} />);
  await screen.findByRole('row', { name: OPTIN.name });
  // One draft: Published and Suspended would each filter to nothing.
  expect(screen.getByRole('radio', { name: 'All' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Drafts' })).toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Published' })).toBeNull();
  expect(screen.queryByRole('radio', { name: 'Suspended' })).toBeNull();
});

it('asks for the empty list to carry the only Create button', async () => {
  optins.listOptins.mockResolvedValue([]);
  const onEmptyChange = vi.fn();
  render(<OptinList onEdit={() => undefined} onCreate={() => undefined} onEmptyChange={onEmptyChange} />);
  await screen.findByRole('button', { name: /Create your first campaign/ });
  expect(onEmptyChange).toHaveBeenLastCalledWith(true);
});

it('keeps other campaign families actionable while a write is pending', async () => {
  const other = { ...OPTIN, id: 'other', name: 'Other campaign' };
  optins.listOptins.mockResolvedValue([OPTIN, other]);
  let finish!: () => void;
  optins.publishOptin.mockImplementation((id: string) => id === OPTIN.id ? new Promise<void>((resolve) => { finish = resolve; }) : Promise.resolve());
  const busy = vi.fn();
  render(<OptinList onEdit={() => undefined} onBusyChange={busy} />);
  await userEvent.click(await screen.findByRole('button', { name: `More actions for ${OPTIN.name}` }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Publish saved draft' }));
  const confirm = screen.getByRole('button', { name: 'Publish saved draft' });
  expect(confirm).toHaveAttribute('data-variant', 'default');
  await userEvent.click(confirm);
  expect(screen.getByRole('button', { name: `More actions for ${OPTIN.name}` })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'More actions for Other campaign' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Publish saved draft' }));
  await userEvent.click(screen.getByRole('button', { name: 'Publish saved draft' }));
  await waitFor(() => expect(optins.publishOptin).toHaveBeenCalledWith(other.id));
  expect(busy).not.toHaveBeenCalledWith(false);
  finish();
  await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false));
});

it('explains why a known design-less campaign cannot be published', async () => {
  optins.readCampaignPreviews.mockResolvedValue([{ id: OPTIN.id, template: null, display_type: 'popup' }]);
  render(<OptinList onEdit={() => undefined} />);
  await userEvent.click(await screen.findByRole('button', { name: /More actions/ }));
  expect(await screen.findByRole('menuitem', { name: 'Publish saved draft' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByText('Add a design in the editor before publishing.')).toBeInTheDocument();
});

it('keeps a family failure visible when another write succeeds and suppresses automatic editor handoff', async () => {
  optins.listOptins.mockResolvedValue([OPTIN, { ...OPTIN, id: 'other', name: 'Other campaign' }]);
  let finish!: (value: { id: string }) => void;
  optins.duplicateCampaign.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  optins.publishOptin.mockRejectedValue(new Error('Publication refused'));
  const onEdit = vi.fn();
  render(<OptinList onEdit={onEdit} />);
  await userEvent.click(await screen.findByRole('button', { name: `More actions for ${OPTIN.name}` }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate as draft' }));
  await userEvent.click(screen.getByRole('button', { name: 'More actions for Other campaign' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Publish saved draft' }));
  await userEvent.click(screen.getByRole('button', { name: 'Publish saved draft' }));
  expect(await screen.findByText('Other campaign: Publication refused')).toBeInTheDocument();
  finish({ id: 'new-draft' });
  await waitFor(() => expect(screen.getByRole('button', { name: `More actions for ${OPTIN.name}` })).toBeEnabled());
  expect(screen.getByText('Other campaign: Publication refused')).toBeInTheDocument();
  expect(onEdit).not.toHaveBeenCalled();
});

it('retries a failed list refresh without repeating the successful mutation', async () => {
  optins.listOptins.mockResolvedValueOnce([OPTIN]).mockRejectedValueOnce(new Error('List offline')).mockResolvedValue([{ ...OPTIN, published_at: '2026-09-15' }]);
  optins.publishOptin.mockResolvedValue(undefined);
  render(<OptinList onEdit={() => undefined} />);
  await userEvent.click(await screen.findByRole('button', { name: /More actions/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Publish saved draft' }));
  await userEvent.click(screen.getByRole('button', { name: 'Publish saved draft' }));
  expect(await screen.findByText('List offline')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByRole('row', { name: OPTIN.name })).toHaveTextContent('Published'));
  expect(optins.publishOptin).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
});
