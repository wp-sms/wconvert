import { beforeEach, expect, it, vi } from 'vitest';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('@wordpress/api-fetch', () => ({ default: apiFetch }));

import { readDataMap } from '../../resources/admin/src/privacy/api';

beforeEach(() => apiFetch.mockReset());

it('reads the current site data map without sending configuration back', () => {
  readDataMap();

  expect(apiFetch).toHaveBeenCalledExactlyOnceWith({
    path: '/wconvert/v1/privacy/data-map',
  });
});
