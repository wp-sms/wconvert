import { CAPTURE_OUTCOME } from './support/outcomes';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ruleTypes } from './support/rule-types';
import { editorHref } from '../../resources/admin/src/nav';

const api = vi.hoisted(() => ({ listGoals: vi.fn(), listPlaybooks: vi.fn(), prefill: vi.fn(), createOptin: vi.fn(), getRules: vi.fn() }));
vi.mock('../../resources/admin/src/goals/api', () => ({ listGoals: api.listGoals, listPlaybooks: api.listPlaybooks, prefill: api.prefill }));
vi.mock('../../resources/admin/src/optins/api', () => ({ createOptin: api.createOptin }));
vi.mock('../../resources/admin/src/builder/api', async (original) => ({ ...(await original<typeof import('../../resources/admin/src/builder/api')>()), getRules: api.getRules }));
vi.mock('../../resources/admin/src/stats/Dashboard', () => ({ Dashboard: () => <p>Report content</p> }));
vi.mock('../../resources/admin/src/leads/LeadLog', () => ({ LeadLog: () => <p>Capture history</p> }));
vi.mock('../../resources/admin/src/destinations/Destinations', () => ({ Destinations: () => <p>Destinations</p> }));
vi.mock('../../resources/admin/src/optins/SiteAllowance', () => ({ SiteAllowance: () => null }));
vi.mock('../../resources/admin/src/optins/OptinList', () => ({ OptinList: () => <p>Campaign index</p> }));
// Exercise App AND the real lazy wrapper with the real creation component.
// The destination editor reports unsaved work so creation cleanup cannot erase it.
vi.mock('../../resources/admin/src/builder/deferred', async () => ({
  GoalScreen: (await import('../../resources/admin/src/goals/GoalScreen')).GoalScreen,
  OptinBuilder: ({ onEditingStateChange }: { onEditingStateChange: (state: { dirty: boolean; busy: boolean }) => void }) => {
    useEffect(() => onEditingStateChange({ dirty: true, busy: false }), [onEditingStateChange]);
    return <p>New draft editor</p>;
  },
}));
const { App } = await import('../../resources/admin/src/App');
const ID = '01JQZK8N3M4P5Q6R7S8T9V0W1X';
const GOAL = { id: 'grow_email_list', label: 'Grow my email list', description: 'Capture email addresses.',
  needs_a_capture: false, grows_a_list: true, outcome: CAPTURE_OUTCOME, headline_kind: 'conversion', headline_label: 'Conversions', tier: 'free', availability: 'ready' };
const START = { id: 'welcome', name: 'Welcome', goal: GOAL.id, display_type: 'popup', notes: '', destination_hint: {} };
const DRAFT = { name: 'Welcome', goal: GOAL.id, config: {} };

beforeEach(() => {
  vi.clearAllMocks();
  window.innerWidth = 1200;
  window.history.replaceState({}, '', '/wp-admin/admin.php?page=wconvert#optins');
  api.listGoals.mockResolvedValue([GOAL]); api.listPlaybooks.mockResolvedValue([START]);
  api.prefill.mockResolvedValue(DRAFT); api.createOptin.mockResolvedValue({ id: ID }); api.getRules.mockResolvedValue(ruleTypes());
});
afterEach(() => { window.innerWidth = 1024; });
async function openCreation() {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Choose' }, { timeout: 5000 }));
  return screen.findByRole('button', { name: 'Use this setup' });
}
async function requestReports() {
  await act(async () => { window.location.hash = '#analytics'; });
}

describe('creation and its owning admin page', () => {
  it('lets the creation prompt replace the redundant page-heading band', async () => {
    await openCreation();
    expect(screen.queryByText('Your on-site forms and offers, in one place.')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Campaigns' })).toHaveClass('sr-only');
    expect(screen.getByRole('heading', { name: 'Choose a campaign setup' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'All Campaigns' }));
    expect(screen.getByText('Your on-site forms and offers, in one place.')).toBeVisible();
  });

  it('blocks outer Back and hash navigation until both prefill and creation finish', async () => {
    let prefill!: (result: unknown) => void, created!: (result: unknown) => void;
    api.prefill.mockReturnValue(new Promise(resolve => { prefill = resolve; }));
    api.createOptin.mockReturnValue(new Promise(resolve => { created = resolve; }));
    await userEvent.click(await openCreation());
    expect(screen.getByRole('button', { name: 'All Campaigns' })).toBeDisabled();
    await requestReports();
    await waitFor(() => expect(window.location.hash).toBe('#optins'));
    expect(screen.queryByText('Report content')).not.toBeInTheDocument();
    await act(async () => prefill(DRAFT));
    expect(screen.getByRole('button', { name: 'All Campaigns' })).toBeDisabled();
    await requestReports();
    await waitFor(() => expect(window.location.hash).toBe('#optins'));
    await act(async () => created({ id: ID }));
    expect(await screen.findByText('New draft editor')).toBeInTheDocument();
    expect(window.location.hash).toBe(editorHref(ID, '#optins'));
    expect(api.createOptin).toHaveBeenCalledTimes(1);
  });

  it('lets Check Optins leave creation even when already on the Optins hash', async () => {
    api.createOptin.mockRejectedValue(new Error('Connection interrupted.'));
    await userEvent.click(await openCreation());
    await userEvent.click(await screen.findByRole('button', { name: 'Check Campaigns' }));
    expect(screen.getByText('Campaign index')).toBeInTheDocument();
    expect(screen.queryByText('Choose a campaign setup')).not.toBeInTheDocument();
  });

  it('does not let creation cleanup erase the newly mounted editor guard', async () => {
    await userEvent.click(await openCreation());
    await screen.findByText('New draft editor');
    await requestReports();
    expect(await screen.findByRole('alertdialog', { name: 'Leave without saving?' })).toBeInTheDocument();
    expect(screen.getByText('New draft editor')).toBeInTheDocument();
    expect(screen.queryByText('Report content')).not.toBeInTheDocument();
  });

  it('can create a draft and open its editor on a phone', async () => {
    window.innerWidth = 390;
    await userEvent.click(await openCreation());
    expect(await screen.findByText('New draft editor')).toBeInTheDocument();
    expect(api.createOptin).toHaveBeenCalledTimes(1);
  });
});
