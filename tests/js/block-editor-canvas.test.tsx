import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiFetch from '@wordpress/api-fetch';
import { clipboard } from './support/wp-compose';

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
 * carries the same semantics: a labelled `combobox` really is what
 * `ComboboxControl` renders, and a region with a heading really is what
 * `Placeholder` renders.
 *
 * **What that buys and what it does not.** These assertions are about THIS
 * component's logic — which of three states it is in, whether it warns, what
 * it offers — and never about WordPress's own components, which are not this
 * repo's to test. The visual result was confirmed in a real block editor under
 * Playground, which is the half a mock cannot speak for.
 */

import { Edit } from '@block/Edit';

vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));

const NEWSLETTER = '01JQ0000000000000000000001';
const SIDEBAR = '01JQ0000000000000000000002';
const SPRING = '01JQ0000000000000000000003';
const EDIT = (id: string) => `https://example.test/wp-admin/admin.php?page=wconvert#optins?edit=${id}`;
const CREATE = 'https://example.test/wp-admin/admin.php?page=wconvert#optins?new=1';

type Entry = { id: string; name: string; status: 'published' | 'draft'; editUrl: string | null };

const published = (id: string, name: string): Entry => ({ id, name, status: 'published', editUrl: EDIT(id) });
const draft = (id: string, name: string): Entry => ({ id, name, status: 'draft', editUrl: EDIT(id) });

/** What `InlineOptinBlock::provideTheOptinList()` prints onto `window`, for a manager. */
function theSiteHas(campaigns: Entry[], links: { manageUrl: string | null; createUrl: string | null } = { manageUrl: 'https://example.test/wp-admin/admin.php?page=wconvert#optins', createUrl: CREATE }): void {
  window.wconvertInlineOptins = { campaigns, ...links };
}

function draw(optinId?: string) {
  const setAttributes = vi.fn();

  render(<Edit attributes={{ optinId }} setAttributes={setAttributes} />);

  return setAttributes;
}

const options = () => [...screen.getByRole('combobox', { name: 'Campaign' }).querySelectorAll('option')];

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  clipboard.length = 0;
});

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
    theSiteHas([published(NEWSLETTER, 'Newsletter footer')]);

    const { container } = render(<Edit attributes={{ optinId: NEWSLETTER }} setAttributes={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'WConvert campaign' })).toBeInTheDocument();
    expect(container.querySelector('[data-wconvert-optin]')).toBeNull();
    expect(container.querySelector('.wc-close')).toBeNull();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('offers the site’s published inline campaigns by name, not by id', async () => {
    theSiteHas([published(SIDEBAR, 'Sidebar signup'), published(NEWSLETTER, 'Newsletter footer')]);

    const setAttributes = draw();

    expect(options().map((o) => o.textContent)).toEqual(['Choose', 'Sidebar signup', 'Newsletter footer']);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Campaign' }), NEWSLETTER);

    expect(setAttributes).toHaveBeenCalledWith({ optinId: NEWSLETTER });
  });

  /**
   * GUIDELINES §8: never offer what will be refused — mark it before the
   * click, with the reason. A first-time owner who saved a draft and came to
   * place it sees it, and sees the one step left.
   */
  it('lists a draft as a refused choice that says why', () => {
    theSiteHas([published(NEWSLETTER, 'Newsletter footer'), draft(SPRING, 'Spring signup')]);

    const setAttributes = draw();
    const spring = options().find((o) => o.value === SPRING);

    expect(spring).toHaveTextContent('Spring signup — draft, publish to place it');
    expect(spring).toBeDisabled();

    // An editor whose combobox predates disabled options still cannot place it.
    fireEvent.change(screen.getByRole('combobox', { name: 'Campaign' }), { target: { value: SPRING } });
    expect(setAttributes).not.toHaveBeenCalled();
  });

  it('names an unnamed campaign without printing its id', () => {
    theSiteHas([published(NEWSLETTER, '')]);
    draw();

    expect(options().map((o) => o.textContent)).toContain('Unnamed campaign');
    expect(document.body).not.toHaveTextContent(NEWSLETTER);
  });

  /**
   * A fresh install has made nothing, and that is not an error — it is the
   * ordinary first state, and it comes with the door.
   */
  it('offers to create one when the site has no inline campaign', () => {
    theSiteHas([]);
    draw();

    expect(screen.getByText(/no inline campaign yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create an inline campaign/ })).toHaveAttribute('href', CREATE);
    expect(screen.getByRole('link', { name: /Create an inline campaign/ })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('button', { name: 'Refresh campaigns' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says the drafts need publishing when drafts are all there is', () => {
    theSiteHas([draft(SPRING, 'Spring signup')]);
    draw();

    expect(screen.getByText('Your inline campaigns are drafts. Publish one, then choose it here.')).toBeInTheDocument();
  });

  /** An Author can place the block but cannot open WConvert, so there is no link to follow. */
  it('names who can help where it has no link to offer', () => {
    theSiteHas([], { manageUrl: null, createUrl: null });
    draw();

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Ask your administrator to publish an inline campaign.')).toBeInTheDocument();
  });

  /**
   * A campaign published in another tab used to wait for an editor reload.
   * Refresh asks the server again, and the post is not edited by it.
   */
  it('refreshes the list without reloading the editor', async () => {
    theSiteHas([]);
    vi.mocked(apiFetch).mockResolvedValue({ campaigns: [published(NEWSLETTER, 'Newsletter footer')], manageUrl: null, createUrl: null });
    const setAttributes = draw();

    await userEvent.click(screen.getByRole('button', { name: 'Refresh campaigns' }));

    expect(apiFetch).toHaveBeenCalledWith({ path: '/wconvert/v1/inline-campaigns' });
    expect(await screen.findByRole('status')).toHaveTextContent('Campaign choices updated.');
    expect(options().map((o) => o.textContent)).toContain('Newsletter footer');
    expect(setAttributes).not.toHaveBeenCalled();
  });
});

describe('a placed campaign', () => {
  it('offers its shortcode with Copy, and says when it was copied', async () => {
    theSiteHas([published(NEWSLETTER, 'Newsletter footer')]);
    draw(NEWSLETTER);

    const shortcode = `[wconvert_optin id="${NEWSLETTER}"]`;

    expect(screen.getByText(shortcode)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Copy shortcode' }));

    expect(clipboard).toEqual([shortcode]);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Shortcode copied.');
  });

  it('links back to the campaign in a new tab', () => {
    theSiteHas([published(NEWSLETTER, 'Newsletter footer')]);
    draw(NEWSLETTER);

    const edit = screen.getByRole('link', { name: /Edit campaign/ });

    expect(edit).toHaveAttribute('href', EDIT(NEWSLETTER));
    expect(edit).toHaveAttribute('target', '_blank');
  });

  it('offers no edit link to someone who cannot open WConvert', () => {
    window.wconvertInlineOptins = { campaigns: [{ ...published(NEWSLETTER, 'Newsletter footer'), editUrl: null }], manageUrl: null, createUrl: null };
    draw(NEWSLETTER);

    expect(screen.queryByRole('link', { name: /Edit campaign/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy shortcode' })).toBeInTheDocument();
  });
});

/**
 * **The id that stopped resolving**, which is the same shape however it
 * happened: unpublished, soft-deleted, or switched to another Display Type.
 * All three reach this component as an id that is not a published inline
 * campaign, and all three leave a block sitting in content nobody has edited.
 */
describe('a campaign id that no longer resolves', () => {
  it('says so, without printing the id', () => {
    theSiteHas([published(SIDEBAR, 'Sidebar signup')]);
    draw(NEWSLETTER);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This campaign is no longer published inline, so this block shows nothing on the page. Republish it or choose another.',
    );
    expect(screen.getByRole('alert')).toHaveAttribute('data-status', 'warning');
    expect(document.body).not.toHaveTextContent(NEWSLETTER);
    expect(screen.queryByRole('button', { name: 'Copy shortcode' })).not.toBeInTheDocument();
  });

  it('names the campaign when the list still knows it', () => {
    theSiteHas([draft(NEWSLETTER, 'Newsletter footer')]);
    draw(NEWSLETTER);

    expect(screen.getByRole('alert')).toHaveTextContent('“Newsletter footer” is no longer published inline');
  });

  /**
   * **It keeps the id.** "Newsletter footer was unpublished" is recoverable by
   * republishing it; an attribute silently reset to nothing is not, and the
   * merchant would have no way of knowing which campaign the block used to
   * name.
   */
  it('keeps the stored id rather than clearing it', () => {
    theSiteHas([published(SIDEBAR, 'Sidebar signup')]);

    const setAttributes = draw(NEWSLETTER);

    expect(setAttributes).not.toHaveBeenCalled();
  });

  it('says nothing at all about a block that names no campaign yet', () => {
    theSiteHas([published(SIDEBAR, 'Sidebar signup')]);
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
 * list, that made EVERY block on the site announce that its campaign was no
 * longer published — while the front end went on rendering all of them
 * perfectly.
 *
 * A diagnostic that is confidently wrong is acted on: the merchant republishes
 * a campaign that was never unpublished. So this state claims nothing about
 * any id.
 */
describe('when the list never arrived', () => {
  it('does not accuse the block of naming a dead campaign', () => {
    draw(NEWSLETTER);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so in two sentences, and that the page is unaffected', () => {
    draw(NEWSLETTER);

    expect(screen.getByText('Your campaigns couldn’t be loaded here. Blocks already on the page still work. Reload the editor.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh campaigns' })).toBeEnabled();
  });

  /** Anything that is not the shape this reads is the same non-answer. */
  it('treats a global of the wrong type the same way', () => {
    (window as unknown as { wconvertInlineOptins: unknown }).wconvertInlineOptins = [{ id: NEWSLETTER, name: 'The old bare array' }];
    draw(NEWSLETTER);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/couldn’t be loaded here/)).toBeInTheDocument();
  });
});
