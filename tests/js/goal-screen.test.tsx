import { displayPlan } from './support/display-entry';
import { treeFixture } from './support/journey';
import { CLICK_OUTCOME } from './support/outcomes';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DOCUMENT_STYLE_ID } from '@renderer/mount';
import { ruleTypes } from './support/rule-types';

/**
 * The goal-first creation flow, and the decisions in it that are not layout.
 *
 * **The goal screen is the front door**, so it *hides* what a settings list
 * would explain (ADR 0026), and it never advertises Pro for something Pro
 * would not supply. **The server query filters on Goal only**; the second step
 * can refine those setups by Format without making it the first question
 * (CONTEXT.md, Display Type). **"Start from scratch" skips the Playbook, never
 * the Goal.** Browsing reads only. Customize creates a draft and opens the editor directly.
 */
const goals = vi.hoisted(() => ({ listGoals: vi.fn(), listPlaybooks: vi.fn(), prefill: vi.fn() }));
const catalog = vi.hoisted(() => ({ catalogStatus: vi.fn(), previewPack: vi.fn(), installPack: vi.fn(), refreshCatalog: vi.fn() }));
vi.mock('../../resources/admin/src/templates/catalog', () => catalog);
const optins = vi.hoisted(() => ({ createOptin: vi.fn() }));
const rules = vi.hoisted(() => ({ getRules: vi.fn() }));

vi.mock('../../resources/admin/src/goals/api', () => goals);
vi.mock('../../resources/admin/src/optins/api', () => optins);
vi.mock('../../resources/admin/src/builder/api', async (original) => ({ ...(await original<typeof import('../../resources/admin/src/builder/api')>()), ...rules }));

const { GoalScreen } = await import('../../resources/admin/src/goals/GoalScreen');

/**
 * Three Goals in the three states, as the server resolves them for one
 * install. `recover_cart` is `unavailable` here because the site has no store
 * — which is `unavailable` beating `locked`, already decided in PHP.
 */
const GOALS = [
  {
    id: 'grow_email_list',
    label: 'Grow my email list',
    description: 'Capture email addresses.',
    needs_a_capture: false,
    grows_a_list: false, outcome: CLICK_OUTCOME,
    headline_kind: 'conversion',
    tier: 'free',
    availability: 'ready' as const,
  },
  {
    id: 'promote_offer',
    label: 'Promote a sale or offer',
    description: 'Send visitors to an offer.',
    needs_a_capture: false,
    grows_a_list: false, outcome: CLICK_OUTCOME,
    headline_kind: 'conversion',
    tier: 'pro',
    availability: 'locked' as const,
  },
  {
    id: 'recover_cart',
    label: 'Bring shoppers back to their cart',
    description: 'Show shoppers the way back.',
    needs_a_capture: false,
    grows_a_list: false, outcome: CLICK_OUTCOME,
    headline_kind: 'conversion',
    tier: 'pro',
    availability: 'unavailable' as const,
  },
];

const PLAYBOOK = {
  id: 'welcome-discount',
  name: 'Welcome discount',
  goal: 'grow_email_list',
  template_id: 'centred-card',
  display_type: 'popup',
  copy: {},
  rules: [],
  targeting: {},
  destination_hint: {},
  setup: { display_type: 'popup', display_rules: displayPlan([{ type: 'time_on_page', seconds: 8 }]), targeting: {} },
  notes: 'A first-order discount is the highest-converting trade there is.',
  /**
   * **The design this Playbook would prefill, with its words already in it.**
   *
   * Composed by `Prefill` on the server, which is the whole reason it travels:
   * binding `copy` to [[Slot Role]]s is the one thing that must not have two
   * implementations, so the chooser draws exactly what creating the draft would store.
   */
  template: {
    tokens: { bg: '#ffffff' },
    tree: treeFixture({
      steps: [
        {
          type: 'stack',
          children: [
            { type: 'heading', role: 'headline', text: 'Ten percent off your first order' },
            { type: 'field', name: 'email', label: 'Email address' },
            { type: 'button', role: 'cta_label', label: 'Send my code', action: 'submit' },
          ],
        },
        { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Done' }] },
      ],
    }),
  },
};

const DRAFT = {
  name: 'Welcome discount',
  goal: 'grow_email_list',
  config: {
    playbook_id: 'welcome-discount',
    template_id: 'centred-card',
    template: {
      tokens: { bg: '#ffffff' },
      tree: treeFixture({
        steps: [
          {
            type: 'stack',
            children: [{ type: 'heading', role: 'headline', text: 'Ten percent off your first order' }],
          },
        ],
      }),
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  document.getElementById(DOCUMENT_STYLE_ID)?.remove();
  goals.listGoals.mockResolvedValue(GOALS);
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK]);
  goals.prefill.mockResolvedValue(DRAFT);
  rules.getRules.mockResolvedValue(ruleTypes());
  optins.createOptin.mockResolvedValue({ id: '01JQZK8N3M4P5Q6R7S8T9V0W1X' });
});

const pickGoal = async () => userEvent.click(await screen.findByRole('button', { name: 'Choose' }));
const customize = async () => userEvent.click(await screen.findByRole('button', { name: 'Use this setup' }));
const unloadPrevented = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('a goal then a draft', () => {
  it('preserves ready, locked and unavailable Goal semantics', async () => {
    render(<GoalScreen onCreated={vi.fn()} />);
    await screen.findByText('Grow my email list');
    expect(screen.getByText('Promote a sale or offer')).toBeInTheDocument();
    expect(screen.getByText(/Available with/)).toBeInTheDocument();
    expect(screen.queryByText('Bring shoppers back to their cart')).not.toBeInTheDocument();
    expect(screen.getByText('Choice 1 of 2')).toBeInTheDocument();
  });

  it('keeps loading separate from an empty Goal registry and offers retry on failure', async () => {
    goals.listGoals.mockRejectedValueOnce(new Error('Goals unavailable.'));
    render(<GoalScreen onCreated={vi.fn()} />);
    await screen.findByText('Goals unavailable.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading goals' }));
    expect(await screen.findByText('Grow my email list')).toBeInTheDocument();
    expect(screen.queryByText('Goals unavailable.')).not.toBeInTheDocument();
  });

  it('explains a successfully read empty Goal registry', async () => {
    goals.listGoals.mockResolvedValue([]);
    render(<GoalScreen onCreated={vi.fn()} />);
    expect(await screen.findByText('No goals available')).toBeInTheDocument();
  });

  it('filters starting points on the selected Goal and writes nothing while browsing', async () => {
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await screen.findByText('Welcome discount');
    expect(goals.listPlaybooks).toHaveBeenCalledWith(GOALS[0].id);
    expect(screen.getByText('Choice 2 of 2')).toBeInTheDocument();
    expect(optins.createOptin).not.toHaveBeenCalled();
    expect(goals.prefill).not.toHaveBeenCalled();
    expect(screen.getByText('Nothing goes live until you publish.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All formats' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Popup', { selector: '[data-slot="badge"]' })).toBeVisible();
  });

  it('labels every setup with its format and filters the goal-scoped choices', async () => {
    const inline = { ...PLAYBOOK, id: 'inline-signup', name: 'Inline signup', display_type: 'inline',
      setup: { ...PLAYBOOK.setup, display_type: 'inline' } };
    goals.listPlaybooks.mockResolvedValue([PLAYBOOK, inline]);
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    const popupCard = (await screen.findByText('Welcome discount')).closest('li')!;
    const inlineCard = screen.getByText('Inline signup').closest('li')!;
    expect(within(popupCard).getByText('Popup', { selector: '[data-slot="badge"]' })).toBeVisible();
    expect(within(inlineCard).getByText('Inline form', { selector: '[data-slot="badge"]' })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Inline form' }));
    expect(screen.queryByText('Welcome discount')).not.toBeInTheDocument();
    expect(screen.getByText('Inline signup')).toBeVisible();
    expect(goals.listPlaybooks).toHaveBeenCalledTimes(1);
    expect(goals.prefill).not.toHaveBeenCalled();
  });

  it('keeps the real design preview and makes the long rationale optional', async () => {
    const { container } = render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await screen.findByText('Welcome discount');
    await waitFor(() => expect(container.querySelectorAll('.wconvert-gallery__card .wconvert-preview')).toHaveLength(1));
    expect(screen.queryByText(PLAYBOOK.notes)).not.toBeInTheDocument();
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
    const details = screen.getByRole('button', { name: 'Setup details for Welcome discount' });
    await userEvent.click(details);
    expect(screen.getByText(PLAYBOOK.notes)).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Welcome discount' })).toBeVisible();
    expect(screen.getByText('Before publishing:')).toBeVisible();
    expect(optins.createOptin).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(details).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the server recommendation without adding another choice step', async () => {
    goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK, recommendation: 'Recommended for stores' }]);
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    expect(await screen.findByText('Recommended for stores')).toBeVisible();
    await customize();
    await waitFor(() => expect(optins.createOptin).toHaveBeenCalledExactlyOnceWith(DRAFT.name, DRAFT.goal, DRAFT.config));
  });

  it('creates exactly the prefilled draft and hands it straight to the editor', async () => {
    const created = vi.fn();
    render(<GoalScreen onCreated={created} />);
    await pickGoal();
    await customize();
    await waitFor(() => expect(created).toHaveBeenCalledWith('01JQZK8N3M4P5Q6R7S8T9V0W1X'));
    expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, PLAYBOOK.id);
    expect(optins.createOptin).toHaveBeenCalledExactlyOnceWith(DRAFT.name, DRAFT.goal, DRAFT.config);
    expect(screen.queryByRole('button', { name: 'Create this Campaign' })).not.toBeInTheDocument();
    expect(screen.queryByText('Step 3 of 3')).not.toBeInTheDocument();
  });

  it('creates a blank draft under the Goal already chosen', async () => {
    const draft = { name: GOALS[0].label, goal: GOALS[0].id, config: { rules: [] } };
    goals.prefill.mockResolvedValue(draft);
    const created = vi.fn();
    render(<GoalScreen onCreated={created} />);
    await pickGoal();
    await userEvent.click(screen.getByRole('button', { name: 'Start with a blank draft' }));
    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, undefined);
    expect(optins.createOptin).toHaveBeenCalledWith(draft.name, draft.goal, draft.config);
  });

  it('offers a blank draft when this Goal has no starting points', async () => {
    goals.listPlaybooks.mockResolvedValue([]);
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    expect(await screen.findByText('No campaign setups available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start with a blank draft' })).toBeEnabled();
  });

  it('identifies a missing design instead of leaving an endless preview skeleton', async () => {
    goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK, template: undefined }]);
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    expect(await screen.findByText(/This design is not available on this site/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this setup' })).toBeEnabled();
  });

  it('guards creation paths, Back, and leaving the page throughout prefill and POST', async () => {
    let finishPrefill!: (draft: unknown) => void, finishCreate!: (draft: unknown) => void;
    goals.prefill.mockReturnValue(new Promise(resolve => { finishPrefill = resolve; }));
    optins.createOptin.mockReturnValue(new Promise(resolve => { finishCreate = resolve; }));
    const busy = vi.fn();
    render(<GoalScreen onCreated={vi.fn()} onBusyChange={busy} />);
    expect(unloadPrevented()).toBe(false);
    await pickGoal(); await customize();
    expect(screen.getByRole('button', { name: 'Creating draft…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start with a blank draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choose a different goal' })).toBeDisabled();
    expect(busy).toHaveBeenLastCalledWith(true);
    expect(unloadPrevented()).toBe(true);
    await act(async () => finishPrefill(DRAFT));
    expect(screen.getByRole('button', { name: 'Creating draft…' })).toBeDisabled();
    expect(unloadPrevented()).toBe(true);
    await act(async () => finishCreate({ id: 'created' }));
    expect(busy).toHaveBeenLastCalledWith(false);
    expect(unloadPrevented()).toBe(false);
  });

  it('suppresses duplicate same-tick start events', async () => {
    goals.prefill.mockReturnValue(new Promise(() => undefined));
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    const button = await screen.findByRole('button', { name: 'Use this setup' });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(goals.prefill).toHaveBeenCalledTimes(1);
  });

  it('retries a failed prefill without claiming an Optin was created', async () => {
    goals.prefill.mockRejectedValueOnce(new Error('Campaign setup unavailable.'));
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal(); await customize();
    await screen.findByText('Campaign setup unavailable.');
    expect(optins.createOptin).not.toHaveBeenCalled();
    expect(screen.queryByText(/Draft creation could not be confirmed/)).not.toBeInTheDocument();
    await customize();
    await waitFor(() => expect(optins.createOptin).toHaveBeenCalledTimes(1));
  });

  it('does not automatically retry a possibly committed POST', async () => {
    optins.createOptin.mockRejectedValueOnce(new Error('Network interrupted.'));
    const created = vi.fn(), check = vi.fn();
    render(<GoalScreen onCreated={created} onCheckOptins={check} />); await pickGoal(); await customize();
    await screen.findByText(/Draft creation could not be confirmed/);
    expect(unloadPrevented()).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Check Campaigns' }));
    expect(check).toHaveBeenCalledOnce();
    expect(optins.createOptin).toHaveBeenCalledTimes(1);
    expect(created).not.toHaveBeenCalled();
  });

  it('discards prefill after the flow closes, before issuing any POST', async () => {
    let finish!: (draft: unknown) => void;
    goals.prefill.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { unmount } = render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal(); await customize();
    expect(unloadPrevented()).toBe(true);
    unmount();
    expect(unloadPrevented()).toBe(false);
    await act(async () => finish(DRAFT));
    expect(optins.createOptin).not.toHaveBeenCalled();
  });

  it('does not reopen the editor after the creation flow has unmounted', async () => {
    let finish!: (draft: unknown) => void;
    optins.createOptin.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const created = vi.fn(), { unmount } = render(<GoalScreen onCreated={created} />);
    await pickGoal(); await customize();
    await waitFor(() => expect(optins.createOptin).toHaveBeenCalledTimes(1));
    unmount(); await act(async () => finish({ id: 'created' }));
    expect(created).not.toHaveBeenCalled();
  });

  it('discards an abandoned Goal’s late starting points', async () => {
    let old!: (entries: unknown) => void;
    goals.listPlaybooks.mockReturnValueOnce(new Promise(resolve => { old = resolve; }));
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    expect(await screen.findByRole('status')).toHaveTextContent('Loading');
    await userEvent.click(screen.getByRole('button', { name: 'Choose a different goal' }));
    await pickGoal(); await screen.findByText('Welcome discount');
    await act(async () => old([{ ...PLAYBOOK, name: 'Abandoned result' }]));
    expect(screen.queryByText('Abandoned result')).not.toBeInTheDocument();
  });

  it('retries a failed starting-point read on the same selected Goal', async () => {
    goals.listPlaybooks.mockRejectedValueOnce(new Error('Campaign setups unavailable.'));
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    await screen.findByText('Campaign setups unavailable.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading campaign setups' }));
    await screen.findByText('Welcome discount');
    expect(goals.listPlaybooks).toHaveBeenLastCalledWith(GOALS[0].id);
  });

  it('uses resolved setup rules instead of raw authored rules for timing', async () => {
    goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK, rules: [{ type: 'exit_intent' }],
      setup: { ...PLAYBOOK.setup, display_rules: displayPlan([{ type: 'time_on_page', seconds: 15, degraded_from: 'exit_intent' }]) } }]);
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    expect(await screen.findByText(/after_a_read/)).toBeInTheDocument();
    expect(screen.queryByText(/exit_intent/)).not.toBeInTheDocument();
  });

  it('describes repeat display using the actual design action and orders audience before timing', async () => {
    goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK,
      template: { ...PLAYBOOK.template, tree: treeFixture({ steps: [{ type: 'stack', children: [
        { type: 'button', label: 'View the offer', action: 'link', href: '/offer' },
      ] }] }) },
      setup: { ...PLAYBOOK.setup, display_rules: displayPlan([{ type: 'time_on_page', seconds: 8 }], [{ type: 'logged_in', value: false }]), frequency: { cooldownDays: 2 } },
    }]);
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    await userEvent.click(await screen.findByRole('button', { name: 'Setup details for Welcome discount' }));
    expect(await screen.findByText(/click the main button/)).toBeInTheDocument();
    expect(screen.queryByText(/submit the form/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Counts', 'Visitor action', 'Format', 'Pages', 'Audience', 'When it appears', 'Schedule & frequency',
    ]);
  });

  it('names known page sets from the site vocabulary without claiming a count of pages', async () => {
    const vocabulary = ruleTypes();
    const contentType = vocabulary.targeting.find((entry) => entry.type === 'singular')!;
    contentType.label = 'Any single item of a type';
    contentType.params.value.options = [{ value: 'post', label: 'Blog posts' }];
    const path = vocabulary.targeting.find((entry) => entry.type === 'url')!;
    path.label = 'A URL path';
    rules.getRules.mockResolvedValue(vocabulary);
    goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK, setup: { ...PLAYBOOK.setup,
      targeting: { include: [{ type: 'singular', value: 'post' }], exclude: [{ type: 'url', value: '/private/*' }] },
    } }]);
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    await userEvent.click(await screen.findByRole('button', { name: 'Setup details for Welcome discount' }));
    expect(await screen.findByText('Any single item of a type: Blog posts, except A URL path: /private/*')).toBeInTheDocument();
    expect(screen.queryByText(/Matches 1 page rule/)).not.toBeInTheDocument();
  });

  it('keeps a page-rule count when a stored object ID needs a separate lookup', async () => {
    goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK, setup: { ...PLAYBOOK.setup,
      targeting: { include: [{ type: 'post', value: '42' }] },
    } }]);
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    await userEvent.click(await screen.findByRole('button', { name: 'Setup details for Welcome discount' }));
    expect(await screen.findByText('Matches 1 page rule')).toBeInTheDocument();
    expect(screen.queryByText(/42/)).not.toBeInTheDocument();
  });

  it('allows creation and retry when optional setup descriptions cannot load', async () => {
    rules.getRules.mockRejectedValueOnce(new Error('Rules unavailable.'));
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    await screen.findByText(/Setup details could not be loaded/);
    expect(screen.getByRole('button', { name: 'Use this setup' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Retry setup details' }));
    expect(await screen.findByText(/time_on_page 8/)).toBeInTheDocument();
  });

  it('makes inline placement work visible before creating the draft', async () => {
    goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK, display_type: 'inline', setup: { ...PLAYBOOK.setup, display_type: 'inline' } }]);
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    expect(await screen.findByText('Inside the page')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Setup details for Welcome discount' }));
    expect(screen.getByText('At its block or shortcode, when page and visitor rules allow it.')).toBeInTheDocument();
    expect(screen.getByText('Add its block or shortcode to the page where it should appear.')).toBeInTheDocument();
  });
});


it('filters installed starting points by collection and creates only the chosen prepared draft', async () => {
  const downloaded = { ...PLAYBOOK, id: 'pack-hash-welcome', collection: { id: 'store', name: 'Store collection', version: '1.1.0' } };
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK, downloaded]);
  render(<GoalScreen onCreated={vi.fn()} />);
  await pickGoal();
  await screen.findByText('Store collection', { selector: 'option' });
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Collection' }), 'store');
  expect(screen.getAllByRole('button', { name: 'Use this setup' })).toHaveLength(1);
  expect(goals.prefill).not.toHaveBeenCalled();
  expect(optins.createOptin).not.toHaveBeenCalled();
  await customize();
  await waitFor(() => expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, downloaded.id));
  expect(optins.createOptin).toHaveBeenCalledWith(DRAFT.name, DRAFT.goal, DRAFT.config);
});

it('recovers when collection and format filters have no setup in common', async () => {
  const downloaded = { ...PLAYBOOK, id: 'pack-inline', name: 'Pack inline', display_type: 'inline',
    setup: { ...PLAYBOOK.setup, display_type: 'inline' }, collection: { id: 'store', name: 'Store collection', version: '1.1.0' } };
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK, downloaded]);
  render(<GoalScreen onCreated={vi.fn()} />);
  await pickGoal();
  await userEvent.click(screen.getByRole('button', { name: 'Inline form' }));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Collection' }), 'bundled');
  expect(screen.getByText('No campaign setups match')).toBeVisible();
  expect(screen.getByText('Try another search, format or collection.')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getAllByRole('button', { name: 'Use this setup' })).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'All formats' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('combobox', { name: 'Collection' })).toHaveValue('all');
});

it('combines search with collection and format filters, and removes each independently', async () => {
  const collection = { id: 'store', name: 'Store collection', version: '1.0' };
  goals.listPlaybooks.mockResolvedValue([
    PLAYBOOK,
    { ...PLAYBOOK, id: 'inline', name: 'Inline welcome', collection, setup: { ...PLAYBOOK.setup, display_type: 'inline' } },
    { ...PLAYBOOK, id: 'seasonal', name: 'Seasonal offer', notes: 'A seasonal campaign', collection },
  ]);
  render(<GoalScreen onCreated={vi.fn()} />);
  await pickGoal();
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search campaign setups' }), '  WELCOME  ');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Collection' }), 'store');
  expect(screen.getByText('1 of 3 campaign setups')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Popup' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Inline form' }));
  expect(screen.getByRole('button', { name: 'Inline form' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Inline welcome')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Inline form' }));
  await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Store collection' }));
  expect(screen.getByText('2 of 3 campaign setups')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByText('3 of 3 campaign setups')).toBeVisible();
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(goals.listPlaybooks).toHaveBeenCalledTimes(1);
  expect(goals.prefill).not.toHaveBeenCalled();
  expect(optins.createOptin).not.toHaveBeenCalled();
});

it('clears a previous search when switching goals', async () => {
  render(<GoalScreen onCreated={vi.fn()} />);
  await pickGoal();
  await userEvent.type(screen.getByRole('searchbox'), 'nothing matches');
  expect(screen.getByText('No campaign setups match')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Choose a different goal' }));
  await pickGoal();
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(await screen.findByRole('button', { name: 'Use this setup' })).toBeVisible();
});

it('installs a pack from creation, then returns to its starting points without creating a draft', async () => {
  const pack = { id: 'store', name: 'Store collection', description: 'Store starts', version: '1.1.0', installed_version: null, state: 'available' };
  const status = { configured: true, source: 'https://example.org/catalog', checked_at: null, packs: [pack] };
  catalog.catalogStatus.mockResolvedValue(status);
  catalog.previewPack.mockResolvedValue({ id: 'store', name: pack.name, version: pack.version, digest: 'abc', templates: [{ ...PLAYBOOK.template, id: 'pack-design', name: 'Welcome design', display_type: 'popup' }], starting_points: [{ id: 'pack-start', name: 'Welcome discount', goal: GOALS[0].id, goal_label: GOALS[0].label, template_id: 'pack-design' }] });
  catalog.installPack.mockResolvedValue({ ...status, packs: [{ ...pack, installed_version: '1.1.0', state: 'installed' }] });
  goals.listPlaybooks.mockResolvedValueOnce([PLAYBOOK]).mockResolvedValue([{ ...PLAYBOOK, id: 'pack-start', collection: { id: 'store', name: pack.name, version: pack.version } }]);
  render(<GoalScreen onCreated={vi.fn()} />);
  await pickGoal();
  await userEvent.type(screen.getByRole('searchbox'), 'nothing matches');
  await userEvent.click(await screen.findByRole('button', { name: 'Browse template packs' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Preview Store collection' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Install pack' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Choose a campaign setup' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('combobox', { name: 'Collection' })).toHaveValue('store');
  expect(screen.getByRole('combobox', { name: 'Collection' })).toHaveFocus();
  expect(screen.getByRole('searchbox')).toHaveValue('');
  await screen.findByRole('button', { name: 'Use this setup' });
  expect(optins.createOptin).not.toHaveBeenCalled();
  expect(goals.prefill).not.toHaveBeenCalled();
});
