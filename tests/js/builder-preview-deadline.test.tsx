import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignPreviewDeadline, usePreviewDeadline } from '../../resources/admin/src/builder/PreviewDeadline';
const request = vi.hoisted(() => vi.fn());
vi.mock('@wordpress/api-fetch', () => ({ default: request }));
function Clock() { const value = usePreviewDeadline(); return <output>{JSON.stringify(value)}</output>; }
const shown = () => JSON.parse(screen.getByRole('status').textContent!);
beforeEach(() => request.mockReset());
describe('one campaign deadline for every editor preview', () => {
  it('uses samples only without an end date, then resolves unsaved edits with WordPress', async () => {
    request.mockResolvedValue({ ends_at: 1793487600000 });
    const view = render(<CampaignPreviewDeadline><Clock /></CampaignPreviewDeadline>);
    expect(shown().mode).toBe('sample');
    expect(shown().deadline).toBeGreaterThan(Date.now());
    expect(request).not.toHaveBeenCalled();
    view.rerender(<CampaignPreviewDeadline endsAt="2026-10-31 23:00"><Clock /></CampaignPreviewDeadline>);
    expect(shown().mode).toBe('loading');
    expect(shown().deadline).toBeUndefined();
    await waitFor(() => expect(shown()).toEqual({ mode: 'live', deadline: 1793487600000 }));
    expect(request.mock.calls[0][0].path).toContain(encodeURIComponent('2026-10-31 23:00'));
    view.rerender(<CampaignPreviewDeadline endsAt=""><Clock /></CampaignPreviewDeadline>);
    expect(shown().mode).toBe('sample');
  });
  it('never substitutes samples for expired dates or failed resolution', async () => {
    request.mockResolvedValueOnce({ ends_at: 1 }).mockRejectedValueOnce(new Error('offline'));
    const view = render(<CampaignPreviewDeadline endsAt="2000-01-01 00:00"><Clock /></CampaignPreviewDeadline>);
    await waitFor(() => expect(shown()).toEqual({ mode: 'live', deadline: 1 }));
    view.rerender(<CampaignPreviewDeadline endsAt="2026-10-31 23:00"><Clock /></CampaignPreviewDeadline>);
    await waitFor(() => expect(shown().mode).toBe('error'));
    expect(shown().deadline).toBeUndefined();
  });
  it('ignores a late response for an older date', async () => {
    let finish!: (value: { ends_at: number }) => void;
    request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ ends_at: 20 });
    const view = render(<CampaignPreviewDeadline endsAt="2026-10-30 00:00"><Clock /></CampaignPreviewDeadline>);
    view.rerender(<CampaignPreviewDeadline endsAt="2026-10-31 00:00"><Clock /></CampaignPreviewDeadline>);
    await waitFor(() => expect(shown().deadline).toBe(20));
    await act(async () => finish({ ends_at: 10 }));
    expect(shown().deadline).toBe(20);
  });
});
