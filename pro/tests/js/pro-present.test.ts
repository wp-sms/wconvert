import { afterEach, describe, expect, it } from 'vitest';
import { DOCUMENT_STYLE_ID } from '@renderer/mount';
import { INLINE_ANCHOR_ATTRIBUTE } from '@loader/present';
import type { OptinControls, PayloadEntry } from '@loader/types';
import { proPresenter } from '../../modules/display-types/loader/present';
import { isShowing } from '../../../tests/js/support/popover';

/**
 * Pro's presenter: four Display Types, two containers, one seam.
 *
 * ============================================================================
 * IT DELEGATES RATHER THAN REPLACES, AND THAT IS THE ASSERTION THAT MATTERS.
 * ============================================================================
 * Pro ships a COMPLETE loader and dequeues free's, so a Pro install's popups
 * and inline Optins are drawn by THIS presenter too (ADR 0014). A presenter
 * that reimplemented them would be a second popup, drifting from free's, on
 * the installs paying for support — the same failure `loader-boundary.test.ts`
 * guards against one layer up, where Pro's module list must carry every free
 * module.
 *
 * So the only thing Pro adds is the two types free has no container for, and
 * everything else is handed to `templatePresenter` untouched.
 */

const TEMPLATE = {
  tree: {
    steps: [
      {
        type: 'stack',
        children: [
          { type: 'heading', text: 'Ten percent off' },
          { type: 'field', name: 'email' },
          { type: 'button', label: 'Go', action: 'submit' },
        ],
      },
      { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Check your inbox' }] },
    ],
  },
  tokens: { bg: '#fff' },
};

const entry = (over: Partial<PayloadEntry> = {}): PayloadEntry => ({
  id: '01JQ0000000000000000000001',
  display_type: 'floating_bar',
  template: TEMPLATE,
  ...over,
});

const controls = (): OptinControls & { impressions: number; dismissals: number; conversions: number } => {
  const seen = {
    impressions: 0,
    dismissals: 0,
    conversions: 0,
    impression: () => void (seen.impressions += 1),
    dismiss: () => void (seen.dismissals += 1),
    convert: () => void (seen.conversions += 1),
  };

  return seen;
};

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById(DOCUMENT_STYLE_ID)?.remove();
  document.documentElement.style.removeProperty('--wconvert-top-bar-offset');
});

const popover = () => document.querySelector<HTMLElement>('[popover]');

it('carries a published placement from the payload into the container', () => {
  proPresenter.show(entry({ display_type: 'floating_bar', placement: 'block_start' }), controls());

  expect(popover()?.style.getPropertyValue('inset-block-start')).toBe(
    'max(0px, env(safe-area-inset-top))',
  );
  expect(document.querySelector('[data-wconvert-top-bar-reservation]')).not.toBeNull();
});

describe.each(['floating_bar', 'slide_in'])('showing a %s', (displayType) => {
  it('draws it into the top layer as a manual popover', () => {
    proPresenter.show(entry({ display_type: displayType }), controls());

    expect(popover()?.getAttribute('popover')).toBe('manual');
    expect(isShowing(popover())).toBe(true);
    expect(document.querySelector('dialog')).toBeNull();
  });

  /**
   * **An Impression is the moment it is shown**, for all three overlays, and
   * these two are overlays: they render in the top layer, so being rendered IS
   * being on screen. Only `inline` waits for the viewport (CONTEXT.md,
   * Impression).
   */
  it('reports the Impression at once', () => {
    const seen = controls();

    proPresenter.show(entry({ display_type: displayType }), seen);

    expect(seen.impressions).toBe(1);
  });

  /**
   * **The design goes inside a CLOSED shadow root, on a div inside the
   * popover**, exactly as it goes inside one on a div inside the dialog. The
   * popover element hosts no shadow root of its own and is armoured with
   * inline `!important` instead, which is the only protection available to an
   * element a theme can reach (ADR 0009).
   *
   * That closedness is also why the visitor's PRESS is asserted at the
   * container rather than here: nothing outside can reach the close button, so
   * `popover-container.test.ts` presses it through the handle `mountPopover`
   * hands back, and the browser pass presses it for real.
   */
  it('puts the design in a closed shadow root the page cannot reach into', () => {
    proPresenter.show(entry({ display_type: displayType }), controls());

    const host = popover()?.firstElementChild as HTMLElement;

    expect(host.tagName).toBe('DIV');
    expect(host.shadowRoot).toBeNull();
    expect(popover()?.shadowRoot).toBeNull();
    expect(popover()?.style.getPropertyPriority('position')).toBe('important');
  });

  /**
   * An Optin whose snapshot is missing has nothing to draw, so it reports no
   * Impression — which leaves its allowance unspent and shows it again on the
   * next page view, rather than consuming it silently here.
   */
  it('shows nothing and spends no allowance when there is no design', () => {
    const seen = controls();

    proPresenter.show(entry({ display_type: displayType, template: undefined }), seen);

    expect(popover()).toBeNull();
    expect(seen.impressions).toBe(0);
  });
});

describe('the two Display Types free already draws', () => {
  it('hands a popup to free’s container, unchanged', () => {
    const seen = controls();

    proPresenter.show(entry({ display_type: 'popup' }), seen);

    expect(document.querySelector('dialog')?.open).toBe(true);
    expect(popover()).toBeNull();
    expect(seen.impressions).toBe(1);
  });

  it('hands an inline Optin to free’s container, anchor and all', () => {
    const seen = controls();
    const anchor = document.createElement('div');

    anchor.setAttribute(INLINE_ANCHOR_ATTRIBUTE, entry().id);
    document.body.appendChild(anchor);

    proPresenter.show(entry({ display_type: 'inline' }), seen);

    expect(anchor.children).toHaveLength(1);
    expect(document.querySelector('dialog')).toBeNull();
    expect(popover()).toBeNull();
  });

  /**
   * **An unrecognised Display Type is a popup**, on both sides and everywhere:
   * the renderer mounts an entry with no Display Type as one, and `decide`
   * reads anything that is not `inline` as an overlay
   * ({@see \\WConvert\\Optin\\DisplayType}). Pro adding two containers must not
   * quietly add a third answer to that question.
   */
  it('still reads an absent Display Type as a popup', () => {
    proPresenter.show(entry({ display_type: undefined }), controls());

    expect(document.querySelector('dialog')?.open).toBe(true);
    expect(popover()).toBeNull();
  });
});
