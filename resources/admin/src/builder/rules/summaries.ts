import { __ } from '@wordpress/i18n';
import { entriesOn } from './axis';
import { howOftenSummary, whenSummary, whereSummary, whoSummary, type Summary } from './sentence';
import type { Frequency, Rule, RuleVocabulary, Targeting } from '../api';

/**
 * The four questions, answered — **once, for the two screens that ask them.**
 *
 * ============================================================================
 * THE PANEL READS THESE. SO DOES THE SUMMARY ABOVE IT.
 * ============================================================================
 * {@see DisplayRules} draws each answer as the label of a disclosure the
 * merchant opens to edit it; {@see Readiness} draws all four as the read-only
 * state of the Optin, above every tab. Same four sentences, same order, same
 * words for the questions.
 *
 * Spelling that twice would be two lists of four translated eyebrows, and the
 * failure would be quiet: the panel and the summary saying *"When"* and
 * *"Timing"* about the same axis on one screen. `sentence.ts` already owns the
 * sentences; this owns the four QUESTIONS and the wiring from a stored config
 * to them.
 *
 * The eyebrows are `__()` at call time rather than module constants, because
 * `wp.i18n` is loaded with the page and a top-level `__()` would be evaluated
 * before the dictionary exists — the same reason `structure/problems.ts` holds
 * thunks rather than strings.
 */

/** What the four sections and the readiness panel both read out of `config`. */
export interface DisplayRulesValue {
  readonly rules: readonly Rule[];
  readonly targeting: Targeting;
  readonly frequency: Frequency;
  readonly priority: number;
}

/** One axis, answered, with the question it answers. */
export interface AxisSummary extends Summary {
  /** A stable key — a control id, and never a translated string. */
  readonly id: string;
  /** Which question this answers — *"Where"*, *"When"*. */
  readonly eyebrow: string;
}

/**
 * Where, When, Who and How often, in the order a merchant is asked them.
 *
 * A fixed-length tuple rather than a bare array, so a caller may take the four
 * apart positionally and a fifth axis is a type error at every call site rather
 * than a silently missing section.
 */
export type AxisSummaries = readonly [AxisSummary, AxisSummary, AxisSummary, AxisSummary];

export function summarise(
  value: DisplayRulesValue,
  vocabulary: RuleVocabulary,
  overlay: boolean,
): AxisSummaries {
  const { rules, targeting, frequency, priority } = value;
  /*
   * Every type on every axis, because a summary reads a rule by its DECLARED
   * params and a Targeting rule can carry a preset like any other. The two
   * client axes are what decide which rules belong to When and to Who; the
   * union is only what looks a rule's declaration up.
   */
  const all = [...vocabulary.targeting, ...vocabulary.triggers, ...vocabulary.conditions];

  return [
    { id: 'where', eyebrow: __('Where', 'wconvert'), ...whereSummary(targeting) },
    {
      id: 'when',
      eyebrow: __('When', 'wconvert'),
      ...whenSummary(entriesOn(rules, vocabulary.triggers), all),
    },
    {
      id: 'who',
      eyebrow: __('Who', 'wconvert'),
      ...whoSummary(entriesOn(rules, vocabulary.conditions), all),
    },
    {
      id: 'how-often',
      eyebrow: __('How often', 'wconvert'),
      ...howOftenSummary(frequency, priority, overlay),
    },
  ];
}
