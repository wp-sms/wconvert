import { afterEach, describe, expect, it, vi } from 'vitest';
import apiFetch from '@wordpress/api-fetch';
import { canExport, eraseIdentifier, exportLeads, readLog } from '../../resources/admin/src/leads/api';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn().mockResolvedValue({}) }));

afterEach(() => { delete window.wconvertAdmin; vi.restoreAllMocks(); });

const submittedForm = () => vi.mocked(HTMLFormElement.prototype.submit).mock.instances.at(-1) as unknown as HTMLFormElement;

describe('history request and export scope', () => {
  it('keeps personal search values in the private request body', async () => {
    window.wconvertAdmin = { exportUrl: 'https://example.test/export?_wpnonce=nonce' };
    const filter = { search: 'quote & repair', purpose: 'enquiries' as const };
    await readLog(filter);
    expect(apiFetch).toHaveBeenCalledWith(expect.objectContaining({
      path: '/wconvert/v1/leads/query', method: 'POST',
      data: expect.objectContaining({ search: 'quote & repair', purpose: 'enquiries' }),
    }));
    expect(vi.mocked(apiFetch).mock.calls[0][0].path).not.toContain('quote');
  });
  it('sends exact phone, date, snapshot and paging in one body', async () => {
    await readLog({ optinId: 'OPTIN', identifier: '+447911123456', leadId: 'LEAD', from: '2026-08-01',
      to: '2026-08-31', cursor: 'opaque+cursor=', snapshot: 'SNAPSHOT', grouped: true, order: 'oldest', includeCounts: true });
    expect(vi.mocked(apiFetch).mock.calls[0][0].data).toMatchObject({
      identifier: '+447911123456', optin_id: 'OPTIN', lead_id: 'LEAD', from: '2026-08-01',
      to: '2026-08-31', cursor: 'opaque+cursor=', snapshot: 'SNAPSHOT', grouped: '1', order: 'oldest', include_counts: '1',
    });
  });

  it('posts export filters without putting them in the download URL', () => {
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined);
    window.wconvertAdmin = { exportUrl: 'https://example.test/admin-post.php?action=export&_wpnonce=nonce' };
    expect(exportLeads({ optinId: 'OPTIN', groupIdentifier: '+447911123456', from: '2026-08-01',
      to: '2026-08-31', grouped: true, cursor: 'page-two', snapshot: 'SNAPSHOT' })).toBe(true);
    const form = submittedForm();
    const url = new URL(form.action);
    const fields = new FormData(form);
    expect(url.searchParams.get('_wpnonce')).toBe('nonce');
    expect(url.searchParams.has('group_identifier')).toBe(false);
    expect(fields.get('optin_id')).toBe('OPTIN');
    expect(fields.get('group_identifier')).toBe('+447911123456');
    expect(fields.get('from')).toBe('2026-08-01');
    expect(fields.get('to')).toBe('2026-08-31');
    expect(fields.get('snapshot')).toBe('SNAPSHOT');
    expect(fields.has('cursor')).toBe(false);
    expect(fields.has('grouped')).toBe(false);
  });

  it('does not invent an export endpoint or authentication when settings are unavailable', () => {
    expect(canExport()).toBe(false);
    expect(exportLeads({ identifier: 'sarah@example.com' })).toBe(false);
  });

  it('sends an exact identifier twice as an explicit destructive confirmation', async () => {
    await eraseIdentifier('+96899123456');
    expect(apiFetch).toHaveBeenCalledWith({
      path: '/wconvert/v1/leads/identifier',
      method: 'DELETE',
      data: { identifier: '+96899123456', confirmed_identifier: '+96899123456' },
    });
  });
});
