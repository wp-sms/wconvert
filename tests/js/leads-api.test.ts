import { afterEach, describe, expect, it, vi } from 'vitest';
import apiFetch from '@wordpress/api-fetch';
import { exportUrl, readLog } from '../../resources/admin/src/leads/api';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn().mockResolvedValue({}) }));

afterEach(() => { delete window.wconvertAdmin; vi.clearAllMocks(); });

describe('history request and export scope', () => {
  it('keeps text search and purpose in both bookmarked reads and exports', async () => {
    window.wconvertAdmin = { exportUrl: 'https://example.test/export?_wpnonce=nonce' };
    const filter = { search: 'quote & repair', purpose: 'enquiries' as const };
    await readLog(filter);
    const read = new URL(vi.mocked(apiFetch).mock.calls[0][0].path!, 'https://example.test');
    const csv = new URL(exportUrl(filter)!);
    for (const url of [read, csv]) {
      expect(url.searchParams.get('search')).toBe('quote & repair');
      expect(url.searchParams.get('purpose')).toBe('enquiries');
    }
  });
  it('encodes exact phone, date, snapshot and paging on the same read endpoint', async () => {
    await readLog({ optinId: 'OPTIN', identifier: '+447911123456', leadId: 'LEAD', from: '2026-08-01',
      to: '2026-08-31', cursor: 'opaque+cursor=', snapshot: 'SNAPSHOT', grouped: true, order: 'oldest', includeCounts: true });
    const path = vi.mocked(apiFetch).mock.calls[0][0].path!;
    const params = new URL(path, 'https://example.test').searchParams;
    expect(params.get('identifier')).toBe('+447911123456');
    expect(params.get('optin_id')).toBe('OPTIN');
    expect(params.get('lead_id')).toBe('LEAD');
    expect(params.get('from')).toBe('2026-08-01');
    expect(params.get('to')).toBe('2026-08-31');
    expect(params.get('cursor')).toBe('opaque+cursor=');
    expect(params.get('snapshot')).toBe('SNAPSHOT');
    expect(params.get('grouped')).toBe('1');
    expect(params.get('order')).toBe('oldest');
    expect(params.get('include_counts')).toBe('1');
  });

  it('exports all matching pages while retaining group scope and the confirmed snapshot', () => {
    window.wconvertAdmin = { exportUrl: 'https://example.test/admin-post.php?action=export&_wpnonce=nonce' };
    const url = new URL(exportUrl({ optinId: 'OPTIN', groupIdentifier: '+447911123456', from: '2026-08-01',
      to: '2026-08-31', grouped: true, cursor: 'page-two', snapshot: 'SNAPSHOT' })!);
    expect(url.searchParams.get('_wpnonce')).toBe('nonce');
    expect(url.searchParams.get('optin_id')).toBe('OPTIN');
    expect(url.searchParams.get('group_identifier')).toBe('+447911123456');
    expect(url.searchParams.get('from')).toBe('2026-08-01');
    expect(url.searchParams.get('to')).toBe('2026-08-31');
    expect(url.searchParams.get('snapshot')).toBe('SNAPSHOT');
    expect(url.searchParams.has('cursor')).toBe(false);
    expect(url.searchParams.has('grouped')).toBe(false);
  });

  it('does not invent an export endpoint or authentication when settings are unavailable', () => {
    expect(exportUrl({ identifier: 'sarah@example.com' })).toBeNull();
  });
});
