import { displayPlan } from './support/display-entry';
import { CAPTURE_OUTCOME, CLICK_OUTCOME } from './support/outcomes';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { ruleTypes } from './support/rule-types';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';

/**
 * The [[Goal]] on screen, and the control that corrects it.
 *
 * ============================================================================
 * IT WAS INVISIBLE EXACTLY WHERE IT HURT.
 * ============================================================================
 * A Goal is chosen in a three-step wizard that cannot be re-entered, and the
 * builder mentioned it in one place: behind a button labelled *Summary*. So a
 * merchant browsing designs met five of seven popup cards greyed out, each
 * reading *"Your goal counts click-throughs"* — **"your goal"**, never naming
 * which — and the server's own refusal had the words *"or change the Goal"*
 * deliberately taken out of it, because no such control existed anywhere.
 *
 * ADR 0059 deleted the greying. This file is the other half: the Goal is a line
 * in the page-header band, and there is a way to change it.
 *
 * ============================================================================
 * THE CHANGE IS EDITORIAL, AND THE CONFIRM IS NOT DECORATION.
 * ============================================================================
 * A Goal declares no converting act now, so changing one cannot make the design
 * wrong — it moves which card reports the Optin and what its headline number is
 * called. But `wconvert_stats` carries no `goal`, so every count is read
 * against the Goal the Optin holds NOW (ADR 0020): the correction restates the
 * whole history rather than splitting it. And the builder's Undo watches the
 * design, which a Goal is not part of — so there is no entry to walk back to,
 * and the confirm is the only place that can be said.
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

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

/** A one-step design that converts on a click and asks the visitor for nothing. */
const OFFER = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/offer-panel.json'), 'utf8').replace('"action": "link"', '"action": "link", "href": "https://example.org/offer"'),
) as TemplateEntry;

const ID = '01JQ00000000000000000000AA';

/**
 * Four [[Goal]]s in the states the dialog draws.
 *
 * **No Goal id is named in an assertion below**, only in these fixtures, which
 * is where the admin bundle's own rule stops: `GoalParityTest` scans
 * `resources/admin/src` and never `tests/js`.
 */
const GOALS = [
  {
    id: 'grow_email_list',
    label: 'Grow my email list',
    description: 'Capture email addresses.',
    needs_a_capture: false,
    grows_a_list: true, outcome: CAPTURE_OUTCOME,
    headline_kind: 'conversion',
    headline_label: 'Conversions',
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
    headline_label: 'Conversions',
    tier: 'free',
    availability: 'ready' as const,
  },
  {
    id: 'deliver_lead_magnet',
    label: 'Deliver a lead magnet',
    description: 'Send a file in exchange for an address.',
    needs_a_capture: true,
    grows_a_list: true, outcome: CAPTURE_OUTCOME,
    headline_kind: 'lead_magnet_delivered',
    headline_label: 'Deliveries',
    tier: 'free',
    availability: 'ready' as const,
  },
  {
    id: 'recover_cart',
    label: 'Bring shoppers back to their cart',
    description: 'Show shoppers the way back.',
    needs_a_capture: false,
    grows_a_list: false, outcome: CLICK_OUTCOME,
    headline_kind: 'conversion',
    headline_label: 'Conversions',
    tier: 'pro',
    availability: 'locked' as const,
  },
];

/**
 * The label groups the builder reads, all empty.
 *
 * Spelled as the keys `TemplateLabels` declares rather than as `{}`, so a group
 * added to that interface fails the type here instead of throwing inside a
 * control halfway through a render.
 */
const LABELS = {
  roles: {},
  nodes: {},
  layouts: {},
  layoutNotes: {},
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

const CARD = {
  id: ENTRY.id,
  name: ENTRY.name,
  display_type: ENTRY.display_type,
  tier: 'free',
  availability: 'ready' as const,
  facets: { act: 'submit' as const, captures: ['email'], shape: 'stack', has_image: false, asks_consent: true },
};

function optin(over: Record<string, unknown> = {}) {
  return {
    can_change_goal: true,
    id: ID,
    name: 'Welcome discount',
    goal: 'grow_email_list',
    published_at: null,
    deleted_at: null,
    suspended: null,
    sibling_act: null,
    config: { display_rules: displayPlan([{ type: 'page_load' }]), template_id: 'centred-card', template: { tree: ENTRY.tree, tokens: ENTRY.tokens } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  builder.getOptin.mockResolvedValue(optin());
  builder.getRules.mockResolvedValue(ruleTypes());
  builder.saveOptin.mockImplementation(
    (_id: string, _name: string, config: Record<string, unknown>, goal?: string) =>
      Promise.resolve({ ...optin(), name: _name, config, ...(goal === undefined ? {} : { goal }) }),
  );
  templates.listTemplates.mockResolvedValue({
    templates: [CARD],
    /*
      **Every group empty rather than absent.** `nameOf` falls back to the key
      where nothing names it, which is the same fallback the server takes — but
      a MISSING group is `undefined` rather than an empty record, and the token
      controls read theirs before anything on this screen renders. Nothing here
      asserts on a word, so the keys are the words.
    */
    labels: LABELS,
    facets: { shape: ['stack'], captures: ['email'], has_image: ['true'] },
  });
  templates.getTemplateTrees.mockResolvedValue({
    templates: [{ id: ENTRY.id, tree: ENTRY.tree, tokens: ENTRY.tokens }],
  });
  stats.readDashboard.mockResolvedValue({ from: '', to: '', days: 30, goals: [] });
  destinations.readDestinations.mockResolvedValue({ destinations: [], types: [] });
  goals.listGoals.mockResolvedValue(GOALS);
  goals.listPlaybooks.mockResolvedValue([]);
});

const open = () => render(<OptinBuilder id={ID} onClose={vi.fn()} />);

it('copies current edits to another Goal while leaving a published original untouched', async () => {
  builder.getOptin.mockResolvedValue(optin({ can_change_goal: false, published_at: '2026-09-14 10:00:00' }));
  copies.createOptin.mockResolvedValue({ id: 'COPIED' });
  const onCreated = vi.fn();
  render(<OptinBuilder id={ID} onClose={vi.fn()} onCreated={onCreated} />);
  await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), ' revised');
  await userEvent.click(screen.getByRole('button', { name: 'Campaign actions' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Campaign details' }));
  await userEvent.click(screen.getByRole('button', { name: 'Duplicate for another goal' }));
  await userEvent.click(within(cardFor('Promote a sale or offer')).getByRole('button', { name: /^Use this goal/ }));
  expect(screen.getByText(/results start at zero/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Create copied draft' }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('COPIED'));
  expect(copies.createOptin).toHaveBeenCalledWith('Welcome discount revised — copy', 'promote_offer', expect.objectContaining({ template_id: 'centred-card' }));
  expect(builder.saveOptin).not.toHaveBeenCalled();
});

/** Open the picker from the band. */
const changeGoal = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Campaign actions' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Campaign details' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Change goal' }));
};

// =============================================================================
// THE LINE IN THE BAND.
// =============================================================================

describe('the numbers in Campaign details', () => {
  /** A failed read is drawn as a failure with one way out, never as "no numbers" (§13). */
  it('says the numbers could not load and tries again in place', async () => {
    builder.getOptin.mockResolvedValue(optin({ published_at: '2026-09-14 10:00:00', can_change_goal: false }));
    stats.readDashboard.mockRejectedValueOnce(new Error('offline'));
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Campaign actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Campaign details' }));
    const details = within(await screen.findByRole('dialog', { name: 'Welcome discount' }));
    const alert = await details.findByText('Results couldn’t load.');
    expect(alert).toHaveAttribute('role', 'alert');
    // Each failed read in the dialog carries its own door, beside its own sentence.
    await userEvent.click(within(alert.parentElement!).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(details.queryByText('Results couldn’t load.')).toBeNull());
    expect(stats.readDashboard).toHaveBeenCalledTimes(2);
  });
});

describe('the goal picker after a failed read', () => {
  it('says the goals could not load, rather than that there are none', async () => {
    const { ChangeGoalDialog } = await import('../../resources/admin/src/builder/ChangeGoalDialog');
    const { failed } = await import('../../resources/admin/src/shell/loadable');
    const onRetry = vi.fn();
    render(<ChangeGoalDialog open onOpenChange={vi.fn()} goals={failed(new Error('offline'))} current="grow_email_list" onChange={vi.fn()} onRetry={onRetry} />);
    expect(screen.getByText('The goals could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/No other goals/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('the goal in Optin details', () => {
  it('says what this Optin is for, and what its number is called', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Campaign actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Campaign details' }));

    const goal = await within(screen.getByRole('dialog')).findByRole('region', { name: 'Goal' });
    expect(await within(goal).findByText('Grow my email list')).toBeInTheDocument();
    expect(goal).toHaveTextContent('Counts as success: Conversions');
  });

  /**
   * **The height is reserved, exactly as the stats strip below it is.** The
   * registry answers a round trip after the Optin does, so a line that appeared
   * would push the strip and the tab strip down after the browser had already
   * painted — the shift ADR 0039 asks a fetching region to absorb.
   */
  it('holds its line while the registry is still answering', async () => {
    goals.listGoals.mockReturnValue(new Promise(() => undefined));

    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Campaign actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Campaign details' }));



    const line = document.querySelector('.min-h-\\[1lh\\]');

    expect(line).not.toBeNull();
    expect(line).toHaveTextContent('');
    expect(screen.queryByRole('button', { name: 'Change goal' })).toBeNull();
  });

  /**
   * **A registry that answered nothing still says the Optin has a Goal**, but
   * never as the id it stores (ADR 0131): blanking it would read as an Optin
   * with no Goal at all, and a raw key tells a merchant nothing.
   */
  it('says the goal is unavailable, never its stored id, where this build cannot name it', async () => {
    goals.listGoals.mockRejectedValue(new Error('nope'));

    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Campaign actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Campaign details' }));

    expect(await within(screen.getByRole('dialog')).findByText('Goal unavailable')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByText('grow_email_list')).toBeNull();
  });

  /**
   * **No control where there is nothing to change to.** An install with one
   * offerable Goal has nothing to offer, and a control that opens a picker
   * holding only the card you already have wastes a click (ADR 0042 rule 2).
   */
  it('offers no control on an install with one goal it can serve', async () => {
    goals.listGoals.mockResolvedValue([GOALS[0]]);

    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Campaign actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Campaign details' }));

    await within(screen.getByRole('dialog')).findByText('Counts as success: Conversions');

    expect(screen.queryByRole('button', { name: 'Change goal' })).toBeNull();
  });
});

// =============================================================================
// THE DIALOG, AND THE FOUR STATES A CARD IS IN.
// =============================================================================

const cardFor = (name: string) => screen.getByText(name).closest('li') as HTMLElement;

describe('the goal picker', () => {
  /** The header holds no goal (ADR 0136): Change goal is reached through Campaign details, so focus returns to Campaign actions. */
  it('returns focus to Campaign actions when the goal picker closes', async () => {
    open();
    await changeGoal();
    expect(screen.queryByRole('button', { name: /^Goal:/ })).toBeNull();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Campaign actions' })).toHaveFocus());
  });

  it('marks the goal in use, and does not offer it again', async () => {
    open();
    await changeGoal();

    const mine = cardFor('Grow my email list');

    expect(mine).toHaveAttribute('aria-current', 'true');
    /*
      `aria-disabled` rather than `disabled`: the card stays reachable so the
      state it announces can be read, which is the line this admin draws
      between a control refused by what the site IS and one that is merely busy.
    */
    expect(within(mine).getByRole('button', { name: 'In use' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('offers every other goal this install can serve', async () => {
    open();
    await changeGoal();

    expect(
      within(cardFor('Promote a sale or offer')).getByRole('button', { name: /^Use this goal/ }),
    ).toBeEnabled();
  });

  /**
   * **`unavailable` is hidden and `locked` is upsold**, which is the front
   * door's rendering and never this screen's own rule: a second copy of
   * *"never sell Pro for something Pro would not supply"* is a second place for
   * it to stop agreeing (ADR 0026).
   */
  it('upsells a goal this install has to buy, and never as a button', async () => {
    // A paid install meeting a higher rung's Goal (ADR 0116).
    window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
    onTestFinished(() => { delete window.wconvertAdmin; });
    open();
    await changeGoal();

    const locked = within(cardFor('Bring shoppers back to their cart'));

    expect(locked.getByText('Pro')).toBeInTheDocument();
    expect(locked.getByText(/Available with/)).toBeInTheDocument();
    expect(locked.queryByRole('button')).toBeNull();

    /*
      **Amber says the SITE is holding this back, and a price is not that**
      (ADR 0037). This badge was `warning`, so amber meant *suspended*,
      *paused*, *needs a plugin* AND *buy Pro* depending which screen the
      merchant was on.
    */
    expect(locked.getByText('Pro').closest('[data-slot="badge"]')).toHaveAttribute(
      'data-variant',
      'secondary',
    );
  });

  /** A free install is not sold a Goal at all — not even a card (ADR 0116). */
  it('hides a goal a free install would have to buy', async () => {
    open();
    await changeGoal();

    expect(screen.queryByText('Bring shoppers back to their cart')).toBeNull();
    expect(screen.queryByText(/Available with/)).toBeNull();
  });

  it('hides a goal this site cannot serve at all', async () => {
    goals.listGoals.mockResolvedValue([
      GOALS[0],
      { ...GOALS[1], availability: 'unavailable' as const },
      // A third that IS offerable, so the control still appears: with one
      // offerable Goal there is nothing to change to and no button to press.
      GOALS[2],
    ]);

    open();
    await changeGoal();

    expect(screen.queryByText('Promote a sale or offer')).toBeNull();
  });

  /**
   * **The one refusal a Goal can still make about a design, marked before the
   * click with the tab that fixes it** (ADR 0042 rule 3). It is the whole of
   * what survives of the Goal-versus-design family (ADR 0059).
   */
  it('allows choosing a draft Goal before adjusting its design', async () => {
    builder.getOptin.mockResolvedValue(
      optin({
        config: { display_rules: displayPlan([{ type: 'page_load' }]), template_id: 'offer-panel', template: { tree: OFFER.tree, tokens: OFFER.tokens } },
      }),
    );

    open();
    await changeGoal();

    const delivery = within(cardFor('Deliver a lead magnet'));

    const refused = delivery.getByRole('button', { name: /^Use this goal/ });

    expect(refused).toBeEnabled();
  });

  it('offers it where the design does capture something', async () => {
    open();
    await changeGoal();

    expect(
      within(cardFor('Deliver a lead magnet')).getByRole('button', { name: /^Use this goal/ }),
    ).toBeEnabled();
  });
});

// =============================================================================
// THE ONE MISTAKE THIS TICKET MADE REACHABLE.
// =============================================================================

describe('a goal that collects contacts, over a design that asks for nothing', () => {
  /**
   * **Allowed, and no longer silent.** Before ADR 0059 this pairing was refused
   * outright — the card was greyed and the save rejected it. It saves now, runs
   * now, and honestly counts click-throughs; what it will never do is collect
   * an address, and no other surface in the product would mention it.
   *
   * A sentence in the launch review rather than a refusal: the Optin is not broken,
   * it is measuring something other than what the merchant asked for.
   */
  it('cannot publish a capture Goal with a click-only design', async () => {
    builder.getOptin.mockResolvedValue(
      optin({
        config: { display_rules: displayPlan([{ type: 'page_load' }]), template_id: 'offer-panel', template: { tree: OFFER.tree, tokens: OFFER.tokens } },
      }),
    );

    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Review & publish' }));

    expect(await screen.findByText(CAPTURE_OUTCOME.requirement)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish campaign' })).toHaveAttribute('aria-disabled', 'true');
  });

  /** And a goal whose product IS the click-through says nothing at all. */
  it('says nothing where the goal does not collect contacts', async () => {
    builder.getOptin.mockResolvedValue(
      optin({
        goal: 'promote_offer',
        config: { display_rules: displayPlan([{ type: 'page_load' }]), template_id: 'offer-panel', template: { tree: OFFER.tree, tokens: OFFER.tokens } },
      }),
    );

    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Review & publish' }));
    expect(screen.queryByText(/will never collect any/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Publish campaign' })).not.toHaveAttribute('aria-disabled');
  });
});

// =============================================================================
// THE CONFIRM, AND WHAT IT SENDS.
// =============================================================================

describe('confirming the change', () => {
  const pick = async (label: string) => {
    await changeGoal();
    await userEvent.click(
      within(cardFor(label)).getByRole('button', { name: /^Use this goal/ }),
    );
  };

  /**
   * **Undo cannot take it back, so this is the only place it is said.** The
   * builder's history watches the design, and a Goal is not in `config` at all
   * — it is a column. That is the exception the structure editor's amendment to
   * ADR 0039 buys for a design switch and cannot buy here.
   */
  it('explains that Goal changes end at first publish and history stays stable', async () => {
    open();
    await pick('Promote a sale or offer');

    expect(await screen.findByText(/keep reporting history stable/)).toBeInTheDocument();
    expect(screen.getByText(/Undo cannot reverse this/)).toBeInTheDocument();
  });

  /**
   * **One save, with the goal as the fourth argument and the current config as
   * the third.** The pair is what the server checks: a goal sent without a
   * config would be answered against whatever was last stored rather than
   * against the design on screen (ADR 0059).
   */
  it('sends the goal beside the config the merchant is looking at', async () => {
    open();
    await pick('Promote a sale or offer');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft and change goal' }));

    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
    expect(builder.saveOptin.mock.calls[0][3]).toBe('promote_offer');
    expect(builder.saveOptin.mock.calls[0][2]).toMatchObject({ template_id: 'centred-card' });
  });

  it('discloses that confirmation also saves the current name and draft, then sends that unsaved name', async () => {
    open();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), ' updated');
    await pick('Promote a sale or offer');
    const confirm = screen.getByRole('button', { name: 'Save draft and change goal' });
    expect(confirm).toHaveAccessibleDescription(/current name and all draft edits, including design, display rules and destinations.*does not publish/);
    expect(builder.saveOptin).not.toHaveBeenCalled();
    await userEvent.click(confirm);
    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
    expect(builder.saveOptin.mock.calls[0][1]).toBe('Welcome discount updated');
    expect(builder.saveOptin.mock.calls[0][2]).toMatchObject({ template: { tree: ENTRY.tree, tokens: ENTRY.tokens } });
    expect(builder.saveOptin.mock.calls[0][3]).toBe('promote_offer');
  });

  it('starts a fresh Undo history only after a successful Goal save', async () => {
    open();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), ' revised');
    expect(screen.getByRole('button', { name: /^Undo/ })).toBeEnabled();
    await pick('Promote a sale or offer');
    const confirm = screen.getByRole('button', { name: 'Save draft and change goal' });
    expect(confirm).toHaveAccessibleDescription(/clears the current Undo and Redo history/);
    await userEvent.click(confirm);
    await waitFor(() => expect(screen.getByRole('button', { name: /^Undo/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: /^Redo/ })).toBeDisabled();
    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' again');
    await userEvent.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Welcome discount revised');
    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
  });

  it('keeps Undo available after a refused Goal save', async () => {
    builder.saveOptin.mockRejectedValue(new Error('The goal change was refused.'));
    open();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), ' revised');
    await pick('Promote a sale or offer');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft and change goal' }));
    // The refusal stays in the dialog, beside the button that caused it.
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('The goal change was refused.');
    expect(screen.getByRole('button', { name: 'Save draft and change goal' })).toBeEnabled();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Welcome discount');
    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when the merchant backs out', async () => {
    open();
    await pick('Promote a sale or offer');
    await userEvent.click(screen.getByRole('button', { name: 'Back to goals' }));

    expect(builder.saveOptin).not.toHaveBeenCalled();
    expect(screen.getByText('Grow my email list')).toBeInTheDocument();
  });

  /*
    **The mirror — "an ordinary Save sends no goal" — lives in
    `builder-shell.test.tsx`**, beside the other things a Save does and does
    not do. It is the same regression read from the other end, and asserting it
    here as well would be two tests that fail together and say the same thing.
  */
});
