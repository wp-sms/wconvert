import { beforeEach, expect, it, vi } from 'vitest';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('@wordpress/api-fetch', () => ({ default: apiFetch }));

import {
  readDataMap,
  readPrivacyGuidance,
  savePrivacyGuidance,
} from '../../resources/admin/src/privacy/api';

beforeEach(() => apiFetch.mockReset());

it('reads the current site data map without sending configuration back', () => {
  readDataMap();

  expect(apiFetch).toHaveBeenCalledExactlyOnceWith({
    path: '/wconvert/v1/privacy/data-map',
  });
});

it('reads and saves the Campaign privacy guidance preference', () => {
  readPrivacyGuidance();
  savePrivacyGuidance(false);

  expect(apiFetch).toHaveBeenNthCalledWith(1, {
    path: '/wconvert/v1/privacy/guidance',
  });
  expect(apiFetch).toHaveBeenNthCalledWith(2, {
    path: '/wconvert/v1/privacy/guidance',
    method: 'POST',
    data: { enabled: false },
  });
});
