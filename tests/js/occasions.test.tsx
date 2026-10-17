import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { nextYearOf, occasionPhase, occasionSchedule, occasionTotals, occasionWindow, placeBar, shownDays } from '../../resources/admin/src/lib/occasion';
import { createHref, occasionHref, optinsHref, routeFrom, sectionFrom } from '../../resources/admin/src/nav';
import type { DashboardPayload, GoalReport, OptinReport } from '../../resources/admin/src/stats/api';
import type { OptinSummary } from '../../resources/admin/src/optins/api';

/**
 * Occasions on the admin (#276, #277; ADR 0149): a campaign belongs to one,
 * the list filters by it from the address, a new campaign made inside one
 * starts with its dates, and its own page draws its campaigns on a date line.
 */
const occasionsApi = vi.hoisted(() => ({ readOccasions: vi.fn(), copyOccasion: vi.fn(), exportOccasion: vi.fn(), importOccasion: vi.fn(), download: vi.fn() }));
vi.mock('../../resources/admin/src/occasions/api', () => occasionsApi);
const optins = vi.hoisted(() => ({ listOptins: vi.fn(), readCampaignPreviews: vi.fn(), readProductHealth: vi.fn() }));
vi.mock('../../resources/admin/src/optins/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/optins/api')>()),
  ...optins,
}));
const stats = vi.hoisted(() => ({ readDashboard: vi.fn() }));
vi.mock('../../resources/admin/src/stats/api', () => stats);
vi.mock('../../resources/admin/src/goals/api', () => ({ listGoals: vi.fn().mockResolvedValue([]) }));
vi.mock('../../resources/admin/src/optins/CampaignDetails', () => ({ default: () => null }));

const { OptinList } = await import('../../resources/admin/src/optins/OptinList');
const { CampaignOccasion } = await import('../../resources/admin/src/occasions/CampaignOccasion');
const { DateLine } = await import('../../resources/admin/src/occasions/DateLine');

const BLACK_FRIDAY = { id: 'black-friday-2026', name: 'Black Friday 2026', start: '2026-11-20', end: '2026-12-01' };
const LAUNCH = { id: 'launch', name: 'Spring launch', start: '2027-03-01', end: '2027-03-07' };

const row = (id: string, name: string, extra: Partial<OptinSummary> = {}): OptinSummary => ({
  id, name, goal: 'promote_offer', parent_id: null, published_at: null, has_unpublished_changes: false, deleted_at: null,
  suspended: null, arms: [], occasion: null, display_type: 'popup', starts_at: null, ends_at: null, ...extra,
});

describe('an occasion’s dates', () => {
  it('prefills a new campaign from the first day 00:00 to the day after the last (ADR 0149 §3)', () => {
    expect(occasionSchedule('2026-11-20', '2026-12-01')).toEqual({ starts_at: '2026-11-20 00:00', ends_at: '2026-12-02 00:00' });
    expect(occasionSchedule('2026-12-31', '2026-12-31')).toEqual({ starts_at: '2026-12-31 00:00', ends_at: '2027-01-01 00:00' });
  });

  it('places a bar as a share of the occasion and flags what shows outside it', () => {
    const fits = placeBar(BLACK_FRIDAY, '2026-11-20 00:00', '2026-12-02 00:00');
    expect(fits).toEqual({ left: 0, width: 100, before: false, after: false });
    const half = placeBar(BLACK_FRIDAY, '2026-11-26 00:00', '2026-12-02 00:00');
    expect(half.left).toBe(50);
    expect(half.width).toBe(50);
    // The teaser runs the ten days before: nothing inside, flagged before.
    expect(placeBar(BLACK_FRIDAY, '2026-11-10 00:00', '2026-11-20 00:00')).toEqual({ left: 0, width: 0, before: true, after: false });
    // Starting early and ending late is clamped to the occasion and flagged at both edges.
    expect(placeBar(BLACK_FRIDAY, '2026-11-18 00:00', '2026-12-05 00:00')).toEqual({ left: 0, width: 100, before: true, after: true });
    // No dates at all shows before and after.
    expect(placeBar(BLACK_FRIDAY, null, null)).toMatchObject({ before: true, after: true, width: 100 });
  });

  it('reads a campaign that ends at midnight as the days it shows', () => {
    expect(shownDays('2026-11-20 00:00', '2026-12-02 00:00')).toEqual({ from: '2026-11-20', to: '2026-12-01' });
    expect(shownDays('2026-11-20 09:00', '2026-12-02 00:00')).toBeNull();
    expect(shownDays(null, '2026-12-02 00:00')).toBeNull();
  });

  it('says where today falls and reads only the days that have happened', () => {
    expect(occasionPhase(BLACK_FRIDAY, '2026-11-17')).toEqual({ kind: 'before', days: 3 });
    expect(occasionPhase(BLACK_FRIDAY, '2026-11-28')).toEqual({ kind: 'during', day: 9, of: 12 });
    expect(occasionPhase(BLACK_FRIDAY, '2026-12-02')).toEqual({ kind: 'after' });
    expect(occasionWindow(BLACK_FRIDAY, '2026-11-17')).toBeNull();
    expect(occasionWindow(BLACK_FRIDAY, '2026-11-28')).toEqual({ from: '2026-11-20', to: '2026-11-28' });
    expect(occasionWindow(BLACK_FRIDAY, '2027-01-05')).toEqual({ from: '2026-11-20', to: '2026-12-01' });
  });

  it('names what Copy to next year makes', () => {
    expect(nextYearOf(BLACK_FRIDAY)).toEqual({ name: 'Black Friday 2027', start: '2027-11-20', end: '2027-12-01' });
    expect(nextYearOf({ name: 'Leap sale', start: '2028-02-29', end: '2028-02-29' })).toEqual({ name: 'Leap sale 2029', start: '2029-02-28', end: '2029-02-28' });
  });
});

describe('an occasion’s totals', () => {
  const numbers = (id: string, impressions: number, conversions: number, dismissals: number, parent: string | null = null): OptinReport => ({
    id, name: id, parent_id: parent, status: 'published', published_at: null, headline: conversions, impressions, conversions, dismissals,
    conversion_rate: impressions ? conversions / impressions : null, deliveries: null, by_day: {}, conversion_by_day: {}, impression_by_day: {},
  });
  const goal = (action: GoalReport['action'], optins: OptinReport[]) => ({ action, optins } as unknown as GoalReport);

  it('adds views and closes across campaigns, and counts clicks only from click goals', () => {
    const report = { goals: [
      goal('click', [numbers('bar', 9000, 600, 1400), numbers('popup', 5000, 500, 1300), numbers('arm', 1000, 100, 100, 'popup'), numbers('elsewhere', 999, 99, 9)]),
      goal('submit', [numbers('teaser', 3000, 200, 500)]),
    ] } as Pick<DashboardPayload, 'goals'>;
    const totals = occasionTotals(report, new Set(['bar', 'popup', 'teaser']));
    expect(totals).toEqual({ views: 18000, clicks: 1200, clickRate: 1200 / 15000, closes: 3300, counted: true });
  });

  it('says when nothing here converts on a click', () => {
    const totals = occasionTotals({ goals: [goal('submit', [numbers('teaser', 10, 1, 1)])] }, new Set(['teaser']));
    expect(totals.counted).toBe(false);
    expect(totals.clicks).toBe(0);
  });
});

describe('the occasion in the address', () => {
  it('names an occasion’s own page under Campaigns, and the list’s filter', () => {
    expect(occasionHref('black-friday-2026')).toBe('#occasions/black-friday-2026');
    expect(sectionFrom('#occasions/black-friday-2026')).toBe('optins');
    expect(routeFrom('#occasions/black-friday-2026')).toMatchObject({ section: 'optins', occasionId: 'black-friday-2026' });
    expect(optinsHref({ occasion: 'black-friday-2026' })).toBe('#optins?occasion=black-friday-2026');
    expect(routeFrom('#optins?occasion=black-friday-2026').occasion).toBe('black-friday-2026');
    expect(createHref({ occasion: 'black-friday-2026' })).toBe('#optins?new=1&occasion=black-friday-2026');
    expect(routeFrom('#optins?new=1&occasion=black-friday-2026')).toMatchObject({ creating: true, occasion: 'black-friday-2026' });
  });

  it('ignores what is not an occasion id', () => {
    expect(routeFrom('#optins?occasion=Not%20One').occasion).toBeUndefined();
    expect(routeFrom('#occasions/Not_One').occasionId).toBeUndefined();
    expect(routeFrom('#leads?occasion=black-friday-2026').occasion).toBeUndefined();
  });

  it('lets the editor return to the occasion page it was opened from', () => {
    expect(routeFrom('#optins?edit=01JQ00000000000000000000AA&back=%23occasions%2Fblack-friday-2026').returnTo).toBe('#occasions/black-friday-2026');
  });
});

describe('the campaign list’s Occasion filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    occasionsApi.readOccasions.mockResolvedValue({ schema: 1, revision: 1, items: [BLACK_FRIDAY, LAUNCH] });
    optins.readCampaignPreviews.mockResolvedValue([]);
    optins.readProductHealth.mockResolvedValue([]);
    stats.readDashboard.mockResolvedValue({ days: 30, from: '2026-10-18', to: '2026-11-16', goals: [], impact: [] });
    optins.listOptins.mockResolvedValue([
      row('01JQ00000000000000000000AA', 'BF top bar', { occasion: BLACK_FRIDAY.id }),
      row('01JQ00000000000000000000AB', 'Welcome discount'),
    ]);
  });

  it('reads the filter from the address and writes a change back to it', async () => {
    const onOccasionChange = vi.fn();
    render(<OptinList onEdit={vi.fn()} occasion={BLACK_FRIDAY.id} onOccasionChange={onOccasionChange} onOpenOccasion={vi.fn()} onCreateInOccasion={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'BF top bar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Welcome discount' })).not.toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Occasion' });
    expect(select).toHaveValue(BLACK_FRIDAY.id);
    await userEvent.selectOptions(select, '');
    expect(onOccasionChange).toHaveBeenCalledWith(undefined);
    await userEvent.selectOptions(select, LAUNCH.id);
    expect(onOccasionChange).toHaveBeenLastCalledWith(LAUNCH.id);
  });

  it('offers a new campaign in the chosen occasion, and its page', async () => {
    const onCreateInOccasion = vi.fn(), onOpenOccasion = vi.fn();
    render(<OptinList onEdit={vi.fn()} occasion={BLACK_FRIDAY.id} onOccasionChange={vi.fn()} onOpenOccasion={onOpenOccasion} onCreateInOccasion={onCreateInOccasion} />);
    await userEvent.click(await screen.findByRole('button', { name: 'New campaign in this occasion' }));
    expect(onCreateInOccasion).toHaveBeenCalledWith(BLACK_FRIDAY.id);
    await userEvent.click(screen.getByRole('button', { name: 'Open occasion' }));
    expect(onOpenOccasion).toHaveBeenCalledWith(BLACK_FRIDAY.id);
  });

  it('shows each campaign’s occasion as a link when none is chosen, and no filter on a site without occasions', async () => {
    const { unmount } = render(<OptinList onEdit={vi.fn()} onOccasionChange={vi.fn()} />);
    const link = await screen.findByRole('link', { name: 'Black Friday 2026' });
    expect(link).toHaveAttribute('href', '#occasions/black-friday-2026');
    expect(screen.getByRole('combobox', { name: 'Occasion' })).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'New campaign in this occasion' })).not.toBeInTheDocument();
    unmount();

    occasionsApi.readOccasions.mockResolvedValue({ schema: 1, revision: 0, items: [] });
    render(<OptinList onEdit={vi.fn()} onOccasionChange={vi.fn()} />);
    await screen.findByRole('button', { name: 'Welcome discount' });
    await waitFor(() => expect(occasionsApi.readOccasions).toHaveBeenCalled());
    expect(screen.queryByRole('combobox', { name: 'Occasion' })).not.toBeInTheDocument();
  });

  it('clears the occasion with the other filters', async () => {
    const onOccasionChange = vi.fn();
    render(<OptinList onEdit={vi.fn()} occasion={LAUNCH.id} onOccasionChange={onOccasionChange} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Clear filters' }));
    expect(onOccasionChange).toHaveBeenCalledWith(undefined);
  });
});

describe('the editor’s Occasion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    occasionsApi.readOccasions.mockResolvedValue({ schema: 1, revision: 1, items: [BLACK_FRIDAY, LAUNCH] });
  });

  it('sets the campaign’s occasion and clears it with None', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<CampaignOccasion value={undefined} onChange={onChange} />);
    const select = await screen.findByRole('combobox', { name: 'Occasion' });
    expect(select).toHaveValue('');
    await userEvent.selectOptions(select, BLACK_FRIDAY.id);
    expect(onChange).toHaveBeenLastCalledWith(BLACK_FRIDAY.id);
    rerender(<CampaignOccasion value={BLACK_FRIDAY.id} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Occasion' }), 'None');
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('draws nothing on a site without occasions', async () => {
    occasionsApi.readOccasions.mockResolvedValue({ schema: 1, revision: 0, items: [] });
    const { container } = render(<CampaignOccasion value={undefined} onChange={vi.fn()} />);
    await waitFor(() => expect(occasionsApi.readOccasions).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the date line', () => {
  it('draws a bar per campaign and flags the one outside the occasion', () => {
    render(<DateLine occasion={BLACK_FRIDAY} today="2026-11-28" campaigns={[
      row('01JQ00000000000000000000AA', 'BF top bar', { published_at: '2026-11-19 10:00:00', starts_at: '2026-11-20 00:00', ends_at: '2026-12-02 00:00' }),
      row('01JQ00000000000000000000AB', 'Coming soon teaser', { starts_at: '2026-11-10 00:00', ends_at: '2026-11-20 00:00' }),
    ]} />);
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByText('BF top bar', { selector: 'bdi' })).toBeInTheDocument();
    expect(rows[0].querySelector('.wconvert-dateline__bar:not(.is-draft)')).toHaveStyle({ insetInlineStart: '0%', inlineSize: '100%' });
    expect(within(rows[1]).getByText('Coming soon teaser. Nov 10 – 19. Shows before the occasion')).toBeInTheDocument();
    expect(rows[1].querySelector('.wconvert-dateline__bar')).toBeNull();
    expect(screen.getByText('Shows outside the occasion')).toBeInTheDocument();
  });
});
