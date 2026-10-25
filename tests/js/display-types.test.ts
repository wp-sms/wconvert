import { afterEach, describe, expect, it } from 'vitest';
import {
  DISPLAY_TYPES,
  displayTypeDescription,
  displayTypeLabel,
} from '../../resources/admin/src/displayTypes';

describe('display type vocabulary', () => {
  afterEach(() => {
    delete window.wconvertAdmin;
  });

  it('keeps the supported formats in the product order', () => {
    expect(DISPLAY_TYPES).toEqual(['popup', 'inline', 'floating_bar', 'slide_in', 'fullscreen']);
  });

  it('explains where each format appears and preserves extension formats', () => {
    expect(displayTypeDescription('popup')).toBe('Centered over the page');
    expect(displayTypeDescription('inline')).toBe('Inside the page');
    expect(displayTypeDescription('floating_bar')).toBe('Bar at the page edge');
    expect(displayTypeDescription('slide_in')).toBe('Panel in a page corner');
    expect(displayTypeDescription('fullscreen')).toBe('Covers the browser viewport');
    expect(displayTypeLabel('extension_format')).toBe('Extension format');
    expect(displayTypeDescription('extension_format')).toBe('');
  });
});
