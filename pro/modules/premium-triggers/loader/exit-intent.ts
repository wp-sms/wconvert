import type { LoaderModule } from '@loader/types';

/**
 * `exit_intent` — fires when the pointer leaves through the top of the page.
 *
 * **The direction is the whole rule.** Up is where the tab strip, the address
 * bar and the window's close button are; a pointer leaving through a side or
 * the bottom is reaching for a scrollbar, a dock or a second monitor. A
 * `mouseout` with no `relatedTarget` and `clientY` at or above zero is the
 * only one of those that means "leaving", and it is what every honest
 * exit-intent implementation watches.
 *
 * It is the FIRST premium rule, and it is premium in the ordinary way: it is
 * absent from a free install rather than present and refused, because free's
 * source never imports this tree (ADR 0028). There is no licence check here
 * and no `if` anywhere on this path — being loaded IS the entitlement
 * (ADR 0015).
 *
 * **It is not device-guarded, deliberately.** A touch device does not produce
 * this gesture, so it never fires there without a branch that has to be right
 * about what a device is — and a hybrid laptop with a touchscreen is a desktop
 * that would fail such a branch. Its distinct mobile sibling is `scroll_up`;
 * see that module's header for why the pair is two types rather than one.
 *
 * One document-level listener rather than one per rule, and no params: the
 * module is instantiated once for however many Optins name this type, and the
 * gesture is the same gesture for all of them.
 */
export const exitIntent: LoaderModule = {
  id: 'exit_intent',
  kind: 'trigger',
  consentCategory: null,
  create: (changed) => {
    // The same high-water posture `scroll_depth` takes, for the same reason:
    // coming back does not un-intend leaving, and a Trigger that un-fired
    // would answer differently depending on where the mouse happened to be at
    // the instant a Condition became true.
    let leaving = false;

    const onMouseOut = (event: MouseEvent): void => {
      // `mouseout` fires on every move between two elements on the page, which
      // is most of what a mouse does. A move that has somewhere to go is not a
      // departure; reading it as one fires on the first hover.
      if (leaving || event.relatedTarget !== null || event.clientY > 0) {
        return;
      }

      leaving = true;
      // Once, on the transition. `scroll_depth` asks on every scroll because
      // each of its rules carries its own threshold; this is a boolean with no
      // params, so a second ask has nothing new to answer.
      changed();
    };

    document.addEventListener('mouseout', onMouseOut);

    return {
      holds: () => leaving,
      stop: () => document.removeEventListener('mouseout', onMouseOut),
    };
  },
};
