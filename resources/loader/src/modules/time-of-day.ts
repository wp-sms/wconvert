import type { LoaderModule } from '../types';
import { siteTimezone } from '../payload';

/**
 * `time_of_day` — a recurring daily window, on the **site's** clock.
 *
 * =============================================================================
 * THIS IS NOT A SCHEDULE, AND THE TWO ARE NAMED SO THAT READING EITHER SAYS SO.
 * =============================================================================
 * A [[Schedule]] is a campaign's LIFETIME: two absolute instants, authored as
 * wall times and resolved once on the server, that happen at most once each
 * (ADR 0050, `schedule.ts`). This is an eligibility window that **comes round
 * again every day** — *only during opening hours*, *only in the evening* — and
 * it is a [[Condition]], so it is asked at the instant a Trigger fires and
 * never held.
 *
 * They will be confused by anyone who reads only one of them, which is why the
 * two live in different files with different vocabulary: a schedule has a
 * `starts_at` and an `ends_at` and this has `between`.
 *
 * =============================================================================
 * WHOSE CLOCK, AND WHY THE ANSWER CANNOT BE PRE-COMPUTED.
 * =============================================================================
 * **The site's.** A merchant setting "9am to 5pm" means their shop's hours, not
 * each visitor's local morning — a visitor-local option is a different feature
 * and is not this one. The authoring surface says so in the merchant's own
 * words (`resources/admin/src/builder/controls.tsx`), because a merchant who
 * reads it the other way targets the wrong hours and blames the plugin.
 *
 * `schedule.ts` gets to do no timezone arithmetic at all, because two instants
 * can be resolved once and shipped. A recurring window cannot: there is no
 * finite set of instants to resolve, and the offset a site is on changes twice
 * a year. So what travels is the **zone** — one attribute on the payload tag,
 * read once per page view — and the browser's own tzdata resolves it. That is
 * what keeps a page cached before a daylight-saving transition right after
 * one, with nothing rebuilt and no timer anywhere.
 *
 * =============================================================================
 * IT STORES NOTHING AND ASKS FOR NOTHING.
 * =============================================================================
 * `consentCategory: null`: the clock is not the visitor's device, nothing is
 * written, and there is no per-visitor fact here with a lifetime — the shape
 * ADR 0017 refuses. It is the cheapest kind of signal there is, which is part
 * of why it is free.
 */

const MINUTES_IN_A_DAY = 1440;

/** One `HH:MM` as minutes since midnight, or **null where it is not one**. */
function minutesIn(clock: string): number | null {
  const read = /^(\d\d):(\d\d)$/.exec(clock);

  if (read === null) {
    return null;
  }

  const hours = Number(read[1]);
  const minutes = Number(read[2]);

  // The regex admits `25:99`, which is two numbers rather than a time. A
  // window built from one would be a rule that quietly held at the wrong hour.
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/**
 * A reader of the SITE's clock, in minutes since its own midnight — or one
 * that answers null, where the zone cannot be read at all.
 *
 * =============================================================================
 * TWO SHAPES, BECAUSE WORDPRESS STORES TWO.
 * =============================================================================
 * A site with a city chosen has an IANA name (`Europe/London`) whose offset
 * moves twice a year, and only tzdata knows when — `Intl` is where the browser
 * keeps its copy. A site with no city chosen has a **fixed offset**
 * (`+05:30`), which never observes daylight saving and is therefore
 * arithmetic: no tzdata, no `Intl`, and no dependence on how recently the
 * browser was updated.
 *
 * The offset branch is not only an optimisation. `Intl` accepts an offset time
 * zone only in recent engines, so a site configured that way would otherwise
 * lose this rule entirely on a browser that is a couple of years old, and lose
 * it the way a fail-shut rule loses things: silently, showing nothing.
 *
 */
function siteClock(zone: string | null): (now: Date) => number | null {
  // ==========================================================================
  // NO ZONE IS NOT "THE VISITOR'S ZONE", AND `Intl` WOULD MAKE IT ONE.
  // ==========================================================================
  // `timeZone: undefined` means the BROWSER's own zone, so falling through to
  // the formatter here would answer a merchant's opening hours against each
  // visitor's clock — the one wrong answer that looks right, and the whole
  // thing this rule exists not to do. A page carrying no zone cannot be
  // answered at all, so it answers no.
  if (zone === null) {
    return () => null;
  }

  const fixed = /^([+-])(\d\d):(\d\d)$/.exec(zone);

  if (fixed !== null) {
    const offset = (Number(fixed[2]) * 60 + Number(fixed[3])) * (fixed[1] === '-' ? -1 : 1);

    return (now) =>
      // Twice, because `%` keeps the sign of its left operand and an offset
      // can put the site's clock on the day before.
      ((now.getUTCHours() * 60 + now.getUTCMinutes() + offset) % MINUTES_IN_A_DAY + MINUTES_IN_A_DAY) %
      MINUTES_IN_A_DAY;
  }

  try {
    // Built ONCE, here, and not on every evaluation. `holds` runs inside a
    // scroll handler and a 250ms poll, and constructing an `Intl` formatter is
    // far more expensive than the DOM lookup this module already hoisted out
    // of it — a hoist that would be pointless with an allocation left under
    // it. The formatter depends only on the zone, which cannot change while a
    // page is open.
    const clock = new Intl.DateTimeFormat('en-GB', {
      // `hourCycle: 'h23'` rather than `hour12: false`, which some engines
      // answer with `24:00` at midnight — an hour `minutesIn` reads as no time
      // at all.
      timeZone: zone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (now) => minutesIn(clock.format(now));
  } catch {
    // A zone this browser does not recognise. Same answer as no zone at all,
    // for the reason above.
    return () => null;
  }
}

/**
 * Is `at` inside `between`?
 *
 * **Half-open, and it wraps.** `09:00-17:00` is live AT nine and over AT five,
 * the same reading `schedule.ts` takes of a window and for its reason: two
 * adjacent windows must not both be live for a minute.
 *
 * An end SMALLER than its start is a window across midnight — *only
 * overnight*, which is a thing merchants mean — so the test flips rather than
 * failing. An end EQUAL to its start is a window no minute is inside, which is
 * what {@see \WConvert\Optin\Schedule::isImpossible()} decides about the same
 * shape one scope up.
 */
function inside(between: string, at: number): boolean {
  const window = /^(\d\d:\d\d)-(\d\d:\d\d)$/.exec(between);

  if (window === null) {
    return false;
  }

  const from = minutesIn(window[1]);
  const to = minutesIn(window[2]);

  if (from === null || to === null || from === to) {
    return false;
  }

  return from < to ? at >= from && at < to : at >= from || at < to;
}

/**
 * How often the page is asked to decide again.
 *
 * A window's boundaries are minutes, so half a minute is close enough — and it
 * is what makes *"a page held open across five o'clock notices"* true rather
 * than hopeful. Without it the shell holds its listeners open for a signal
 * nothing announces: `ineligible` is a live standing, so a visitor sitting on
 * a page at 08:59 would wait forever for the nine o'clock that never arrives.
 *
 * Only instantiated where a rule of this type is actually on the page (the
 * shell's lazy subscription), and torn down with everything else the moment no
 * candidate can still change.
 */
const TICK_MS = 30_000;

export const timeOfDay: LoaderModule = {
  id: 'time_of_day',
  kind: 'condition',
  consentCategory: null,
  create: (changed) => {
    // Both read ONCE per page view. A zone cannot change while a page is open,
    // and the element it is on is the one the payload was already read from —
    // so asking again on every evaluation would be a DOM lookup and an `Intl`
    // allocation inside a scroll handler, for an answer that cannot have
    // moved.
    const clock = siteClock(siteTimezone());
    const tick = setInterval(changed, TICK_MS);

    return {
      // ======================================================================
      // THE CLOCK IS READ LIVE, AND IT IS NOT THE DECISION'S OWN READING.
      // ======================================================================
      // Every Condition answers for RIGHT NOW — the instant a Trigger fires,
      // which may be a timer's worth of page view after the decision began.
      // `RuleEvaluator.holds(rule)` is handed no instant to share, so this is a
      // second reading of the clock, microseconds after `decide` took its own.
      //
      // That is a real limit rather than a feature: `shell.ts` reads the clock
      // once precisely so a decision cannot straddle midnight, and this sits
      // outside that guarantee. The window it could disagree in is
      // sub-millisecond and the two answer different questions — when the
      // campaign runs, against what time it is — so it is booked rather than
      // paid for by threading an instant through every module's interface.
      holds: (rule) => {
        const at = clock(new Date());

        return at !== null && inside(String(rule.between ?? ''), at);
      },
      stop: () => clearInterval(tick),
    };
  },
};
