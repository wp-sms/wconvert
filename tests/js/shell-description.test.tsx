import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Description } from '../../resources/admin/src/shell/Description';

/**
 * **A description is a ROLE with a size of its own**, and until the type scale
 * landed it had neither: nine call sites spelled `text-pretty
 * text-muted-foreground` by hand, six of them forgot `text-pretty`, and every
 * one of them rendered at body size — so a sentence explaining a thing was
 * exactly as large as the thing.
 *
 * These assert the CLASSES rather than computed pixels, and that is a stated
 * limit rather than laziness: Vitest runs jsdom with `css: false`, so nothing
 * in this suite computes a font size. The browser pass is what proves the
 * rendered result; this is what stops the class being dropped.
 */
describe('a description', () => {
  it('is set at the note size, muted, balanced and capped to a reading measure', () => {
    render(<Description>Where captured leads are sent on to.</Description>);

    const note = screen.getByText('Where captured leads are sent on to.');

    expect(note.tagName).toBe('P');
    expect(note).toHaveClass('text-note');
    expect(note).toHaveClass('text-muted-foreground');
    expect(note).toHaveClass('text-pretty');
    expect(note).toHaveClass('max-w-2xl');
  });

  /**
   * The suspension reason is the one call site that comes UP a size. It was
   * `text-xs` — 12px, the smallest text on the Optin list — carrying the most
   * important explanatory sentence on that screen.
   */
  it('renders inline where it sits inside something that is already a paragraph', () => {
    render(
      <Description as="span" className="mt-1 block">
        Its Goal is no longer available.
      </Description>,
    );

    const note = screen.getByText('Its Goal is no longer available.');

    expect(note.tagName).toBe('SPAN');
    expect(note).toHaveClass('text-note');
    expect(note).not.toHaveClass('text-xs');
  });
});
