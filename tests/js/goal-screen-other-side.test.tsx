import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { displayPlan } from './support/display-entry';
import { ruleTypes } from './support/rule-types';
import { GOALS } from './support/goals';
import type { Template } from '@renderer/types';

/** Step 2's "Works with this goal": another Goal's setups, converted on the way in (ADR 0163). */
const goals = vi.hoisted(() => ({ listGoals: vi.fn(), listPlaybooks: vi.fn(), prefill: vi.fn(), previewPlaybooks: vi.fn() }));
const catalog = vi.hoisted(() => ({ catalogStatus: vi.fn(), refreshCatalog: vi.fn(), setCatalogConsent: vi.fn(), installSetup: vi.fn(), installDesign: vi.fn(), previewDesign: vi.fn() }));
vi.mock('../../resources/admin/src/templates/catalog', () => catalog);
const picker = vi.hoisted(() => ({ pickerData: vi.fn(), savePreferences: vi.fn(), saveOccasions: vi.fn() }));
vi.mock('../../resources/admin/src/discovery/api', () => picker);
const optins = vi.hoisted(() => ({ createOptin: vi.fn() }));
const rules = vi.hoisted(() => ({ getRules: vi.fn() }));
vi.mock('../../resources/admin/src/destinations/api', () => ({ readDestinations: vi.fn().mockRejectedValue(new Error('not needed')) }));
vi.mock('../../resources/admin/src/goals/api', () => goals);
vi.mock('../../resources/admin/src/optins/api', () => optins);
vi.mock('../../resources/admin/src/builder/api', async (original) => ({ ...(await original<typeof import('../../resources/admin/src/builder/api')>()), ...rules }));
const { GoalScreen } = await import('../../resources/admin/src/goals/GoalScreen');

const OFFER = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/offer-receipt.json'), 'utf8')
  .replace('"action": "link"', '"action": "link", "href": "https://shop.test/"')) as Template;
const playbook = (id: string, goal: string) => ({ id, name: id === 'black-friday' ? 'Black Friday code' : 'Newsletter', goal, template_id: 'offer-receipt', display_type: 'popup',
  copy: {}, rules: [], targeting: {}, destination_hint: {}, notes: '', template: { tree: OFFER.tree, tokens: OFFER.tokens },
  setup: { display_type: 'popup', display_rules: displayPlan([{ type: 'page_load' }]), targeting: {} } });

beforeEach(() => {
  vi.clearAllMocks();
  picker.pickerData.mockResolvedValue({ schema: 1, today: '2026-11-06', timezone: 'UTC', collections: [], preferences: { schema: 1, revision: 0, saved: [], hidden: [], events: [], businesses: [], markets: [] }, occasions: { schema: 1, revision: 0, items: [] } });
  goals.previewPlaybooks.mockResolvedValue({ entries: [] });
  goals.listGoals.mockResolvedValue(GOALS);
  goals.listPlaybooks.mockImplementation((goal: string) => Promise.resolve(goal === 'promote_offer' ? [playbook('black-friday', 'promote_offer')] : [playbook('newsletter', goal)]));
  goals.prefill.mockImplementation((goal: string, id: string) => Promise.resolve({ name: 'Black Friday code', goal, config: { playbook_id: id, display_rules: displayPlan([{ type: 'page_load' }]), template_id: 'offer-receipt', template: { tree: OFFER.tree, tokens: OFFER.tokens } } }));
  rules.getRules.mockResolvedValue(ruleTypes());
  optins.createOptin.mockResolvedValue({ id: '01JQZK8N3M4P5Q6R7S8T9V0W1X' });
});

describe('setups that work with this goal', () => {
  it('offers an offer setup to an email list with its form added, and keeps the email goal', async () => {
    const onCreated = vi.fn();
    render(<GoalScreen onCreated={onCreated} />);
    const card = (await screen.findByText('Grow my email list')).closest('li, article, [data-choice]') as HTMLElement;
    await userEvent.click(within(card).getAllByRole('button')[0]);
    const group = within(await screen.findByRole('region', { name: 'Works with this goal' }));
    expect(group.getByText('Email form added')).toBeInTheDocument();
    await userEvent.click(group.getByRole('button', { name: 'Use this setup' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(goals.prefill).toHaveBeenCalledWith('promote_offer', 'black-friday');
    const [, goal, config] = optins.createOptin.mock.calls[0] as [string, string, { template: Template; display_rules: unknown }];
    expect(goal).toBe('grow_email_list');
    expect(config.template.tree.submissions).toHaveLength(1);
    expect(config.display_rules).toEqual(displayPlan([{ type: 'page_load' }]));
  });
});
