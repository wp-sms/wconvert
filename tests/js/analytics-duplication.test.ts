import { expect, it, vi } from 'vitest';
import apiFetch from '@wordpress/api-fetch';
import { duplicateCampaign } from '../../resources/admin/src/optins/api';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
it('duplicates a draft with its analytics exclusion but a fresh public label', async () => {
  const config = { analytics: { off: true, label: 'Original promotion' }, display_type: 'popup' };
  vi.mocked(apiFetch).mockResolvedValueOnce({ goal: 'grow_email_list', config }).mockResolvedValueOnce({ id: 'copy' });
  await duplicateCampaign('original', 'New promotion');
  expect(apiFetch).toHaveBeenLastCalledWith({ path: '/wconvert/v1/optins', method: 'POST', data: { name: 'New promotion', goal: 'grow_email_list', config: { ...config, analytics: { off: true, label: '' } } } });
  expect(config.analytics.label).toBe('Original promotion');
});
