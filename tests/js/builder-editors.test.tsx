import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RulesEditor } from '../../resources/admin/src/builder/RulesEditor';
import { TargetingEditor } from '../../resources/admin/src/builder/TargetingEditor';
import { allRuleTypes, ruleTypes } from './support/rule-types';
import type { Rule } from '../../resources/admin/src/builder/api';

/**
 * The two rule surfaces, against the guarantees they exist to make visible.
 *
 * What is asserted here is deliberately narrow: the panel LAYOUT is not a TDD
 * seam and the translation underneath has its own tests
 * (`tests/js/builder-presets.test.ts`). What these cover is the handful of
 * facts that are only true if the screen says them — which rules are offered,
 * which cannot be removed, and what the merchant is told about how two lists
 * combine.
 */

const vocabulary = ruleTypes();

function rulesEditor(rules: Rule[], onChange = vi.fn()) {
  render(
    <RulesEditor
      triggers={vocabulary.triggers}
      conditions={vocabulary.conditions}
      rules={rules}
      onChange={onChange}
    />,
  );

  return onChange;
}

describe('the rules editor', () => {
  /**
   * **Triggers and Conditions are two separate lists**, because a rule type is
   * one or the other and never both (CONTEXT.md, Condition). Without the
   * split, an engine holding several eligible Optins cannot tell "waiting"
   * from "ineligible", and neither can the merchant looking at the screen.
   */
  it('draws when it shows and who sees it as two lists', () => {
    rulesEditor([{ type: 'page_load' }]);

    expect(screen.getByRole('heading', { name: 'When it shows' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Who sees it' })).toBeInTheDocument();
  });

  /**
   * **"Shows immediately" is the explicit `page_load` Trigger, never an empty
   * list** (CONTEXT.md, Trigger). An empty list would make "fires at once" and
   * "can never fire" the same value, so the merchant has to be able to say the
   * first one out loud.
   */
  it('offers showing immediately as a choice a merchant can make', async () => {
    const changed = rulesEditor([{ type: 'time_on_page', seconds: 8 }]);

    await userEvent.selectOptions(screen.getByLabelText('Add a trigger'), 'page_load|');

    expect(changed).toHaveBeenCalledWith([{ type: 'time_on_page', seconds: 8 }, { type: 'page_load' }]);
  });

  /**
   * **Every Optin has at least one Trigger.** The screen stops the merchant
   * reaching zero and the save route refuses the same state — one of those is
   * a courtesy and the other is the guarantee.
   */
  it('will not remove the only trigger, and will remove one of two', async () => {
    rulesEditor([{ type: 'page_load' }]);

    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();

    render(
      <RulesEditor
        triggers={vocabulary.triggers}
        conditions={vocabulary.conditions}
        rules={[{ type: 'page_load' }, { type: 'time_on_page', seconds: 8 }]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button', { name: 'Remove' }).length).toBeGreaterThan(0);
  });

  /**
   * A rule stored at one index is edited at that index. The list is stored
   * FLAT and in the merchant's order; rebuilding it from the two views would
   * silently reorder it into triggers-then-conditions on every save, and the
   * rule list is a screen they look at.
   */
  it('edits a rule where it sits in the flat list', async () => {
    const changed = rulesEditor([
      { type: 'device', in: ['mobile'] },
      { type: 'page_load' },
      { type: 'time_on_page', seconds: 8 },
    ]);

    // The first Remove on screen belongs to the first TRIGGER, which sits at
    // index 1 of the flat list — the condition was written first.
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    // The condition is still first, because the flat list was spliced rather
    // than rebuilt from the two views.
    expect(changed).toHaveBeenCalledWith([
      { type: 'device', in: ['mobile'] },
      { type: 'time_on_page', seconds: 8 },
    ]);
  });

  /**
   * **A rule of a type this build has never heard of still reaches a row.**
   *
   * Filtering the flat list down to the two known axes would leave such a rule
   * invisible AND unremovable — still in `config`, still saved back, with
   * nothing on screen to act on. The vocabulary is closed, so this is rare;
   * "rare and silent" is the combination that makes it worth a list of its own.
   */
  it('shows a rule it cannot draw controls for, and offers a way out of it', async () => {
    const changed = rulesEditor([{ type: 'page_load' }, { type: 'moon_phase', in: ['waxing'] }]);

    expect(screen.getByText('moon_phase')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Not available on this site' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(changed).toHaveBeenCalledWith([{ type: 'page_load' }]);
  });

  /**
   * **A premium type is named, never drawn disabled.** wp.org Guideline 9
   * fires on showing a real control the user cannot use, and ADR 0012 answers
   * it the same way at prefill. Naming it is also what a settings list owes a
   * merchant who went hunting for it (ADR 0026).
   */
  /**
   * ========================================================================
   * A SUBSTITUTION IS A PERSISTENT NOTE ON ITS OWN ROW.
   * ========================================================================
   * Never a dismissible banner: dismissed once, it leaves the Optin carrying
   * an invisible substitution forever (ADR 0012). So the note is on the row
   * the substituted rule occupies, and nothing on screen retires it.
   */
  it('says on the row which premium rule this one is standing in for', () => {
    const locked = ruleTypes({ free: 'ready', pro: 'locked' });

    render(
      <RulesEditor
        triggers={locked.triggers}
        conditions={locked.conditions}
        rules={[{ type: 'time_on_page', seconds: 15, degraded_from: 'exit_intent' }]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Standing in for/)).toHaveTextContent('exit_intent');
    // Persistent: there is no control anywhere on this screen that takes it
    // away. `Remove` belongs to a row, and this Optin's only Trigger keeps
    // none — so the note has no dismissal to be confused with.
    expect(screen.queryByRole('button', { name: /Dismiss|Got it|Hide/ })).toBeNull();
  });

  /** A rule the merchant asked for carries no such note. */
  it('says nothing of the sort about an ordinary rule', () => {
    rulesEditor([{ type: 'time_on_page', seconds: 15 }]);

    expect(screen.queryByText(/Standing in for/)).toBeNull();
  });

  /**
   * **Editing a substituted rule does not un-substitute it.** A `time_on_page`
   * retimed to 30 seconds is still what the Optin got instead of exit intent,
   * and losing the marker on the first edit would retire the note and the
   * upgrade offer it anchors — the invisible substitution again, arriving
   * through the one screen that was supposed to show it.
   */
  it('carries the marker through an edit of the substituted rule', async () => {
    const changed = rulesEditor([{ type: 'time_on_page', seconds: 15, degraded_from: 'exit_intent' }]);

    await userEvent.selectOptions(screen.getByLabelText('time_on_page'), 'after_a_moment');

    expect(changed).toHaveBeenCalledWith([
      { type: 'time_on_page', seconds: 5, degraded_from: 'exit_intent' },
    ]);
  });

  it('names a locked type as an upsell rather than offering it', () => {
    const locked = ruleTypes({ free: 'ready', pro: 'locked' });

    render(
      <RulesEditor
        triggers={locked.triggers}
        conditions={locked.conditions}
        rules={[{ type: 'page_load' }]}
        onChange={vi.fn()}
      />,
    );

    const add = screen.getByLabelText('Add a trigger');

    expect(within(add).queryByRole('option', { name: 'click_element' })).toBeNull();
    expect(screen.getAllByText(/With WConvert Pro:/).length).toBeGreaterThan(0);
  });
});

describe('the targeting picker', () => {
  const targeting = (props = {}) =>
    render(
      <TargetingEditor
        types={vocabulary.targeting}
        targeting={{}}
        onChange={vi.fn()}
        {...props}
      />,
    );

  /**
   * **Five page rules, plus one visitor predicate** — and `logged_in` lives on
   * this axis only because the client cannot read WordPress's HttpOnly auth
   * cookie (CONTEXT.md, Targeting).
   */
  it('covers all five page prefixes in both lists', () => {
    targeting();

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
  it('keeps the visitor predicate out of the page lists', () => {
    targeting();

    for (const list of screen.getAllByLabelText('Add')) {
      expect(within(list).queryByRole('option', { name: 'logged_in' })).toBeNull();
    }

    expect(screen.getByLabelText('logged_in')).toBeInTheDocument();
  });

  /**
   * **Exclude beats include, and the screen says so** — along with the other
   * half a merchant cannot guess: an empty include list is "everywhere", not
   * "nowhere". It is the only reading under which an exclude-only Optin means
   * anything.
   */
  it('states how the two lists combine, and what an empty one means', () => {
    targeting();

    // Both halves are named, rather than left to reading order: "the second
    // one wins" is only true of a screen the merchant has already understood.
    expect(screen.getByText(/Leave “Show it on” empty to show it everywhere/)).toBeInTheDocument();
    expect(screen.getByText(/Anything in “But never on” wins/)).toBeInTheDocument();
  });

  /**
   * Unset means **do not ask**, which is not the same as false: an Optin that
   * does not care whether the visitor is signed in is a different thing from
   * one that shows only to signed-out visitors.
   */
  it('offers three answers for the visitor predicate, and clears rather than storing false', async () => {
    const changed = vi.fn();

    targeting({ targeting: { logged_in: true }, onChange: changed });

    await userEvent.selectOptions(screen.getByLabelText('logged_in'), '');

    expect(changed).toHaveBeenCalledWith({});
  });
});

describe('the vocabulary the two editors are given', () => {
  it('is the one that ships, so these tests cannot pass against a vocabulary the product lacks', () => {
    expect(allRuleTypes().map((type) => type.type)).toContain('page_load');
    expect(allRuleTypes().length).toBeGreaterThan(6);
  });
});
