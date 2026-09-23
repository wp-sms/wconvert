import { __ } from '@wordpress/i18n';
import type { ConvertingAct } from '../structure/catalogue';
import type { DisplayPlan } from '@loader/display-rules';
import { groupSummary } from './plan';
import { howOftenSummary, whereSummary, type Summary } from './sentence';
import type { Frequency, RuleVocabulary, Schedule, Targeting } from '../api';

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
  readonly display_rules?: DisplayPlan;
  readonly targeting: Targeting;
  readonly frequency: Frequency;
  /**
   * *When it runs*, on the same axis as the allowance.
   *
   * It sits inside "Schedule & frequency" rather than becoming a fifth section because it
   * answers the same question at a coarser grain — the allowance is how often
   * ONE VISITOR may meet it, and this is when the campaign is on at all — and
   * because a merchant reading one row wants both facts in the same sentence:
   * *"Runs 27 Nov to 30 Nov · every time, until they close it"*.
   */
  readonly schedule: Schedule;
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
 * Pages, Audience, When it appears, and Schedule & frequency, in screen order.
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
  act: ConvertingAct = 'submit',
): AxisSummaries {
  const { display_rules: plan, targeting, frequency, schedule, priority } = value;
  /*
   * Every type on every axis, because a summary reads a rule by its DECLARED
   * params and a Targeting rule can carry a preset like any other. The two
   * client axes are what decide which rules belong to When and to Who; the
   * union is only what looks a rule's declaration up.
   */
  const all = [...vocabulary.targeting, ...vocabulary.triggers, ...vocabulary.conditions];

  const audience = plan?.audience;
  const groups = audience?.mode === 'groups' ? audience.groups.map(group => groupSummary(group, all)) : [];
  const opening = plan?.opening;
  const when = !opening ? { text: __('Replace older display rules', 'wconvert'), attention: true }
    : opening.mode === 'immediate' ? { text: __('As soon as the page is eligible', 'wconvert'), attention: false }
      : groupSummary({ match: opening.mode === 'click' ? 'any' : opening.match, rules: opening.rules }, all);
  if (opening?.mode === 'automatic' && (!Number.isFinite(opening.minimum_seconds ?? 0) || (opening.minimum_seconds ?? 0) < 0 || (opening.minimum_seconds ?? 0) > 3600)) when.attention = true;
  if (opening?.mode === 'automatic' && opening.minimum_seconds) when.text += ` · ${opening.minimum_seconds} ` + __('seconds minimum', 'wconvert');
  return [
    { id: 'where', eyebrow: __('Pages', 'wconvert'), ...whereSummary(targeting),
      ...(targeting.mode === 'selected' && !targeting.include?.length ? { text: __('Choose included pages', 'wconvert'), attention: true } : {}) },
    { id: 'who', eyebrow: __('Audience', 'wconvert'), text: audience?.mode === 'everyone' ? __('Everyone', 'wconvert') : groups.map(group => `(${group.text})`).join(__(' OR ', 'wconvert')) || __('Choose an audience', 'wconvert'),
      attention: !audience || (audience.mode === 'groups' && (!groups.length || groups.some(group => group.attention))) },
    { id: 'when', eyebrow: __('Opening moment', 'wconvert'), ...when },
    { id: 'how-often', eyebrow: __('Schedule & limits', 'wconvert'), ...howOftenSummary(frequency, schedule, priority, overlay, act) },
  ];
}
