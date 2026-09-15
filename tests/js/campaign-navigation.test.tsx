import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ listOptins: vi.fn(), readCampaignPreviews: vi.fn(), duplicateCampaign: vi.fn() }));
vi.mock('../../resources/admin/src/optins/api', async original => ({ ...await original<typeof import('../../resources/admin/src/optins/api')>(), ...api }));
vi.mock('../../resources/admin/src/goals/api', () => ({ listGoals: async () => [] }));
vi.mock('../../resources/admin/src/stats/api', () => ({ readDashboard: async () => ({ days: 30, from: '2026-08-16', to: '2026-09-14', goals: [] }) }));
vi.mock('../../resources/admin/src/builder/lazy', () => ({ GoalScreen: () => <p>New creation flow</p>, OptinBuilder: ({ id }: { id: string }) => <p>Editing {id}</p> }));
vi.mock('../../resources/admin/src/optins/CampaignDetails', () => ({ default: () => null }));
const { App } = await import('../../resources/admin/src/App');
const ROW = { id: '01JQ00000000000000000000AA', name: 'Welcome', goal: 'grow_email_list', published_at: null, deleted_at: null, suspended: null, has_unpublished_changes: false, parent_id: null, arms: [] };
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/wp-admin/admin.php?page=wconvert#optins');
  window.innerWidth = 1200;
  api.listOptins.mockResolvedValue([ROW]);
  api.readCampaignPreviews.mockResolvedValue([]);
});

it('blocks creation and detail-editor navigation until a duplicate completes', async () => {
  let resolve!: (value: unknown) => void;
  api.duplicateCampaign.mockReturnValue(new Promise(done => { resolve = done; }));
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: /More actions/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate as draft' }));
  expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }));
  expect(screen.queryByText('New creation flow')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Welcome' }));
  expect(await screen.findByRole('button', { name: 'Open editor' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Open editor' }));
  expect(window.location.hash).toBe('#optins');
  await act(async () => { resolve({ id: 'COPY' }); });
  await waitFor(() => expect(window.location.hash).toContain('edit=COPY'));
  expect(await screen.findByText('Editing COPY')).toBeInTheDocument();
});
