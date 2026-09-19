import { describe, expect, it } from 'vitest';
import {
  DISPLAY_TYPES,
  displayTypeDescription,
  displayTypeLabel,
  displayTypeOptions,
} from '../../resources/admin/src/displayTypes';

describe('display type vocabulary', () => {
  it('keeps the supported formats in the product order', () => {
    expect(DISPLAY_TYPES).toEqual(['popup', 'inline', 'floating_bar', 'slide_in']);
    expect(displayTypeOptions()).toEqual([
      { value: 'popup', label: 'Popup' },
      { value: 'inline', label: 'Inline form' },
      { value: 'floating_bar', label: 'Floating bar' },
      { value: 'slide_in', label: 'Slide-in' },
    ]);
  });

  it('explains where each format appears and preserves extension formats', () => {
    expect(displayTypeDescription('popup')).toBe('Centred over the page');
    expect(displayTypeDescription('inline')).toBe('Inside the page');
    expect(displayTypeDescription('floating_bar')).toBe('Bar at the page edge');
    expect(displayTypeDescription('slide_in')).toBe('Panel in a page corner');
    expect(displayTypeLabel('extension_format')).toBe('extension_format');
    expect(displayTypeDescription('extension_format')).toBe('extension_format');
  });
});
