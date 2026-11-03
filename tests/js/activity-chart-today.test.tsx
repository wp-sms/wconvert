import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityChart, dateTicks, nearestDay } from '../../resources/admin/src/stats/ActivityChart';
import type { Numbers } from '../../resources/admin/src/stats/api';

afterEach(cleanup);
const numbers = {
  impression_by_day: { '2026-10-30': 40, '2026-10-31': 42, '2026-11-01': 9 },
  conversion_by_day: { '2026-10-30': 4, '2026-10-31': 5, '2026-11-01': 1 },
} as unknown as Numbers;

/** A window through today ends on a running day: dashed, hollow, and named (ADR 0177). */
it('marks the day still running so it does not read as a drop', async () => {
  render(<ActivityChart label="Submissions" numbers={numbers} partialDay="2026-11-01" />);
  expect(document.querySelectorAll('.wa-partial-line')).toHaveLength(1);
  expect(document.querySelector('.wa-partial-point title')?.textContent).toBe('Today so far');
  await userEvent.click(screen.getByText('View exact daily numbers'));
  expect(screen.getByText(/· Today so far/)).toBeInTheDocument();
});

it('draws a complete window as one solid line', () => {
  render(<ActivityChart label="Submissions" numbers={numbers} />);
  expect(document.querySelectorAll('.wa-partial-line, .wa-partial-point')).toHaveLength(0);
});

/** jsdom's `fireEvent.pointer*` drops `clientX` and `pointerType`, so these are real mouse events under the pointer's names. */
function pointer(type: string, target: Element, init: { clientX?: number; pointerType?: string } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.clientX ?? 0 });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'mouse' });
  fireEvent(target, event);
}

describe('reading one day off the chart (ADR 0185)', () => {
  it('snaps a position to the nearest day', () => {
    expect(nearestDay(0, 300, 4)).toBe(0);
    expect(nearestDay(49, 300, 4)).toBe(0);
    expect(nearestDay(51, 300, 4)).toBe(1);
    expect(nearestDay(300, 300, 4)).toBe(3);
  });

  it('stays on the chart past its edges, and copes with one day or none', () => {
    expect(nearestDay(-20, 300, 4)).toBe(0);
    expect(nearestDay(340, 300, 4)).toBe(3);
    expect(nearestDay(150, 300, 1)).toBe(0);
    expect(nearestDay(150, 300, 0)).toBeNull();
  });

  const hover = (clientX: number) => pointer('pointermove', document.querySelector('.wa-chart-plot')!, { clientX });
  const tip = () => document.querySelector('.wa-chart-tip');

  it('shows the day and its value under the pointer, and nothing once it leaves', () => {
    render(<ActivityChart label="Submissions" numbers={numbers} />);
    expect(tip()).toBeNull();
    hover(0);
    expect(tip()).toHaveTextContent('Oct 30, 2026');
    expect(tip()).toHaveTextContent('4');
    expect(document.querySelector('.wa-chart-cursor')).toHaveAttribute('x1', '0');
    expect(document.querySelectorAll('.wa-chart-dot')).toHaveLength(1);
    pointer('pointerout', document.querySelector('.wa-chart-plot')!);
    expect(tip()).toBeNull();
    expect(document.querySelector('.wa-chart-cursor')).toBeNull();
  });

  it('adds the previous date and value when comparing', () => {
    const before = {
      impression_by_day: { '2026-10-27': 30, '2026-10-28': 31, '2026-10-29': 32 },
      conversion_by_day: { '2026-10-27': 3, '2026-10-28': 7, '2026-10-29': 2 },
    } as unknown as Numbers;
    render(<ActivityChart label="Submissions" numbers={numbers} previous={before} />);
    hover(480);
    expect(tip()).toHaveTextContent('Oct 31, 2026');
    expect(tip()).toHaveTextContent('Oct 28, 2026');
    expect(tip()).toHaveTextContent('7');
    expect(document.querySelectorAll('.wa-chart-dot')).toHaveLength(2);
  });

  it('says Today so far on the running day only', () => {
    render(<ActivityChart label="Submissions" numbers={numbers} partialDay="2026-11-01" />);
    hover(960);
    expect(tip()).toHaveTextContent('Today so far');
    hover(0);
    expect(tip()).not.toHaveTextContent('Today so far');
  });

  it('writes a rate with no one shown as a dash, with no dot', async () => {
    const quiet = { impression_by_day: { '2026-10-30': 0, '2026-10-31': 42 }, conversion_by_day: { '2026-10-31': 5 } } as unknown as Numbers;
    render(<ActivityChart label="Submissions" numbers={quiet} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Rate' }));
    hover(0);
    expect(tip()).toHaveTextContent('—');
    expect(document.querySelectorAll('.wa-chart-dot')).toHaveLength(0);
  });

  it('keeps a tap open after the finger lifts, until a tap elsewhere', () => {
    render(<ActivityChart label="Submissions" numbers={numbers} />);
    const plot = document.querySelector('.wa-chart-plot')!;
    pointer('pointerdown', plot, { pointerType: 'touch' });
    pointer('pointerout', plot, { pointerType: 'touch' });
    expect(tip()).toHaveTextContent('Oct 30, 2026');
    pointer('pointerdown', document.body, { pointerType: 'touch' });
    expect(tip()).toBeNull();
  });

  it('drops the tooltip when the browser takes the touch to scroll', () => {
    render(<ActivityChart label="Submissions" numbers={numbers} />);
    const plot = document.querySelector('.wa-chart-plot')!;
    pointer('pointerdown', plot, { pointerType: 'touch' });
    pointer('pointercancel', plot, { pointerType: 'touch' });
    expect(tip()).toBeNull();
  });

  it('leaves the exact numbers to the table: the drawing is hidden from a screen reader', () => {
    render(<ActivityChart label="Submissions" numbers={numbers} />);
    hover(0);
    expect(document.querySelector('.wa-chart')).toHaveAttribute('aria-hidden', 'true');
    expect(tip()).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('drawing to the panel (ADR 0185)', () => {
  const measureAs = (width: number) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width, left: 0 } as DOMRect);
  };
  afterEach(() => vi.restoreAllMocks());

  it('asks for about five dates when wide and three when narrow, evenly spaced', () => {
    expect(dateTicks(30, 960)).toEqual([0, 7, 15, 22, 29]);
    expect(dateTicks(30, 300)).toEqual([0, 15, 29]);
  });

  it('never repeats a date in a short period', () => {
    expect(dateTicks(3, 960)).toEqual([0, 1, 2]);
    expect(dateTicks(4, 300)).toEqual([0, 2, 3]);
    expect(dateTicks(1, 960)).toEqual([0]);
    expect(dateTicks(0, 960)).toEqual([]);
  });

  const long = {
    impression_by_day: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`2026-10-${String(i + 1).padStart(2, '0')}`, 10])),
    conversion_by_day: {},
  } as unknown as Numbers;

  it('runs the line and the gridlines from edge to edge at the measured width', () => {
    measureAs(640);
    render(<ActivityChart label="Submissions" numbers={long} />);
    expect(document.querySelector('.wa-chart')).toHaveAttribute('viewBox', '0 0 640 190');
    const line = document.querySelector('.wa-current-line')!.getAttribute('d')!;
    expect(line.startsWith('M0,')).toBe(true);
    expect(line).toMatch(/L640,\d+$/);
    expect(document.querySelector('.wa-chart line')).toHaveAttribute('x1', '0');
    expect(document.querySelector('.wa-chart line')).toHaveAttribute('x2', '640');
  });

  it('draws in a fixed space where nothing can be measured', () => {
    render(<ActivityChart label="Submissions" numbers={long} />);
    expect(document.querySelector('.wa-chart')).toHaveAttribute('viewBox', '0 0 960 190');
  });

  it('places each date at the same pixel as its day on the line', () => {
    measureAs(290);
    render(<ActivityChart label="Submissions" numbers={long} />);
    const dates = [...document.querySelectorAll<HTMLElement>('.wa-chart-dates > span')];
    expect(dates.map((date) => date.textContent)).toEqual(['Oct 1, 2026', 'Oct 16, 2026', 'Oct 30, 2026']);
    expect(dates.map((date) => parseFloat(date.style.insetInlineStart))).toEqual([0, 150, 290]);
  });

  it('keeps time running left to right in a right-to-left admin', () => {
    render(<ActivityChart label="Submissions" numbers={numbers} />);
    expect(document.querySelector('.wa-chart-block')).toHaveAttribute('dir', 'ltr');
  });
});
