import { treeFixture } from './support/journey';
import { afterEach, describe, expect, it } from 'vitest';
import { SHADOW_CSS } from '@renderer/css';
import { render } from '@renderer/render';

const panel = (tokens: Record<string, string>, narrow?: Record<string, string>) => {
  const root = render(treeFixture({ steps: [{ type: 'panel', tokens, narrow, children: [] }] }), {}, 0);

  return root.querySelector<HTMLElement>('.wc-panel') ?? root;
};

describe('right to left', () => {
  afterEach(() => { document.dir = ''; });

  it('mirrors a four-sided pad, which clears the close control at the end of the line', () => {
    document.dir = 'rtl';
    const box = panel({ pad: '0 40px 0 0' }, { pad: '48px 18px 20px 6px' });

    expect(box.style.getPropertyValue('--wc-pad')).toBe('0 0 0 40px');
    expect(box.style.getPropertyValue('--wc-n-pad')).toBe('48px 6px 20px 18px');
  });

  it('leaves every pad alone left to right', () => {
    expect(panel({ pad: '0 40px 0 0' }).style.getPropertyValue('--wc-pad')).toBe('0 40px 0 0');
  });

  it.each(['24px', '48px 18px 20px', '0 max(0px,calc((100% - 270px)/2))', 'calc(1px + 2px) 3px 4px 5px'])('leaves %s alone, which has no sides to swap', (pad) => {
    document.dir = 'rtl';

    expect(panel({ pad }).style.getPropertyValue('--wc-pad')).toBe(pad);
  });

  it('touches no token but pad', () => {
    document.dir = 'rtl';

    expect(panel({ margin: '1px 2px 3px 4px' }).style.getPropertyValue('--wc-margin')).toBe('1px 2px 3px 4px');
  });

  it('comes after every rule that spaces or slants letters, so it needs no !important', () => {
    const rule = SHADOW_CSS.indexOf(':dir(rtl){letter-spacing:normal;font-style:normal}');

    expect(rule).toBeGreaterThan(-1);
    expect(SHADOW_CSS.lastIndexOf('font-style:italic')).toBeLessThan(rule);
    expect(SHADOW_CSS.lastIndexOf('letter-spacing:')).toBe(rule + ':dir(rtl){'.length);
  });
});
