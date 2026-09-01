import { __, _n, sprintf } from '@wordpress/i18n';
import { listWithAnd } from './rules/sentence';
import type { Destination, DestinationType } from '../destinations/api';

/**
 * What the readiness panel says about where the [[Lead]]s go — and about the
 * [[Playbook]]'s expectation, which until now nothing read at all.
 *
 * ============================================================================
 * PURE, BECAUSE THE SENTENCES ARE THE PART WORTH PINNING.
 * ============================================================================
 * The panel itself is a `<dl>`; everything decidable about it is here. That is
 * the same split `rules/sentence.ts` makes one screen over, and for the same
 * reason: *"nothing is bound, and the Playbook wanted an email address to go
 * somewhere"* is a sentence with four cases in it, and a component test that
 * had to render a whole builder to check one of them would check none of them.
 */

/**
 * The [[Playbook]]'s [[Destination]] hint, as `Prefill` stored it.
 *
 * ============================================================================
 * IT HAS BEEN WRITTEN SINCE PREFILL SHIPPED AND READ BY NOTHING.
 * ============================================================================
 * `Prefill::fromPlaybook()` copies it into `config`, `PublishedProjection`
 * deliberately strips it on the way to the browser because it is authoring
 * state — and no screen has ever opened it. So a merchant who started from
 * *Welcome discount* was told, in the Playbook's own notes, that the trade is
 * an address for a discount, and then met a Destinations tab that said nothing
 * about which Destination the Playbook was written for.
 *
 * Two keys and never a third: `PlaybookLibrary::HINT_KEYS` refuses anything
 * else at registration, and refuses a [[Destination]] id dressed as a type.
 */
export interface DestinationHint {
  readonly types: readonly string[];
  readonly fields: readonly string[];
}

/**
 * The hint out of a stored `config`, or null where there is none.
 *
 * Read defensively rather than cast: `config` is a JSON blob a merchant's
 * install may have been through several versions of, and a hint that arrived
 * as a string would otherwise reach `listWithAnd` as characters.
 */
export function hintIn(config: Record<string, unknown>): DestinationHint | null {
  const hint = config.destination_hint;

  if (typeof hint !== 'object' || hint === null) {
    return null;
  }

  const { types, fields } = hint as { types?: unknown; fields?: unknown };

  return { types: strings(types), fields: strings(fields) };
}

const strings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : [];

/**
 * What the [[Playbook]] expected, in the merchant's words — or null where it
 * expected nothing this install can say anything about.
 *
 * ============================================================================
 * IT NAMES THE TYPES THIS INSTALL HAS, AND SILENTLY DROPS THE ONES IT DOES NOT.
 * ============================================================================
 * A hint names Destination TYPES, and a Playbook is written for every install
 * rather than for this one — so it may name a type only [[Pro]] supplies, and
 * `welcome-discount` names one (`email_service_provider`) that no registry
 * member has at all. Printing an unresolved key at a merchant is printing our
 * own vocabulary at them, and there is nothing here that could translate it:
 * the words for a type come from the type, and a type this install does not
 * have has no words.
 *
 * **The FIELDS are the half that always means something**, which is why they
 * lead. `email`, `name` and `phone` are the closed capture vocabulary, named by
 * `TemplateLabels::fields()` on every install — so the sentence survives an
 * install that can name none of the types.
 */
export function hintSaid(
  hint: DestinationHint | null,
  types: readonly DestinationType[],
  fields: Record<string, string>,
): string | null {
  if (hint === null) {
    return null;
  }

  const captured = hint.fields.map((field) => fields[field] ?? field);
  const named = hint.types
    .map((type) => types.find((each) => each.id === type)?.label)
    .filter((label): label is string => label !== undefined);

  if (captured.length === 0 && named.length === 0) {
    return null;
  }

  if (named.length === 0) {
    return sprintf(
      /* translators: %s: what a Playbook captures, e.g. “Email address”. */
      __('The playbook this started from captures %s.', 'wconvert'),
      listWithAnd(captured),
    );
  }

  if (captured.length === 0) {
    return sprintf(
      /* translators: %s: one or more destination types, e.g. “WP SMS”. */
      __('The playbook this started from expects a destination like %s.', 'wconvert'),
      listWithAnd(named),
    );
  }

  return sprintf(
    /* translators: 1: what it captures, e.g. “Email address”. 2: destination types, e.g. “WP SMS”. */
    __('The playbook this started from captures %1$s, and expects a destination like %2$s.', 'wconvert'),
    listWithAnd(captured),
    listWithAnd(named),
  );
}

/** Where this Optin's Leads go, and anything wrong with getting them there. */
export interface DestinationsSaid {
  readonly said: string;
  /** Whether the sentence above is *nowhere* — which is what the hint answers. */
  readonly empty: boolean;
  readonly problems: readonly string[];
}

/**
 * Which [[Destination]]s this Optin pushes to, read out.
 *
 * ============================================================================
 * A CAPTURE IS NEVER LOST BY HAVING NOWHERE TO GO, AND THE SENTENCE SAYS SO.
 * ============================================================================
 * The local [[Lead]] log is not a Destination (CONTEXT.md, Destination): it is
 * written first and always, and CSV export works with nothing configured at
 * all. So *"nowhere"* is a perfectly good answer for a [[Standalone]] install
 * and must not read as a fault — the panel says what is true and leaves the
 * amber for the things that are actually wrong.
 *
 * **What IS wrong gets named per Destination rather than counted.** A merchant
 * with two Destinations and one failing needs to know which, and ADR 0039's
 * density rule cuts the other way here: the fact differs per item, so it goes
 * on the item.
 */
export function destinationsSaid(
  bound: readonly string[],
  destinations: readonly Destination[] | null,
): DestinationsSaid {
  if (bound.length === 0) {
    return {
      said: __('Nowhere. Leads are still captured here, and exported.', 'wconvert'),
      empty: true,
      problems: [],
    };
  }

  // Null while the read is in flight, and after one that failed — the panel
  // still knows the Optin is bound to something, and saying how many is
  // honest where naming them is not yet possible.
  if (destinations === null) {
    return { said: countOfDestinations(bound.length), empty: false, problems: [] };
  }

  const found = bound
    .map((id) => destinations.find((each) => each.id === id))
    .filter((each): each is Destination => each !== undefined);

  const missing = bound.length - found.length;
  const problems: string[] = [];

  for (const destination of found) {
    if (destination.availability !== 'ready') {
      problems.push(
        sprintf(
          /* translators: %s: a destination's name. */
          __(
            '%s is not running here, so captures are kept and not sent. Re-push from Destinations once it works.',
            'wconvert',
          ),
          destination.label,
        ),
      );
    }

    if (destination.health.consecutive_failures > 0) {
      problems.push(
        sprintf(
          /* translators: 1: a destination's name. 2: how many pushes failed in a row. */
          _n(
            '%1$s has failed %2$d time in a row.',
            '%1$s has failed %2$d times in a row.',
            destination.health.consecutive_failures,
            'wconvert',
          ),
          destination.label,
          destination.health.consecutive_failures,
        ),
      );
    }
  }

  /*
   * **A binding whose Destination is gone.** An Optin holds ids and a
   * Destination is deleted site-wide, so this is reachable and is otherwise
   * completely silent: the Destinations tab draws a checkbox per Destination
   * that EXISTS, so a binding to one that does not is invisible there.
   */
  if (missing > 0) {
    problems.push(
      sprintf(
        /* translators: %d: how many destinations an Optin points at that no longer exist. */
        _n(
          'It points at %d destination that has been deleted.',
          'It points at %d destinations that have been deleted.',
          missing,
          'wconvert',
        ),
        missing,
      ),
    );
  }

  /*
   * **Every binding points at something that is gone.** *"Leads go to 2
   * destinations"* would be a sentence contradicted by the line under it, and
   * *"Nowhere"* would be the answer for an Optin nobody ever bound — which is
   * not this one. The problem below already counts them; this says what is
   * true of the push.
   */
  if (found.length === 0) {
    return { said: __('Nothing that still exists.', 'wconvert'), empty: false, problems };
  }

  return {
    said: listWithAnd(found.map((destination) => destination.label)),
    empty: false,
    problems,
  };
}

const countOfDestinations = (count: number): string =>
  sprintf(
    /* translators: %d: a number of destinations. */
    _n('%d destination', '%d destinations', count, 'wconvert'),
    count,
  );
