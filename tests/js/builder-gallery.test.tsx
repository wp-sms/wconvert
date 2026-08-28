import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
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
