import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { mirrored } from '../../resources/admin/src/builder/BlockTree';
import { Tabs, TabsList, TabsTrigger } from '../../resources/admin/src/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '../../resources/admin/src/components/ui/dropdown-menu';

/**
 * ============================================================================
 * THE TWO HALVES OF RTL THAT A TEST CAN ACTUALLY PROVE.
 * ============================================================================
 * The admin is verified 44/44 under `fa_IR` and every box in it uses logical
 * properties, so most of the RTL story is CSS and belongs on a browser pass.
 * Two pieces are not CSS, and both were found in a browser after shipping —
 * which is the argument for having them here instead.
 *
 * - **The arrow inversion.** "Next control" is physically ← in Persian, so a
 *   hard-coded `ArrowRight` walks a treegrid row backwards for every RTL
 *   merchant and does it silently. It is a pure function, and it was only
 *   provable in a browser because it was not exported.
 * - **The Radix `dir` regression.** Every Radix primitive resolves its
 *   direction through its own `useDirection()`, falls back to `ltr` when no
 *   `DirectionProvider` is above it, and then writes that answer onto the DOM
 *   as a real `dir` attribute — which beats inheritance. So `Tabs.Root` saying
 *   `ltr` turned the whole builder left-to-right inside an admin the browser
 *   had correctly laid out right-to-left. `useDirection` reads the COMPUTED
 *   direction of `<html>`, and jsdom reflects that from an inline style, so
 *   this is testable without a browser after all.
 */

afterEach(() => {
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('dir');
});

/** What a right-to-left WordPress locale actually does to the document. */
const readRightToLeft = () => {
  document.documentElement.setAttribute('dir', 'rtl');
  document.documentElement.style.direction = 'rtl';
};

describe('the arrow keys in a right-to-left box', () => {
  it('swaps left and right, because "next" is the other way', () => {
    expect(mirrored('ArrowRight')).toBe('ArrowLeft');
    expect(mirrored('ArrowLeft')).toBe('ArrowRight');
  });

  /**
   * **Up is up in Persian too.** A list runs top to bottom whichever way the
   * words run, so inverting the vertical keys would break the one axis that was
   * never at risk — and `Alt+↑`/`Alt+↓` move a block by the same reasoning.
   */
  it('leaves every other key alone, including the vertical ones', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' ']) {
      expect(mirrored(key)).toBe(key);
    }
  });
});

describe('the vendored Radix wrappers', () => {
  it('reads left to right where the document does', () => {
    render(
      <Tabs value="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByRole('tablist').closest('[dir]')).toHaveAttribute('dir', 'ltr');
  });

  /**
   * The regression itself: without the hook this renders `dir="ltr"` inside an
   * RTL page and pins everything under it the wrong way round.
   */
  it('follows the document into right-to-left rather than pinning it back', () => {
    readRightToLeft();

    render(
      <Tabs value="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByRole('tablist').closest('[dir]')).toHaveAttribute('dir', 'rtl');
  });

  /** And the menu, which is the other primitive the block tree's rows use. */
  it('does the same for a dropdown menu', () => {
    readRightToLeft();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      </DropdownMenu>,
    );

    expect(screen.getByText('Open').closest('[dir]')).toHaveAttribute('dir', 'rtl');
  });
});
