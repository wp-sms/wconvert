import { describe, expect, it } from 'vitest';
import { fitZoom, revealScroll, stepZoom, zoomAt } from '../../resources/admin/src/builder/structure/flowViewport';

describe('Fit', () => {
  it('shows the whole map at up to 100%, and never below 70% (ADR 0142)', () => {
    expect(fitZoom({ width: 1000, height: 800 }, { width: 600, height: 500 })).toBe(1);
    expect(fitZoom({ width: 1000, height: 800 }, { width: 1200, height: 1000 })).toBe(0.8);
    expect(fitZoom({ width: 1000, height: 800 }, { width: 3000, height: 4000 })).toBe(0.7);
    expect(fitZoom({ width: 0, height: 0 }, { width: 600, height: 500 })).toBe(1);
  });
});

describe('zooming', () => {
  it('keeps the point under the pointer where it was', () => {
    const scroll = zoomAt({ left: 100, top: 50 }, { x: 200, y: 100 }, 1, 0.5);
    // Map point (300, 150) was under the pointer; at 50% it is at (150, 75).
    expect(scroll).toEqual({ left: -50, top: -25 });
    expect(zoomAt({ left: 0, top: 0 }, { x: 0, y: 0 }, 0.8, 1)).toEqual({ left: 0, top: 0 });
  });

  it('steps in tenths between 40% and 150%', () => {
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(0.73, -1)).toBe(0.7);
    expect(stepZoom(1.5, 1)).toBe(1.5);
    expect(stepZoom(0.4, -1)).toBe(0.4);
  });
});

describe('keeping the selection in view', () => {
  const view = { left: 0, top: 0, width: 800, height: 600 };
  const card = (x: number, y: number) => ({ x, y, width: 240, height: 120 });

  it('leaves a card that is already in view where it is', () => {
    expect(revealScroll(view, 1, [card(100, 100)])).toBeNull();
  });

  it('brings in the selected card and the screen after it when both fit', () => {
    expect(revealScroll(view, 1, [card(100, 900), card(100, 1100)])).toEqual({ left: 0, top: 1220 + 24 - 600 });
  });

  it('brings in the selected card alone when the next one is too far away', () => {
    expect(revealScroll(view, 1, [card(100, 900), card(100, 2400)])).toEqual({ left: 0, top: 900 + 120 + 24 - 600 });
  });

  it('measures at the current zoom', () => {
    expect(revealScroll(view, 0.5, [card(1600, 100)])).toEqual({ left: 800 + 120 + 24 - 800, top: 0 });
  });
});
