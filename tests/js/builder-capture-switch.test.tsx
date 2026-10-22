import { displayPlan } from './support/display-entry';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { ruleTypes } from './support/rule-types';
import { GOALS } from './support/goals';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';

/**
 * The Contact form switch in the editor (ADR 0163): one box for every way in,
 * applied as one Undo step that carries the Goal, saved in the one PATCH, and a
 * copy where the Goal is fixed.
 */
const builder = vi.hoisted(() => ({
  getOptin: vi.fn(),
  getRules: vi.fn(),
  saveOptin: vi.fn(),
  getThemeTokens: vi.fn(),
}));

const templates = vi.hoisted(() => ({ listTemplates: vi.fn(), getTemplateTrees: vi.fn() }));
const stats = vi.hoisted(() => ({ readDashboard: vi.fn() }));
const destinations = vi.hoisted(() => ({ readDestinations: vi.fn() }));
const goals = vi.hoisted(() => ({ listGoals: vi.fn(), listPlaybooks: vi.fn() }));
const copies = vi.hoisted(() => ({ createOptin: vi.fn() }));
vi.mock('../../resources/admin/src/optins/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/optins/api')>()), ...copies,
}));

vi.mock('../../resources/admin/src/builder/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/builder/api')>()),
  ...builder,
}));
vi.mock('../../resources/admin/src/templates/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/templates/api')>()),
  ...templates,
}));
vi.mock('../../resources/admin/src/stats/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/stats/api')>()),
  ...stats,
}));
vi.mock('../../resources/admin/src/destinations/api', () => destinations);
vi.mock('../../resources/admin/src/goals/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/goals/api')>()),
  ...goals,
}));

const { OptinBuilder } = await import('../../resources/admin/src/builder/OptinBuilder');

const ID = '01JQ00000000000000000000AA';
const design = (id: string) => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../resources/templates/library/${id}.json`), 'utf8')
  .replace('"action": "link"', '"action": "link", "href": "https://example.org/offer"')) as TemplateEntry;
const OFFER = design('offer-receipt');
const SIGNUP = design('centred-card');

const LABELS = {
  roles: {},
  nodes: {},
  layouts: {},
  layoutHelp: {}, layoutNotes: {},
  layoutParams: {},
  layoutParamValues: {},
  nodeParams: {},
  nodeParamValues: {},
  fields: {},
  keys: {},
  placeholders: {},
  params: {},
  tokens: {},
  tokenValues: {},
  facets: {},
  facetValues: {},
};


function optin(entry: TemplateEntry, over: Record<string, unknown> = {}) {
  return {
    can_change_goal: true, id: ID, name: 'Welcome offer', goal: entry === SIGNUP ? 'grow_email_list' : 'promote_offer',
    published_at: null, deleted_at: null, suspended: null, sibling_act: null,
    config: { display_rules: displayPlan([{ type: 'page_load' }]), template_id: entry.id, template: { tree: entry.tree, tokens: entry.tokens } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  builder.getOptin.mockResolvedValue(optin(OFFER));
  builder.getRules.mockResolvedValue(ruleTypes());
  builder.saveOptin.mockImplementation((_id: string, name: string, config: Record<string, unknown>, goal?: string) =>
    Promise.resolve({ ...optin(OFFER), name, config, ...(goal === undefined ? {} : { goal }) }));
  templates.listTemplates.mockResolvedValue({ templates: [], labels: LABELS, facets: { shape: [], captures: [], has_image: [] } });
  templates.getTemplateTrees.mockResolvedValue({ templates: [] });
  stats.readDashboard.mockResolvedValue({ from: '', to: '', days: 30, goals: [] });
  destinations.readDestinations.mockResolvedValue({ destinations: [], types: [] });
  goals.listGoals.mockResolvedValue(GOALS);
  goals.listPlaybooks.mockResolvedValue([]);
});

const formSwitch = async () => within(await screen.findByRole('region', { name: 'Contact form' }));
const tree = (config: Record<string, unknown>) => (config.template as TemplateEntry).tree;

describe('the Contact form switch', () => {
  it('adds an email form as one Undo step that also restores the goal, and saves both in one PATCH', async () => {
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);
    await userEvent.click((await formSwitch()).getByRole('radio', { name: 'Email' }));
    const box = within(await screen.findByRole('dialog', { name: 'Add an email form?' }));
    expect(box.getByText(/Gets the “Email address” field, consent and the “Get my code” button\./)).toBeInTheDocument();
    expect(box.getByText('Grow my email list')).toBeInTheDocument();
    expect(box.getByText('Undo reverts all of this.')).toBeInTheDocument();
    await userEvent.click(box.getByRole('button', { name: 'Add email form' }));

    expect((await formSwitch()).getByRole('radio', { name: 'Email' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Undo: Add email form' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(builder.saveOptin).toHaveBeenCalledTimes(1));
    const [, , saved, savedGoal] = builder.saveOptin.mock.calls[0];
    expect(savedGoal).toBe('grow_email_list');
    expect(tree(saved).submissions).toHaveLength(1);
  });

  it('takes the design and the goal back together on Undo', async () => {
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);
    await userEvent.click((await formSwitch()).getByRole('radio', { name: 'Email' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Add email form' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Undo: Add email form' }));
    expect((await formSwitch()).getByRole('radio', { name: 'None' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  });

  it('offers a Shop now button when removing a form with no link to bring back', async () => {
    vi.stubGlobal('wconvertAdmin', { offerLink: { href: 'https://shop.test/shop/', place: 'shop' } });
    onTestFinished(() => { vi.unstubAllGlobals(); });
    builder.getOptin.mockResolvedValue(optin(SIGNUP));
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);
    await userEvent.click((await formSwitch()).getByRole('radio', { name: 'None' }));
    const box = within(await screen.findByRole('dialog', { name: 'Remove the email form?' }));
    expect(box.getByRole('checkbox', { name: 'Add a “Shop now” button' })).toBeChecked();
    expect(box.getByRole('textbox', { name: 'Link' })).toHaveValue('https://shop.test/shop/');
    expect(box.getByText('Promote an offer or content')).toBeInTheDocument();
    await userEvent.click(box.getByRole('checkbox', { name: 'Add a “Shop now” button' }));
    expect(box.getByText('Show a message')).toBeInTheDocument();
  });

  it('makes a signup copy of a published campaign and leaves the original alone', async () => {
    builder.getOptin.mockResolvedValue(optin(OFFER, { can_change_goal: false, published_at: '2026-10-01 10:00:00' }));
    copies.createOptin.mockResolvedValue({ id: 'COPIED' });
    const onCreated = vi.fn();
    render(<OptinBuilder id={ID} onClose={vi.fn()} onCreated={onCreated} />);
    const control = await formSwitch();
    expect(control.getByText('Published campaigns keep their goal. The copy is a new draft.')).toBeInTheDocument();
    await userEvent.click(control.getByRole('button', { name: 'Make a signup copy' }));
    const box = within(await screen.findByRole('dialog', { name: 'Make a signup copy' }));
    await userEvent.click(box.getByRole('radio', { name: 'Ask for phone' }));
    await userEvent.click(box.getByRole('button', { name: 'Create signup copy' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('COPIED'));
    expect(copies.createOptin).toHaveBeenCalledWith('Welcome offer (signup)', 'grow_sms_list', expect.objectContaining({ template_id: OFFER.id }));
    expect(tree(copies.createOptin.mock.calls[0][2]).submissions).toHaveLength(1);
    expect(builder.saveOptin).not.toHaveBeenCalled();
  });

  it('is disabled with one plain line where the campaign cannot switch', async () => {
    builder.getOptin.mockResolvedValue(optin(SIGNUP, { goal: 'deliver_lead_magnet' }));
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);
    const control = await formSwitch();
    expect(control.getByRole('radio', { name: 'None' })).toBeDisabled();
    expect(control.getByText('A lead magnet needs the email form to deliver the file.')).toBeInTheDocument();
  });

  it('opens the same box when the form’s screen is deleted, rather than refusing', async () => {
    builder.getOptin.mockResolvedValue(optin(SIGNUP));
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);
    await formSwitch();
    await userEvent.click(screen.getByRole('button', { name: /^Actions for Details/ }));
    const item = screen.getByRole('menuitem', { name: 'Delete screen' });
    expect(item).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(item);
    expect(await screen.findByRole('dialog', { name: 'Remove the email form?' })).toBeInTheDocument();
  });
});
