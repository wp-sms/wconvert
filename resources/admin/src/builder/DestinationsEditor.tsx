import { __, sprintf } from '@wordpress/i18n';
import { Plug } from 'lucide-react';
import { Description } from '../shell/Description';
import { EmptyState } from '../shell/EmptyState';
import {
  Region,
  RegionBody,
  RegionErrorState,
  RegionFooter,
  RegionHeader,
} from '../shell/Region';
import { RowsSkeleton } from '../shell/RowsSkeleton';
import { tierProductName } from '../goals/availability';
import { targetSaid } from '../destinations/settings';
import type { Loadable } from '../shell/loadable';
import type { Destination, DestinationType } from '../destinations/api';

/**
 * Which [[Destination]]s this [[Optin]] pushes to.
 *
 * **An Optin holds Destination ids and nothing more.** No audience, no tags,
 * no field map: a Destination is configured once, site-wide, and *includes*
 * whatever selects the target inside the remote system, so two Optins feeding
 * one audience reference one Destination. The per-Optin field map that would
 * normally sit here is eliminated by canonical field keys (CONTEXT.md,
 * Destination).
 *
 * A Destination whose type is not `ready` is still shown and still bindable —
 * the binding is a decision the merchant made, and unbinding it because a
 * plugin was deactivated for an afternoon would lose it silently. It is the
 * DISPATCH that skips it, on every capture, and self-heals when the dependency
 * comes back (ADR 0027 draws the same line for a suspended [[Condition]]).
 *
 * ============================================================================
 * IT NO LONGER FETCHES. THE SCREEN DOES.
 * ============================================================================
 * The list is site-level configuration rather than a function of this Optin, so
 * it was read here, once. {@see ReadinessPanel} needs the same payload to say
 * where the Leads go and whether anything is failing — and two components
 * fetching one list is two round trips, two failure paths, and two moments at
 * which one of them is holding a stale answer.
 */
export interface DestinationsEditorProps {
  readonly bound: readonly string[];
  /**
   * The site's Destinations, in the three states a read has.
   *
   * **This was `readonly Destination[] | null`, and `null` meant two things.**
   * Its own comment said so: *in flight* AND *after one that failed*. The read
   * is `.then(setDestinations).catch(…)` and this branched
   * `available === null ? 'Loading…' : …`, so a failed fetch left the tab
   * showing a placeholder that would never resolve.
   *
   * The reasoning around it was right and the type could not carry it: falling
   * back to `[]` was deliberately declined, because *"an empty one would read
   * as 'you have none' rather than 'we could not ask'"*. `Loadable` is the
   * union the rest of the admin already uses, and it makes the confusion
   * unrepresentable rather than merely fixed.
   */
  readonly available: Loadable<readonly Destination[]>;
  /**
   * The types those routes run over, for the two absences that are not one.
   *
   * A `Destination` carries the resolved [[Availability]] and nothing about
   * WHY, so this row could say only *"not running here"* — one sentence for
   * *you have not bought the tier* and *this site is missing a plugin*. That
   * is the collapse `Destinations` and `AddRule` both warn against in comments
   * and ADR 0026 exists to stop: it is how a paying customer is shown an
   * advertisement and a merchant is offered a licence we do not sell.
   */
  readonly types: readonly DestinationType[];
  /**
   * What the [[Playbook]] this Optin started from expected, in words — or null
   * where it started from none, or named nothing this install can say
   * anything about.
   *
   * **Written by prefill since prefill shipped, and read by nothing until
   * now.** It travels to this screen because this is where the decision it is
   * about gets made: *"the playbook captures an email address and expects a
   * destination like WP SMS"* is an instruction while nothing is bound, and
   * history the moment something is — which is why the caller passes it only in
   * the first case (ADR 0042 rule 2).
   */
  readonly hint: string | null;
  readonly onChange: (bound: string[]) => void;
}

/**
 * **What a row says about itself goes UNDER the name, not beside it.**
 *
 * Every row carries where that route lands now, and inline each sentence
 * started at whatever x the name happened to end at — four rows, four left
 * edges, and an eye reading down the list found no column to follow. So a note
 * lines up under the name it is about rather than under the box.
 *
 * **The row is a two-column grid and the indent is the first column**, which is
 * what makes that true without anybody measuring. It was `ms-7` — 28px, hand-
 * computed to clear a 16px checkbox and the space beside it, and a number that
 * silently stops being right the day either one changes. The checkbox sizes
 * column one, `gap-x-2` is the same 0.5rem `.wconvert-check` spends on the same
 * relationship, and every note starts at column two because that is where the
 * name starts.
 */
const NOTE = 'col-start-2';

/**
 * ============================================================================
 * IT DREW NONE OF THE SHARED VOCABULARY, AND IT WAS THE ONLY SCREEN THAT DID.
 * ============================================================================
 * A raw `<section>`, a bare `<h3>`, and `<p className="description">` for both
 * of the two states it had — WordPress's own class, on the one tab in the
 * builder that had no reason to wear it. Every other region in this admin is
 * {@see Region} plus {@see RegionHeader}, its empty state is {@see EmptyState}
 * with the door out of it, and its failure is a {@see RegionErrorState}.
 *
 * It also leaves `.wconvert-editor` behind with the WordPress markup: that
 * class exists to retarget wp-admin's controls (ADR 0035's staged boundary),
 * and the rows here are a grid this file draws. Its
 * `input[type="checkbox"] { margin-inline-end }` was adding six pixels to the
 * grid's own column gap.
 */
export function DestinationsEditor({
  bound,
  available,
  types,
  hint,
  onChange,
}: DestinationsEditorProps) {
  return (
    <Region>
      <RegionHeader title={__('Where these leads go', 'wconvert')} level={3} />

      {available.status === 'loading' ? (
        <RowsSkeleton />
      ) : available.status === 'failed' ? (
        <RegionErrorState
          message={available.message}
        />
      ) : available.data.length === 0 ? (
        <EmptyState icon={Plug} title={__('No destinations yet', 'wconvert')}>
          {__(
            'Leads are still captured and exported — a destination only sends them on.',
            'wconvert'
          )}
        </EmptyState>
      ) : (
        <RegionBody>
        <ul className="wconvert-choices">
          {available.data.map((destination) => {
            const said = targetSaid(destination.target);
            const control = `wconvert-bind-${destination.id}`;
            const type = types.find((candidate) => candidate.id === destination.type);

            return (
              <li
                key={destination.id}
                className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5"
              >
                <input
                  id={control}
                  type="checkbox"
                  /*
                    **The merchant's name is the accessible name, and the
                    target only DESCRIBES it.** They are two different jobs:
                    the name is what they chose to call this route, and
                    "Sending to Newsletter" is what it does. Folding the second
                    into the `<label>` would make a screen reader announce the
                    whole sentence as the checkbox's name — and rename the
                    control every time somebody re-pointed the route.
                  */
                  aria-describedby={said === null ? undefined : `${control}-target`}
                  checked={bound.includes(destination.id)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...bound, destination.id]
                        : bound.filter((id) => id !== destination.id)
                    )
                  }
                />
                {/*
                  **`htmlFor` rather than a `<label>` wrapped round the pair**,
                  which is what this was: the grid needs the box and the name to
                  be siblings so the box can size column one. It is also the
                  pattern `index.css` argues for beside the vendored checkbox,
                  for the separate reason that a wrapping label forwards a click
                  the control already received.
                */}
                <label htmlFor={control} className="min-w-0">
                  {destination.label}
                </label>
                {/*
                  **Where these leads actually land, at the moment the choice
                  is made.** This tab drew `☐ MailPoet` and nothing more, which
                  says nothing about which of two MailPoet routes is being
                  bound — and telling them apart is the whole reason a
                  Destination carries a name.

                  `null` draws nothing at all: the lead-magnet email selects
                  nothing and is perfectly configured, and a provider that could
                  not be reached is a question nobody could ask. The wording and
                  the three states are `targetSaid`'s.
                */}
                {said !== null && (
                  <Description as="span" id={`${control}-target`} className={NOTE}>
                    {said}
                  </Description>
                )}
                {/*
                  **Nothing waits.** A Destination whose type is not `ready` is
                  skipped at dispatch and never enqueued — a job whose handler
                  cannot succeed would retry against nothing forever — so the
                  captures are kept and the pushes are LOST until a bulk re-push
                  replays them. Copy that said "pushes wait" would describe a
                  queue that does not exist (#4, ADR 0008).
                */}
                {destination.availability !== 'ready' && (
                  <Description as="span" className={NOTE}>
                    {destination.availability === 'locked'
                      ? sprintf(
                          /* translators: %s: the product that supplies it, e.g. “WConvert Pro”. */
                          __(
                            'Needs %s, so captures are kept here, not sent. Re-push from Destinations once it runs.',
                            'wconvert'
                          ),
                          tierProductName(type?.tier)
                        )
                      : sprintf(
                          /* translators: %s: the plugin or platform it needs, e.g. “WP SMS”. */
                          __(
                            'Needs %s on this site, so captures are kept here, not sent. Re-push from Destinations once it runs.',
                            'wconvert'
                          ),
                          type?.requires_label ?? __('something this site does not have', 'wconvert')
                        )}
                  </Description>
                )}
              </li>
            );
          })}
        </ul>
        </RegionBody>
      )}

      {/*
        **Under the list, because it is about the choice rather than about any
        one row.** It names Destination TYPES and the [[Lead]] fields the
        Playbook needs — never a Destination, which is a thing only this site
        has and which prefill deliberately does not bind for the merchant.

        A {@see RegionFooter} is what "under the content and about all of it"
        already looks like everywhere else, and it is what gives the sentence
        the rule above it that a bare margin never did.
      */}
      {hint !== null && (
        <RegionFooter>
          <Description>{hint}</Description>
        </RegionFooter>
      )}
    </Region>
  );
}
