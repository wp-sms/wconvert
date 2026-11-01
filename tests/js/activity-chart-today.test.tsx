import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { ActivityChart } from '../../resources/admin/src/stats/ActivityChart';
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
