import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * **What the block draws in the post editor's canvas.**
 *
 * Two of #86's acceptance criteria are entirely about this component and
 * neither can be reached from PHP: *"The block's editor canvas shows a
 * labelled placeholder rather than a rendered Optin"* and *"The block reports
 * an unresolvable or non-`inline` Optin id in the editor instead of emitting a
 * dead anchor."* Until this file existed they rested on one person having
 * looked at the screen once.
 *
 * ============================================================================
 * THE EDITOR PACKAGES ARE MOCKED, AND THE MOCKS ARE THE POINT OF RESTRAINT.
 * ============================================================================
 * `@wordpress/components` and `@wordpress/block-editor` are not installed —
 * `resources/blocks/inline-optin/src/wordpress.d.ts` says why, and it is 393 MB
 * of dev tree for types. So they are stubbed here as the plainest HTML that
 * carries the same semantics: a `<select>` really is what `SelectControl`
 * renders, and a region with a heading really is what `Placeholder` renders.
 *
 * **What that buys and what it does not.** These assertions are about THIS
 * component's logic — which of three states it is in, whether it warns, what
 * it offers — and never about WordPress's own components, which are not this
 * repo's to test. The visual result was confirmed in a real block editor under
 * Playground, which is the half a mock cannot speak for.
 */

import { Edit } from '@block/Edit';



const NEWSLETTER = '01JQ0000000000000000000001';
const SIDEBAR = '01JQ0000000000000000000002';

/** What `InlineOptinBlock::provideTheOptinList()` prints onto `window`. */
function theSiteHasPublished(optins: { id: string; name: string }[] | undefined): void {
  window.wconvertInlineOptins = optins;
}

function draw(optinId?: string) {
  const setAttributes = vi.fn();

  render(<Edit attributes={{ optinId }} setAttributes={setAttributes} />);

  return setAttributes;
}

afterEach(() => {
  delete window.wconvertInlineOptins;
  vi.restoreAllMocks();
});

describe('the editor canvas', () => {
  /**
   * **ADR 0040 is about the BUILDER's preview, and this is not the builder.**
   *
   * There, the picture is an input — clicking a headline puts the caret in the
   * block that edits it — and that is what earns the real renderer its place.
   * Nothing on the post editor's screen can change what an Optin says, so a
   * render here could only be an output: the static thumbnail ADR 0010 says
   * does not exist anywhere in this flow.
   *
   * Asserted as the ABSENCE of the two things a render would leave behind —
   * the loader's anchor and the renderer's shadow host — because "it is a
   * placeholder" is a claim about what is NOT drawn.
   */
  it('shows a labelled placeholder and never the Optin', () => {
    theSiteHasPublished([{ id: NEWSLETTER, name: 'Newsletter footer' }]);

    const { container } = render(<Edit attributes={{ optinId: NEWSLETTER }} setAttributes={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Inline Campaign' })).toBeInTheDocument();
    expect(container.querySelector('[data-wconvert-optin]')).toBeNull();
    expect(container.querySelector('.wc-close')).toBeNull();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('offers the site’s published inline Optins by name, not by id', async () => {
    theSiteHasPublished([
      { id: SIDEBAR, name: 'Sidebar signup' },
      { id: NEWSLETTER, name: 'Newsletter footer' },
    ]);

    const setAttributes = draw();

    expect(
      [...screen.getByRole('combobox').querySelectorAll('option')].map((o) => o.textContent),
    ).toEqual(['Choose a campaign…', 'Sidebar signup', 'Newsletter footer']);

    await userEvent.selectOptions(screen.getByRole('combobox'), NEWSLETTER);

    expect(setAttributes).toHaveBeenCalledWith({ optinId: NEWSLETTER });
  });

  /**
   * A fresh install has published nothing, and that is not an error — it is
   * the ordinary first state, and it says where to go.
   */
  it('says so when the site has published no inline Optin', () => {
    theSiteHasPublished([]);
    draw();

    expect(screen.getByRole('combobox')).toHaveDisplayValue('No published inline Campaigns');
    expect(screen.getByText(/no published inline Campaign yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/**
 * **The id that stopped resolving**, which is the same shape however it
 * happened: unpublished, soft-deleted, or switched to another Display Type.
 * All three reach this component as an id that is not in the list, and all
 * three leave a block sitting in content nobody has edited.
 */
describe('an Optin id that no longer resolves', () => {
  it('says so, rather than looking like a working block', () => {
    theSiteHasPublished([{ id: SIDEBAR, name: 'Sidebar signup' }]);
    draw(NEWSLETTER);

    expect(screen.getByRole('alert')).toHaveTextContent(NEWSLETTER);
    expect(screen.getByRole('alert')).toHaveAttribute('data-status', 'warning');
  });

  /**
   * **It keeps the id.** "Newsletter footer was unpublished" is recoverable by
   * republishing it; an attribute silently reset to nothing is not, and the
   * merchant would have no way of knowing which Optin the block used to name.
   */
  it('keeps the stored id rather than clearing it', () => {
    theSiteHasPublished([{ id: SIDEBAR, name: 'Sidebar signup' }]);

    const setAttributes = draw(NEWSLETTER);

    expect(setAttributes).not.toHaveBeenCalled();
  });

  it('says nothing at all about a block that names no Optin yet', () => {
    theSiteHasPublished([{ id: SIDEBAR, name: 'Sidebar signup' }]);
    draw();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/**
 * ============================================================================
 * THE LIST THAT NEVER ARRIVED, WHICH IS NOT THE SAME AS AN EMPTY ONE.
 * ============================================================================
 * A JS optimizer strips the inline script, or a stale bundle is served, and
 * `window.wconvertInlineOptins` is simply not there. Reported as an empty
 * list, that made EVERY block on the site announce that its Optin was no
 * longer published — while the front end went on rendering all of them
 * perfectly.
 *
 * A diagnostic that is confidently wrong is acted on: the merchant republishes
 * an Optin that was never unpublished. So this state claims nothing about any
 * id.
 */
describe('when the list never arrived', () => {
  it('does not accuse the block of naming a dead Optin', () => {
    theSiteHasPublished(undefined);
    draw(NEWSLETTER);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says the editor could not load them, and that the page is unaffected', () => {
    theSiteHasPublished(undefined);
    draw(NEWSLETTER);

    expect(screen.getByText(/could not load your list of Campaigns/i)).toBeInTheDocument();
    expect(screen.getByText(/still shows on the page/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveDisplayValue('Campaigns unavailable');
  });

  /** Anything that is not the shape this reads is the same non-answer. */
  it('treats a global of the wrong type the same way', () => {
    (window as unknown as { wconvertInlineOptins: unknown }).wconvertInlineOptins = 'nope';
    draw(NEWSLETTER);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/could not load your list of Campaigns/i)).toBeInTheDocument();
  });
});
