import { afterEach, describe, expect, it } from 'vitest';
import { formatMoney, formatWhen, humanize, labelOf } from '../../resources/admin/src/lib/format';

// 2026-10-09 14:00 UTC.
const NOW = Date.UTC(2026, 9, 9, 14, 0);

describe('dates read in the site’s zone and locale', () => {
  afterEach(() => { document.documentElement.lang = ''; });

  it('reads a list row as today, yesterday or a short date', () => {
    expect(formatWhen('2026-10-09 09:05:00', 'list', NOW, 'UTC')).toMatch(/^Today, 9:05\sAM$/);
    expect(formatWhen('2026-10-08 23:59:00', 'list', NOW, 'UTC')).toBe('Yesterday');
    expect(formatWhen('2026-10-03 08:00:00', 'list', NOW, 'UTC')).toBe('Oct 3');
    expect(formatWhen('2025-10-03 08:00:00', 'list', NOW, 'UTC')).toBe('Oct 3, 2025');
  });

  it('reads a detail as the whole fact', () => {
    expect(formatWhen('2026-10-09 14:22:00', 'detail', NOW, 'UTC')).toMatch(/^Oct 9, 2026, 2:22\sPM$/);
  });

  it('decides today by the site’s day, not the browser’s', () => {
    // 14:00 UTC is already the 10th in Auckland, so the 9th is yesterday there.
    expect(formatWhen('2026-10-09 09:00:00', 'list', NOW, 'Pacific/Auckland')).toBe('Yesterday');
  });

  it('converts an ISO instant into the site’s zone before printing it', () => {
    expect(formatWhen('2026-10-09T10:00:00Z', 'detail', NOW, '+03:30')).toMatch(/1:30\sPM$/);
  });

  it('follows the site locale', () => {
    document.documentElement.lang = 'de-DE';
    expect(formatWhen('2026-10-09 14:22:00', 'detail', NOW, 'UTC')).toBe('09.10.2026, 14:22');
  });

  it('never prints what it cannot read', () => {
    expect(formatWhen('not a date', 'list', NOW, 'UTC')).toBe('—');
    expect(formatWhen(null)).toBe('—');
  });
});

describe('money and keys', () => {
  it('prints the store currency’s symbol', () => {
    expect(formatMoney(1240.5, 'USD')).toBe('$1,240.50');
    expect(formatMoney(3, 'XYZ')).toMatch(/3/);
  });

  it('never prints a raw key', () => {
    expect(labelOf('wc-processing', { 'wc-processing': 'Processing' }, 'Other status')).toBe('Processing');
    expect(labelOf('wc-custom', { 'wc-processing': 'Processing' }, 'Other status')).toBe('Other status');
    expect(humanize('utm_campaign')).toBe('Utm campaign');
  });
});

describe('the calendar', () => {
  afterEach(() => { document.documentElement.lang = ''; });

  it('stays Gregorian on a Persian site, so a month names the month it covers', () => {
    document.documentElement.lang = 'fa-IR';
    expect(formatWhen('2026-10-09 14:22:00', 'detail', NOW, 'UTC')).toContain('۲۰۲۶');
  });
});
