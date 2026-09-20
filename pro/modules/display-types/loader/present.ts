import type { OptinControls, PayloadEntry, Presenter } from '@loader/types';
import { captureInto, templatePresenter } from '@loader/present';
import { mountPopover } from './popover';
import { mountFullscreen } from './fullscreen';
import { selectAutomatic, showAutomatic } from '../../inline-placement/loader';
import { connectRecovery } from './recovery';

/**
 * Pro's presenter: the three Display Types free has no container for, and
 * free's presenter for everything else.
 *
 * ============================================================================
 * IT DELEGATES. IT DOES NOT REPLACE.
 * ============================================================================
 * Pro ships a COMPLETE loader and dequeues free's, so on a Pro install this is
 * what draws the popups and the inline Optins too (ADR 0014). Reimplementing
 * either would put a second popup on the installs that pay for support, free
 * to drift from the one every other install runs — the same failure
 * `pro/tests/js/loader-boundary.test.ts` guards one layer up, where Pro's
 * module list must carry every free module.
 *
 * So the branch is as narrow as it can be: three Display Types are Pro's, and
 * the `else` is free's presenter with the entry and the controls handed
 * through untouched. Everything free's presenter knows about a popup — the
 * missing snapshot that spends no allowance, the anchor an inline Optin needs,
 * the two moments an Impression has — keeps working here because it is still
 * that code doing it.
 *
 * ============================================================================
 * WHAT PRO HAS TO REPEAT, AND WHY IT IS THE SHORT LIST.
 * ============================================================================
 * Only the four lines free's presenter spends on an overlay: refuse an entry
 * with no design, mount, bind capture, report the Impression. Capture comes
 * through free's exported {@link captureInto} rather than a copy, which is
 * what it was exported for — a submit-metered Optin converts when the Lead
 * lands and the CONTAINER cannot know whether it did, so the reporting has to
 * live on this side of the boundary either way (ADR 0025).
 *
 * **The Impression is reported on show, with no viewport to wait for.**
 * Fullscreen, floating bars and slide-ins render in the top layer, so
 * being rendered is being on screen. `inline` is the one that waits, and it is
 * free's to draw (CONTEXT.md, Impression).
 */
export const proPresenter: Presenter = {
  connect: ({ entries, changed }) => connectRecovery(proPresenter, entries, changed),
  select: selectAutomatic,
  show(entry: PayloadEntry, controls: OptinControls): void {
    if (entry.display_type !== 'floating_bar' && entry.display_type !== 'slide_in' && entry.display_type !== 'fullscreen') {
      showAutomatic(entry, controls, templatePresenter);

      return;
    }

    const template = entry.template;

    // An Optin whose snapshot is missing or malformed has nothing to draw. It
    // reports no Impression, so its allowance is unspent and it is shown again
    // on the next page view rather than silently consumed here — free's answer
    // for a popup, and there is no reason for a bar to have a different one.
    if (template === undefined || template === null) {
      return;
    }

    const mounted = (entry.display_type === 'fullscreen' ? mountFullscreen : mountPopover)({
      displayType: entry.display_type,
      placement: entry.placement,
      template,
      // As free's presenter does, and it is one line rather than a shared
      // helper for the same reason the other four are: this branch is as narrow
      // as it can be, and everything else is free's code doing it.
      endsAt: entry.ends_at,
      // Called rather than handed over: `controls` is the shell's object and a
      // bare reference to a method on it is a `this` waiting to be lost.
      onDismiss: () => controls.dismiss(),
      onConvert: () => controls.convert(),
    });

    if (!mounted.mounted) {
      return;
    }

    try {
      mounted.show();
    } catch {
      mounted.close();
      return;
    }

    captureInto(mounted, entry.id, controls);

    controls.impression();
  },
};
