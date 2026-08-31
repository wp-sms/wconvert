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

/** Open one disclosure by the question it answers. */
const open = (eyebrow: string) => userEvent.click(screen.getByRole('button', { name: new RegExp(`^${eyebrow}`) }));

describe('the four sections', () => {
  it('asks Where, When, Who and How often, in that order', () => {
    panel();

    // The order is the order a merchant asks the questions in, and it is read
    // off the DOM rather than off four separate lookups so a reshuffle fails
    // here rather than passing four times.
    expect(
      screen
        .getAllByRole('button', { expanded: false })
        .map((button) => button.querySelector('.wconvert-section__eyebrow')?.textContent),
    ).toEqual(['Where', 'When', 'Who', 'How often']);
  });

  it('starts collapsed and opens on click', async () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 20 }] });

    expect(screen.queryByLabelText('Add a trigger')).toBeNull();

    await open('When');

    expect(screen.getByLabelText('Add a trigger')).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: /^When/ })).toHaveTextContent('Never — it has no trigger yet');
  });

  /**
   * **The default allowance is not "every time".** Both switches are ON when
   * absent, so an untouched Optin already stops when the visitor closes it or
   * signs up — and a summary reading "Every time" would be a lie on the
   * commonest Optin there is.
   */
  it('reads the default allowance as stopping, not as unlimited', () => {
    panel();

    expect(screen.getByRole('button', { name: /^How often/ })).toHaveTextContent(
      'Every time, until they close it or sign up',
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

    expect(screen.getByRole('button', { name: /^Where/ })).toHaveTextContent('On 2 pages, except 1 page');
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

    expect(screen.getByRole('button', { name: /^When/ })).toHaveTextContent('needs selector');
  });

  /** And a rule with everything it needs reads as its phrase, with its own values in it. */
  it('reads a complete rule as its phrase, with the merchant’s value in it', () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 20 }] });

    expect(screen.getByRole('button', { name: /^When/ })).toHaveTextContent('time_on_page 20');
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

    await open('When');
    await open('Who');

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

    await open('When');
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

    await open('When');
    await userEvent.click(screen.getByRole('radio', { name: 'Waits for one of these' }));

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

    await open('When');

    expect(screen.getByText(/This never runs/)).toBeInTheDocument();
    // And nothing offers to add another, because anything added would be one
    // more rule that never runs — offered by us.
    expect(screen.queryByLabelText('Add a trigger')).toBeNull();
  });

  /** `page_load` is never in the add control: it is the radio, and one decision gets one control. */
  it('keeps page_load out of the list it is not a member of', async () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 8 }] });

    await open('When');

    const add = screen.getByLabelText('Add a trigger');

    expect(within(add).queryByRole('option', { name: 'page_load' })).toBeNull();
  });

  /**
   * **Every Optin has at least one Trigger.** The screen stops the merchant
   * reaching zero and the save route refuses the same state — one of those is
   * a courtesy and the other is the guarantee.
   */
  it('will not remove the only trigger', async () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 20 }] });

    await open('When');

    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  /**
   * **Every row IS removable once `page_load` is carrying the Optin**, because
   * none of them is doing anything — the guarantee is that the Optin keeps a
   * Trigger it can act on, and `page_load` is one.
   */
  it('lets the last unreachable trigger go, because it was never the one firing', async () => {
    panel({ rules: [{ type: 'page_load' }, { type: 'time_on_page', seconds: 20 }] });

    await open('When');

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

    await open('When');

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

    await open('When');

    expect(screen.getByText(/Standing in for/)).toHaveTextContent('exit_intent');
    expect(screen.queryByRole('button', { name: /Dismiss|Got it|Hide/ })).toBeNull();
  });

  /** A rule the merchant asked for carries no such note. */
  it('says nothing of the sort about an ordinary rule', async () => {
    panel({ rules: [{ type: 'time_on_page', seconds: 15 }] });

    await open('When');

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

    await open('When');
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

    await open('When');

    const add = screen.getByLabelText('Add a trigger');

    expect(within(add).queryByRole('option', { name: 'click_element' })).toBeNull();
    expect(screen.getAllByText(/With WConvert Pro:/).length).toBeGreaterThan(0);
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
      { types: ruleTypes({ free: 'ready', pro: 'unavailable' }) },
    );

    await open('Who');

    const explained = screen.getByText(/Not available on this site:/).parentElement as HTMLElement;

    expect(within(explained).getByText('cart_has_items')).toBeInTheDocument();
    expect(within(explained).getAllByText(/Needs WooCommerce on this site/).length).toBeGreaterThan(0);
    expect(within(explained).queryByText(/Pro/)).toBeNull();
  });

  /** And a rule already ON the Optin says the same thing on its own row. */
  it('says the same thing on the row of a rule the Optin already carries', async () => {
    panel(
      { rules: [{ type: 'page_load' }, { type: 'cart_has_items' }] },
      { types: ruleTypes({ free: 'ready', pro: 'unavailable' }) },
    );

    await open('Who');

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

    await open('Where');

    for (const list of screen.getAllByLabelText('Add')) {
      expect(within(list).getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Choose…',
        'post',
        'singular',
        'archive',
        'term',
        'url',
      ]);
    }
  });

  /**
   * The visitor predicate is held APART from the two lists, as a field beside
   * them: the lists are a union of page sets, so a visitor rule dropped into
   * the include list would widen the Optin to the whole site for anyone
   * matching it (ADR 0005).
   */
  it('keeps the visitor predicate out of the page lists', async () => {
    panel();

    await open('Where');

    for (const list of screen.getAllByLabelText('Add')) {
      expect(within(list).queryByRole('option', { name: 'logged_in' })).toBeNull();
    }

    expect(screen.getByLabelText('logged_in')).toBeInTheDocument();
  });

  /**
   * **Exclude beats include, and the screen says so** — along with the other
   * half a merchant cannot guess: an empty include list is "everywhere", not
   * "nowhere".
   */
  it('states how the two lists combine, and what an empty one means', async () => {
    panel();

    await open('Where');

    expect(screen.getByText(/Empty means everywhere/)).toBeInTheDocument();
    expect(screen.getByText(/Exclusions always win/)).toBeInTheDocument();
  });

  /**
   * Unset means **do not ask**, which is not the same as false: an Optin that
   * does not care whether the visitor is signed in is a different thing from
   * one that shows only to signed-out visitors.
   */
  it('offers three answers for the visitor predicate, and clears rather than storing false', async () => {
    const changed = panel({ targeting: { logged_in: true } });

    await open('Where');
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
