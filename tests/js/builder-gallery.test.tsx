import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Template } from '../../resources/renderer/src/types';
import type {
  TemplateIndex,
  TemplateIndexEntry,
  TemplateLabelsWithFacets,
} from '../../resources/admin/src/templates/api';

/**
 * The picker: the grid, the chips, the search box, and the card a free install
 * cannot use.
 *
 * ============================================================================
 * THE PREVIEW IS STILL THE HALF THE SUITE CANNOT SEE.
 * ============================================================================
 * `zoom` and `content-visibility` are layout properties and Vitest runs jsdom
 * with `css: false`, so nothing here can see whether a card is the right shape
 * or whether an off-screen one costs anything. Deferred mounting is worse than
 * invisible: jsdom has no `IntersectionObserver` at all, so every card in this
 * file reports itself near the viewport and mounts — which is the documented
 * degradation ({@see TemplateCard}) and is exactly why the browser pass drives
 * this with Playwright rather than the Chrome extension.
 *
 * What IS assertable is everything the merchant reads: which designs a chip
 * leaves on screen, what a locked card offers instead of a design, and that a
 * refusal is said before the click rather than after it.
 */
const { Gallery } = await import('../../resources/admin/src/builder/Gallery');
type Fit = import('../../resources/admin/src/builder/Gallery').Fit;
const { TemplatePicker } = await import('../../resources/admin/src/builder/TemplatePicker');

const ROOT = resolve(import.meta.dirname, '../..');

const read = (path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as never;

/** A shipped design, exactly as `resources/templates/library/` holds it. */
const design = (id: string): Template => read(`resources/templates/library/${id}.json`);

/**
 * The labels the server ships, composed the way `TemplateLabels` composes them
 * — the shape words and the capture words are the vocabulary the structure
 * editor already speaks, which is the property that makes them worth borrowing.
 */
const LABELS = {
  facets: { shape: 'Shape', captures: 'Asks for', has_image: 'Picture' },
  facetValues: {
    'shape.stack': 'Column',
    'shape.row': 'Row',
    'shape.split': 'Side by side',
    'captures.email': 'Email address',
    'captures.name': 'Name',
    'captures.phone': 'Phone number',
    'has_image.true': 'With a picture',
  },
} as unknown as TemplateLabelsWithFacets;

const FACETS = {
  shape: ['stack', 'row', 'split'],
  captures: ['email', 'name', 'phone'],
  has_image: ['true'],
};

interface Wanted {
  readonly id: string;
  readonly name: string;
  readonly display_type?: string;
  readonly act?: 'submit' | 'click' | null;
  readonly captures?: string[];
  readonly shape?: string;
  readonly has_image?: boolean;
  readonly locked?: boolean;
}

const card = ({
  id,
  name,
  display_type = 'popup',
  act = 'submit',
  captures = ['email'],
  shape = 'stack',
  has_image = false,
  locked = false,
}: Wanted): TemplateIndexEntry => ({
  id,
  name,
  display_type,
  tier: locked ? 'pro' : 'free',
  availability: locked ? 'locked' : 'ready',
  facets: { act: locked ? null : act, captures, shape, has_image, asks_consent: false },
  ...(locked ? { preview_url: `https://wconvert.com/designs/${id}/` } : {}),
});

/** The card a design is on, found by the name it prints. */
const cardFor = (name: string) => screen.getByText(name).closest('li') as HTMLElement;

/**
 * What an ordinary standalone Optin needs of a design: nothing.
 *
 * **Four of the five [[Goal]]s reach this exact value**, which is the whole of
 * ADR 0059 in one fixture — a Goal declares no converting act, so a design is
 * refused only for something about this particular Optin.
 */
const ANY: Fit = { needsACapture: false, bound: false, sibling: null, act: 'submit' };

// =============================================================================
// THE GRID.
// =============================================================================

const ENTRIES = [card({ id: 'centred-card', name: 'Centred card' }), card({ id: 'stacked-signup', name: 'Stacked signup', captures: ['phone'] })];

const TREES = new Map<string, Template>([
  ['centred-card', design('centred-card')],
  ['stacked-signup', design('stacked-signup')],
]);

const grid = (entries: TemplateIndexEntry[], chosen: string | undefined, fit: Fit = ANY) =>
  render(
    <Gallery
      entries={entries}
      trees={TREES}
      labels={LABELS}
      chosen={chosen}
      fit={fit}
      busy={false}
      onChoose={vi.fn()}
      onNear={vi.fn()}
    />,
  );

describe('a gallery card', () => {
  it('renders a button in both states, so the row cannot go ragged', () => {
    grid(ENTRIES, 'centred-card');

    const inUse = screen.getByRole('button', { name: /In use/ });
    const offer = screen.getByRole('button', { name: /Use this design/ });

    // The same element, the same size class — what differs is the variant and
    // whether it can be pressed, neither of which changes the box.
    expect(inUse.tagName).toBe('BUTTON');
    expect(offer.tagName).toBe('BUTTON');
    expect(inUse).toHaveAttribute('data-size', 'sm');
    expect(offer).toHaveAttribute('data-size', 'sm');
  });

  it('does not offer the design that is already in use', () => {
    grid(ENTRIES, 'centred-card');

    expect(screen.getByRole('button', { name: /In use/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Use this design/ })).toBeEnabled();
  });

  /**
   * Selection was exposed as a badge and a border colour, and neither is a
   * state in the accessibility tree — so the chosen card was chosen only if
   * you could see it.
   */
  it('says which card is chosen to something that is not looking', () => {
    const { container } = grid(ENTRIES, 'stacked-signup');

    const current = container.querySelectorAll('[aria-current="true"]');

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Stacked signup');
  });

  it('offers every card where none is chosen', () => {
    grid(ENTRIES, undefined);

    expect(screen.getAllByRole('button', { name: /Use this design/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /In use/ })).toBeNull();
  });

  /**
   * **A card whose design has not arrived is not a card that failed.** Trees are
   * fetched for what is on screen (ADR 0043), so "no tree yet" is the ordinary
   * state of a card a merchant has just scrolled to — and it asks for its own.
   */
  it('asks for the design it does not have, and stays a card while it waits', () => {
    const onNear = vi.fn();

    render(
      <Gallery
        entries={ENTRIES}
        trees={new Map()}
        labels={LABELS}
        chosen={undefined}
        fit={ANY}
        busy={false}
        onChoose={vi.fn()}
        onNear={onNear}
      />,
    );

    expect(onNear).toHaveBeenCalledWith('centred-card');
    expect(onNear).toHaveBeenCalledWith('stacked-signup');
    expect(screen.getAllByRole('button', { name: /Use this design/ })).toHaveLength(2);
  });
});

// =============================================================================
// A DESIGN THE SAVE WOULD REFUSE — AND THE ONE IT NO LONGER DOES.
//
// `refuseAMetricItCannotReport()` rejected a click-converting design under a
// submit-counting Goal outright, and this gallery greyed out five of seven
// popup cards to say so before the click — each reading *"Your goal counts
// click-throughs"* while naming no goal and offering no way to change one.
//
// **That refusal is deleted** (ADR 0059): a [[Goal]] declares no converting
// act, so on an ordinary standalone Optin nothing here is greyed at all. What
// still marks a card is about this particular Optin, and the four cases below
// are the whole of it.
// =============================================================================

const CLICKS = card({ id: 'offer-panel', name: 'Offer panel', act: 'click', captures: [] });
const SILENT = card({ id: 'silent', name: 'Silent', act: null, captures: [] });

describe('a design that converts the other way', () => {
  /** The assertion this whole ticket exists for. */
  it('is offered like any other, under a goal that counts submissions', () => {
    grid([ENTRIES[0], CLICKS], undefined);

    expect(within(cardFor('Offer panel')).getByRole('button', { name: /Use this design/ })).toBeEnabled();
    expect(within(cardFor('Centred card')).getByRole('button', { name: /Use this design/ })).toBeEnabled();
    expect(screen.queryByText(/Your goal counts/)).toBeNull();
  });

  /**
   * **Offered, and marked — on the card that would do it** (ADR 0042 rule 3).
   * `wconvert_stats` carries no act, so a [[Conversion]] is read against the
   * design the Optin holds NOW: a hundred form submissions read as a hundred
   * click-throughs the moment the design does (ADR 0020).
   *
   * The sentence shipped for a day on the dialog's header instead, where it
   * appeared before anything was picked, stayed up over designs that change
   * nothing, and could not name a direction.
   */
  it('says what taking it would change, on its own card and naming the direction', () => {
    grid([ENTRIES[0], CLICKS], undefined);

    expect(
      within(cardFor('Offer panel')).getByText(/Counts click-throughs instead of submissions/),
    ).toBeInTheDocument();
    expect(within(cardFor('Offer panel')).getByText(/already counted/)).toBeInTheDocument();
  });

  /** And the card that changes nothing says nothing. */
  it('says nothing on a design that converts the way this Optin already does', () => {
    grid([ENTRIES[0], CLICKS], undefined);

    expect(within(cardFor('Centred card')).queryByText(/instead of/)).toBeNull();
  });

  it('reads the direction the other way round', () => {
    grid([ENTRIES[0], CLICKS], undefined, { ...ANY, act: 'click' });

    expect(
      within(cardFor('Centred card')).getByText(/Counts submissions instead of click-throughs/),
    ).toBeInTheDocument();
    expect(within(cardFor('Offer panel')).queryByText(/instead of/)).toBeNull();
  });

  /**
   * **One sentence per card.** A refused card already says the one thing that
   * matters about it, and two sentences about one card is what ADR 0042 rule 2
   * forbids.
   */
  it('is not said on a card that is refused anyway', () => {
    grid([ENTRIES[0], CLICKS], undefined, { ...ANY, needsACapture: true });

    expect(within(cardFor('Offer panel')).getByText(/captures nothing/)).toBeInTheDocument();
    expect(within(cardFor('Offer panel')).queryByText(/instead of/)).toBeNull();
  });

  /** And the mirror, which is the pairing that greyed out most of the library. */
  it('is offered the other way round too', () => {
    grid([ENTRIES[0], CLICKS], undefined, { ...ANY, act: 'click' });

    expect(within(cardFor('Centred card')).getByRole('button', { name: /Use this design/ })).toBeEnabled();
    expect(within(cardFor('Offer panel')).getByRole('button', { name: /Use this design/ })).toBeEnabled();
  });
});

describe('a design that counts nothing at all', () => {
  /**
   * **The worse failure, and it kept its words.** It renders, publishes and
   * reports zero forever (ADR 0020) — an Optin that looks like it is working.
   */
  it('cannot be chosen, and says why on the card', () => {
    grid([SILENT], undefined);

    expect(screen.getByText('Nothing on this design counts as a conversion.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use this design/ })).toBeDisabled();
  });

  it('tells a screen reader why, not just that', () => {
    grid([ENTRIES[0], SILENT], undefined);

    const described = within(cardFor('Silent'))
      .getByRole('button', { name: /Use this design/ })
      .getAttribute('aria-describedby') ?? '';

    expect(described).toContain('wconvert-refused-silent');
  });

  /** The one that is fine is untouched — this marks, it does not disable a gallery. */
  it('leaves the designs that are fine offered', () => {
    grid([ENTRIES[0], SILENT], undefined);

    expect(within(cardFor('Centred card')).getByRole('button', { name: /Use this design/ })).toBeEnabled();
  });

  /**
   * **Marked, never hidden.** A merchant comparing three designs and finding
   * two has no way to know the third exists or why it is gone — and the reason
   * is about their own Optin rather than about the install, so it is worth
   * reading.
   */
  it('is still on screen, so the merchant can see what they are not being offered', () => {
    grid([ENTRIES[0], SILENT], undefined);

    expect(screen.getByText('Silent')).toBeInTheDocument();
  });
});

describe('a design that captures nothing', () => {
  /**
   * **The one refusal a [[Goal]] can still make about a design.** The delivery
   * kind is written when a push to the lead-magnet [[Destination]] succeeds,
   * and a design asking the visitor for nothing gives it nothing to push.
   */
  it('is refused where the goal counts deliveries', () => {
    grid([ENTRIES[0], CLICKS], undefined, { ...ANY, needsACapture: true });

    const offer = within(cardFor('Offer panel'));

    expect(offer.getByRole('button', { name: /Use this design/ })).toBeDisabled();
    expect(offer.getByText('This design captures nothing, and your goal counts deliveries.')).toBeInTheDocument();
    expect(within(cardFor('Centred card')).getByRole('button', { name: /Use this design/ })).toBeEnabled();
  });

  /**
   * **And where this Optin binds a [[Destination]]**, which is ADR 0025's rule
   * re-keyed off the act and onto the capture: there would be no [[Lead]] to
   * send. It holds under every Goal, which is why it is not asked of one.
   */
  it('is refused where this Optin sends leads somewhere', () => {
    grid([ENTRIES[0], CLICKS], undefined, { ...ANY, bound: true });

    expect(within(cardFor('Offer panel')).getByText(/no leads to send/)).toBeInTheDocument();
    expect(within(cardFor('Centred card')).getByRole('button', { name: /Use this design/ })).toBeEnabled();
  });

  /** And on an Optin that is neither, it is an ordinary card. */
  it('is offered where this Optin needs neither', () => {
    grid([CLICKS], undefined);

    expect(screen.getByRole('button', { name: /Use this design/ })).toBeEnabled();
  });
});

describe('a design that would break an A/B comparison', () => {
  /**
   * **The guarantee the shared Goal used to smuggle in** (ADR 0059).
   * `createVariant()` copies its parent's Goal so the arms share an act — which
   * only worked while a Goal declared one. An arm holding a form beside an arm
   * holding a click CTA puts a ~3% submission rate against a ~25% click rate.
   */
  it('cannot be chosen, and names the other arm', () => {
    grid([ENTRIES[0], CLICKS], undefined, { ...ANY, sibling: 'submit' });

    const offer = within(cardFor('Offer panel'));

    expect(offer.getByRole('button', { name: /Use this design/ })).toBeDisabled();
    expect(offer.getByText(/the other arm of this test converts on a form submission/)).toBeInTheDocument();
  });

  it('reads the constraint the other way round', () => {
    grid([ENTRIES[0], CLICKS], undefined, { ...ANY, sibling: 'click', act: 'click' });

    expect(
      within(cardFor('Centred card')).getByText(/the other arm of this test converts on a click/),
    ).toBeInTheDocument();
    expect(within(cardFor('Offer panel')).getByRole('button', { name: /Use this design/ })).toBeEnabled();
  });

  /** An Optin that is not part of a test is never asked the question. */
  it('says nothing where this Optin has no siblings', () => {
    grid([ENTRIES[0], CLICKS], undefined);

    expect(screen.queryByText(/the other arm/)).toBeNull();
  });
});

// =============================================================================
// A PREMIUM DESIGN ON A FREE INSTALL.
// =============================================================================

const LOCKED = card({
  id: 'popup-two-column',
  name: 'Two-column offer',
  locked: true,
  shape: 'split',
  captures: ['name', 'email'],
  has_image: true,
});

describe('a design this install does not have', () => {
  /**
   * ==========================================================================
   * THE ASSERTION THE WHOLE TIER STORY RESTS ON.
   * ==========================================================================
   * Shipping the tree and refusing the save is trialware (issue #7), and
   * rendering a real control `disabled` is what wp.org Guideline 9 fires on.
   * What a merchant can actually do from here is LOOK at the design, so that is
   * the affordance — an admin-side link to our own site, which Guideline 10
   * explicitly welcomes.
   */
  it('offers a link to see it, and never a button that cannot be pressed', () => {
    grid([ENTRIES[0], LOCKED], undefined);

    const locked = within(cardFor('Two-column offer'));
    const link = locked.getByRole('link', { name: /See this design/ });

    expect(link).toHaveAttribute('href', 'https://wconvert.com/designs/popup-two-column/');
    expect(locked.queryByRole('button')).toBeNull();
  });

  it('leaves wp-admin in a new tab, without handing over the opener', () => {
    grid([LOCKED], undefined);

    const link = screen.getByRole('link', { name: /See this design/ });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  /** Only `Pro` on a locked card is news; a `Free` badge on the rest is not. */
  it('is the only card wearing a badge', () => {
    grid([ENTRIES[0], LOCKED], undefined);

    expect(within(cardFor('Two-column offer')).getByText('Pro')).toBeInTheDocument();
    expect(within(cardFor('Centred card')).queryByText('Free')).toBeNull();
  });

  /**
   * **With no render to look at, the facets are what a merchant compares.** In
   * their own words, and never a thumbnail — ADR 0010's *no static thumbnails
   * anywhere* survives because a locked card carries no image at all.
   */
  it('says what the design is, since there is none to show', () => {
    grid([LOCKED], undefined);

    const locked = within(cardFor('Two-column offer'));

    expect(locked.getByText('Side by side')).toBeInTheDocument();
    expect(locked.getByText('Email address')).toBeInTheDocument();
    expect(locked.getByText('With a picture')).toBeInTheDocument();
    expect(cardFor('Two-column offer').querySelector('img')).toBeNull();
  });

  /**
   * **It is never refused and never marked**: a card that is not offered is not
   * refused, and a sentence about a design the merchant cannot have would be a
   * sentence about nothing.
   */
  it('carries no sentence about something it cannot be used for', () => {
    grid([LOCKED], undefined, { needsACapture: true, bound: true, sibling: 'click', act: 'click' });

    expect(screen.queryByText(/captures nothing/)).toBeNull();
    expect(screen.queryByText(/the other arm/)).toBeNull();
    // Nor about a switch nobody can make: it is not a design this install has.
    expect(screen.queryByText(/instead of/)).toBeNull();
  });

  /** And it does not ask for a tree there is none of. */
  it('does not ask the server for a design it was never sent', () => {
    const onNear = vi.fn();

    render(
      <Gallery
        entries={[LOCKED]}
        trees={new Map()}
        labels={LABELS}
        chosen={undefined}
        fit={ANY}
        busy={false}
        onChoose={vi.fn()}
        onNear={onNear}
      />,
    );

    expect(onNear).not.toHaveBeenCalled();
  });
});

// =============================================================================
// THE TOOLBAR.
// =============================================================================

/** Ten designs, which is past the point where narrowing is worth a toolbar. */
const LIBRARY: TemplateIndexEntry[] = [
  card({ id: 'a-column-email', name: 'Column email' }),
  card({ id: 'b-column-phone', name: 'Column phone', captures: ['phone'] }),
  card({ id: 'c-row-email', name: 'Row email', shape: 'row' }),
  card({ id: 'd-split-photo', name: 'Split photo', shape: 'split', has_image: true }),
  card({ id: 'e-column-photo', name: 'Column photo', has_image: true }),
  card({ id: 'f-column-name', name: 'Column name', captures: ['name', 'email'] }),
  card({ id: 'g-row-phone', name: 'Row phone', shape: 'row', captures: ['phone'] }),
  card({ id: 'h-split-email', name: 'Split email', shape: 'split' }),
  card({ id: 'i-column-click', name: 'Column click', act: 'click', captures: [] }),
  card({ id: 'j-inline-only', name: 'Inline only', display_type: 'inline' }),
];

const picker = (entries: TemplateIndexEntry[], displayType = 'popup') =>
  render(
    <TemplatePicker
      index={{ templates: entries, labels: LABELS, facets: FACETS } as TemplateIndex}
      trees={new Map()}
      displayType={displayType}
      chosen={undefined}
      fit={ANY}
      busy={false}
      onChoose={vi.fn()}
      onNear={vi.fn()}
    />,
  );

/** Every design name currently on screen, in grid order. */
const shown = () =>
  [...document.querySelectorAll('.wconvert-gallery__card [id^="wconvert-design-"]')].map(
    (each) => each.textContent,
  );

describe('the toolbar', () => {
  /**
   * **It appears only when the set is large enough to need it**, which is the
   * toolbar's own rule for the count read one control over: *a count is stated
   * only where the set can be large enough to need one*. A chip strip over
   * eight designs is a line that taxes every visit and informs none
   * (ADR 0042 rule 2), and a fresh install is exactly that.
   */
  it('is absent on a library small enough to read', () => {
    picker(LIBRARY.slice(0, 5));

    expect(screen.queryByRole('group', { name: 'Shape' })).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('appears once there are enough designs to narrow', () => {
    picker(LIBRARY);

    expect(screen.getByRole('group', { name: 'Shape' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Asks for' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Picture' })).toBeInTheDocument();
  });

  /**
   * The count is the one number that moves when nothing else on screen does, so
   * it is the one thing that has to be spoken (ADR 0038). It counts the SHOWN
   * set, which is already filtered to this Display Type.
   */
  it('counts what is on screen, out loud', async () => {
    picker(LIBRARY);

    const count = screen.getByText('9 designs');

    expect(count.closest('[aria-live="polite"]')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Row' }));

    expect(screen.getByText('2 designs')).toBeInTheDocument();
  });

  /** One Template serves exactly one Display Type, so it is not asked twice. */
  it('never offers Display Type as a chip', () => {
    picker(LIBRARY);

    expect(shown()).not.toContain('Inline only');
    expect(screen.queryByRole('group', { name: /type/i })).toBeNull();
  });
});

describe('narrowing the library', () => {
  it('keeps only the designs arranged that way', async () => {
    picker(LIBRARY);

    await userEvent.click(screen.getByRole('button', { name: 'Side by side' }));

    expect(shown()).toEqual(['Split photo', 'Split email']);
  });

  /**
   * **OR within a facet**, which is what pressing two chips means — and it is
   * why there is no "All" chip: nothing pressed is no constraint, so the
   * unfiltered state is the empty one.
   */
  it('widens within one facet and narrows across two', async () => {
    picker(LIBRARY);

    await userEvent.click(screen.getByRole('button', { name: 'Row' }));
    await userEvent.click(screen.getByRole('button', { name: 'Side by side' }));

    expect(shown()).toEqual(['Row email', 'Split photo', 'Row phone', 'Split email']);

    await userEvent.click(screen.getByRole('button', { name: 'Phone number' }));

    expect(shown()).toEqual(['Row phone']);
  });

  /**
   * *Selected* is one declaration and every strip reads it (ADR 0042 rule 5),
   * so a chip says it is pressed with `aria-pressed` rather than with a variant
   * — a variant meaning "selected" is a second place for that decision to live.
   */
  it('says a chip is pressed as a state rather than as a colour', async () => {
    picker(LIBRARY);

    const chip = screen.getByRole('button', { name: 'Row' });

    expect(chip).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(chip);

    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('narrows on a boolean facet with the one chip it has', async () => {
    picker(LIBRARY);

    await userEvent.click(screen.getByRole('button', { name: 'With a picture' }));

    expect(shown()).toEqual(['Split photo', 'Column photo']);
  });
});

describe('searching the library', () => {
  /** The admin's first search box, so it needs a real label — a placeholder is not one. */
  it('is labelled for something that is not looking at it', () => {
    picker(LIBRARY);

    expect(screen.getByRole('searchbox', { name: 'Search designs' })).toBeInTheDocument();
  });

  it('matches the name, whatever case it was typed in', async () => {
    picker(LIBRARY);

    await userEvent.type(screen.getByRole('searchbox'), 'SPLIT');

    expect(shown()).toEqual(['Split photo', 'Split email']);
  });

  /**
   * **A dead end is not a state.** *"No designs match"* tells a merchant what
   * they can already see; *"No designs match — clear filters"* is a screen
   * (ADR 0039).
   */
  it('offers the way back when nothing matches', async () => {
    picker(LIBRARY);

    await userEvent.type(screen.getByRole('searchbox'), 'nothing at all');

    expect(screen.getByText('No designs match')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(shown()).toHaveLength(9);
  });

  it('clears the chips as well as the box', async () => {
    picker(LIBRARY);

    await userEvent.click(screen.getByRole('button', { name: 'Side by side' }));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('button', { name: 'Side by side' })).toHaveAttribute('aria-pressed', 'false');
    expect(shown()).toHaveLength(9);
  });
});

describe('a Display Type with no designs', () => {
  /**
   * The existing message gains a door. It said what the merchant could already
   * see and left them to find the way out (ADR 0039).
   */
  it('says so, and does not draw a toolbar over nothing', () => {
    picker(LIBRARY, 'floating_bar');

    expect(screen.getByText(/No designs for/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Shape' })).toBeNull();
  });
});

/**
 * ============================================================================
 * ~~A GOAL EVERY DESIGN REFUSES~~ — THE STATE AND ITS NOTE ARE BOTH GONE.
 * ============================================================================
 * A note stood under the grid saying *"None of these counts a click-through,
 * which is what this Optin's goal measures"*, with *Clear filters* as its door,
 * because a Goal that counted clicks refused every submit-metered design in the
 * library — which is most of it.
 *
 * **No Goal refuses a design for its act now** (ADR 0059), so the state is
 * unreachable. And the door was dead code even while it was reachable: it
 * appeared only when the set was narrowed, and the toolbar that narrows it
 * renders at nine designs per [[Display Type]] while free ships eight popup
 * entries and six inline ones. There were no chips to clear.
 */
describe('the note about a Goal every design refuses', () => {
  it('is gone, and no card is greyed for its act', async () => {
    render(
      <TemplatePicker
        index={{ templates: LIBRARY, labels: LABELS, facets: FACETS } as TemplateIndex}
        trees={new Map()}
        displayType="popup"
        chosen={undefined}
        fit={{ ...ANY, act: 'click' }}
        busy={false}
        onChoose={vi.fn()}
        onNear={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Column' }));
    await userEvent.click(screen.getByRole('button', { name: 'Phone number' }));

    expect(screen.queryByText(/None of these counts/)).toBeNull();
    expect(screen.queryByText(/change the Goal/i)).toBeNull();
    expect(screen.getAllByRole('button', { name: /Use this design/ }).every((each) => !each.hasAttribute('disabled'))).toBe(true);
  });
});
