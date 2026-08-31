import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
}));

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
  published_at: null,
  deleted_at: null,
  suspended: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  optins.listOptins.mockResolvedValue([OPTIN]);
  goals.listGoals.mockResolvedValue([
    { id: 'grow_email_list', label: 'Grow my email list', availability: 'ready' },
  ]);
});

describe('a row', () => {
  /**
   * **The reason an Optin stopped showing is a description, not fine print.**
   * It was `text-xs` — the only 12px body text in the admin, and the smallest
   * thing on the screen carrying its most important explanatory sentence.
   * {@see Description} is the role, and it renders at `--text-note`.
   */
  it('states a suspension reason at the description size, not smaller', async () => {
    optins.listOptins.mockResolvedValue([
      {
        ...OPTIN,
        published_at: '2026-01-01T00:00:00+00:00',
        suspended: 'Its Goal is no longer available on this site.',
      },
    ]);

    render(<OptinList onEdit={() => undefined} />);

    const reason = await screen.findByText('Its Goal is no longer available on this site.');

    expect(reason).toHaveClass('text-note');
    expect(reason).not.toHaveClass('text-xs');
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

    expect(await screen.findByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
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

    expect(await screen.findByText('Published')).toBeInTheDocument();
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
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Why did nothing show?' }));

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
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Why did nothing show?' }));

    expect(await screen.findByText(/a cache is serving that page before WordPress runs/)).toBeInTheDocument();
  });
});
