import type { Template } from '@renderer/types';

export type Device = 'desktop' | 'mobile';

/** A `px` or `rem` width as pixels; anything else (`%`, `min()`) is no number to draw at. */
function pixels(value: unknown, fallback: number): number {
  const match = /^\s*([\d.]+)(rem|px)\s*$/.exec(String(value ?? ''));

  return match ? Number(match[1]) * (match[2] === 'rem' ? 16 : 1) : fallback;
}

/**
 * How wide a design is drawn, the one number every surface uses (ADR 0170).
 *
 * A bar and a fullscreen are a page's width; the rest are their own. Mobile is
 * a 360px phone everywhere, with a 16px margin for what floats on it.
 */
export function renderWidth(tokens: Template['tokens'], displayType: string, device: Device): number {
  const own = (fallback: number) => pixels(tokens.width, fallback);

  if (device === 'mobile') {
    switch (displayType) {
      case 'floating_bar':
      case 'fullscreen':
        return 360;
      case 'popup':
        return Math.min(own(448), 328);
      default:
        return 328;
    }
  }

  switch (displayType) {
    case 'floating_bar':
      return 880;
    case 'fullscreen':
      return 1024;
    case 'slide_in':
      return Math.min(own(416), 416);
    case 'inline':
      return Math.min(own(640), 680);
    default:
      return own(448);
  }
}
