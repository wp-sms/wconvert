import { afterEach, expect, it } from 'vitest';
import { journeyLabel } from '@loader/journey-labels';

afterEach(() => document.body.replaceChildren());
it('keeps existing translations when an older cached page lacks the saved-state label', () => {
  const tag = document.createElement('script'); tag.id = 'wconvert-payload';
  tag.setAttribute('data-journey', JSON.stringify(['Continuer', 'Réessayez.', 'Coordonnées requises.']));
  document.body.append(tag);
  expect(journeyLabel(0)).toBe('Continuer');
  expect(journeyLabel(2)).toBe('Coordonnées requises.');
  expect(journeyLabel(3)).toBe('Already saved. You can review these details, but cannot change them.');
});
it('falls back for malformed and non-string copy without losing valid translated labels', () => {
  const tag = document.createElement('script'); tag.id = 'wconvert-payload'; document.body.append(tag);
  tag.setAttribute('data-journey', '{'); expect(journeyLabel(0)).toBe('Continue');
  tag.setAttribute('data-journey', JSON.stringify(['Continuer', false]));
  expect(journeyLabel(0)).toBe('Continuer');
  expect(journeyLabel(1)).toBe('Submission not confirmed. Please try again.');
});
