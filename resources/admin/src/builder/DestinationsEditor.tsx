import { __ } from '@wordpress/i18n';
import { Description } from '../shell/Description';
import { targetSaid } from '../destinations/settings';
import type { Destination } from '../destinations/api';

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
  /** Null while the read is in flight, and after one that failed. */
  readonly available: readonly Destination[] | null;
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

export function DestinationsEditor({ bound, available, hint, onChange }: DestinationsEditorProps) {
  return (
    <section className="wconvert-destinations-editor">
      <h3>{__('Where these leads go', 'wconvert')}</h3>

      {available === null ? (
        <p className="description">{__('Loading…', 'wconvert')}</p>
      ) : available.length === 0 ? (
        <p className="description">
          {__(
            'No destinations yet. Leads are still captured and exported — a destination only sends them on.',
            'wconvert'
          )}
        </p>
      ) : (
        <ul className="wconvert-choices">
          {available.map((destination) => {
            const said = targetSaid(destination.target);
            const control = `wconvert-bind-${destination.id}`;

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
                    {__(
                      'Not running here, so captures are kept, not sent. Re-push from Destinations once it works.',
                      'wconvert'
                    )}
                  </Description>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/*
        **Under the list, because it is about the choice rather than about any
        one row.** It names Destination TYPES and the [[Lead]] fields the
        Playbook needs — never a Destination, which is a thing only this site
        has and which prefill deliberately does not bind for the merchant.
      */}
      {hint !== null && <Description className="mt-2">{hint}</Description>}
    </section>
  );
}
