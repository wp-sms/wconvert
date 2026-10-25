import { describe, expect, it } from 'vitest';
import { place, type Framing } from '../../resources/admin/src/stage/geometry';

const card = { width: 300, height: 225 };
const desktop = (format: string, more: Partial<Framing> = {}): Framing => ({ format, device: 'desktop', zoom: 'fit', cap: 1.25, rtl: false, ...more });
const near = (value: number) => expect.closeTo(value, 3);

describe('where a design stands on the page', () => {
  it('fills 88% of an inline slot with a wide, short design such as inline-cta', () => {
    const at = place(desktop('inline'), card, { width: 680, height: 150 });

    expect(at.scale * 680).toBeCloseTo(264, 3);
    expect(at.x).toBeCloseTo(18, 3);
    // Centred in the band that starts 22% down and is 60% tall.
    expect(at.y).toBeCloseTo(49.5 + (135 - 150 * at.scale) / 2, 3);
    // The plate runs the page's width and stands 2% of it proud above and below.
    expect(at.plate).toEqual({ x: 0, y: near(at.y - 6), width: 300, height: near(150 * at.scale + 12) });
  });

  it('centres a popup in 72% × 88% of the page', () => {
    const at = place(desktop('popup'), card, { width: 448, height: 520 });

    expect(at.scale).toBeCloseTo(198 / 520, 5);
    expect(at.x).toBeCloseTo((300 - 448 * at.scale) / 2, 5);
    expect(at.y).toBeCloseTo((225 - 198) / 2, 5);
    expect(at.plate).toBeUndefined();
  });

  it('never draws a design more than 1.25 times its size, or past 1 on the canvas', () => {
    const page = { width: 1200, height: 900 };

    expect(place(desktop('popup'), page, { width: 300, height: 200 }).scale).toBe(1.25);
    expect(place(desktop('popup', { cap: 1 }), page, { width: 300, height: 200 }).scale).toBe(1);
  });

  it('puts a slide-in in the end corner, mirrored in RTL', () => {
    const ltr = place(desktop('slide_in'), card, { width: 416, height: 300 });
    const scale = Math.min(150 / 416, 193.5 / 300);

    expect(ltr.scale).toBeCloseTo(scale, 5);
    expect(ltr.x).toBeCloseTo(300 - 12 - 416 * scale, 5);
    expect(ltr.y).toBeCloseTo(225 - 15.75 - 300 * scale, 5);
    expect(place(desktop('slide_in', { rtl: true }), card, { width: 416, height: 300 }).x).toBeCloseTo(12, 5);
  });

  it('moves a slide-in to the corner its placement names', () => {
    const at = place(desktop('slide_in', { placement: 'block_start_inline_start' }), card, { width: 416, height: 300 });

    expect(at.x).toBeCloseTo(12, 5);
    expect(at.y).toBeCloseTo(15.75, 5);
    expect(place(desktop('slide_in', { placement: 'block_start_inline_start', rtl: true }), card, { width: 416, height: 300 }).x)
      .toBeCloseTo(300 - 12 - 416 * at.scale, 5);
  });

  it('spans a bar across the top, and reports how much page it covers', () => {
    const at = place(desktop('floating_bar'), card, { width: 880, height: 88 });

    expect(at).toMatchObject({ x: 0, y: 0, scale: near(300 / 880) });
    expect(at.barHeight).toBeCloseTo(30, 5);
  });

  it('puts a bar at the bottom when its placement says so', () => {
    const at = place(desktop('floating_bar', { placement: 'block_end' }), card, { width: 880, height: 88 });

    expect(at.y).toBeCloseTo(225 - 30, 5);
    expect(at.barHeight).toBeUndefined();
  });

  it('draws a fullscreen at 1024 across the page and as tall as the page', () => {
    const at = place(desktop('fullscreen'), card, { width: 1024, height: 700 });

    expect(at).toMatchObject({ x: 0, y: 0, scale: near(300 / 1024) });
    expect(at.fill).toBeCloseTo(225 / (300 / 1024), 5);
  });

  it('grows the page at actual size so the design fits at scale 1', () => {
    const at = place(desktop('popup', { zoom: 'actual' }), card, { width: 448, height: 520 });

    expect(at.scale).toBe(1);
    expect(at.page).toMatchObject({ width: near(448 / 0.72), height: near(520 / 0.88) });
    expect(at.x).toBeCloseTo((448 / 0.72 - 448) / 2, 5);
  });

  it('keeps the page at the stage size when the design already fits at actual size', () => {
    const at = place(desktop('popup', { zoom: 'actual' }), { width: 1200, height: 900 }, { width: 448, height: 520 });

    expect(at.page).toMatchObject({ width: 1200, height: 900 });
  });
});

describe('on a phone', () => {
  const phone = (format: string): Framing => ({ format, device: 'mobile', zoom: 'fit', cap: 1.25, rtl: false });

  it('scales a 360 × 720 page into the stage and draws the design at scale 1', () => {
    const at = place(phone('popup'), card, { width: 328, height: 400 });

    expect(at.page).toEqual({ width: 360, height: 720, scale: 225 / 720, x: (300 - 360 * (225 / 720)) / 2, y: 0 });
    expect(at).toMatchObject({ scale: 1, x: 16, y: 160 });
  });

  it('never enlarges the phone past the cap, and draws it at 1 at actual size', () => {
    const tall = { width: 1200, height: 1000 };

    expect(place({ ...phone('popup'), cap: 1 }, tall, { width: 328, height: 400 }).page).toMatchObject({ scale: 1, x: 420, y: 140 });
    expect(place({ ...phone('popup'), zoom: 'actual' }, card, { width: 328, height: 400 }).page).toMatchObject({ scale: 1, x: 0, y: 0 });
  });

  it('keeps a tall popup 16px from the top', () => {
    expect(place(phone('popup'), card, { width: 328, height: 700 }).y).toBe(16);
  });

  it('stands a slide-in 16px from the bottom', () => {
    expect(place(phone('slide_in'), card, { width: 328, height: 240 })).toMatchObject({ x: 16, y: 720 - 16 - 240 });
  });

  it('puts an inline design under the page head, rising for a tall one', () => {
    expect(place(phone('inline'), card, { width: 328, height: 200 }).y).toBe(150);
    expect(place(phone('inline'), card, { width: 328, height: 600 }).y).toBe(104);
    expect(place(phone('inline'), card, { width: 328, height: 700 }).y).toBe(64);
  });

  it('fills the phone with a fullscreen', () => {
    expect(place(phone('fullscreen'), card, { width: 360, height: 400 })).toMatchObject({ x: 0, y: 0, scale: 1, fill: 720 });
  });
});
