import { describe, expect, it } from 'vitest';
import { decorateFullscreen } from '../../pro/modules/display-types/loader/surface';

describe('fullscreen authored spacing', () => {
  it('keeps authored padding responsive and leaves child widths bounded', () => {
    const root = document.createElement('div');
    root.style.setProperty('--wc-pad', '0');
    root.append(document.createElement('div'));
    decorateFullscreen(root, '60rem');
    expect(root.style.padding).toBe('var(--wc-pad)');
    expect((root.firstElementChild as HTMLElement).style.maxInlineSize).toBe('60rem');
    root.style.setProperty('--wc-pad', '12px');
    expect(root.style.padding).toBe('var(--wc-pad)');
  });
  it('retains safe container spacing when a design does not provide it', () => {
    const root = document.createElement('div');
    decorateFullscreen(root, undefined);
    expect(root.style.paddingBlockStart).toContain('safe-area-inset-top');
    expect(root.style.minBlockSize).toBe('100dvh');
  });
});

it('stretches a full-bleed composition to the viewport', () => {
  const root = document.createElement('div');
  root.style.setProperty('--wc-pad', '0');
  const composition = document.createElement('div'); root.append(composition);
  decorateFullscreen(root, '100%');
  expect(composition.style.flexGrow).toBe('1');
  decorateFullscreen(root, '48rem');
  expect(composition.style.flexGrow).toBe('0');
});
