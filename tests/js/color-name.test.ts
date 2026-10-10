import { describe, expect, it } from 'vitest';
import { colorName } from '../../resources/admin/src/builder/colorName';

/** A swatch says a color's name, not its hex (ADR 0135). */
describe('colorName', () => {
  it('names the colors a look is made of', () => {
    expect(colorName('#ffffff')).toBe('White');
    expect(colorName('#000000')).toBe('Black');
    expect(colorName('#18181b')).toBe('Charcoal');
    expect(colorName('#2f4f37')).toBe('Forest');
    expect(colorName('#f7f1e6')).toBe('Cream');
  });

  it('reads the short and alpha hex forms', () => {
    expect(colorName('#fff')).toBe('White');
    expect(colorName('#ffffffff')).toBe('White');
  });

  it('says a translucent color is see-through', () => {
    expect(colorName('rgba(15, 23, 42, 0.55)')).toBe('Navy, see-through');
  });

  it('calls anything far from every name a custom color, and anything unreadable too', () => {
    expect(colorName('var(--brand)')).toBe('Custom color');
    expect(colorName('')).toBe('Custom color');
  });
});
