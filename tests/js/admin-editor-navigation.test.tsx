import { displayPlan } from './support/display-entry';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ruleTypes } from './support/rule-types';
import type { TemplateEntry, TemplateIndex } from '../../resources/admin/src/templates/api';
import { editorHref, reportHref } from '../../resources/admin/src/nav';

const api = vi.hoisted(() => ({ getOptin: vi.fn(), getRules: vi.fn(), saveOptin: vi.fn() }));
const designs = vi.hoisted(() => ({ listTemplates: vi.fn(), getTemplateTrees: vi.fn() }));
const destinations = vi.hoisted(() => ({ readDestinations: vi.fn() }));
const goals = vi.hoisted(() => ({ listGoals: vi.fn() }));

vi.mock('../../resources/admin/src/builder/api', async (original) => ({
  ...await original<typeof import('../../resources/admin/src/builder/api')>(), ...api,
}));
vi.mock('../../resources/admin/src/templates/api', async (original) => ({
  ...await original<typeof import('../../resources/admin/src/templates/api')>(), ...designs,
}));
vi.mock('../../resources/admin/src/destinations/api', async (original) => ({
  ...await original<typeof import('../../resources/admin/src/destinations/api')>(), ...destinations,
}));
vi.mock('../../resources/admin/src/goals/api', async (original) => ({
  ...await original<typeof import('../../resources/admin/src/goals/api')>(), ...goals,
}));

// Reading-page bodies are outside this integration. App, real history, both
// confirmation dialogs, the lazy boundary and the actual editor stay real.
vi.mock('../../resources/admin/src/stats/Dashboard', () => ({ Dashboard: () => <p>Report content</p> }));
vi.mock('../../resources/admin/src/leads/LeadLog', () => ({ LeadLog: () => <p>Captured leads</p> }));
vi.mock('../../resources/admin/src/destinations/Destinations', () => ({ Destinations: () => <p>Destination routes</p> }));
vi.mock('../../resources/admin/src/optins/SiteAllowance', () => ({ SiteAllowance: () => null }));
vi.mock('../../resources/admin/src/optins/OptinList', () => ({
  OptinList: ({ onEdit }: { onEdit: (id: string) => void }) => <button onClick={() => onEdit('OPTIN1')}>Edit Welcome offer</button>,
}));

const { App } = await import('../../resources/admin/src/App');
const ENTRY = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8')) as TemplateEntry;
const INDEX: TemplateIndex = {
  templates: [{ id: ENTRY.id, name: ENTRY.name, display_type: ENTRY.display_type, tier: 'free', availability: 'ready',
    facets: { act: 'submit', captures: ['email'], shape: 'stack', has_image: false, asks_consent: false } }],
  labels: { roles: {}, nodes: {}, layouts: {}, layoutHelp: {}, layoutNotes: {}, layoutParams: {}, layoutParamValues: {}, nodeParams: {},
    nodeParamValues: {}, fields: {}, keys: {}, placeholders: {}, params: {}, tokenValues: {}, tokens: {}, facets: {}, facetValues: {} },
  facets: { shape: ['stack'], captures: ['email'], has_image: [] },
};
const REPORT = reportHref({ days: 7, goal: 'grow_email_list', optinId: 'OPTIN1' });
const EDITOR = editorHref('OPTIN1', REPORT);

function savedOptin() {
  return { id: 'OPTIN1', name: 'Welcome offer', goal: null, published_at: null, has_unpublished_changes: false,
    deleted_at: null, suspended: null, sibling_act: null,
    config: { display_rules: displayPlan([{ type: 'page_load' }]), template_id: ENTRY.id, template: { tree: ENTRY.tree, tokens: ENTRY.tokens } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.innerWidth = 1200;
  window.history.replaceState({}, '', `/wp-admin/admin.php?page=wconvert${REPORT}`);
  api.getOptin.mockResolvedValue(savedOptin());
  api.getRules.mockResolvedValue(ruleTypes());
  api.saveOptin.mockImplementation((_id: string, name: string, config: Record<string, unknown>) => Promise.resolve({ ...savedOptin(), name, config }));
  designs.listTemplates.mockResolvedValue(INDEX);
  designs.getTemplateTrees.mockResolvedValue({ templates: [ENTRY] });
  destinations.readDestinations.mockResolvedValue({ destinations: [], types: [], connections: [] });
  goals.listGoals.mockResolvedValue([]);
});

afterEach(() => { window.innerWidth = 1024; });

async function openEditor() {
  render(<App />);
  await act(async () => { window.location.hash = EDITOR; });
  // The first case imports the real deferred editor graph. Give that boundary
  // room to load when the full suite is compiling other workers concurrently.
  return screen.findByRole('textbox', { name: 'Name' }, { timeout: 5000 });
}

/** Real asynchronous history traversal; a mocked event cannot catch restoration races. */
async function back() {
  await act(async () => {
    const changed = new Promise<void>((resolve) => window.addEventListener('hashchange', () => resolve(), { once: true }));
    window.history.back();
    await changed;
  });
}

async function resize(width: number) {
  await act(async () => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
}

describe('App navigation through the real lazy editor', () => {
  it('retains unsaved work after browser Back and Keep editing, then discards through the real confirmation', async () => {
    const name = await openEditor();
    expect(screen.getByRole('button', { name: 'Back to Analytics' })).toBeInTheDocument();
    await userEvent.type(name, ' revised');
    await back();
    await screen.findByRole('alertdialog', { name: 'Leave without saving?' });
    expect(name).toHaveValue('Welcome offer revised');
    expect(api.getOptin).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(window.location.hash).toBe(EDITOR));
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(name);
    expect(name).toHaveFocus();

    await back();
    await userEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));
    await screen.findByText('Report content');
    expect(window.location.hash).toBe(REPORT);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
  });

  it('uses one confirmation for the editor Back button and returns to the exact report', async () => {
    const name = await openEditor();
    await userEvent.type(name, ' revised');
    await userEvent.click(screen.getByRole('button', { name: 'Back to Analytics' }));
    expect(await screen.findAllByRole('alertdialog')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await screen.findByText('Report content');
    expect(window.location.hash).toBe(REPORT);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('includes name edits in draft history and updates navigation dirty state on Undo', async () => {
    const name = await openEditor();
    const undo = screen.getByRole('button', { name: /^Undo/ });
    const redo = screen.getByRole('button', { name: /^Redo/ });
    expect(undo).toHaveAttribute('title', 'Undo draft edit');
    expect(redo).toHaveAttribute('title', 'Redo draft edit');
    await userEvent.type(name, ' revised');
    expect(undo).toBeEnabled();
    expect(redo).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    await userEvent.click(undo);
    expect(name).toHaveValue('Welcome offer');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Back to Analytics' }));
    await screen.findByText('Report content');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('explains mobile editing scope from the device controls before a block is selected', async () => {
    await openEditor();
    expect(screen.queryByRole('group', { name: /Headline/ })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Mobile' }));
    await userEvent.click(screen.getByRole('button', { name: 'About mobile editing' }));
    expect(screen.getByText('Editing mobile appearance. Text and blocks are shared across sizes.')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('radio', { name: 'Desktop' }));
    expect(screen.queryByRole('button', { name: 'About mobile editing' })).toBeNull();
    expect(screen.queryByText('Editing mobile appearance. Text and blocks are shared across sizes.')).toBeNull();
  });

  it('treats Escape as Keep editing and restores the previous control', async () => {
    const name = await openEditor();
    await userEvent.type(name, ' revised');
    await back();
    await screen.findByRole('alertdialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(window.location.hash).toBe(EDITOR));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(name).toHaveValue('Welcome offer revised');
    expect(name).toHaveFocus();
  });

  it('restores the current duplicate history entry when Back crosses the same editor URL twice', async () => {
    await openEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Back to Analytics' }));
    await screen.findByText('Report content');
    await act(async () => { window.location.hash = EDITOR; });
    const name = await screen.findByRole('textbox', { name: 'Name' });
    await userEvent.type(name, ' revised');
    await back();
    await screen.findByRole('alertdialog');
    await back();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(window.location.hash).toBe(EDITOR);
    const currentEntry = window.history.state;
    expect(name).toHaveValue('Welcome offer revised');
    await back();
    await userEvent.click(await screen.findByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(window.location.hash).toBe(EDITOR));
    expect(window.history.state).toEqual(currentEntry);
    expect(name).toHaveValue('Welcome offer revised');
    expect(api.getOptin).toHaveBeenCalledTimes(2);
  });

  it('discards the draft consistently when accepting another URL for the same Optin', async () => {
    const name = await openEditor();
    await userEvent.type(name, ' revised');
    const other = editorHref('OPTIN1', '#leads');
    await act(async () => { window.location.hash = other; });
    await userEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Welcome offer'));
    expect(window.location.hash).toBe(other);
    expect(screen.getByRole('button', { name: 'Back to Leads' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' another edit');
    await back();
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(window.location.hash).toBe(other));
  });

  it('keeps the same editable draft when the viewport narrows', async () => {
    const name = await openEditor();
    await userEvent.type(name, ' revised');
    await resize(600);
    expect(name).toBeInTheDocument();
    expect(name.closest('[hidden]')).toBeNull();
    expect(name.closest('[inert]')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(name);
    await resize(1200);
    expect(await screen.findByRole('textbox', { name: 'Name' })).toBe(name);
    expect(name).toHaveValue('Welcome offer revised');
    expect(api.getOptin).toHaveBeenCalledTimes(1);
  });

  it('opens the editor directly in an initially narrow viewport', async () => {
    window.innerWidth = 600;
    window.history.replaceState({}, '', `/wp-admin/admin.php?page=wconvert${EDITOR}`);
    render(<App />);
    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('Welcome offer');
    await resize(1200);
    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('Welcome offer');
    expect(api.getOptin).toHaveBeenCalledTimes(1);
  });

  it('guards the narrow editor Back button without discarding the mounted draft on Cancel', async () => {
    const name = await openEditor();
    await userEvent.type(name, ' revised');
    await resize(600);
    const backButton = screen.getByRole('button', { name: 'Back to Analytics' });
    await userEvent.click(backButton);
    await userEvent.click(await screen.findByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(window.location.hash).toBe(EDITOR));
    expect(backButton).toHaveFocus();
    await resize(1200);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(name);
    expect(name).toHaveValue('Welcome offer revised');
    await resize(600);
    await userEvent.click(screen.getByRole('button', { name: 'Back to Analytics' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));
    await screen.findByText('Report content');
    expect(window.location.hash).toBe(REPORT);
  });

  it('restores browser Back while Save draft is pending and preserves the saved editor afterwards', async () => {
    let finish!: (value: ReturnType<typeof savedOptin>) => void;
    api.saveOptin.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const name = await openEditor();
    await userEvent.type(name, ' revised');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await back();
    await waitFor(() => expect(window.location.hash).toBe(EDITOR));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(name).toBeInTheDocument();
    await act(async () => { finish({ ...savedOptin(), name: 'Welcome offer revised' }); });
    await screen.findByText('Draft saved');
    await back();
    await screen.findByText('Report content');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

it('opens display rules from analytics and returns to the same report', async () => {
  window.history.replaceState({}, '', `/wp-admin/admin.php?page=wconvert${editorHref('OPTIN1', REPORT, 'rules')}`);
  render(<App />);
  const tab = await screen.findByRole('tab', { name: 'Display rules' });
  expect(tab).toHaveAttribute('aria-selected', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Back to Analytics' }));
  await waitFor(() => expect(window.location.hash).toBe(REPORT));
});
