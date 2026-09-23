import { displayEntry } from '../../../tests/js/support/display-entry';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FREE_MODULES } from '@loader/modules';
import { start } from '@loader/shell';
import type { Store } from '@loader/storage';
import type { PayloadEntry } from '@loader/types';
import { templatePresenter } from '@loader/present';
import { ELITE_MODULES } from '../../resources/loader/src/modules';
import proLoader, { presenter } from '../../resources/loader/src/elite';
import { proPresenter } from '../../modules/display-types/loader';
import { recordingPresenter } from '../../../tests/js/support/presenter';

/**
 * The free/Pro loader module boundary, asserted from Pro's side.
 *
 * This file lives under pro/ rather than under tests/js/, and that placement is
 * the point: it imports Pro's tree, so putting it in free's tree would make the
 * test itself the leak bin/verify-source-contract.sh exists to catch.
 *
 * Two things are proven here, and the second only became load-bearing once
 * both sides shipped modules. The IMPORT DIRECTION: this file resolves free's
 * tree from inside Pro's, and Pro's entry evaluates, so the cross-tree wiring
 * ADR 0028 requires exists rather than merely being described. And the
 * COMPOSITION: Pro's loader is free's modules plus Pro's, in that order, and
 * carries every module free's carries — which is what makes the PHP dequeue
 * safe (`tests/unit/Pro/Frontend/LoaderReplacementTest.php`). Pro REPLACES
 * free's loader, so a free module missing from Pro's build is a capability a
 * merchant loses by paying for Pro.
 */
describe("Pro's loader entry", () => {
  it("resolves free's loader tree from inside Pro's", () => {
    // Not a tautology: free's modules and engine are reached across the plugin
    // boundary by relative path, so a broken or reversed dependency direction
    // fails this file at import time rather than at any assertion.
    expect(Array.isArray(FREE_MODULES)).toBe(true);
    expect(proLoader.modules).toBeInstanceOf(Array);
  });

  it("is free's modules plus Pro's own", () => {
    const composed = proLoader.modules.map((m) => m.id);

    expect(composed).toEqual([...FREE_MODULES.map((m) => m.id), ...ELITE_MODULES.map((m) => m.id)]);
  });

  /**
   * **And it boots with PRO's presenter, which is the other half of the same
   * replacement.**
   *
   * Pro dequeues free's loader, so free's entry never runs on a Pro install
   * and free's presenter is never reached unless this one hands it work
   * (ADR 0014). An entry still booting `templatePresenter` composes every
   * premium MODULE correctly and then draws nothing for either premium Display
   * Type — free's `mount()` returns NOTHING for a type it has no container
   * for, so a bar would be decided, counted as shown, and invisible.
   *
   * That is a one-line mistake with no other symptom in this suite: every
   * container test and every arbitration test names its presenter explicitly,
   * so all of them pass while the shipped bundle shows nobody a bar.
   */
  it("boots with Pro's presenter and not free's", () => {
    expect(presenter).toBe(proPresenter);
    expect(presenter).not.toBe(templatePresenter);
  });

  it("carries every module free's loader carries", () => {
    // Pro REPLACES free's loader and dequeues it in PHP (ADR 0014), so any
    // free module missing from Pro's build is a capability a merchant loses by
    // paying for Pro.
    const composed = new Set(proLoader.modules.map((m) => m.id));

    for (const free of FREE_MODULES) {
      expect(composed).toContain(free.id);
    }
  });
});

/**
 * =============================================================================
 * ONE OPTIN CARRYING BOTH GESTURES, ON PRO'S REAL LOADER.
 * =============================================================================
 * `pro/tests/js/pro-modules.test.ts` proves the two modules answer
 * independently. This proves the thing a merchant actually builds: **one Optin
 * naming `exit_intent` AND `scroll_up`**, run through the composed Pro loader
 * and the real shell, firing on whichever gesture the visitor's device can
 * make.
 *
 * That pairing is the whole reason they are two types rather than one with two
 * meanings (#32). A single type would make this Optin unexpressible: the
 * merchant could not ask for the desktop gesture without the phone one, and
 * the rules panel would have one row that means two things — so "why didn't my
 * popup show" would have no per-rule answer.
 *
 * Neither module is device-guarded, deliberately. A desktop visitor never
 * produces the scroll gesture and a phone never produces the pointer one, so
 * the wrong Trigger simply never fires — no branch that has to be right about
 * what a device is.
 */
describe('one Optin carrying both premium Triggers', () => {
  const bothGestures = (): PayloadEntry => (displayEntry({
    id: 'a',
    display_type: 'popup',
    triggers: [{ type: 'exit_intent' }, { type: 'scroll_up' }],
    conditions: [],
  }));

  /** A store that starts empty and stays on this test, never localStorage. */
  const fakeStore = (): Store => {
    let held: string | null = null;

    return { read: () => held, write: (value) => void (held = value) };
  };

  const pageView = () => {
    const presenter = recordingPresenter();
    const stop = start({
      loader: proLoader,
      entries: [bothGestures()],
      presenter,
      store: fakeStore(),
      now: () => Date.UTC(2026, 2, 1),
    });

    return { presenter, stop };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not fire before either gesture is made', () => {
    const { presenter, stop } = pageView();

    expect(presenter.shown).toEqual([]);
    stop();
  });

  /** The desktop half: a pointer leaving through the top, and no scrolling. */
  it('fires on the pointer leaving, with no scrolling at all', () => {
    const { presenter, stop } = pageView();

    document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0, relatedTarget: null }));

    expect(presenter.shown).toEqual(['a']);
    stop();
  });

  /** The phone half: a turn back up the page, and no pointer at all. */
  it('fires on the turn back up the page, with no pointer at all', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0);
    const { presenter, stop } = pageView();

    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1_200);
    window.dispatchEvent(new Event('scroll'));
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(900);
    window.dispatchEvent(new Event('scroll'));

    expect(presenter.shown).toEqual(['a']);
    stop();
  });

  /**
   * And ONCE. Two Triggers on one Optin is "any one of these", not two
   * chances to show the same popup at the same visitor.
   */
  it('shows once when the visitor makes both gestures', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0);
    const { presenter, stop } = pageView();

    document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0, relatedTarget: null }));
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1_200);
    window.dispatchEvent(new Event('scroll'));
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(900);
    window.dispatchEvent(new Event('scroll'));

    expect(presenter.shown).toEqual(['a']);
    stop();
  });
});
