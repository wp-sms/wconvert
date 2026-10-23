import { afterEach, expect, it } from 'vitest';
import { pageLabel, providePageLabels } from '@renderer/page-labels';

// The renderer's and loaders' own words arrive as `data-labels` (ADR 0166):
// only the ones that differ from English, keyed by position.
const page = (labels: string | null) => {
  const tag = document.createElement('script');
  tag.id = 'wconvert-payload';
  if (labels !== null) tag.setAttribute('data-labels', labels);
  document.body.append(tag);
  providePageLabels(undefined);
};

afterEach(() => { document.body.replaceChildren(); providePageLabels(undefined); });

it('reads a translated word at its position and keeps the English for one not printed', () => {
  page(JSON.stringify({ 0: 'Schließen', 17: 'Weiter' }));
  expect(pageLabel(0, 'Close')).toBe('Schließen');
  expect(pageLabel(17, 'Continue')).toBe('Weiter');
  expect(pageLabel(2, 'Time remaining')).toBe('Time remaining');
});

it('reads an untranslated page, an older cached one and a malformed attribute as English', () => {
  page(null);
  expect(pageLabel(0, 'Close')).toBe('Close');
  document.body.replaceChildren();
  page('{');
  expect(pageLabel(0, 'Close')).toBe('Close');
  document.body.replaceChildren();
  providePageLabels(undefined);
  expect(pageLabel(0, 'Close')).toBe('Close');
});

it('takes the admin\'s words where there is no payload tag', () => {
  providePageLabels({ 1: 'Kampagne' });
  expect(pageLabel(1, 'Campaign')).toBe('Kampagne');
});
