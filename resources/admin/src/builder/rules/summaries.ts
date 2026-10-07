import { __, sprintf } from '@wordpress/i18n';
import type { ConvertingAct } from '../structure/catalogue';
import type { DisplayPlan } from '@loader/display-rules';
import { groupSummary } from './plan';
import { datesSummary, howOftenSummary, whereSummary, type Summary } from './sentence';
import { derive, type SectionId } from './picks';
import type { Frequency, RuleVocabulary, Schedule, Targeting } from '../api';

/**
 * The five questions, answered — **once, for every screen that asks them.**
 *
 * ============================================================================
 * THE MENU READS THESE. SO DO READINESS AND THE CAMPAIGN DETAILS.
 * ============================================================================
 * {@see DisplayRules} draws each answer under its question in the side menu;
 * {@see Readiness} and `CampaignDetails` draw all five as the read-only state
 * of the Optin. Same five answers, same order, same words for the questions.
 *
 * An answer is the matched [[Quick pick]]'s own words — *"After 15 seconds"*,
 * *"Once per visit"* — so the menu reads back what the chip says. Custom reads
 * the rules instead. A section that needs attention reads its problem rather
 * than a pick, because Readiness quotes the text as the blocker.
 *
 * The eyebrows are `__()` at call time rather than module constants, because
 * `wp.i18n` is loaded with the page and a top-level `__()` would be evaluated
 * before the dictionary exists — the same reason `structure/problems.ts` holds
 * thunks rather than strings.
 */

/** What the five sections and the readiness panel all read out of `config`. */
export interface DisplayRulesValue {
  readonly display_rules?: DisplayPlan;
  readonly targeting: Targeting;
  readonly frequency: Frequency;
  /** *When it runs* — the Dates question, a coarser grain than the allowance. */
  readonly schedule: Schedule;
  readonly priority: number;
}

/** One axis, answered, with the question it answers. */
export interface AxisSummary extends Summary {
  /** A stable key — a control id, and never a translated string. */
  readonly id: SectionId;
  /** Which question this answers — *"Where"*, *"When"*. */
  readonly eyebrow: string;
}

/**
 * Where, Who, When, How often and Dates, in screen order.
 *
 * A fixed-length tuple, so a sixth question is a type error at every call site
 * rather than a silently missing section. Callers look an entry up by its id.
 */
export type AxisSummaries = readonly [AxisSummary, AxisSummary, AxisSummary, AxisSummary, AxisSummary];

/** The five questions, in screen order. */
export function questions(): Record<SectionId, string> {
  return {
    where: __('Where does it show?', 'wconvert'),
    who: __('Who sees it?', 'wconvert'),
    when: __('When does it open?', 'wconvert'),
    'how-often': __('How often?', 'wconvert'),
    dates: __('Dates', 'wconvert'),
  };
}

export function summarise(
  value: DisplayRulesValue,
  vocabulary: RuleVocabulary,
  overlay: boolean,
  act: ConvertingAct = 'submit',
): AxisSummaries {
  const { display_rules: plan, targeting, frequency, schedule, priority } = value;
  /*
   * Every type on every axis, because a summary reads a rule by its DECLARED
   * params and a Targeting rule can carry a preset like any other.
   */
  const all = [...vocabulary.targeting, ...vocabulary.triggers, ...vocabulary.conditions];
  const asked = questions();
  const answer = (id: SectionId, custom: Summary): AxisSummary => {
    const pick = derive(id, value, vocabulary);
    return { id, eyebrow: asked[id], attention: custom.attention, text: pick.open || custom.attention ? custom.text : pick.label(value) };
  };

  const audience = plan?.audience;
  const groups = audience?.mode === 'groups' ? audience.groups.map(group => groupSummary(group, all)) : [];
  const opening = plan?.opening;
  const when = !opening ? { text: __('Replace older display rules', 'wconvert'), attention: true }
    : opening.mode === 'immediate' ? { text: __('Right away', 'wconvert'), attention: false }
      : groupSummary({ match: opening.mode === 'click' ? 'any' : opening.match, rules: opening.rules }, all);
  if (opening?.mode === 'automatic' && (!Number.isFinite(opening.minimum_seconds ?? 0) || (opening.minimum_seconds ?? 0) < 0 || (opening.minimum_seconds ?? 0) > 3600)) when.attention = true;
  if (opening?.mode === 'automatic' && opening.minimum_seconds) when.text += ` · ${sprintf(__('not before %d seconds', 'wconvert'), opening.minimum_seconds)}`;
  const where = targeting.mode === 'selected' && !targeting.include?.length
    ? { text: __('Choose at least one page', 'wconvert'), attention: true }
    : whereSummary(targeting);
  return [
    { ...answer('where', where), ...(!where.attention && targeting.exclude?.length ? { text: where.text } : {}) },
    answer('who', { text: audience?.mode === 'everyone' ? __('Everyone', 'wconvert') : groups.map(group => `(${group.text})`).join(__(' or ', 'wconvert')) || __('Choose who sees it', 'wconvert'),
      attention: !audience || (audience.mode === 'groups' && (!groups.length || groups.some(group => group.attention))) }),
    answer('when', when),
    answer('how-often', howOftenSummary(frequency, priority, overlay, act)),
    answer('dates', datesSummary(schedule)),
  ];
}

/** One section's answer, by id rather than by position. */
export function summaryOf(summaries: AxisSummaries, id: SectionId): AxisSummary {
  return summaries.find(summary => summary.id === id)!;
}
