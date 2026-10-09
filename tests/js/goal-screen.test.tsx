import { displayPlan } from './support/display-entry';
import { treeFixture } from './support/journey';
import { CAPTURE_OUTCOME, CLICK_OUTCOME } from './support/outcomes';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
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
const goals = vi.hoisted(() => ({ listGoals: vi.fn(), listPlaybooks: vi.fn(), prefill: vi.fn(), previewPlaybooks: vi.fn() }));
const catalog = vi.hoisted(() => ({ catalogStatus: vi.fn(), previewPack: vi.fn(), installPack: vi.fn(), refreshCatalog: vi.fn() }));
vi.mock('../../resources/admin/src/templates/catalog', () => catalog);
const picker = vi.hoisted(() => ({ pickerData: vi.fn(), savePreferences: vi.fn(), saveOccasions: vi.fn() }));
vi.mock('../../resources/admin/src/discovery/api', () => picker);
const optins = vi.hoisted(() => ({ createOptin: vi.fn() }));
const rules = vi.hoisted(() => ({ getRules: vi.fn() }));

const destinationsApi = vi.hoisted(() => ({ readDestinations: vi.fn() }));
vi.mock('../../resources/admin/src/destinations/api', () => destinationsApi);
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
  destinationsApi.readDestinations.mockRejectedValue(new Error('Not needed by this test'));
  picker.pickerData.mockResolvedValue({ schema: 1, today: '2026-11-06', timezone: 'Asia/Muscat', collections: [], preferences: { schema: 1, revision: 0, saved: [], hidden: [], events: [], businesses: [], markets: [] }, occasions: { schema: 1, revision: 0, items: [] } });
  picker.savePreferences.mockImplementation(value => Promise.resolve({ ...value, revision: value.revision + 1 }));
  goals.previewPlaybooks.mockResolvedValue({ entries: [] });
  document.getElementById(DOCUMENT_STYLE_ID)?.remove();
  goals.listGoals.mockResolvedValue(GOALS);
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK]);
  goals.prefill.mockResolvedValue(DRAFT);
  rules.getRules.mockResolvedValue(ruleTypes());
  optins.createOptin.mockResolvedValue({ id: '01JQZK8N3M4P5Q6R7S8T9V0W1X' });
});

const pickGoal = async () => userEvent.click(await screen.findByRole('button', { name: /^Choose/ }));
const inspect = async () => {
  if (!screen.queryByRole('button', { name: 'Use this setup' })) await userEvent.click(await screen.findByRole('button', { name: /Setup details for/ }));
};
const customize = async () => { await inspect(); await userEvent.click(await screen.findByRole('button', { name: 'Use this setup' })); };
const unloadPrevented = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('a goal then a draft', () => {
  it('preserves ready, locked and unavailable Goal semantics on a paid install', async () => {
    // A paid install meeting a higher rung's Goal (ADR 0116).
    window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
    onTestFinished(() => { delete window.wconvertAdmin; });
    render(<GoalScreen onCreated={vi.fn()} />);
    await screen.findByText('Grow my email list');
    expect(screen.getByText('Promote a sale or offer')).toBeInTheDocument();
    expect(screen.getByText(/Available with/)).toBeInTheDocument();
    expect(screen.queryByText('Bring shoppers back to their cart')).not.toBeInTheDocument();
    expect(screen.getByText('Choice 1 of 2')).toBeInTheDocument();
  });

  /** A free install is sold no Goal: the locked card is not drawn at all (ADR 0116). */
  it('hides a locked Goal on a free install', async () => {
    render(<GoalScreen onCreated={vi.fn()} />);
    await screen.findByText('Grow my email list');
    expect(screen.queryByText('Promote a sale or offer')).not.toBeInTheDocument();
    expect(screen.queryByText(/Available with/)).not.toBeInTheDocument();
    expect(screen.queryByText('Pro')).not.toBeInTheDocument();
  });

  it('keeps loading separate from an empty Goal registry and offers retry on failure', async () => {
    goals.listGoals.mockRejectedValueOnce(new Error('Goals unavailable.'));
    render(<GoalScreen onCreated={vi.fn()} />);
    await screen.findByText('Goals unavailable.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
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
    // The reassurance repeated on every step is gone (§8); the one scope note is on the inspector's Use this setup.
    expect(screen.queryByText(/Nothing goes live/)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All formats' })).toBeChecked();
    expect(screen.getByText('Popup', { selector: '[data-slot="badge"]' })).toBeVisible();
  });

  it('lists no setup a free install would have to buy', async () => {
    goals.listPlaybooks.mockResolvedValue([PLAYBOOK, { ...PLAYBOOK, id: 'paid-setup', name: 'Paid setup', template_id: 'paid-card', availability: 'locked' as const }]);
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await screen.findByText('Welcome discount');
    expect(screen.queryByText('Paid setup')).not.toBeInTheDocument();
    expect(screen.queryByText(/Available with/)).not.toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('radio', { name: 'Inline form' }));
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
    // One line of why, then the facts at a glance; nothing to open first.
    expect(screen.getByText(PLAYBOOK.notes)).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Welcome discount' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Have ready' })).toBeVisible();
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
    await userEvent.click(screen.getByRole('button', { name: 'Choose a design myself' }));
    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, undefined);
    expect(optins.createOptin).toHaveBeenCalledWith(draft.name, draft.goal, draft.config);
  });

  it('offers a blank draft when this Goal has no starting points', async () => {
    goals.listPlaybooks.mockResolvedValue([]);
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    expect(await screen.findByText('No campaign setups available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a design myself' })).toBeEnabled();
  });

  it('identifies a missing design instead of leaving an endless preview skeleton', async () => {
    goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK, template: undefined }]);
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    expect(await screen.findByText(/This design is not available on this site/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Setup details for/ })).toBeEnabled();
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
    expect(screen.getByRole('button', { name: 'Choose a design myself', hidden: true })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change goal', hidden: true })).toBeDisabled();
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
    await inspect();
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
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(optins.createOptin).toHaveBeenCalledTimes(1));
  });

  it('does not automatically retry a possibly committed POST', async () => {
    optins.createOptin.mockRejectedValueOnce(new Error('Network interrupted.'));
    const created = vi.fn(), check = vi.fn();
    render(<GoalScreen onCreated={created} onCheckOptins={check} />); await pickGoal(); await customize();
    await screen.findByText(/Draft creation could not be confirmed/);
    expect(screen.getByRole('button', { name: 'Use this setup' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Use this setup' }));
    expect(optins.createOptin).toHaveBeenCalledTimes(1);
    expect(unloadPrevented()).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Check campaigns' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Change goal' }));
    await pickGoal(); await screen.findByText('Welcome discount');
    await act(async () => old([{ ...PLAYBOOK, name: 'Abandoned result' }]));
    expect(screen.queryByText('Abandoned result')).not.toBeInTheDocument();
  });

  it('retries a failed starting-point read on the same selected Goal', async () => {
    goals.listPlaybooks.mockRejectedValueOnce(new Error('Campaign setups unavailable.'));
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    await screen.findByText('Campaign setups unavailable.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Welcome discount');
    expect(goals.listPlaybooks).toHaveBeenLastCalledWith(GOALS[0].id);
  });

  it('uses resolved setup rules instead of raw authored rules for timing', async () => {
    goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK, rules: [{ type: 'exit_intent' }],
      setup: { ...PLAYBOOK.setup, display_rules: displayPlan([{ type: 'time_on_page', seconds: 15, degraded_from: 'exit_intent' }]) } }]);
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    await inspect();
    expect(await screen.findByText(/After 15 seconds/)).toBeInTheDocument();
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
      'Format', 'Opens', 'Where', 'Who', 'How often', 'Counts',
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
    expect(screen.getByRole('button', { name: /Setup details for/ })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await inspect();
    expect(await screen.findByText(/After 8 seconds/)).toBeInTheDocument();
  });

  it('makes inline placement work visible before creating the draft', async () => {
    goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK, display_type: 'inline', setup: { ...PLAYBOOK.setup, display_type: 'inline' } }]);
    render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
    expect(await screen.findByText('Inline form', { selector: '[data-slot=badge]' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Setup details for Welcome discount' }));
    expect(screen.getByText('Where you place it')).toBeInTheDocument();
    expect(screen.getByText('A page to place its block or shortcode on')).toBeInTheDocument();
  });
});


it('filters installed starting points by collection and creates only the chosen prepared draft', async () => {
  const downloaded = { ...PLAYBOOK, id: 'pack-hash-welcome', collection: { id: 'store', name: 'Store collection', version: '1.1.0' } };
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK, downloaded]);
  render(<GoalScreen onCreated={vi.fn()} />);
  await pickGoal();
  await screen.findByText('Store collection', { selector: 'option' });
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Source' }), 'store');
  expect(screen.getAllByRole('button', { name: /Setup details for/ })).toHaveLength(1);
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
  await userEvent.click(screen.getByRole('radio', { name: 'Inline form' }));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Source' }), 'bundled');
  expect(screen.getByText('No campaign setups match')).toBeVisible();
  expect(screen.getByText('Try another search, business, format or collection.')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getAllByRole('button', { name: /Setup details for/ })).toHaveLength(2);
  expect(screen.getByRole('radio', { name: 'All formats' })).toBeChecked();
  expect(screen.getByRole('combobox', { name: 'Source' })).toHaveValue('all');
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
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Source' }), 'store');
  expect(screen.getByText(/1 of 3 setups/)).toBeVisible();
  expect(screen.getByRole('radio', { name: 'Popup' })).toBeDisabled();
  await userEvent.click(screen.getByRole('radio', { name: 'Inline form' }));
  expect(screen.getByRole('radio', { name: 'Inline form' })).toBeChecked();
  expect(screen.getByText('Inline welcome')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Inline form' }));
  await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Store collection' }));
  expect(screen.getByText(/2 of 3 setups/)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByText(/^3 setups$/)).toBeVisible();
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
  await userEvent.click(screen.getByRole('button', { name: 'Change goal' }));
  await pickGoal();
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(await screen.findByRole('button', { name: /Setup details for/ })).toBeVisible();
});

it('offers no template packs while no catalog is configured', async () => {
  render(<GoalScreen onCreated={vi.fn()} />);
  await pickGoal();
  await userEvent.click(await screen.findByRole('button', { name: 'More ways to browse' }));
  expect(await screen.findByRole('menuitem', { name: 'Occasions & preferences' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: 'Template packs' })).not.toBeInTheDocument();
  expect(catalog.catalogStatus).not.toHaveBeenCalled();
});

it('installs a pack from creation, then returns to its starting points without creating a draft', async () => {
  const pack = { id: 'store', name: 'Store collection', description: 'Store starts', version: '1.1.0', installed_version: null, state: 'available' };
  const status = { configured: true, source: 'https://example.org/catalog', checked_at: null, packs: [pack] };
  window.wconvertAdmin = { exportUrl: '', catalogConfigured: true };
  onTestFinished(() => { delete window.wconvertAdmin; });
  catalog.catalogStatus.mockResolvedValue(status);
  catalog.previewPack.mockResolvedValue({ id: 'store', name: pack.name, version: pack.version, digest: 'abc', templates: [{ ...PLAYBOOK.template, id: 'pack-design', name: 'Welcome design', display_type: 'popup' }], starting_points: [{ id: 'pack-start', name: 'Welcome discount', goal: GOALS[0].id, goal_label: GOALS[0].label, template_id: 'pack-design' }] });
  catalog.installPack.mockResolvedValue({ ...status, packs: [{ ...pack, installed_version: '1.1.0', state: 'installed' }] });
  goals.listPlaybooks.mockResolvedValueOnce([PLAYBOOK]).mockResolvedValue([{ ...PLAYBOOK, id: 'pack-start', collection: { id: 'store', name: pack.name, version: pack.version } }]);
  render(<GoalScreen onCreated={vi.fn()} />);
  await pickGoal();
  await userEvent.type(screen.getByRole('searchbox'), 'nothing matches');
  await userEvent.click(await screen.findByRole('button', { name: 'More ways to browse' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Template packs' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Preview Store collection' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Install pack' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Choose a campaign setup' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('combobox', { name: 'Source' })).toHaveValue('store');
  // The filter it set lives under More filters, which opens so focus can land on it.
  expect(screen.getByRole('combobox', { name: 'Source' })).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'Source' })).toHaveFocus();
  expect(screen.getByRole('searchbox')).toHaveValue('');
  await screen.findByRole('button', { name: /Setup details for/ });
  expect(optins.createOptin).not.toHaveBeenCalled();
  expect(goals.prefill).not.toHaveBeenCalled();
});
it('combines business and format filters without writing a draft', async () => {
  goals.listPlaybooks.mockResolvedValue([
    { ...PLAYBOOK, business_types: [{ id: 'stores', label: 'Stores' }] },
    { ...PLAYBOOK, id: 'service', name: 'Service newsletter', business_types: [{ id: 'services', label: 'Service businesses' }], setup: { ...PLAYBOOK.setup, display_type: 'inline' } },
  ]);
  render(<GoalScreen onCreated={vi.fn()} />);
  await userEvent.click((await screen.findAllByRole('button', { name: /^Choose/ }))[0]);
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Business' }), 'services');
  expect(screen.getAllByRole('button', { name: /Setup details for/ })).toHaveLength(1);
  expect(screen.getByText('Service newsletter')).toBeVisible();
  expect(screen.getByRole('radio', { name: 'Popup' })).toBeDisabled();
  await userEvent.click(screen.getByRole('radio', { name: 'Inline form' }));
  expect(screen.getByText('Service newsletter')).toBeVisible();
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Source' }), 'bundled');
  expect(screen.getAllByRole('button', { name: /Setup details for/ })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getAllByRole('button', { name: /Setup details for/ })).toHaveLength(2);
  expect(optins.createOptin).not.toHaveBeenCalled();
});


it('groups shared designs, keeps matching use cases reachable and creates only the chosen setup', async () => {
  const repair = { ...PLAYBOOK, id: 'repair', name: 'Repair request', notes: 'Discuss a repair', business_types: [{ id: 'services', label: 'Service businesses' }] };
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK, repair]);
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  expect(screen.getAllByRole('button', { name: /Setup details for/ })).toHaveLength(1);
  expect(screen.queryByRole('combobox', { name: /Use case for/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Setup details for Welcome discount' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Repair request' }));
  await userEvent.click(screen.getByRole('button', { name: 'Back to setups' }));
  expect(screen.getByText('Repair request', { selector: '.wconvert-gallery__card h3' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Setup details for Repair request' }));
  expect(screen.getByRole('dialog', { name: 'Repair request' })).toHaveTextContent('Discuss a repair');
  await userEvent.keyboard('{Escape}');
  expect(goals.prefill).not.toHaveBeenCalled();
  await userEvent.type(screen.getByRole('searchbox'), 'Welcome');
  expect(screen.getByText('Welcome discount', { selector: '.wconvert-gallery__card h3' })).toBeVisible();
  expect(screen.queryByRole('combobox', { name: /Use case for/ })).not.toBeInTheDocument();
  await userEvent.clear(screen.getByRole('searchbox'));
  expect(screen.getByText('Repair request', { selector: '.wconvert-gallery__card h3' })).toBeVisible();
  await customize();
  await waitFor(() => expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, repair.id));
  expect(optins.createOptin).toHaveBeenCalledOnce();
});

it('requests only visible prepared previews and creates the exact reviewed revision', async () => {
  const metadata = { ...PLAYBOOK, revision: 'reviewed-revision', design_key: 'registered:card', template: undefined, availability: 'ready' };
  goals.listPlaybooks.mockResolvedValue([metadata]);
  goals.previewPlaybooks.mockResolvedValue({ entries: [{ ...metadata, template: PLAYBOOK.template }] });
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await waitFor(() => expect(goals.previewPlaybooks).toHaveBeenCalledWith(GOALS[0].id, [PLAYBOOK.id]));
  await customize();
  expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, PLAYBOOK.id, 'reviewed-revision', undefined);
});

it('paginates 500 metadata entries without requesting all their prepared trees', async () => {
  const metadata = Array.from({ length: 500 }, (_, at) => ({ ...PLAYBOOK, id: `start-${at}`, name: `Start ${at}`, template_id: `card-${at}`, design_key: `registered:card-${at}`, revision: `revision-${at}`, template: undefined }));
  goals.listPlaybooks.mockResolvedValue(metadata);
  goals.previewPlaybooks.mockImplementation((_goal, ids: string[]) => Promise.resolve({ entries: metadata.filter(entry => ids.includes(entry.id)).map(entry => ({ ...entry, template: PLAYBOOK.template })) }));
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await screen.findByText('Page 1 of 21');
  // Twenty-four on the page, plus the one drawn on its own to start from.
  expect(screen.getAllByRole('button', { name: /Setup details for/ })).toHaveLength(24);
  expect(screen.getByRole('button', { name: 'Preview Start 0 first' })).toBeInTheDocument();
  await waitFor(() => expect(goals.previewPlaybooks).toHaveBeenCalled());
  expect(goals.previewPlaybooks.mock.calls.flatMap(call => call[1])).toHaveLength(25);
  expect(goals.previewPlaybooks.mock.calls.every(call => call[1].length <= 24)).toBe(true);
});

it('saves canonical designs through authenticated preferences and filters without writing a campaign', async () => {
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await userEvent.click(await screen.findByRole('button', { name: 'Save design: Welcome discount' }));
  await waitFor(() => expect(picker.savePreferences).toHaveBeenCalledWith(expect.objectContaining({ saved: ['registered:centred-card'], revision: 0 })));
  await userEvent.click(await screen.findByRole('checkbox', { name: /Saved designs only/ }));
  expect(screen.getByText('More filters').closest('summary')).toHaveTextContent('1 on');
  expect(screen.getByText('Welcome discount')).toBeVisible();
  expect(optins.createOptin).not.toHaveBeenCalled();
});

it('keeps collection membership exact when two use cases share a design', async () => {
  const second = { ...PLAYBOOK, id: 'unrelated-copy', name: 'Unrelated copy' };
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK, second]);
  const data = await picker.pickerData();
  picker.pickerData.mockResolvedValue({ ...data, collections: [{ id: 'useful', revision: 'r', name: 'Useful collection', description: 'Useful starts', business_types: [], markets: [], priority: 1, cover: 'reading', items: [{ setup_id: PLAYBOOK.id, stage: 'any' }] }] });
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await userEvent.click(await screen.findByRole('button', { name: /Useful collection Useful starts/ }));
  expect(screen.queryByRole('combobox', { name: /Use case for/ })).not.toBeInTheDocument();
  await customize(); expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, PLAYBOOK.id);
});

it('changes the use case inside inspection and creates the exact chosen snapshot', async () => {
  const other = { ...PLAYBOOK, id: 'guide', name: 'Practical guide', requirements: ['Have the guide URL ready'], revision: 'guide-r', prepared_revision: 'guide-prepared', template: PLAYBOOK.template };
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK, other]);
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await userEvent.click(await screen.findByRole('button', { name: 'Setup details for Welcome discount' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Mobile' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Practical guide' }));
  expect(screen.getByRole('heading', { name: 'Practical guide' })).toBeVisible();
  expect(screen.getByText('Have the guide URL ready')).toBeVisible();
  expect(screen.getByRole('radio', { name: 'Mobile' })).toBeChecked();
  await userEvent.click(screen.getByRole('button', { name: 'Use this setup' }));
  expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, 'guide', 'guide-r', undefined);
});

it('uses one collection dialog, recovers an empty filtered stage and restores its view after inspection', async () => {
  // A floating bar is a paid format; a free install is not offered it (ADR 0116).
  window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
  onTestFinished(() => { delete window.wconvertAdmin; });
  const announcement = { ...PLAYBOOK, id: 'sale-bar', name: 'Sale announcement', template_id: 'bar', setup: { ...PLAYBOOK.setup, display_type: 'floating_bar' } };
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK, announcement]);
  const data = await picker.pickerData();
  picker.pickerData.mockResolvedValue({ ...data, collections: [{ id: 'event', revision: 'r', name: 'Sale preparation', description: 'Prepare a useful sale', business_types: [], markets: [], priority: 1, cover: 'reading', items: [{ setup_id: PLAYBOOK.id, stage: 'before' }, { setup_id: announcement.id, stage: 'during' }] }] });
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await userEvent.click(await screen.findByRole('button', { name: /Sale preparation Prepare a useful sale/ }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  const dialog = screen.getByRole('dialog');
  await userEvent.click(within(dialog).getByRole('radio', { name: 'Floating bar' }));
  expect(within(dialog).getByRole('radio', { name: /Before/ })).toBeDisabled();
  expect(within(dialog).getByRole('radio', { name: /During/ })).toBeChecked();
  expect(within(dialog).getByText(/Showing a matching stage instead/)).toBeVisible();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Setup details for Sale announcement' }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Back to collection' }));
  expect(screen.getByRole('heading', { name: 'Sale preparation' })).toBeVisible();
  expect(screen.getByRole('radio', { name: /During/ })).toBeChecked();
  expect(optins.createOptin).not.toHaveBeenCalled();
});

it('compares two distinct designs, reviews one in the same dialog and returns without creating', async () => {
  const other = { ...PLAYBOOK, id: 'guide', name: 'Practical guide', template_id: 'other-card' };
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK, other]);
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Compare design: Welcome discount' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Compare design: Practical guide' }));
  await userEvent.click(screen.getByRole('button', { name: 'Compare' }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getAllByRole('region', { name: 'Design preview' })).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: 'Review setup: Practical guide' }));
  expect(screen.getByRole('heading', { name: 'Practical guide' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Back to comparison' }));
  expect(screen.getByRole('heading', { name: 'Compare setups' })).toBeVisible();
  expect(optins.createOptin).not.toHaveBeenCalled();
});

it('keeps comparison recoverable when a search hides every selected design', async () => {
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Compare design: Welcome discount' }));
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search campaign setups' }), 'no matching setup');
  expect(screen.getByText('No campaign setups match')).toBeVisible();
  expect(screen.getByRole('complementary', { name: 'Selected for comparison' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
  await userEvent.clear(screen.getByRole('searchbox', { name: 'Search campaign setups' }));
  expect(screen.getByRole('checkbox', { name: 'Compare design: Welcome discount' })).not.toBeChecked();
  expect(optins.createOptin).not.toHaveBeenCalled();
});

it('keeps a refused setup focusable with its reason and never prepares it', async () => {
  // A paid site on a lower rung is shown the next rung's setup, refused.
  window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
  onTestFinished(() => { delete window.wconvertAdmin; });
  goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK, availability: 'locked', template: undefined }]);
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await inspect();
  const use = await screen.findByRole('button', { name: 'Use this setup' });
  expect(use).toHaveAttribute('aria-disabled', 'true');
  expect(use).toBeEnabled();
  expect(use).toHaveAccessibleDescription(/Available with/);
  await userEvent.click(use);
  expect(goals.prefill).not.toHaveBeenCalled(); expect(optins.createOptin).not.toHaveBeenCalled();
});


it('never offers a setup whose design is missing from this site', async () => {
  goals.listPlaybooks.mockResolvedValue([{ ...PLAYBOOK, availability: 'unavailable', template: undefined }]);
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  expect(await screen.findByText('No campaign setups available')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Setup details for/ })).toBeNull();
});

it('requires inspection before creating and keeps preview controls out of the cards', async () => {
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  const preview = await screen.findByRole('button', { name: 'Setup details for Welcome discount' });
  expect(screen.queryByRole('button', { name: 'Use this setup' })).not.toBeInTheDocument();
  await userEvent.click(preview);
  expect(screen.getByRole('combobox', { name: 'Zoom' })).toHaveValue('width');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Zoom' }), 'whole');
  expect(screen.getByRole('button', { name: 'Use this setup' })).toBeEnabled();
  expect(optins.createOptin).not.toHaveBeenCalled();
});


it('replaces a failed inspection preview with recovery, then shows the exact retried setup', async () => {
  const metadata = { ...PLAYBOOK, revision: 'review-r', availability: 'ready', template: undefined };
  goals.listPlaybooks.mockResolvedValue([metadata]);
  goals.previewPlaybooks.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ entries: [{ ...metadata, template: PLAYBOOK.template }] });
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await screen.findByText('Preview could not be loaded.');
  await inspect();
  expect(screen.getByRole('alert')).toHaveTextContent('This preview could not be loaded.');
  expect(screen.queryByText('Loading preview…')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use this setup' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Use this setup' })).toBeEnabled());
  expect(optins.createOptin).not.toHaveBeenCalled();
});

it('folds the secondary filters under one More filters row and opens preferences over the library', async () => {
  const repair = { ...PLAYBOOK, id: 'repair', name: 'Repair request', template_id: 'repair-card', business_types: [{ id: 'services', label: 'Service businesses' }] };
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK, repair]);
  const data = await picker.pickerData();
  picker.pickerData.mockResolvedValue({ ...data, occasions: { schema: 1, revision: 0, items: [{ id: 'sale', name: 'Anniversary sale', start: '2026-11-27', end: '2026-12-01' }] } });
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await screen.findByText('Repair request');
  const more = screen.getByText('More filters').closest('summary')!;
  expect(screen.getByRole('combobox', { name: 'Business' })).not.toBeVisible();
  expect(screen.queryByRole('button', { name: 'Help me choose' })).not.toBeInTheDocument();
  await userEvent.click(more);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Business' }), 'services');
  expect(more).toHaveTextContent('1 on');

  await userEvent.click(screen.getByRole('button', { name: 'More ways to browse' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Occasions & preferences' }));
  const dialog = await screen.findByRole('dialog', { name: 'Occasions & preferences' });
  // A dialog over the library, not a panel in its place.
  expect(screen.getByRole('heading', { name: 'Choose a campaign setup', hidden: true })).toBeInTheDocument();
  expect(within(dialog).getByText('Nov 27 – Dec 1, 2026')).toBeVisible();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Find ideas' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('region', { name: 'Occasion planning ideas' })).toHaveTextContent('Nov 27 – Dec 1, 2026');
  expect(optins.createOptin).not.toHaveBeenCalled();
});

it('starts a long list with one recommended setup that can be used straight away', async () => {
  const many = Array.from({ length: 5 }, (_, at) => ({ ...PLAYBOOK, id: `start-${at}`, name: `Start ${at}`, template_id: `card-${at}`, design_key: `registered:card-${at}` }));
  goals.listPlaybooks.mockResolvedValue(many);
  goals.prefill.mockResolvedValue(DRAFT);
  const created = vi.fn();
  render(<GoalScreen onCreated={created} />); await pickGoal();
  const start = (await screen.findByRole('heading', { name: 'Start here' })).closest('section')!;
  expect(within(start).getByText('Start 0')).toBeInTheDocument();
  // The recommended one is not drawn twice.
  expect(screen.getAllByRole('button', { name: /Setup details for/ })).toHaveLength(4);
  await userEvent.click(within(start).getByRole('button', { name: 'Use this setup' }));
  await waitFor(() => expect(created).toHaveBeenCalled());
  expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, 'start-0');
});

it('stops recommending once the merchant narrows the list', async () => {
  const many = Array.from({ length: 5 }, (_, at) => ({ ...PLAYBOOK, id: `start-${at}`, name: `Start ${at}`, template_id: `card-${at}`, design_key: `registered:card-${at}` }));
  goals.listPlaybooks.mockResolvedValue(many);
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await screen.findByRole('heading', { name: 'Start here' });
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search campaign setups' }), 'Start');
  expect(screen.queryByRole('heading', { name: 'Start here' })).toBeNull();
  expect(screen.getAllByRole('button', { name: /Setup details for/ })).toHaveLength(5);
});

it('starts a list campaign on Keep in WConvert only while no service of its channel is connected', async () => {
  goals.listGoals.mockResolvedValue([{ ...GOALS[0], outcome: CAPTURE_OUTCOME }]);
  const draft = { name: GOALS[0].label, goal: GOALS[0].id, config: { rules: [] } };
  goals.prefill.mockResolvedValue(draft);
  destinationsApi.readDestinations.mockResolvedValue({ destinations: [], types: [] });
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await userEvent.click(screen.getByRole('button', { name: 'Choose a design myself' }));
  await waitFor(() => expect(optins.createOptin).toHaveBeenCalledWith(draft.name, draft.goal, { rules: [], capture_mode: 'local', destinations: [] }));
});

it('leaves a list campaign sending when the site already has a ready service', async () => {
  goals.listGoals.mockResolvedValue([{ ...GOALS[0], outcome: CAPTURE_OUTCOME }]);
  const draft = { name: GOALS[0].label, goal: GOALS[0].id, config: { rules: [] } };
  goals.prefill.mockResolvedValue(draft);
  destinationsApi.readDestinations.mockResolvedValue({ destinations: [{ id: 'mc', type: 'mailchimp', availability: 'ready', settings: {}, requirements: { audience_channels: ['email'], settings: {} } }], types: [] });
  render(<GoalScreen onCreated={vi.fn()} />); await pickGoal();
  await userEvent.click(screen.getByRole('button', { name: 'Choose a design myself' }));
  await waitFor(() => expect(optins.createOptin).toHaveBeenCalledWith(draft.name, draft.goal, draft.config));
});
