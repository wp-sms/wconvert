import { expect, it } from 'vitest';
import { matchesSearch } from '../../resources/admin/src/discovery/search';
it('finds task aliases without confusing fragments or changing authored translations', () => {
  expect(matchesSearch('repair estimate', ['Repair quote'])).toBe(true);
  expect(matchesSearch('banner', ['Floating bar'])).toBe(true);
  expect(matchesSearch('inquiries', ['Collect enquiries'])).toBe(true);
  expect(matchesSearch('bar', ['Barber appointment'])).toBe(false);
  expect(matchesSearch('bar', ['Barber appointment', 'Popup'])).toBe(false);
  expect(matchesSearch('برآورد', ['درخواست برآورد هزینه'])).toBe(true);
  expect(matchesSearch('repair estimate', ['Repair advice'])).toBe(false);
});
