import { adminSettings } from '../../settings';
import type { ConvertingAct } from '../structure/catalogue';
import { hasScheduleEnded } from '../../lib/wallTime';
import { __, _n, _x, sprintf } from '@wordpress/i18n';
import { fromRule } from '../presets';
import { readable, readableHours } from '../../lib/wallTime';
import { derive, type SectionId } from './picks';
import { everyType } from './plan';
import { summarise, type DisplayRulesValue } from './summaries';
import type { Frequency, Rule, RuleParam, RuleType, RuleVocabulary, Schedule, Targeting } from '../api';

/**
 * The five section answers and the one summary sentence — pure, and the only
 * place the rules are read as prose.
 *
 * ============================================================================
 * THE SENTENCE IS TOKENS IN A TRANSLATED FRAME, NEVER CONCATENATED.
 * ============================================================================
 * {@link sentenceParts} returns one lowercase phrase per question, each with
 * its own translated frame — `on %s`, `to %s` — and the screen drops the
 * framed phrases into `__('Shows %1$s %2$s, %3$s, %4$s.')`. The phrase is the
 * clickable token; the frame's words stay plain around it. A language that
 * reorders where, who and when moves the placeholders; nothing is spliced.
 *
 * The chips' inline numbers are the same idea one level down: a pick's
 * template has exactly one `%s`, and the control sits where it is
 * (`picks.ts`). A translator can move the `%s`; nothing else is split.
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

/** One section's summary, and whether the merchant should open it. */
export interface Summary {
  readonly text: string;
  /**
   * Something in this section will not do what it looks like it does.
   *
   * ==========================================================================
   * TWO CAUSES, ONE FLAG, AND THE NAME COVERS BOTH.
   * ==========================================================================
   * It was called `incomplete`, which described only the first: a rule missing
   * a value it needs, so it can never answer true. The second is a rule that
   * is complete and **unreachable** — a Trigger sitting beside "shows
   * immediately", which fires first every time.
   *
   * Both are the same thing to the merchant: a rule they believe is doing
   * something that is not. Reported on the COLLAPSED row, which is the whole
   * point — ADR 0042 rule 3 asks that a control which cannot do its job say so
   * before the click rather than after it.
   */
  readonly attention: boolean;
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
 * **`logged_in` is not in this sentence, and it is still on this axis.** It is
 * a FIELD beside the two lists rather than a page rule — the lists are a union
 * of page sets, and a visitor predicate in one would widen the Optin to the
 * whole site for anyone matching it (ADR 0005). It reads out under WHO, where
 * its control now is, because a merchant asking *who sees this* should get one
 * answer rather than half of it here.
 */
export function whereSummary(targeting: Targeting): Summary {
  const included = targeting.include?.length ?? 0;
  const excluded = targeting.exclude?.length ?? 0;

  const text =
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
              __('Matches %s', 'wconvert'),
              countOfPages(included),
            )
          : sprintf(
              /* translators: 1: a count of page rules it shows on. 2: a count it is kept off. */
              __('Matches %1$s, except %2$s', 'wconvert'),
              countOfPages(included),
              countOfPages(excluded),
            );

  return { text, attention: false };
}

const countOfPages = (count: number): string =>
  sprintf(
    /* translators: %d: a number of page rules. */
    _n('%d page rule', '%d page rules', count, 'wconvert'),
    count,
  );

// ============================================================================
// HOW OFTEN — FOUR FIELDS, SIXTEEN COMBINATIONS, ONE SENTENCE EACH.
// ============================================================================

/**
 * *When it runs*, as a clause — or null where nothing was scheduled.
 *
 * ============================================================================
 * FORMATTED IN THE SITE'S LOCALE, FROM A WALL TIME WITH NO ZONE ON IT.
 * ============================================================================
 * The stored value is `2026-11-27 09:00` and carries no offset, which is the
 * whole point of it (`src/Optin/Schedule.php`). {@see momentOf} reads it back
 * as the same wall time and {@see readable} spells it, so the round trip shifts
 * nothing — the merchant reads back what they typed.
 *
 * That is also why no timezone is named here. The instant this resolves to is
 * the SITE's business and is computed once, on the server; this screen is
 * showing the merchant their own words back.
 *
 * ============================================================================
 * AND A WINDOW THAT HAS CLOSED SAYS SO, BECAUSE NOTHING ELSE DOES.
 * ============================================================================
 * An Optin past its `ends_at` stays **Published**, shows nothing and records no
 * Impression (ADR 0050) — correctly, and silently. The Optin list gives it no
 * badge and the builder gave it no sentence, so a merchant whose sale finished
 * last week reads *"Runs 27 Nov to 30 Nov"* and learns nothing about today.
 *
 * It reads as the past tense and carries `attention`, which under the rules
 * panel's own rule opens the section on arrival. That is not a defect being
 * flagged — a campaign ending is what a campaign does — it is ADR 0042 rule 2:
 * extending it or unpublishing it is the next thing they do, and they cannot
 * decide either without knowing.
 */
function windowClause(schedule: Schedule): string | null {
  const from = readable(schedule.starts_at);
  const to = readable(schedule.ends_at);

  if (to !== null && hasFinished(schedule)) {
    return sprintf(
      /* translators: %s: a date and time it stopped running. */
      __('Stopped running on %s', 'wconvert'),
      to,
    );
  }

  if (from !== null && to !== null) {
    return sprintf(
      /* translators: 1: a date and time it starts. 2: a date and time it ends. */
      __('Runs %1$s to %2$s', 'wconvert'),
      from,
      to,
    );
  }

  if (from !== null) {
    return sprintf(
      /* translators: %s: a date and time it starts. */
      __('Runs from %s', 'wconvert'),
      from,
    );
  }

  return to === null
    ? null
    : sprintf(
        /* translators: %s: a date and time it ends. */
        __('Runs until %s', 'wconvert'),
        to,
      );
}



/**
 * *When it runs*, as the Dates section's answer.
 *
 * A window that has closed carries `attention` — see {@link windowClause} —
 * and so does one that ends before it starts, which would never run at all.
 */
export function datesSummary(schedule: Schedule): Summary {
  if (endsBeforeStart(schedule)) return { text: __('End is before start', 'wconvert'), attention: true };
  return { text: windowClause(schedule) ?? __('Runs until you unpublish it', 'wconvert'), attention: hasFinished(schedule) };
}

/** A window that ends before it starts, which would never run. */
export const endsBeforeStart = (schedule: Schedule): boolean => !!schedule.starts_at && !!schedule.ends_at && schedule.ends_at <= schedule.starts_at;

/**
 * The limits on how often it shows, each a clause — the part of the allowance
 * that is a number rather than a stop.
 */
function capsOf(frequency: Frequency): string[] {
  const caps: string[] = [];

  if (frequency.maxPerSession !== undefined) {
    caps.push(sprintf(
      /* translators: %d: automatic appearances in one visit. */
      _n('at most %d time per visit', 'at most %d times per visit', frequency.maxPerSession, 'wconvert'),
      frequency.maxPerSession,
    ));
  }

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

  return caps;
}

const andLimits = () => _x('and', 'joins two limits on how often a campaign shows', 'wconvert');

/**
 * The allowance, read out.
 *
 * **The default is not "every time".** `stopAfterDismiss` and
 * `stopAfterConversion` are both ON when absent — `frequency.ts` tests
 * `!== false` — so an untouched Optin already stops when the visitor closes it
 * or completes its action, and a summary reading "Every time" would be a lie on the
 * commonest Optin there is.
 *
 * `priority` is appended only where it decides something. `arbitrate()` sorts
 * overlays and leaves `inline` Optins alone, so on an inline design the number
 * is real, stored, and inert — and a summary that mentioned it would be
 * telling the merchant about a control that changes nothing.
 *
 * The dates are not in it. They are their own question now, {@link datesSummary}.
 */
export function howOftenSummary(
  frequency: Frequency,
  priority: number,
  overlay: boolean,
  act: ConvertingAct = 'submit',
): Summary {
  const caps = capsOf(frequency);
  const stoppers: string[] = [];

  // Absent means ON, which is why these read `!== false` rather than `=== true`
  // — the same test the engine makes of the same key.
  if (frequency.stopAfterDismiss !== false) {
    stoppers.push(__('they close it', 'wconvert'));
  }

  if (frequency.stopAfterConversion !== false) {
    // No second "they": the sentence reads *"until they close it or sign up"*,
    // and the subject carries across the conjunction. Its own string rather
    // than a fragment of the first, because a language that does not carry it
    // has to be able to repeat it.
    stoppers.push(stoppers.length > 0
      ? (act === 'click' ? __('click the main button', 'wconvert') : __('submit the form', 'wconvert'))
      : (act === 'click' ? __('they click the main button', 'wconvert') : __('they submit the form', 'wconvert')));
  }

  const or = _x('or', 'joins two things that stop a campaign showing again', 'wconvert');

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
            join(caps, andLimits()),
          )
        : sprintf(
            /* translators: 1: one or more limits, e.g. “at most 3 times”. 2: what stops it, e.g. “they close it”. */
            __('Shows %1$s, and stops once %2$s', 'wconvert'),
            join(caps, andLimits()),
            join(stoppers, or),
          );

  if (!overlay || priority === 0) {
    return { text, attention: false };
  }

  return {
    text: sprintf(
      /* translators: 1: the allowance, e.g. “Every time, until they close it”. 2: a priority number. */
      __('%1$s · priority %2$d', 'wconvert'),
      text,
      priority,
    ),
    attention: false,
  };
}

/**
 * Is this Optin's window already behind it?
 *
 * Read at render in the site's timezone, never the administrator's clock.
 * Without a known zone, retain the authored dates without claiming it ended.
 */
function hasFinished(schedule: Schedule): boolean {
  return hasScheduleEnded(schedule.ends_at, adminSettings()?.timezone);
}

// ============================================================================
// THE SENTENCE.
// ============================================================================

/**
 * One phrase of the summary sentence, and whether its section needs a look.
 *
 * `frame` is the translated words around it — `on %s`, `to %s`, `It runs %s.`
 * — which the sentence draws muted, with `text` as the clickable phrase in
 * place of `%s`. A translator can move the `%s`; the phrase itself stays whole.
 */
export interface SentencePart extends Summary {
  readonly section: SectionId;
  readonly frame: string;
}

export interface SentenceParts {
  readonly where: SentencePart;
  readonly who: SentencePart;
  readonly when: SentencePart;
  readonly often: SentencePart;
  /** Absent until a date is set. */
  readonly dates?: SentencePart;
}

// ----------------------------------------------------------------------------
// WHERE, IN THE SITE'S OWN WORDS WHERE IT CAN BE SAID WITHOUT A LOOKUP.
// ----------------------------------------------------------------------------

/**
 * Up to two page rules by name — a URL path as typed, a content type by its
 * label — or null, which means *count them instead*. A post or term id would
 * need a round trip to name, and the sentence cannot wait for one.
 */
function namesOf(rules: NonNullable<Targeting['include']>, types: readonly RuleType[], conjunction: string): string | null {
  if (rules.length === 0 || rules.length > 2) return null;
  const names = rules.map((rule) => {
    const param = types.find((type) => type.type === rule.type)?.params.value;
    if (param?.control === 'path_glob' && typeof rule.value === 'string' && rule.value.trim() !== '') return rule.value.trim();
    if (param?.control === 'post_type') return param.options.find((option) => option.value === String(rule.value))?.label ?? null;
    return null;
  });
  return names.every((name): name is string => name !== null) ? join(names, conjunction) : null;
}

/** Where it shows, as the menu's answer and as the sentence's phrase. */
export function whereReading(pickId: string, targeting: Targeting, types: readonly RuleType[]): { answer: Summary; phrase: string } {
  const exclude = targeting.exclude ?? [];
  const include = targeting.include ?? [];
  const excepted = exclude.length === 0 ? null
    : namesOf(exclude, types, _x('and', 'joins pages a campaign is kept off', 'wconvert')) ?? sprintf(
      /* translators: %d: a number of pages. */
      _n('%d page', '%d pages', exclude.length, 'wconvert'), exclude.length);
  const with_ = (answer: string, phrase: string, attention = false) => ({
    answer: { text: excepted === null ? answer : sprintf(
      /* translators: 1: where it shows, e.g. “Entire site”. 2: the pages it is kept off, e.g. “/checkout/*” or “2 pages”. */
      __('%1$s, except %2$s', 'wconvert'), answer, excepted), attention },
    phrase: excepted === null ? phrase : sprintf(
      /* translators: 1: where it shows, e.g. “every page”. 2: the pages it is kept off, e.g. “/checkout/*” or “2 pages”. */
      __('%1$s except %2$s', 'wconvert'), phrase, excepted),
  });

  if (pickId === 'entire') return with_(__('Entire site', 'wconvert'), __('every page', 'wconvert'));
  if (pickId === 'blog') return with_(__('Blog posts only', 'wconvert'), __('blog posts', 'wconvert'));
  if (include.length === 0) {
    return { answer: { text: __('Choose at least one page', 'wconvert'), attention: true }, phrase: __('pages you haven’t chosen yet', 'wconvert') };
  }
  const chosen = namesOf(include, types, _x('or', 'joins pages any one of which it shows on', 'wconvert')) ?? sprintf(
    /* translators: %d: a number of pages. */
    _n('%d selected page', '%d selected pages', include.length, 'wconvert'), include.length);
  return with_(chosen, chosen);
}

// ----------------------------------------------------------------------------
// HOW OFTEN, UNDER CUSTOM.
// ----------------------------------------------------------------------------

/** Custom pacing in plain words: *"up to 2 times per visit, 3 days apart"*. */
export function customPacing(frequency: Frequency, capital: boolean): string {
  const parts: string[] = [];
  if (frequency.maxPerSession !== undefined) {
    parts.push(sprintf(capital
      /* translators: %d: a number of times. */
      ? _n('Up to %d time per visit', 'Up to %d times per visit', frequency.maxPerSession, 'wconvert')
      /* translators: %d: a number of times. */
      : _n('up to %d time per visit', 'up to %d times per visit', frequency.maxPerSession, 'wconvert'), frequency.maxPerSession));
  }
  if (frequency.cooldownDays !== undefined) {
    parts.push(sprintf(
      /* translators: %d: a number of days. */
      _n('%d day apart', '%d days apart', frequency.cooldownDays, 'wconvert'), frequency.cooldownDays));
  }
  if (parts.length === 0) return capital ? __('Every page they see', 'wconvert') : __('on every page they see', 'wconvert');
  return parts.join(_x(', ', 'separates two limits on how often a campaign shows', 'wconvert'));
}

/**
 * The summary sentence: *"Shows on [every page] to [everyone], [after 15
 * seconds], [once per visit]."* — each bracket a phrase that opens its section.
 *
 * A matched pick reads its own phrase. Custom reads the rules themselves,
 * joined by the group's own connective. Attention is the section's — the
 * sentence and the menu go amber together.
 */
export function sentenceParts(
  value: DisplayRulesValue,
  vocabulary: RuleVocabulary,
): SentenceParts {
  const sections = summarise(value, vocabulary);
  const attention = (id: SectionId) => sections.find(section => section.id === id)?.attention ?? false;
  const all = everyType(vocabulary);
  /* translators: %s: where it shows, e.g. “every page”. */
  const on = __('on %s', 'wconvert');
  /* translators: %s: who sees it, e.g. “everyone”. */
  const to = __('to %s', 'wconvert');
  const bare = '%s';
  const phrase = (id: SectionId, frame: string, custom: () => string): SentencePart => {
    const pick = derive(id, value, vocabulary);
    return { section: id, frame, text: pick.fragment?.(value) ?? custom(), attention: attention(id) };
  };
  const plan = value.display_rules;
  const unchosen = __('visitors you haven’t described yet', 'wconvert');

  const where: SentencePart = { section: 'where', frame: on, attention: attention('where'),
    text: whereReading(derive('where', value, vocabulary).id, value.targeting, vocabulary.targeting).phrase };

  const who = phrase('who', to, () => {
    const audience = plan?.audience;
    if (!audience) return unchosen;
    if (audience.mode === 'everyone') return __('everyone', 'wconvert');
    const groups = audience.groups.map(group => join(group.rules.map(rule => phraseOf(rule as Rule, all).text),
      group.match === 'all' ? _x('and', 'joins rules a visitor must all match', 'wconvert') : _x('or', 'joins rules any one of which a visitor may match', 'wconvert')));
    return groups.length === 0 || groups.some(group => group === '') ? unchosen
      /* translators: %s: what the visitor must match, e.g. “they are on mobile and signed in to this site”. */
      : sprintf(__('visitors if %s', 'wconvert'), groups.join(_x(', or if ', 'joins alternative groups of visitors', 'wconvert')));
  });

  const when = phrase('when', bare, () => {
    const opening = plan?.opening;
    if (opening?.mode === 'immediate') return __('as soon as the page loads', 'wconvert');
    if (!opening || opening.rules.length === 0) return __('at a moment you haven’t chosen', 'wconvert');
    return join(opening.rules.map(rule => phraseOf(rule as Rule, all).text),
      opening.mode === 'automatic' && opening.match === 'all' ? _x('and', 'joins opening rules that must all happen', 'wconvert') : _x('or', 'joins opening rules any one of which opens it', 'wconvert'));
  });

  const often = phrase('how-often', bare, () => customPacing(value.frequency, false));

  const from = readable(value.schedule.starts_at);
  const until = readable(value.schedule.ends_at);
  const dates: SentencePart | undefined = from === null && until === null ? undefined
    : hasFinished(value.schedule) && until !== null
      /* translators: %s: the date and time it stopped running. */
      ? { section: 'dates', text: until, attention: true, frame: __('It stopped running on %s.', 'wconvert') }
      : { section: 'dates', attention: attention('dates'),
        /* translators: %s: when it runs, e.g. “from 27 Nov to 30 Nov”. */
        frame: __('It runs %s.', 'wconvert'),
        text: from !== null && until !== null
          /* translators: 1: a date and time it starts. 2: a date and time it ends. */
          ? sprintf(__('from %1$s to %2$s', 'wconvert'), from, until)
          : from !== null
            /* translators: %s: a date and time it starts. */
            ? sprintf(__('from %s', 'wconvert'), from)
            /* translators: %s: a date and time it ends. */
            : sprintf(__('until %s', 'wconvert'), until ?? '') };

  return { where, who, when, often, ...(dates ? { dates } : {}) };
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
  if (['cart_products', 'cart_categories'].includes(rule.type)) {
    const count = Array.isArray(rule.ids) ? rule.ids.length : 0;
    const items = rule.type === 'cart_products' ? sprintf(_n('%d selected product', '%d selected products', count, 'wconvert'), count) : sprintf(_n('%d selected category', '%d selected categories', count, 'wconvert'), count);
    const phrase = rule.operator === 'none' ? __('Cart contains none of %s', 'wconvert') : rule.operator === 'all' ? __('Cart contains all of %s', 'wconvert') : __('Cart contains any of %s', 'wconvert');
    return { text: sprintf(phrase, items) + (rule.type === 'cart_categories' && rule.descendants ? __(' (including subcategories)', 'wconvert') : ''), attention: count === 0 };
  }
  if (['cart_quantity', 'cart_amount'].includes(rule.type) && rule.range && typeof rule.range === 'object') {
    const r = rule.range as Record<string, unknown>;
    const comparison = r.operator === 'between' ? `${r.min ?? '…'}–${r.max ?? '…'}` : `${r.operator === 'max' ? __('at most', 'wconvert') : __('at least', 'wconvert')} ${r.min ?? '…'}`;
    return { text: `${types.find(t => t.type === rule.type)?.label ?? __('Unavailable rule', 'wconvert')}: ${comparison}${typeof r.currency === 'string' ? ` ${r.currency}` : ''}`, attention: typeof r.min !== 'number' };
  }
  const read = fromRule(rule, types);

  if (read === null) {
    return { text: rule.type, attention: true };
  }

  const { type, preset } = read;
  // The params the phrase takes, in DECLARED order — which is what makes
  // `%2$s` mean the second one and lets a translator move it anywhere.
  const open = Object.keys(type.params).filter(
    (param) => !(preset !== null && preset.phrase !== null && param in preset.fixed),
  );

  const missing = open.filter((param) => !(rule.type === 'query_param' && param === 'value') && !supplied(rule[param]));
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
      attention: true,
    };
  }

  if (rule.type === 'query_param' && !supplied(rule.value)) {
    return { text: sprintf(__('URL contains the “%s” parameter (any value)', 'wconvert'), String(rule.key)), attention: false };
  }
  if (rule.type === 'logged_in') {
    return { text: rule.value === true ? __('signed in to this site', 'wconvert') : __('signed out of this site', 'wconvert'), attention: false };
  }

  // A phrase with no placeholders is passed through untouched rather than
  // through `sprintf`, which would eat a literal `%` out of a merchant's own
  // CSS selector.
  return { text: values.length === 0 ? phrase : fill(phrase, ...values), attention: false };
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
  // A daily window is one value the merchant reads in their own clock: the
  // control that writes it renders in the reader's locale, so a 12-hour
  // merchant types into a box saying "10:00 PM" and would read "22:00-02:00"
  // here. Same value, one spelling — the job {@see readable} does for the
  // schedule beside it.
  if (param.control === 'hours') {
    return readableHours(value) ?? String(value);
  }

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
