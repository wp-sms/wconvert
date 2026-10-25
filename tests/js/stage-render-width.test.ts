import { describe, expect, it } from 'vitest';
import { renderWidth } from '../../resources/admin/src/stage/renderWidth';

describe('the width a design is drawn at', () => {
  it('draws a bar and a fullscreen at a page width on desktop', () => {
    expect(renderWidth({ width: '30rem' }, 'floating_bar', 'desktop')).toBe(880);
    expect(renderWidth({ width: '40rem' }, 'fullscreen', 'desktop')).toBe(1024);
  });

  it('draws a popup at its own width, and 448 when it declares none', () => {
    expect(renderWidth({ width: '32rem' }, 'popup', 'desktop')).toBe(512);
    expect(renderWidth({ width: '600px' }, 'popup', 'desktop')).toBe(600);
    expect(renderWidth({}, 'popup', 'desktop')).toBe(448);
  });

  it('caps a slide-in at 416 and an inline design at 680', () => {
    expect(renderWidth({ width: '30rem' }, 'slide_in', 'desktop')).toBe(416);
    expect(renderWidth({ width: '22rem' }, 'slide_in', 'desktop')).toBe(352);
    expect(renderWidth({ width: '736px' }, 'inline', 'desktop')).toBe(680);
    expect(renderWidth({ width: '36rem' }, 'inline', 'desktop')).toBe(576);
    expect(renderWidth({}, 'inline', 'desktop')).toBe(640);
  });

  it('falls back to the default for a width no number can be read from', () => {
    expect(renderWidth({ width: '100%' }, 'popup', 'desktop')).toBe(448);
    expect(renderWidth({ width: 'min(90vw, 40rem)' }, 'inline', 'desktop')).toBe(640);
    expect(renderWidth({ width: '100%' }, 'slide_in', 'desktop')).toBe(416);
  });

  it('draws every format inside a 360px phone', () => {
    expect(renderWidth({ width: '30rem' }, 'floating_bar', 'mobile')).toBe(360);
    expect(renderWidth({ width: '30rem' }, 'fullscreen', 'mobile')).toBe(360);
    expect(renderWidth({ width: '32rem' }, 'popup', 'mobile')).toBe(328);
    expect(renderWidth({ width: '18rem' }, 'popup', 'mobile')).toBe(288);
    expect(renderWidth({ width: '22rem' }, 'slide_in', 'mobile')).toBe(328);
    expect(renderWidth({ width: '736px' }, 'inline', 'mobile')).toBe(328);
  });
});
