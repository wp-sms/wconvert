import { describe, expect, it, vi } from 'vitest';
const fetch = vi.hoisted(() => vi.fn());
vi.mock('@wordpress/api-fetch', () => ({ default: fetch }));
const { testSend } = await import('../../resources/admin/src/destinations/api');

describe('the explicit destination test request', () => {
  it('posts the reviewed email sample to the named destination', async () => {
    const report = { outcome: 'success', message: 'Accepted.' };
    fetch.mockResolvedValue(report);
    expect(await testSend('route-id', 'seed@example.com')).toEqual(report);
    expect(fetch).toHaveBeenCalledExactlyOnceWith({
      path: '/wconvert/v1/destinations/route-id/test-send', method: 'POST', data: { email: 'seed@example.com' },
    });
  });
  it('includes an interest value only when explicitly supplied', async () => {
    fetch.mockClear();
    await testSend('route-id', 'seed@example.com', 'installation');
    expect(fetch).toHaveBeenCalledExactlyOnceWith({
      path: '/wconvert/v1/destinations/route-id/test-send', method: 'POST', data: { email: 'seed@example.com', interest: 'installation' },
    });
  });
});
