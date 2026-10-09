import type { OptinControls, PayloadEntry, Presenter } from './types';
import type { Mounted } from '@renderer/mount';
import { mount } from '@renderer/mount';
import { bindJourney } from './journey';
import { isOverlay } from './decide';
import { campaignLifecycle, notifyCampaign } from './events';

/**
 * The presenter: the join between deciding WHETHER to show an Optin and
 * knowing HOW to draw one.
 *
 * Everything upstream of this was already real — the rules are evaluated, the
 * contest is settled, the Impression is recorded, the frequency cap holds
 * across days. What a visitor would see was the only part missing, and it lives
 * behind this seam rather than in here, because the renderer is a pure function
 * of (tree, tokens) that the ADMIN imports too (ADR 0010).
 */

/**
 * Where an `inline` Optin was embedded.
 *
 * It renders where it was put and never competes for the screen, so unlike the
 * three overlays it needs somewhere on the page to go. The block and shortcode
 * that emit this anchor arrive with the builder; an Optin whose anchor is not
 * on this page renders nothing and reports nothing, which is the safe
 * direction — an Optin nobody saw has not been seen.
 */
export const INLINE_ANCHOR_ATTRIBUTE = 'data-wconvert-optin';

export function createTemplatePresenter(bind: typeof captureInto): Presenter { return {
  show(entry: PayloadEntry, controls: OptinControls): void {
    const template = entry.template;

    // An Optin whose snapshot is missing or malformed has nothing to draw. It
    // reports no Impression, so its allowance is unspent and it is shown again
    // on the next page view rather than silently consumed here.
    if (template === undefined || template === null) {
      return;
    }

    // `inline` is the one Display Type that needs somewhere on the page to go.
    // Asked through `isOverlay` rather than by comparing the string again:
    // the arbitration in `decide` already answers this question, and two
    // spellings of it would eventually disagree about an unknown type.
    // **`entry.anchor` where the server sent one, and this Optin's own id
    // otherwise.** An Optin normally renders at the anchor naming it, and the
    // one case that is not true of is an arm of an A/B test: the merchant
    // placed one block, naming the campaign, and an arm has an id of its own
    // that no block on the page mentions. Without this, half the traffic on an
    // inline test would meet nothing at all, silently — so the server says
    // where an entry renders when it is not its own id, and this reads it
    // ({@link ../../../src/Optin/PublishedProjection.php}).
    const anchor = isOverlay(entry) ? null : anchorFor(entry.anchor ?? entry.id);

    const mounted = mount({
      ...campaignLifecycle(entry),
      displayType: entry.display_type,
      template,
      anchor,
      // The countdown's deadline, and the Optin's window, are one number
      // (ADR 0052). Absent where the merchant set no end, which draws a clock
      // with nothing in it rather than inventing one.
      endsAt: entry.ends_at,
      // Called rather than handed over: `controls` is the shell's object and
      // a bare reference to a method on it is a `this` waiting to be lost.
      onDismiss: () => controls.dismiss(),
      onConvert: () => controls.convert(),
    });

    if (!mounted.mounted) {
      return;
    }

    mounted.show();

    bind(mounted, entry, controls);

    // **An Impression has two moments and only a renderer can tell them
    // apart.** For the three overlays it is the moment it is shown, because
    // they render in the top layer and being rendered IS being on screen. For
    // `inline` it is the moment it ENTERS THE VIEWPORT, since an inline Optin
    // renders where it was embedded and may sit far below the fold
    // (CONTEXT.md, Impression).
    if (anchor === null) {
      controls.impression();

      return;
    }

    whenInViewport(anchor, () => controls.impression());
  },
}; }

export const templatePresenter: Presenter = createTemplatePresenter(captureInto);

/**
 * Wire a mounted Optin's form to the capture endpoint.
 *
 * **Capture binds to the handle the container hands back**, not to a form it
 * goes looking for. A closed shadow root is exactly as closed to this module
 * as it is to a theme script, and the rendered root is the only way in — which
 * is also why this is exported: it is the seam a test reaches, and the seam
 * Pro's own presenter reaches when it composes its two containers (ADR 0028).
 *
 * **The Conversion is the capture succeeding**, which is why it is reported
 * from here and not from the container: a submit-metered Optin converts when
 * the [[Lead]] lands, and the container cannot know whether it did
 * (ADR 0025). A click-metered Optin reports its own through `onConvert` and
 * never reaches this at all — its single step holds no form, so nothing it
 * renders can submit.
 */
export function captureInto(mounted: Mounted, entry: PayloadEntry, controls: OptinControls): void {
  bindJourney(mounted, entry, { onLeadAccepted: () => notifyCampaign(entry, 'capture'), onCaptured: () => controls.convert(), onDismiss: () => controls.dismiss() });
}

function anchorFor(id: string): Element | null {
  try {
    return document.querySelector(`[${INLINE_ANCHOR_ATTRIBUTE}="${id}"]`);
  } catch {
    // A corrupted id can be a selector that will not parse. That is one Optin
    // not rendered, never a throw on a page WConvert was asked to leave alone
    // (ADR 0004).
    return null;
  }
}

export function whenInViewport(element: Element, report: () => void): () => void {
  const Observer = window.IntersectionObserver;

  // No observer means no way to tell "on the page" from "on the screen". The
  // overlay reading is the one that over-counts rather than under-counts, and
  // an Impression that never arrives makes the conversion rate's denominator
  // wrong for every Optin on the install.
  if (typeof Observer !== 'function') {
    report();

    return () => {};
  }

  const observer = new Observer((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      // Once. An Optin scrolled past twice was seen once (CONTEXT.md,
      // Impression).
      observer.disconnect();
      report();
    }
  });

  observer.observe(element);
  return () => observer.disconnect();
}
