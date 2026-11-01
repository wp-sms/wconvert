import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OptinSummary } from '../../resources/admin/src/optins/api';
import { actionFor, checklistOf, type Milestones } from '../../resources/admin/src/optins/checklist';

/**
 * The getting-started checklist on Campaigns (ADR 0176; approved prototype
 * claude.ai/artifact/7kfMUDZUzGU3rbrxADFEcs): three steps read from the
 * milestones and the list, one button on the current step, and a per-user
 * "hidden" flag written by × and by "You're all set".
 */
const api = vi.hoisted(() => ({ readMilestones: vi.fn(), hideChecklist: vi.fn() }));
vi.mock('../../resources/admin/src/optins/gettingStartedApi', () => api);

const { GettingStarted, useChecklist } = await import('../../resources/admin/src/optins/GettingStarted');

const NONE: Milestones = { first_publish: null, first_impression: null, first_conversion: null };
const row = (id: string, overrides: Partial<OptinSummary> = {}): OptinSummary => ({
  id, name: `Campaign ${id}`, goal: 'grow_email_list', parent_id: null, published_at: null, deleted_at: null,
  has_unpublished_changes: false, suspended: null, arms: [], occasion: null, display_type: 'popup', starts_at: null, ends_at: null,
  ...overrides,
});
const never = () => false;
const states = (rows: OptinSummary[], m: Milestones, countsNothing = never) => checklistOf(rows, m, countsNothing).steps.map((s) => s.state);

beforeEach(() => {
  vi.clearAllMocks();
  window.wconvertAdmin = { homeUrl: 'https://shop.example/' } as typeof window.wconvertAdmin;
  api.hideChecklist.mockResolvedValue({ hidden: true });
});

describe('the steps, from what the site records', () => {
  it('starts on Create with nothing on the site', () => {
    expect(states([], NONE)).toEqual(['current', 'todo', 'todo']);
  });

  it('moves to Publish once any campaign exists, and a deleted one does not count', () => {
    expect(states([row('A')], NONE)).toEqual(['done', 'current', 'todo']);
    expect(states([row('A', { deleted_at: '2026-10-01 00:00:00' })], NONE)).toEqual(['current', 'todo', 'todo']);
  });

  it('reads Publish from first_publish, so unpublishing later does not undo it', () => {
    expect(states([row('A')], { ...NONE, first_publish: '2026-10-31' })).toEqual(['done', 'done', 'current']);
  });

  it('is all set at the first lead', () => {
    const checklist = checklistOf([row('A')], { first_publish: '2026-10-31', first_impression: '2026-10-31', first_conversion: '2026-11-01' }, never);
    expect(checklist.done).toBe(3);
    expect(checklist.allSet).toBe(true);
  });

  it('counts views instead on a site whose campaigns only show a message', () => {
    const message = (goal: string) => goal === 'show_message';
    const checklist = checklistOf([row('A', { goal: 'show_message' })], { ...NONE, first_publish: '2026-10-31', first_impression: '2026-11-01' }, message);
    expect(checklist.result).toBe('view');
    expect(checklist.allSet).toBe(true);
  });
});

describe('one button, on the current step only', () => {
  it('maps Create to the goal screen, Publish to the newest draft and the last step to the site', () => {
    expect(actionFor(checklistOf([], NONE, never), 'create', 'https://shop.example/')).toEqual({ kind: 'create' });

    const drafts = checklistOf([row('01A'), row('01C'), row('01B')], NONE, never);
    expect(actionFor(drafts, 'publish', 'https://shop.example/')).toEqual({ kind: 'edit', id: '01C' });
    expect(actionFor(drafts, 'create', 'https://shop.example/')).toBeNull();
    expect(actionFor(drafts, 'result', 'https://shop.example/')).toBeNull();

    const live = checklistOf([row('A', { published_at: '2026-10-31 09:00:00' })], { ...NONE, first_publish: '2026-10-31' }, never);
    expect(actionFor(live, 'result', 'https://shop.example/')).toEqual({ kind: 'site', url: 'https://shop.example/' });
    expect(actionFor(live, 'result', 'javascript:alert(1)')).toBeNull();
  });

  it('offers no Publish button when there is no draft to open', () => {
    const published = checklistOf([row('A', { published_at: '2026-10-31 09:00:00' })], NONE, never);
    expect(actionFor(published, 'publish', 'https://shop.example/')).toBeNull();
  });
});

function Harness({ rows, onCreate = vi.fn(), onEdit = vi.fn() }: { rows: OptinSummary[]; onCreate?: () => void; onEdit?: (id: string) => void }) {
  const view = useChecklist(rows, []);
  if (view.status !== 'shown') return <p>{view.status}</p>;
  return <GettingStarted checklist={view.checklist} onCreate={onCreate} onEdit={onEdit} onHide={view.hide} />;
}

describe('the card', () => {
  it('shows one action, opens the draft with it, and links the walkthrough on wconvert.io', async () => {
    api.readMilestones.mockResolvedValue(NONE);
    const onEdit = vi.fn();
    render(<Harness rows={[row('01A', { name: 'Welcome discount' })]} onEdit={onEdit} />);

    const card = await screen.findByRole('region', { name: 'Get your first campaign live' });
    expect(within(card).getByText('1 of 3 done')).toBeInTheDocument();
    expect(within(card).getByText('Welcome discount is saved.')).toBeInTheDocument();
    expect(within(card).getAllByRole('button').map((b) => b.textContent)).toEqual(['', 'Review & publish']);
    await userEvent.click(within(card).getByRole('button', { name: 'Review & publish' }));
    expect(onEdit).toHaveBeenCalledWith('01A');
    expect(within(card).getByRole('link', { name: /Watch: 3-min walkthrough/ }))
      .toHaveAttribute('href', 'https://wconvert.io/docs/create-your-first-campaign/#watch-the-walkthrough');
  });

  it('hides for good when × is pressed', async () => {
    api.readMilestones.mockResolvedValue(NONE);
    render(<Harness rows={[]} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Hide this checklist' }));

    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByText('hidden')).toBeInTheDocument();
    expect(api.hideChecklist).toHaveBeenCalledOnce();
  });

  it('says "You’re all set" once and writes the hidden flag while it says it', async () => {
    api.readMilestones.mockResolvedValue({ first_publish: '2026-10-31', first_impression: '2026-10-31', first_conversion: '2026-11-01' });
    render(<Harness rows={[row('A', { name: 'Welcome discount', published_at: '2026-10-31 09:00:00' })]} />);

    expect(await screen.findByRole('heading', { name: 'You’re all set' })).toBeInTheDocument();
    expect(screen.getByText('Welcome discount is live and has its first lead. This checklist won’t show next time.')).toBeInTheDocument();
    await waitFor(() => expect(api.hideChecklist).toHaveBeenCalledOnce());
    expect(screen.getByRole('heading', { name: 'You’re all set' })).toBeInTheDocument();
  });

  it('never shows to a user who hid it, and does not even ask for milestones', () => {
    window.wconvertAdmin = { checklistHidden: true } as typeof window.wconvertAdmin;
    render(<Harness rows={[]} />);

    expect(screen.getByText('hidden')).toBeInTheDocument();
    expect(api.readMilestones).not.toHaveBeenCalled();
  });

  it('steps aside when the milestones cannot be read', async () => {
    api.readMilestones.mockRejectedValue(new Error('offline'));
    render(<Harness rows={[]} />);

    expect(await screen.findByText('hidden')).toBeInTheDocument();
  });
});
