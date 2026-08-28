import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';

/**
 * The gallery card's footer, which is the half of the card the suite can see.
 *
 * **The preview is the half it cannot.** `zoom` is a layout property and Vitest
 * runs jsdom with `css: false`, so the dead space under every card — 192px
 * reserved for a 106px render — is invisible here in both directions: it
 * neither failed before nor passes now. That one is the browser pass's.
 *
 * What IS assertable is the shape of the footer, and it was wrong for the same
 * reason the preview was: the CHOSEN card rendered a `Badge` where every other
 * rendered a `Button`, ~22px against ~32px, so it sat ~10px shorter than its
 * neighbours — the exact ragged row `Gallery.tsx`'s own comment says the
 * layout exists to prevent.
 */
const { Gallery } = await import('../../resources/admin/src/builder/Gallery');

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

const OTHER: TemplateEntry = { ...ENTRY, id: 'stacked-signup', name: 'Stacked signup' };

const draw = (chosen: string | undefined) =>
  render(
    <Gallery
      templates={[ENTRY, OTHER]}
      displayType={ENTRY.display_type}
      chosen={chosen}
      act="submit"
      busy={false}
      onChoose={vi.fn()}
    />,
  );

describe('a gallery card', () => {
  it('renders a button in both states, so the row cannot go ragged', () => {
    draw(ENTRY.id);

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
    draw(ENTRY.id);

    expect(screen.getByRole('button', { name: /In use/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Use this design/ })).toBeEnabled();
  });

  /**
   * Selection was exposed as a badge and a border colour, and neither is a
   * state in the accessibility tree — so the chosen card was chosen only if
   * you could see it.
   */
  it('says which card is chosen to something that is not looking', () => {
    const { container } = draw(OTHER.id);

    const current = container.querySelectorAll('[aria-current="true"]');

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Stacked signup');
  });

  it('offers every card where none is chosen', () => {
    draw(undefined);

    expect(screen.getAllByRole('button', { name: /Use this design/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /In use/ })).toBeNull();
  });
});

/**
 * ============================================================================
 * A DESIGN THE SAVE WILL REFUSE IS MARKED, NOT OFFERED AND THEN REFUSED.
 * ============================================================================
 * `OptinController::refuseAMetricItCannotReport()` rejects a click-converting
 * design under a submit-counting [[Goal]] outright (ADR 0025). The gallery
 * offered it anyway — so a merchant pressed *Use this design*, waited for a
 * round trip, and got a red bar telling them to "pick a design that matches the
 * Goal, **or change the Goal**", with no control on the screen that changes a
 * Goal.
 *
 * The admin already had the doctrine: {@see renderingFor} marks an option that
 * cannot be taken *before* the click, with the reason. This is that, one
 * surface over — and `convertingActOf` is the same reading the server and
 * `problemsIn` take, so the three cannot disagree about which designs match.
 */
const CLICKS: TemplateEntry = {
  ...ENTRY,
  id: 'offer-panel',
  name: 'Offer panel',
  tree: {
    steps: [
      {
        type: 'stack',
        children: [
          { type: 'heading', role: 'headline', text: 'Midseason sale' },
          { type: 'button', role: 'cta_label', action: 'link', label: 'Shop the sale' },
        ],
      },
    ],
  } as TemplateEntry['tree'],
};

const NOTHING: TemplateEntry = {
  ...ENTRY,
  id: 'silent',
  name: 'Silent',
  tree: { steps: [{ type: 'stack', children: [{ type: 'heading', text: 'Hello' }] }] } as TemplateEntry['tree'],
};

/** The card a design is on, found by the name it prints. */
const card = (name: string) => screen.getByText(name).closest('li') as HTMLElement;

const gallery = (entries: TemplateEntry[], act: 'submit' | 'click') =>
  render(
    <Gallery
      templates={entries}
      displayType={ENTRY.display_type}
      chosen={undefined}
      act={act}
      busy={false}
      onChoose={vi.fn()}
    />,
  );

describe('a design this Optin’s Goal cannot use', () => {
  it('cannot be chosen, and says why on the card', () => {
    gallery([ENTRY, CLICKS], 'submit');

    const offer = within(card('Offer panel'));

    expect(offer.getByRole('button', { name: /Use this design/ })).toBeDisabled();
    expect(offer.getByText('Converts on a click. Your goal counts form submissions.')).toBeInTheDocument();
  });

  /**
   * The reason is the button's DESCRIPTION, so a screen reader hears why it
   * cannot be pressed rather than only that it cannot.
   */
  it('tells a screen reader why, not just that', () => {
    gallery([ENTRY, CLICKS], 'submit');

    const offer = within(card('Offer panel'));
    const described = offer.getByRole('button', { name: /Use this design/ }).getAttribute('aria-describedby') ?? '';

    expect(described).toContain('wconvert-refused-offer-panel');
  });

  /** The one that matches is untouched — this marks, it does not disable a gallery. */
  it('leaves the designs that do match offered', () => {
    gallery([ENTRY, CLICKS], 'submit');

    expect(
      within(card('Centred card')).getByRole('button', { name: /Use this design/ }),
    ).toBeEnabled();
  });

  /**
   * **Marked, never hidden.** A merchant comparing three designs and finding
   * two has no way to know the third exists or why it is gone — and the reason
   * is about their Goal rather than about the install, so it is worth reading.
   */
  it('is still on screen, so the merchant can see what they are not being offered', () => {
    gallery([ENTRY, CLICKS], 'submit');

    expect(screen.getByText('Offer panel')).toBeInTheDocument();
  });

  /** The mirror: a submitting design under a Goal that counts click-throughs. */
  it('reads the constraint the other way round for a click-counting Goal', () => {
    gallery([ENTRY, CLICKS], 'click');

    expect(
      within(card('Centred card')).getByRole('button', { name: /Use this design/ }),
    ).toBeDisabled();
    expect(
      within(card('Centred card')).getByText('Converts on a form submission. Your goal counts click-throughs.'),
    ).toBeInTheDocument();
    expect(
      within(card('Offer panel')).getByRole('button', { name: /Use this design/ }),
    ).toBeEnabled();
  });

  /**
   * **A design offering nothing is the worse failure and gets its own words.**
   * It renders, publishes and reports zero forever (ADR 0020) — an Optin that
   * looks like it is working.
   */
  it('names a design that counts nothing at all as its own problem', () => {
    gallery([NOTHING], 'submit');

    expect(screen.getByText('Nothing on this design counts as a conversion.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use this design/ })).toBeDisabled();
  });
});
