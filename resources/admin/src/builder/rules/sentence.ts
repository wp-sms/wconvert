import { __, _n, _x, sprintf } from '@wordpress/i18n';
import { fromRule } from '../presets';
import type { Entry } from './axis';
import type { Frequency, Rule, RuleParam, RuleType, Targeting } from '../api';

/**
 * The four section summaries — pure, and the only place the rules are read as
 * prose.
 *
 * ============================================================================
 * THE SENTENCE IS THE DISCLOSURE'S LABEL. IT IS NOT MAD LIBS.
 * ============================================================================
 * The obvious shape for this screen is a literal sentence with the controls
 * embedded in it — *"Fires after ⟨15⟩ seconds"* with a number input where the
 * 15 is. **That cannot be localised.** `sprintf` returns a string and not JSX,
 * and a language that reorders subject and object cannot be served by
 * splitting one translation around React children: the translator would be
 * handed three fragments with no way to say which order they go in. This admin
 * is verified 44/44 under `fa_IR` and that is not a property to spend.
 *
 * So the collapsed row shows the sentence and expanding it reveals an ordinary
 * form. Same merchant experience, and since a `<button>` may contain phrasing
 * content but not a form control, it is also the only accessible shape for a
 * disclosure whose label reads as a sentence.
 *
 * ============================================================================
 * TWO HOMES FOR THE WORDS, AND IT IS ADR 0013'S RULE READ FROM THE OTHER END.
 * ============================================================================
 * The VOCABULARY fragments — *"after %1$s seconds on the page"* — are keyed by
 * manifest entry, so they are the same category as `RuleLabels::types()` and
 * live in `src/Rules/RuleLabels.php` where `wp i18n make-pot` can see them.
 * They arrive here on `RuleType.phrase` and `RulePreset.phrase`.
 *
 * The FRAMES and the joiners — *"Fires %s"*, *"or"*, *"On every page"* — are
 * keyed by nothing at all. They are ordinary screen copy and are `__()` here,
 * reaching `wp.i18n` through `wp_set_script_translations`.
 */

/** One section's summary, and whether anything in it stops the Optin working. */
export interface Summary {
  readonly text: string;
  /**
   * A rule in this section is missing a value it needs, so it can never
   * answer true.
   *
   * Reported on the COLLAPSED row, which is the whole point: ADR 0042 rule 3
   * asks that a control which cannot do its job say so before the click, not
   * after it. A section that reads *"Fires when someone clicks"* with nothing
   * after it is a merchant about to publish an Optin that never shows.
   */
  readonly incomplete: boolean;
}

// ============================================================================
// WHERE — COUNTS, NEVER TITLES.
// ============================================================================

/**
 * *Where* it may appear, as a count of rules rather than a list of pages.
 *
 * **Naming the pages would need an async lookup this sentence cannot wait
 * for.** A stored rule holds `{type: 'post', value: '42'}` and nothing else;
 * turning 42 into "Pricing" is a round trip to `wp/v2/search`, which means the
 * summary would render blank, then flicker into words — on a collapsed row the
 * merchant is reading to decide whether to open it. Counts are synchronous,
 * and they stay correct on the day that lookup 500s or the post is
 * unpublished.
 *
 * `logged_in` is a clause rather than a member of the counts, because it is a
 * FIELD beside the two lists rather than a page rule: the lists are a union of
 * page sets, and a visitor predicate in one would widen the Optin to the whole
 * site for anyone matching it (ADR 0005).
 */
export function whereSummary(targeting: Targeting): Summary {
  const included = targeting.include?.length ?? 0;
  const excluded = targeting.exclude?.length ?? 0;

  const pages =
    included === 0 && excluded === 0
      ? __('On every page', 'wconvert')
      : included === 0
        ? sprintf(
            /* translators: %s: a count of page rules, e.g. “2 pages”. */
            __('Everywhere except %s', 'wconvert'),
            countOfPages(excluded),
          )
        : excluded === 0
          ? sprintf(
              /* translators: %s: a count of page rules, e.g. “3 pages”. */
              __('On %s', 'wconvert'),
              countOfPages(included),
            )
          : sprintf(
              /* translators: 1: a count of page rules it shows on. 2: a count it is kept off. */
              __('On %1$s, except %2$s', 'wconvert'),
              countOfPages(included),
              countOfPages(excluded),
            );

  if (targeting.logged_in === undefined) {
    return { text: pages, incomplete: false };
  }

  return {
    text: sprintf(
      /* translators: 1: where it shows, e.g. “On every page”. 2: which visitors, e.g. “signed-in visitors only”. */
      __('%1$s, %2$s', 'wconvert'),
      pages,
      targeting.logged_in
        ? __('signed-in visitors only', 'wconvert')
        : __('signed-out visitors only', 'wconvert'),
    ),
    incomplete: false,
  };
}

const countOfPages = (count: number): string =>
  sprintf(
    /* translators: %d: a number of page rules. */
    _n('%d page', '%d pages', count, 'wconvert'),
    count,
  );

// ============================================================================
// WHEN AND WHO — THE AXES' OWN CONNECTIVES, NEVER THE MERCHANT'S.
// ============================================================================

/**
 * *When* it fires: any one Trigger, so the joiner is **or**.
 *
 * That connective is the axis's and is not a choice on offer. There is no
 * ALL/ANY grouping anywhere on this screen, and ADR 0005's nesting ceiling is
 * permanent rather than "not in v1" — precisely because "we'll add OR later"
 * is the path by which an expression language arrives.
 *
 * **An Optin with no Trigger can never fire**, and the save route already
 * refuses one. Saying so here is ADR 0042 rule 3: the merchant learns it from
 * the section they are looking at rather than from a refusal after the click.
 */
export function whenSummary(entries: readonly Entry[], types: readonly RuleType[]): Summary {
  if (entries.length === 0) {
    return { text: __('Never — it has no trigger yet', 'wconvert'), incomplete: true };
  }

  const read = entries.map(([rule]) => phraseOf(rule, types));

  return {
    text: sprintf(
      /* translators: %s: one or more trigger phrases joined by “or”, e.g. “after 15 seconds on the page”. */
      __('Fires %s', 'wconvert'),
      join(read.map((each) => each.text), _x('or', 'joins triggers, any one of which fires', 'wconvert')),
    ),
    incomplete: read.some((each) => each.incomplete),
  };
}

/**
 * *Who* sees it: every Condition holds at the instant a Trigger fires, so the
 * joiner is **and**.
 */
export function whoSummary(entries: readonly Entry[], types: readonly RuleType[]): Summary {
  if (entries.length === 0) {
    return { text: __('Anyone who reaches it', 'wconvert'), incomplete: false };
  }

  const read = entries.map(([rule]) => phraseOf(rule, types));

  return {
    text: sprintf(
      /* translators: %s: one or more condition phrases joined by “and”. */
      __('Only when %s', 'wconvert'),
      join(read.map((each) => each.text), _x('and', 'joins conditions, all of which must hold', 'wconvert')),
    ),
    incomplete: read.some((each) => each.incomplete),
  };
}

// ============================================================================
// HOW OFTEN — FOUR FIELDS, SIXTEEN COMBINATIONS, ONE SENTENCE EACH.
// ============================================================================

/**
 * The allowance, read out.
 *
 * **The default is not "every time".** `stopAfterDismiss` and
 * `stopAfterConversion` are both ON when absent — `frequency.ts` tests
 * `!== false` — so an untouched Optin already stops when the visitor closes it
 * or signs up, and a summary reading "Every time" would be a lie on the
 * commonest Optin there is.
 *
 * `priority` is appended only where it decides something. `arbitrate()` sorts
 * overlays and leaves `inline` Optins alone, so on an inline design the number
 * is real, stored, and inert — and a summary that mentioned it would be
 * telling the merchant about a control that changes nothing.
 */
export function howOftenSummary(frequency: Frequency, priority: number, overlay: boolean): Summary {
  const caps: string[] = [];

  if (frequency.maxImpressions !== undefined) {
    caps.push(
      sprintf(
        /* translators: %d: a number of showings. */
        _n('at most %d time', 'at most %d times', frequency.maxImpressions, 'wconvert'),
        frequency.maxImpressions,
      ),
    );
  }

  if (frequency.cooldownDays !== undefined) {
    caps.push(
      sprintf(
        /* translators: %d: a number of days. */
        _n('at most once every %d day', 'at most once every %d days', frequency.cooldownDays, 'wconvert'),
        frequency.cooldownDays,
      ),
    );
  }

  const stoppers: string[] = [];

  // Absent means ON, which is why these read `!== false` rather than `=== true`
  // — the same test the engine makes of the same key.
  if (frequency.stopAfterDismiss !== false) {
    stoppers.push(__('they close it', 'wconvert'));
  }

  if (frequency.stopAfterConversion !== false) {
    stoppers.push(__('they sign up', 'wconvert'));
  }

  const and = _x('and', 'joins two limits on how often an Optin shows', 'wconvert');
  const or = _x('or', 'joins two things that stop an Optin showing again', 'wconvert');

  const text =
    caps.length === 0
      ? stoppers.length === 0
        ? __('Every time, with no limit', 'wconvert')
        : sprintf(
            /* translators: %s: what stops it, e.g. “they close it or they sign up”. */
            __('Every time, until %s', 'wconvert'),
            join(stoppers, or),
          )
      : stoppers.length === 0
        ? sprintf(
            /* translators: %s: one or more limits, e.g. “at most 3 times”. */
            __('Shows %s', 'wconvert'),
            join(caps, and),
          )
        : sprintf(
            /* translators: 1: one or more limits, e.g. “at most 3 times”. 2: what stops it, e.g. “they close it”. */
            __('Shows %1$s, and stops once %2$s', 'wconvert'),
            join(caps, and),
            join(stoppers, or),
          );

  if (!overlay || priority === 0) {
    return { text, incomplete: false };
  }

  return {
    text: sprintf(
      /* translators: 1: the allowance, e.g. “Every time, until they close it”. 2: a priority number. */
      __('%1$s · priority %2$d', 'wconvert'),
      text,
      priority,
    ),
    incomplete: false,
  };
}

// ============================================================================
// ONE RULE, READ.
// ============================================================================

/**
 * One rule as a clause, with its own values in it.
 *
 * The preset's phrase wins where it has one, because that is what a preset IS
 * (ADR 0005): *"after a few seconds"*, not *"after 5 seconds on the page"* —
 * which would be the general form with extra steps, and would teach the
 * merchant that "after a few seconds" is `time_on_page` underneath, the one
 * thing a preset exists to spare them.
 *
 * A type this build has never heard of reads as its raw key. That is the only
 * honest thing left to say about it, and it matches the row underneath.
 */
export function phraseOf(rule: Rule, types: readonly RuleType[]): Summary {
  const read = fromRule(rule, types);

  if (read === null) {
    return { text: rule.type, incomplete: true };
  }

  const { type, preset } = read;
  // The params the phrase takes, in DECLARED order — which is what makes
  // `%2$s` mean the second one and lets a translator move it anywhere.
  const open = Object.keys(type.params).filter(
    (param) => !(preset !== null && preset.phrase !== null && param in preset.fixed),
  );

  const missing = open.filter((param) => !supplied(rule[param]));
  const values = open.map((param) => format(type.params[param], rule[param]));
  const phrase = preset?.phrase ?? type.phrase;

  if (missing.length > 0) {
    return {
      text: sprintf(
        /* translators: 1: what the rule does, e.g. “Clicks an element”. 2: the setting it still needs, e.g. “CSS selector”. */
        __('%1$s — needs %2$s', 'wconvert'),
        preset?.label ?? type.label,
        join(
          missing.map((param) => type.params[param].label),
          _x('and', 'joins the settings a rule is still missing', 'wconvert'),
        ),
      ),
      incomplete: true,
    };
  }

  // A phrase with no placeholders is passed through untouched rather than
  // through `sprintf`, which would eat a literal `%` out of a merchant's own
  // CSS selector.
  return { text: values.length === 0 ? phrase : fill(phrase, ...values), incomplete: false };
}

/**
 * `sprintf` where the format is not a literal.
 *
 * `@wordpress/i18n` types its arguments by reading the placeholders out of the
 * literal format string, which cannot work here: the phrase is translated copy
 * that arrives from PHP at runtime, and how many values it takes is a property
 * of the rule type rather than of this call site.
 *
 * The arity is asserted where it can be — `RuleLabelParityTest` checks every
 * shipped phrase against the same manifest these params come from, in both
 * directions. That is a stronger guarantee than a compiler could give a
 * dynamic string, which is why this cast is the honest shape rather than a
 * gap.
 */
const fill = sprintf as unknown as (format: string, ...values: string[]) => string;

/**
 * Has this param been given a value?
 *
 * ============================================================================
 * A SECOND SPELLING OF `RuleVocabulary::couldFire()`'s EMPTINESS TEST, AND IT
 * IS DELIBERATELY NOT THE WHOLE OF IT.
 * ============================================================================
 * The emptiness rule is copied exactly — an absent key, an empty string and an
 * empty set all mean "nothing was chosen", while `false` and `0` are values a
 * merchant meant. A `scroll_depth` of 0 is "as soon as they arrive".
 *
 * **What is NOT copied is the `authored` exemption, and that is the point.**
 * The server skips authored params so a save is not refused over a selector
 * only the merchant can supply — a `click_element` arriving blank from a
 * [[Playbook]] is exactly the state prefill hands them to complete (ADR 0012).
 * This is the surface that has to TELL them to complete it. So the rule here
 * is stricter than the rule there, on purpose: PHP decides whether the Optin
 * may be saved, and this decides whether the sentence may claim it will fire.
 *
 * Two spellings of an emptiness test with no test asserting they agree is a
 * real cost, and the honest place to pay it is beside the sentence that needs
 * it. `tests/js/builder-sentence.test.ts` pins the four cases.
 */
const supplied = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);

/**
 * A stored value as the merchant's own word for it.
 *
 * A closed option set carries labels resolved for this install — a custom post
 * type's name is whatever its author registered, and `mobile` is "Mobile" —
 * so a summary printing the raw value would be showing the merchant the
 * manifest rather than their site.
 */
function format(param: RuleParam, value: unknown): string {
  const one = (each: unknown): string =>
    param.options.find((option) => option.value === String(each))?.label ?? String(each);

  if (Array.isArray(value)) {
    return join(value.map(one), _x('or', 'joins the values of one set-valued rule', 'wconvert'));
  }

  return one(value);
}

/**
 * A list joined with "and" — for a caller outside this file that has items of
 * its own to read out, and no reason to spell the joiner a second time.
 */
export const listWithAnd = (items: readonly string[]): string =>
  join(items, _x('and', 'joins the last item of a plain list', 'wconvert'));

/**
 * A list, in words.
 *
 * Both the separator and the conjunction are translated, because neither is
 * punctuation every language shares — and the two-item case is its own string
 * rather than the general one with an empty head, so a translator can give it
 * the form their language actually uses.
 */
function join(items: readonly string[], conjunction: string): string {
  if (items.length === 0) {
    return '';
  }

  if (items.length === 1) {
    return items[0];
  }

  const head = items.slice(0, -1).join(_x(', ', 'separates all but the last item of a list', 'wconvert'));

  return sprintf(
    /* translators: 1: every item but the last, already joined. 2: the conjunction, “or” or “and”. 3: the last item. */
    _x('%1$s %2$s %3$s', 'joins the last item of a list', 'wconvert'),
    head,
    conjunction,
    items[items.length - 1],
  );
}
