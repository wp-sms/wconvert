import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisplayRules } from '../../resources/admin/src/builder/rules/DisplayRules';
import type { DisplayRulesValue } from '../../resources/admin/src/builder/rules/DisplayRules';
import { allRuleTypes, ruleTypes } from './support/rule-types';
import type { RuleVocabulary } from '../../resources/admin/src/builder/api';

/**
 * The rules panel, against the guarantees it exists to make visible.
 *
 * ============================================================================
 * FOUR DISCLOSURES OVER ONE FLAT LIST.
 * ============================================================================
 * This replaced `RulesEditor` + `TargetingEditor`, which were two components
 * rendered one under the other with three `<h3>`s between them. What is
 * asserted is deliberately narrow and is mostly what it always was: the panel
 * LAYOUT is not a TDD seam and the preset translation has its own tests
 * (`tests/js/builder-presets.test.ts`). What lives here is the handful of
 * facts that are only true if the screen says them — which rules are offered,
 * which cannot be removed, what a merchant is told about how two lists
 * combine, and now what each section says about itself before it is opened.
 *
 * **Every body starts collapsed**, so a test that wants a control opens the
 * section first. That is the shape under test rather than an inconvenience:
 * the summary is what the merchant reads to decide whether to open it.
 */

const vocabulary = ruleTypes();

const value = (over: Partial<DisplayRulesValue> = {}): DisplayRulesValue => ({
  rules: [],
  targeting: {},
  frequency: {},
  schedule: {},
  priority: 0,
  ...over,
});

function panel(
  over: Partial<DisplayRulesValue> = {},
  { onChange = vi.fn(), types = vocabulary, overlay = true }: {
    onChange?: ReturnType<typeof vi.fn>;
    types?: RuleVocabulary;
    overlay?: boolean;
  } = {},
) {
  render(<DisplayRules vocabulary={types} value={value(over)} overlay={overlay} onChange={onChange} />);

  return onChange;
}

/**
 * The panel wired to real state, for the handful of assertions that are about
 * what happens on the SECOND interaction.
 *
 * {@link panel} holds `value` fixed and records the patches, which is right for
 * "what does this control emit" — most of this file. It cannot answer "and then
 * what does the screen show", because the row never receives the rule it just
 * produced.
 */
function livePanel(over: Partial<DisplayRulesValue> = {}, types: RuleVocabulary = vocabulary) {
  function Harness() {
    const [state, setState] = useState(value(over));

    return (
      <DisplayRules
        vocabulary={types}
        value={state}
        overlay
        onChange={(patch) => setState((current) => ({ ...current, ...patch }))}
      />
    );
  }

  render(<Harness />);
}

/**
 * Open one disclosure by the question it answers, if it is not open already.
 *
 * **Idempotent, because the panel now opens what needs attention on arrival.**
 * A bare click would CLOSE the section a test had come to look inside — an
 * Optin with no Trigger opens *When* by itself, and that is most of this file's
 * fixtures.
 */
const open = async (eyebrow: string) => {
  const trigger = screen.getByRole('button', { name: new RegExp(`^${eyebrow}`) });

  if (trigger.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(trigger);
  }
};

/** Read the actual searchable picker, including unavailable metadata. */
const ruleMenu = async (label: string) => {
  const trigger = screen.getByRole('button', { name: label });
  if (trigger.getAttribute('aria-expanded') !== 'true') await userEvent.click(trigger);
  return screen.getByRole('dialog', { name: 'Choose a rule' });
};
const offered = async (label: string): Promise<string[]> =>
  [...(await ruleMenu(label)).querySelectorAll('[data-available="true"]')].map(group => group.getAttribute('aria-label') ?? '');
const absent = async (label: string): Promise<string[]> =>
  [...(await ruleMenu(label)).querySelectorAll('[data-available="false"]')].map(group => group.getAttribute('aria-label') ?? '');

describe('the four sections', () => {
  it('asks Where, When, Who and How often, in that order', () => {
    panel();

    // The order is the order a merchant asks the questions in, and it is read
    // off the DOM rather than off four separate lookups so a reshuffle fails
    // here rather than passing four times.
    expect(
      [...document.querySelectorAll('.wconvert-section__eyebrow')].map((span) => span.textContent),
    ).toEqual(['Pages', 'Audience', 'When it appears', 'Schedule & frequency']);
  });

  it('starts collapsed and opens on click', async () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 20 }] });

    expect(screen.queryByLabelText('Add a trigger')).toBeNull();

    await open('When it appears');

    expect(screen.getByLabelText('Add a trigger')).toBeInTheDocument();
  });

  /**
   * ==========================================================================
   * OPEN WHAT NEEDS ATTENTION — NOT WHAT IS SET.
   * ==========================================================================
   * "Open the sections that have rules in them" is the obvious rule and it is
   * wrong: a [[Playbook]] prefills across three axes, so a brand-new Optin
   * would open three of four and this tab would be LONGER than the four closed
   * rows it replaced. `attention` is ADR 0042 rule 2 read literally — open what
   * changes what you do next.
   */
  it('opens the section that needs attention, and only that one', () => {
    // No Trigger at all: `whenSummary` says "Never — it has no trigger yet".
    panel();

    expect(
      screen
        .getAllByRole('button', { expanded: true })
        .map((button) => button.querySelector('.wconvert-section__eyebrow')?.textContent),
    ).toEqual(['When it appears']);
  });

  /** And an Optin whose rules are all fine opens nothing at all. */
  it('opens nothing where there is nothing to act on', () => {
    panel({ rules: [{ type: 'page_load' }] });

    expect(screen.queryAllByRole('button', { expanded: true })).toHaveLength(0);
  });
});

describe('what each section says about itself', () => {
  /**
   * **An Optin with no Trigger can never fire**, and the save route already
   * refuses one. Saying it on the collapsed row is ADR 0042 rule 3: the
   * merchant learns it from the section rather than from a refusal after the
   * click.
   */
  it('says an Optin with no trigger will never fire, before the click', () => {
    panel();

    expect(screen.getByRole('button', { name: /^When it appears/ })).toHaveTextContent('Never — it has no trigger yet');
  });

  /**
   * **The default allowance is not "every time".** Both switches are ON when
   * absent, so an untouched Optin already stops when the visitor closes it or
   * signs up — and a summary reading "Every time" would be a lie on the
   * commonest Optin there is.
   */
  it('reads the default allowance as stopping, not as unlimited', () => {
    panel();

    expect(screen.getByRole('button', { name: /^Schedule & frequency/ })).toHaveTextContent(
      'Every time, until they close it or submit the form',
    );
  });

  /** Where counts its rules rather than naming pages, which would need a lookup. */
  it('counts the page rules rather than naming them', () => {
    panel({
      targeting: {
        include: [
          { type: 'url', value: '/a' },
          { type: 'url', value: '/b' },
        ],
        exclude: [{ type: 'url', value: '/checkout' }],
      },
    });

    expect(screen.getByRole('button', { name: /^Pages/ })).toHaveTextContent('Matches 2 page rules, except 1 page rule');
  });

  /**
   * **A trigger that cannot fire says so before the click.** A `click_element`
   * prefilled by a [[Playbook]] arrives with its selector blank, because a
   * selector is an `authored` param a Playbook may not supply — and the
   * sentence must say the trigger needs one rather than reading "when someone
   * clicks ⟨nothing⟩".
   */
  it('says a trigger is missing what it needs rather than reading past it', () => {
    panel({ rules: [{ type: 'click_element' }] });

    expect(screen.getByRole('button', { name: /^When it appears/ })).toHaveTextContent('needs selector');
  });

  /** And a rule with everything it needs reads as its phrase, with its own values in it. */
  it('reads a complete rule as its phrase, with the merchant’s value in it', () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 20 }] });

    expect(screen.getByRole('button', { name: /^When it appears/ })).toHaveTextContent('time_on_page 20');
  });
});

describe('when it shows and who sees it', () => {
  /**
   * **Triggers and Conditions are two separate lists**, because a rule type is
   * one or the other and never both (CONTEXT.md, Condition). Without the
   * split, an engine holding several eligible Optins cannot tell "waiting"
   * from "ineligible", and neither can the merchant looking at the screen.
   */
  it('draws them as two sections with their own add controls', async () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 20 }] });

    await open('When it appears');
    await open('Audience');

    expect(screen.getByLabelText('Add a trigger')).toBeInTheDocument();
    expect(screen.getByLabelText('Add a condition')).toBeInTheDocument();
  });

  /**
   * ==========================================================================
   * "SHOWS IMMEDIATELY" IS A MODE, NOT AN ITEM IN THE LIST.
   * ==========================================================================
   * It is still the explicit `page_load` Trigger and never an empty list
   * (CONTEXT.md, Trigger) — an empty list would make "fires at once" and "can
   * never fire" the same value. What changed is where the merchant says it.
   *
   * As one entry among many it let them choose *shows immediately* AND *after
   * a few seconds*, which is not a preference: `page_load` is
   * `holds: () => true`, Triggers are ORed, and the seconds decide nothing.
   * The screen agreed with them anyway.
   */
  it('asks whether it waits, and writes page_load for the answer that does not', async () => {
    const changed = panel({ rules: [{ type: 'time_on_page', seconds: 8 }] });

    await open('When it appears');
    await userEvent.click(screen.getByRole('radio', { name: 'page_load' }));

    expect(changed).toHaveBeenCalledWith({
      rules: [{ type: 'time_on_page', seconds: 8 }, { type: 'page_load' }],
    });
  });

  /**
   * **Neither answer deletes a rule.** Flipping back removes `page_load` and
   * only `page_load` — a merchant experimenting with the two loses nothing,
   * which is what makes the radio safe without a confirm.
   */
  it('removes only page_load when it is told to wait again', async () => {
    const changed = panel({
      rules: [{ type: 'device', in: ['mobile'] }, { type: 'page_load' }, { type: 'scroll_up' }],
    });

    await open('When it appears');
    await userEvent.click(screen.getByRole('radio', { name: 'Wait for one of these actions' }));

    expect(changed).toHaveBeenCalledWith({
      rules: [{ type: 'device', in: ['mobile'] }, { type: 'scroll_up' }],
    });
  });

  /**
   * **A rule that never runs is shown, not hidden.** An Optin saved before
   * this screen existed, or prefilled by a Playbook, can carry both — and
   * hiding the unreachable ones would be the failure the Unknown section
   * exists to prevent: still in `config`, still saved back, nothing on screen
   * to act on.
   */
  it('lists a trigger that page_load has made unreachable, and says so', async () => {
    panel({ rules: [{ type: 'page_load' }, { type: 'time_on_page', seconds: 8 }] });

    await open('When it appears');

    expect(screen.getByText(/This never runs/)).toBeInTheDocument();
    // And nothing offers to add another, because anything added would be one
    // more rule that never runs — offered by us.
    expect(screen.queryByLabelText('Add a trigger')).toBeNull();
  });

  /**
   * ==========================================================================
   * NOTHING IS OFFERED THAT COULD ONLY EVER BE A DUPLICATE.
   * ==========================================================================
   * A Trigger with no params has exactly one spelling, so a second is the SAME
   * rule and can never be the reason anything fired — offering it is us handing
   * the merchant a dead rule.
   *
   * A type that HAS params stays on offer however many are already there: a
   * second `time_on_page` may well be lower than the first, and a second
   * `click_element` is a different selector. Where one of those does turn out
   * to be idle the ROW says so, which is the right order — only then is it
   * knowable.
   */
  it.each([['scroll_up'], ['exit_intent']])('stops offering %s once the Optin has it', async (type) => {
    panel({ rules: [{ type }] });

    await open('When it appears');

    expect(await offered('Add a trigger')).not.toContain(type);
  });

  /**
   * **A threshold too, which is the case the merchant actually hits.** A
   * second *Time on the page* is never what anyone wants: the lower one always
   * fires and the other is dead. Offering it and then explaining the mistake
   * was the shape before this.
   */
  it('stops offering a threshold trigger once the Optin has one', async () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 8 }] });

    await open('When it appears');

    expect(await offered('Add a trigger')).not.toContain('time_on_page');
    // ...and the ones that ARE two different things stay on offer.
    expect(await offered('Add a trigger')).toContain('scroll_depth');
  });

  it('keeps offering a trigger whose params say WHICH thing', async () => {
    panel({ rules: [{ type: 'click_element', selector: '.a' }] });

    await open('When it appears');

    expect(await offered('Add a trigger')).toContain('click_element');
  });

  /**
   * ==========================================================================
   * AND THE SAME ON THE CONDITION AXIS, WHERE THE TRAP IS WORSE.
   * ==========================================================================
   * Conditions are ANDed, so `device [mobile]` beside `device [desktop]` is a
   * rule that can never hold for anybody. One rule carrying several values is
   * what the merchant meant, and a set-valued scalar is exactly what ADR 0005
   * provides for it.
   */
  it('offers a condition once, and a second of the ones that differ', async () => {
    panel({ rules: [{ type: 'device', in: ['mobile'] }, { type: 'query_param', key: 'utm_source', value: ['a'] }] });

    await open('Audience');

    expect(await offered('Add a condition')).not.toContain('device');
    expect(await offered('Add a condition')).toContain('query_param');
  });

  /** A pair already stored is shown and explained, never hidden. */
  it('explains a stored second condition of a kind that may only be set once', async () => {
    panel({ rules: [{ type: 'device', in: ['mobile'] }, { type: 'device', in: ['desktop'] }] });

    await open('Audience');

    const notes = screen.getAllByText(/narrows the one above it/);

    expect(notes).toHaveLength(1);
  });

  /**
   * **A threshold behind a lower one of its own kind says so on its row.**
   * *"After 8 seconds or after 20 seconds"* is *"after 8 seconds"*, and the
   * merchant's next move is to change a number rather than to touch the radio
   * — so it is a different sentence from the `page_load` one.
   */
  it('says which rows never run when two thresholds of one type are set', async () => {
    panel({
      rules: [
        { type: 'time_on_page', seconds: 8 },
        { type: 'time_on_page', seconds: 20 },
      ],
    });

    expect(screen.getByRole('button', { name: /^When it appears/ })).toHaveTextContent(
      '1 other trigger never runs',
    );

    await open('When it appears');

    const notes = screen.getAllByText(/This never runs/);

    expect(notes).toHaveLength(1);
    expect(notes[0]).toHaveTextContent('a trigger of the same kind always fires before it');
  });

  /** `page_load` is never in the add control: it is the radio, and one decision gets one control. */
  it('keeps page_load out of the list it is not a member of', async () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 8 }] });

    await open('When it appears');

    const add = await ruleMenu('Add a trigger');

    expect(within(add).queryByRole('button', { name: 'page_load' })).toBeNull();
  });

  /**
   * **Every Optin has at least one Trigger.** The screen stops the merchant
   * reaching zero and the save route refuses the same state — one of those is
   * a courtesy and the other is the guarantee.
   */
  it('will not remove the only trigger', async () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 20 }] });

    await open('When it appears');

    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  /**
   * **Every row IS removable once `page_load` is carrying the Optin**, because
   * none of them is doing anything — the guarantee is that the Optin keeps a
   * Trigger it can act on, and `page_load` is one.
   */
  it('lets the last unreachable trigger go, because it was never the one firing', async () => {
    panel({ rules: [{ type: 'page_load' }, { type: 'time_on_page', seconds: 20 }] });

    await open('When it appears');

    expect(screen.getAllByRole('button', { name: 'Remove' }).length).toBeGreaterThan(0);
  });

  /**
   * ==========================================================================
   * A RULE STORED AT ONE INDEX IS EDITED AT THAT INDEX.
   * ==========================================================================
   * The list is stored FLAT and in the merchant's order; rebuilding it from
   * the sections would silently reorder it into triggers-then-conditions on
   * every save, and the rule list is a screen they look at. Splitting one
   * component into four files is exactly where that invariant would be lost,
   * so it is asserted across the split rather than within one section.
   */
  it('edits a rule where it sits in the flat list, not where its section draws it', async () => {
    const changed = panel({
      rules: [
        { type: 'device', in: ['mobile'] },
        { type: 'scroll_up' },
        { type: 'time_on_page', seconds: 8 },
      ],
    });

    await open('When it appears');

    // The first Remove inside the When section belongs to the first TRIGGER,
    // which sits at index 1 of the flat list — the condition was written first.
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(changed).toHaveBeenCalledWith({
      rules: [
        { type: 'device', in: ['mobile'] },
        { type: 'time_on_page', seconds: 8 },
      ],
    });
  });

  /**
   * **A rule of a type this build has never heard of still reaches a row.**
   *
   * Filtering the flat list down to the known axes would leave such a rule
   * invisible AND unremovable — still in `config`, still saved back, with
   * nothing on screen to act on.
   */
  it('shows a rule it cannot draw controls for, and offers a way out of it', async () => {
    const changed = panel({ rules: [{ type: 'page_load' }, { type: 'moon_phase', in: ['waxing'] }] });

    expect(screen.getByText('moon_phase')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Not available on this site' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(changed).toHaveBeenCalledWith({ rules: [{ type: 'page_load' }] });
  });

  /**
   * ==========================================================================
   * A SUBSTITUTION IS A PERSISTENT NOTE ON ITS OWN ROW.
   * ==========================================================================
   * Never a dismissible banner: dismissed once, it leaves the Optin carrying
   * an invisible substitution forever (ADR 0012).
   */
  it('says on the row which premium rule this one is standing in for', async () => {
    panel(
      { rules: [{ type: 'time_on_page', seconds: 15, degraded_from: 'exit_intent' }] },
      { types: ruleTypes({ free: 'ready', pro: 'locked' }) },
    );

    await open('When it appears');

    expect(screen.getByText(/Standing in for/)).toHaveTextContent('exit_intent');
    expect(screen.queryByRole('button', { name: /Dismiss|Got it|Hide/ })).toBeNull();
  });

  /**
   * ==========================================================================
   * "SET IT MYSELF" HAS TO STICK, AND IT COULD NOT.
   * ==========================================================================
   * Which preset a row is wearing is DERIVED from the rule's values
   * (`fromRule`), so choosing the general form re-emitted the same values, the
   * same preset matched them again, and the select snapped straight back with
   * no controls drawn. Nothing happened, on every rule type — every
   * `device`, `time_on_page` and `scroll_depth` preset fixes all of its
   * params, so this was a menu item that could never do anything.
   *
   * A merchant who wants their own `utm_term` is not locked out of one
   * (ADR 0005: a preset is a shortcut over the engine type, never a
   * replacement for it), so this is the assertion that keeps that true.
   */
  it('drops to the general form and stays there, with the preset’s values to edit', async () => {
    const changed = panel({ rules: [{ type: 'device', in: ['desktop'] }] });

    await open('Audience');

    // It reads back as the preset that matches it.
    const select = screen.getByLabelText('device');

    expect(select).toHaveValue('desktop_only');
    expect(screen.queryByLabelText('in')).toBeNull();

    await userEvent.selectOptions(select, '');

    // The choice sticks even though the values still match `desktop_only`...
    expect(select).toHaveValue('');
    // ...and the params it was hiding are now there to edit, carrying what the
    // preset had set rather than nothing.
    expect(screen.getByText('in')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'desktop' })).toBeChecked();

    // Nothing was written by dropping to the general form: it is the same rule.
    expect(changed).toHaveBeenCalledWith({ rules: [{ type: 'device', in: ['desktop'] }] });
  });

  /** And editing from there produces the merchant's own values. */
  it('lets the merchant set a combination no preset offers', async () => {
    const changed = panel({ rules: [{ type: 'device', in: ['desktop'] }] });

    await open('Audience');
    await userEvent.selectOptions(screen.getByLabelText('device'), '');
    await userEvent.click(screen.getByRole('checkbox', { name: 'mobile' }));

    expect(changed).toHaveBeenLastCalledWith({
      rules: [{ type: 'device', in: ['mobile', 'desktop'] }],
    });
  });

  /** Choosing a named preset again puts the row back on it. */
  it('goes back to a preset when one is chosen', async () => {
    livePanel({ rules: [{ type: 'device', in: ['desktop'] }] });

    await open('Audience');

    const select = screen.getByLabelText('device');

    await userEvent.selectOptions(select, '');

    expect(select).toHaveValue('');

    await userEvent.selectOptions(select, 'mobile_only');

    expect(select).toHaveValue('mobile_only');
    // And the params it fixes are hidden again, because the preset is what
    // sets them now.
    expect(screen.queryByText('in')).toBeNull();
  });

  /**
   * ==========================================================================
   * CONTROLS DO NOT VANISH UNDER THE CURSOR.
   * ==========================================================================
   * Unticking one of three device boxes lands on `['tablet', 'desktop']`,
   * which IS the "anywhere but mobile" preset — so the row snapped onto it and
   * the checkboxes being used disappeared mid-edit. Touching a param is
   * setting it yourself, and the row stays in that mode until a preset is
   * chosen from the select.
   */
  it('keeps the controls in place while the merchant is using them', async () => {
    livePanel({ rules: [{ type: 'device', in: ['mobile', 'tablet', 'desktop'] }] });

    await open('Audience');

    await userEvent.click(screen.getByRole('checkbox', { name: 'mobile' }));

    // The remaining boxes are still there, and still reflect the rule.
    expect(screen.getByRole('checkbox', { name: 'mobile' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'tablet' })).toBeChecked();
    expect(screen.getByLabelText('device')).toHaveValue('');

    await userEvent.click(screen.getByRole('checkbox', { name: 'tablet' }));

    expect(screen.getByRole('checkbox', { name: 'desktop' })).toBeChecked();
  });

  /** A rule the merchant asked for carries no such note. */
  it('says nothing of the sort about an ordinary rule', async () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 15 }] });

    await open('When it appears');

    expect(screen.queryByText(/Standing in for/)).toBeNull();
  });

  /**
   * **Editing a substituted rule does not un-substitute it.** Losing the
   * marker on the first edit would retire the note and the upgrade offer it
   * anchors — the invisible substitution again, arriving through the one
   * screen that was supposed to show it.
   */
  it('carries the marker through an edit of the substituted rule', async () => {
    const changed = panel({ rules: [{ type: 'time_on_page', seconds: 15, degraded_from: 'exit_intent' }] });

    await open('When it appears');
    await userEvent.selectOptions(screen.getByLabelText('time_on_page'), 'after_a_moment');

    expect(changed).toHaveBeenCalledWith({
      rules: [{ type: 'time_on_page', seconds: 5, degraded_from: 'exit_intent' }],
    });
  });
});

// ============================================================================
// THE THREE RENDERINGS OF AN ABSENCE, AND THE ONE THAT WAS MISSING.
// ============================================================================

describe('a rule type this install cannot run', () => {
  /**
   * **A premium type is named, never drawn disabled.** wp.org Guideline 9
   * fires on showing a real control the user cannot use, and ADR 0012 answers
   * it the same way at prefill. Naming it is also what a settings list owes a
   * merchant who went hunting for it (ADR 0026).
   */
  it('names a locked type as an upsell rather than offering it', async () => {
    panel(
      { rules: [{ type: 'time_on_page', seconds: 20 }] },
      { types: ruleTypes({ free: 'ready', pro: 'locked' }) },
    );

    await open('When it appears');

    expect(await offered('Add a trigger')).not.toContain('click_element');
    // ==========================================================================
    // NAMED IN THE MENU, WHICH IS WHERE THE MERCHANT WENT LOOKING FOR IT.
    // ==========================================================================
    // It was a permanent block of chips under the Add control, drawn on every
    // visit of every section. ADR 0026's `explain` is unchanged; what moved is
    // which thing the list is (ADR 0054).
    expect(await absent('Add a trigger')).toContain('With WConvert Pro');

    const menu = await ruleMenu('Add a trigger');
    const pro = menu.querySelector('[data-available="false"][aria-label="With WConvert Pro"]') as HTMLElement;

    expect(within(pro).getByText('click_element')).toBeInTheDocument();
    // Metadata, never a control: Guideline 9 fires on a real control the user
    // cannot use, and there is nothing here a click could reach (ADR 0015).
    expect(within(pro).queryByRole('button')).toBeNull();
  });

  /**
   * ==========================================================================
   * AND `unavailable` IS EXPLAINED, WHICH IS THE HOLE THIS CLOSES.
   * ==========================================================================
   * `RulesEditor` branched on `ready` and `locked` only, so a cart Condition on
   * a store-less site was in neither list and was **silently absent** — while
   * `Suspension::reason()` told the same merchant, on the Optin list, exactly
   * which plugin their Optin needed. The two screens disagreed.
   *
   * **It names the plugin**, because "not available on this site" leaves a
   * merchant who deactivated WooCommerce to guess which of their plugins did
   * it. **And it is never an upsell**: a rule the SITE cannot serve is not
   * something we can sell (ADR 0026).
   */
  it('explains a type the site cannot serve, and names the plugin', async () => {
    panel(
      { rules: [{ type: 'page_load' }] },
      // `elite`, because the two cart Conditions are the `cart-recovery`
      // module's rung (ADR 0056). Naming the rung rather than "premium" is
      // what makes this test about the Conditions it actually asserts on.
      { types: ruleTypes({ elite: 'unavailable' }) },
    );

    await open('Audience');

    // ==========================================================================
    // ONE GROUP LABEL CARRYING THE REASON, AND A CHIP PER CAPABILITY.
    // ==========================================================================
    // The reason used to be on every card, under a heading that said it again.
    // Grouping BY what is missing is ADR 0026's own argument applied to the
    // shape: an install missing two plugins gets two honest lines rather than
    // one lumped "not available on this site".
    const menu = await ruleMenu('Add a condition');
    const woo = menu.querySelector('[data-available="false"][aria-label="Needs WooCommerce"]') as HTMLElement;

    expect(within(woo).getByText('cart_has_items')).toBeInTheDocument();
    expect(within(woo).getByText('cart_value_min')).toBeInTheDocument();
    // Never an upsell: a rule the SITE cannot serve is not ours to sell.
    expect(await absent('Add a condition')).not.toContain('With WConvert Pro');
  });

  /**
   * And an install that has everything gets a flat menu — the screen is
   * simpler for the customer who bought it all, which is the right direction.
   */
  it('draws no disabled group at all where the install can run everything', async () => {
    panel({ rules: [{ type: 'page_load' }] }, { types: ruleTypes() });

    await open('Audience');

    expect(await absent('Add a condition')).toEqual([]);
  });

  /** And a rule already ON the Optin says the same thing on its own row. */
  it('says the same thing on the row of a rule the Optin already carries', async () => {
    panel(
      { rules: [{ type: 'page_load' }, { type: 'cart_has_items' }] },
      { types: ruleTypes({ elite: 'unavailable' }) },
    );

    await open('Audience');

    expect(screen.getByText(/Needs WooCommerce on this site, which is not active/)).toBeInTheDocument();
  });
});

describe('where it shows', () => {
  /**
   * **Five page rules, plus one visitor predicate** — and `logged_in` lives on
   * this axis only because the client cannot read WordPress's HttpOnly auth
   * cookie (CONTEXT.md, Targeting).
   */
  it('covers all five page prefixes in both lists', async () => {
    panel();

    await open('Pages');

    for (const list of screen.getAllByLabelText('Add')) {
      await userEvent.click(list);
      expect(within(screen.getByRole('dialog')).getAllByRole('button').map(button => button.textContent)).toEqual([
        'post',
        'singular',
        'archive',
        'term',
        'url',
      ]);
      await userEvent.keyboard('{Escape}');
    }
  });

  /**
   * ==========================================================================
   * THE SAME ADD CONTROL AS THE OTHER THREE, WHICH CLOSES A LATENT HOLE.
   * ==========================================================================
   * The two lists had a hand-rolled `<select>` over every type that called
   * `renderingFor` nowhere — so the day a targeting type declares a `tier` or a
   * `requires`, it would have been offered on a site that cannot run it, with
   * no gate and no explanation. That is the exact failure `AddRule` closes, and
   * it was closed on three axes out of four.
   */
  it('gates the page lists the way every other axis is gated', async () => {
    panel(
      {},
      {
        types: {
          ...vocabulary,
          targeting: vocabulary.targeting.map((type) =>
            type.type === 'url' ? { ...type, tier: 'pro', availability: 'locked' as const } : type,
          ),
        },
      },
    );

    await open('Pages');

    for (const list of screen.getAllByLabelText('Add')) {
      // Named, and unreachable — the same rendering the other three axes give
      // a locked type, from the same `renderingFor` cascade.
      await userEvent.click(list);
      const reason = screen.getByRole('group', { name: 'With WConvert Pro' });
      expect(within(reason).getByText('url')).toBeInTheDocument();
      expect(within(reason).queryByRole('button')).toBeNull();
      await userEvent.keyboard('{Escape}');
    }
  });

  /**
   * The visitor predicate is held APART from the two lists: they are a union of
   * page SETS, so a visitor rule dropped into the include list would widen the
   * Optin to the whole site for anyone matching it (ADR 0005). It is still
   * STORED on this axis — only the client cannot read the auth cookie — and it
   * is DRAWN under WHO, which is the section a merchant looks in.
   */
  it('keeps the visitor predicate out of the page lists, and out of this section', async () => {
    panel();

    await open('Pages');

    for (const list of screen.getAllByLabelText('Add')) {
      await userEvent.click(list);
      expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'logged_in' })).toBeNull();
      await userEvent.keyboard('{Escape}');
    }

    expect(screen.queryByLabelText('logged_in')).toBeNull();

    await open('Audience');

    expect(screen.getByLabelText('logged_in')).toBeInTheDocument();
  });

  /**
   * **The prose folded into the empty state.** *"Empty means everywhere.
   * Exclusions always win."* stood above both lists on every visit, and half of
   * it described the empty list right below it. ADR 0042 rule 2: the first half
   * IS the empty state, and the second appears only when both lists hold
   * something — the only arrangement in which precedence decides anything.
   */
  it('says what an empty list means by being the empty state', async () => {
    panel();

    await open('Pages');

    expect(screen.getByText('Shown everywhere on the site.')).toBeInTheDocument();
    expect(screen.queryByText(/exclusions always win/i)).toBeNull();
  });

  it('says which list wins only once both of them hold something', async () => {
    panel({
      targeting: {
        include: [{ type: 'url', value: '/a' }],
        exclude: [{ type: 'url', value: '/b' }],
      },
    });

    await open('Pages');

    expect(screen.getByText(/exclusions always win/i)).toBeInTheDocument();
  });

  /**
   * Unset means **do not ask**, which is not the same as false: an Optin that
   * does not care whether the visitor is signed in is a different thing from
   * one that shows only to signed-out visitors.
   */
  it('offers three answers for the visitor predicate, and clears rather than storing false', async () => {
    const changed = panel({ targeting: { logged_in: true } });

    await open('Audience');
    await userEvent.selectOptions(screen.getByLabelText('logged_in'), '');

    expect(changed).toHaveBeenCalledWith({ targeting: {} });
  });
});

describe('the vocabulary the panel is given', () => {
  it('is the one that ships, so these tests cannot pass against a vocabulary the product lacks', () => {
    expect(allRuleTypes().map((type) => type.type)).toContain('page_load');
    expect(allRuleTypes().length).toBeGreaterThan(6);
  });
});

/**
 * ============================================================================
 * A SALE HAS AN END DATE, AND FORGETTING TO SWITCH IT OFF IS THE COMPLAINT.
 * ============================================================================
 * Free ships the *Promote a sale or offer* Goal. Without a schedule,
 * announcing one means remembering to unpublish the Optin by hand, and
 * forgetting is precisely the *"it keeps popping up"* support topic this whole
 * area exists to answer.
 *
 * **The control writes a wall time and never an instant.** What the merchant
 * types is a local date and time, because that is the only thing they can
 * reason about; resolving it against the site's timezone is the server's, once
 * (`src/Optin/Schedule.php`). A browser that resolved it here would resolve it
 * against the ADMIN's zone, which is not the site's.
 */
describe('when it runs', () => {
  it('writes what the merchant typed, as a wall time with no zone on it', async () => {
    const onChange = panel();

    await open('Schedule & frequency');
    await userEvent.type(screen.getByLabelText('Start showing it on'), '2026-11-27T09:00');

    expect(onChange).toHaveBeenLastCalledWith({ schedule: { starts_at: '2026-11-27 09:00' } });
  });

  /** An emptied box is "no boundary", not a boundary at the epoch. */
  it('drops the key when the merchant clears the box', async () => {
    const onChange = panel({ schedule: { starts_at: '2026-11-27 09:00' } });

    await open('Schedule & frequency');
    await userEvent.clear(screen.getByLabelText('Start showing it on'));

    expect(onChange).toHaveBeenLastCalledWith({ schedule: {} });
  });

  /**
   * "From Friday, forever" and "from now until Friday" are both things
   * merchants mean, so neither box requires the other.
   */
  it('takes an end with no start', async () => {
    const onChange = panel();

    await open('Schedule & frequency');
    await userEvent.type(screen.getByLabelText('Stop showing it on'), '2026-11-30T23:59');

    expect(onChange).toHaveBeenLastCalledWith({ schedule: { ends_at: '2026-11-30 23:59' } });
  });

  /**
   * The collapsed row says it, so the merchant reads it without opening.
   *
   * Asserted on the PIECES rather than on one formatted string: the date is
   * rendered through `Intl.DateTimeFormat` in the reader's own locale, so
   * pinning "27 November 2026, 09:00" would pin a test runner's locale rather
   * than a decision. What has to be true is that both ends are named and that
   * the wall time survives the round trip unshifted.
   */
  it('says the window on the section the merchant has not opened', () => {
    panel({ schedule: { starts_at: '2026-11-27 09:00', ends_at: '2026-11-30 23:59' } });

    const row = screen.getByRole('button', { name: /^Schedule & frequency/ });

    expect(row).toHaveTextContent(/Runs .*27.*2026.*to .*30.*2026/);
    expect(row).toHaveTextContent(/9:00/);
    expect(row).toHaveTextContent(/11:59|23:59/);
  });

  it('says a one-sided window as the open-ended thing it is', () => {
    panel({ schedule: { starts_at: '2026-11-27 09:00' } });

    expect(screen.getByRole('button', { name: /^Schedule & frequency/ })).toHaveTextContent(/Runs from .*27.*2026/);
  });
});
