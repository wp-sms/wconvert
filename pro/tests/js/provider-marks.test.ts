import { afterEach, expect, it } from 'vitest';
import { providerMarks } from '@/destinations/ProviderMark';
import { registerProviderMarks } from '../../modules/destinations/admin/marks';

afterEach(() => { for (const id of Object.keys(providerMarks)) delete providerMarks[id]; });

it('free carries no provider artwork until the destinations module hands it over', () => {
  expect(providerMarks).toEqual({});
  registerProviderMarks();
  expect(providerMarks.mailchimp).toMatch(/svg/);
  expect(providerMarks.brevo).toMatch(/svg/);
  expect(providerMarks.brevo).not.toBe(providerMarks.mailchimp);
});
