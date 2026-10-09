import { afterEach, describe, expect, it } from 'vitest';
import {
  DISPLAY_TYPES,
  displayTypeDescription,
  displayTypeLabel,
  displayTypeOptions,
} from '../../resources/admin/src/displayTypes';

describe('display type vocabulary', () => {
  afterEach(() => {
    delete window.wconvertAdmin;
  });

  it('keeps the supported formats in the product order', () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
    expect(DISPLAY_TYPES).toEqual(['popup', 'inline', 'floating_bar', 'slide_in', 'fullscreen']);
    expect(displayTypeOptions()).toEqual([
      { value: 'popup', label: 'Popup' },
      { value: 'inline', label: 'Inline form' },
      { value: 'floating_bar', label: 'Floating bar' },
      { value: 'slide_in', label: 'Slide-in' },
      { value: 'fullscreen', label: 'Fullscreen' },
    ]);
  });

  /** A free install is offered only the two formats it can publish (ADR 0116). */
  it.each([
    ['an explicit free install', { exportUrl: '', installedTier: 'free' as const }],
    ['absent boot data', undefined],
  ])('offers only popup and inline for %s', (_case, settings) => {
    window.wconvertAdmin = settings;
    expect(displayTypeOptions()).toEqual([
      { value: 'popup', label: 'Popup' },
      { value: 'inline', label: 'Inline form' },
    ]);
  });

  /** A draft saved with a Pro format keeps its value selectable after Pro is removed. */
  it('keeps the current format on a free install', () => {
    expect(displayTypeOptions('floating_bar').map(({ value }) => value)).toEqual(['popup', 'inline', 'floating_bar']);
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
