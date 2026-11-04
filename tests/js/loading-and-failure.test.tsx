import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import apiFetch from '@wordpress/api-fetch';
import { CommercePicker, CommerceRange } from '../../resources/admin/src/builder/CommerceControls';
import { PayloadMeter } from '../../resources/admin/src/builder/PayloadMeter';
import { DestinationUsageNotice } from '../../resources/admin/src/destinations/DestinationUsageNotice';
import { RetentionSummary } from '../../resources/admin/src/leads/RetentionSummary';
import { DeliveryAttention } from '../../resources/admin/src/stats/DeliveryAttention';
import { readDestinations, destinationsAfter } from '../../resources/admin/src/destinations/api';
import { readRetention } from '../../resources/admin/src/leads/api';
import type { Template } from '@renderer/types';

/** GUIDELINES §§12–13 on the small surfaces with no suite of their own: a wait has a shape, a failure is drawn and has a door. */
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
vi.mock('../../resources/admin/src/destinations/api', async (original) => ({
  ...(await original<typeof import('../../resources/admin/src/destinations/api')>()),
  readDestinations: vi.fn(),
  destinationsAfter: vi.fn(),
}));
vi.mock('../../resources/admin/src/leads/api', async (original) => ({
  ...(await original<typeof import('../../resources/admin/src/leads/api')>()),
  readRetention: vi.fn(),
}));
const api = vi.mocked(apiFetch);

beforeEach(() => { api.mockReset(); window.wconvertAdmin = { exportUrl: '', designBudget: 1000 } as never; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete window.wconvertAdmin; });

describe('the commerce controls', () => {
  it('a store currency that cannot be read is drawn, not left loading forever', async () => {
    api.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ items: [], currency: 'EUR', decimals: 2 });
    render(<CommerceRange money value={{}} onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading store currency…');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the store currency.');
    expect(screen.queryByRole('status')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/EUR/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a chosen product whose name cannot be read says so and offers Try again', async () => {
    api.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ items: [{ id: 7, name: 'Beans' }], currency: 'EUR', decimals: 2 });
    render(<CommercePicker compact value={[7]} onChange={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Product names could not load. Your selection is kept.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Beans')).toBeInTheDocument();
  });

  it('a failed search has a button rather than a sentence telling you to try again', async () => {
    api.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ items: [{ id: 7, name: 'Beans' }], currency: 'EUR', decimals: 2 });
    render(<CommercePicker compact value={[]} onChange={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bea' } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not search the store.');
    expect(alert).not.toHaveTextContent('Could not search the store. Try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Beans')).toBeInTheDocument();
  });
});

describe('the retention line', () => {
  it('keeps the policy when a re-read fails', async () => {
    vi.mocked(readRetention).mockResolvedValueOnce({ days: 90 } as never).mockRejectedValueOnce({ message: 'Away' }).mockResolvedValue({ days: 30 } as never);
    const view = render(<RetentionSummary refreshKey={0} />);
    expect(await screen.findByText(/deleted automatically after 90 days/)).toBeInTheDocument();

    view.rerender(<RetentionSummary refreshKey={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not refresh retention');
    expect(screen.getByText(/deleted automatically after 90 days/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/deleted automatically after 30 days/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('has nothing to keep on a first failure, and says so with its door', async () => {
    vi.mocked(readRetention).mockRejectedValueOnce({ message: 'Away' }).mockResolvedValue({ days: null } as never);
    render(<RetentionSummary />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded: Away');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/kept until you delete them/)).toBeInTheDocument();
  });
});

describe('a destination’s usage', () => {
  it('that could not be read offers Try again here, rather than naming a door the dialog does not have', async () => {
    const usage = [{ id: 'c', name: 'Sale bar', live: true, draft: false }];
    vi.mocked(readDestinations).mockResolvedValue({ destinations: [{ id: 'd', usage }] } as never);
    render(<DestinationUsageNotice id="d" usage={null} />);
    expect(screen.queryByText(/Refresh/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Sale bar')).toBeInTheDocument();
  });
});

describe('the sending check on Analytics', () => {
  it('holds a shape back for a slow read, and draws nothing for a quick all-clear', async () => {
    vi.useFakeTimers();
    try {
      let finish!: (value: never) => void;
      vi.mocked(destinationsAfter).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      const { container } = render(<DeliveryAttention />);
      expect(container).toBeEmptyDOMElement();
      await act(async () => { await vi.advanceTimersByTimeAsync(200); });
      expect(screen.getByRole('status')).toHaveTextContent('Loading sending status…');
      await act(async () => { finish({ destinations: [], failures: [] } as never); });
      expect(container).toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the size meter', () => {
  const template = { tree: {}, tokens: {} } as Template;

  it('reserves its place while measuring, then gives the share', async () => {
    // jsdom's Blob has no stream().
    vi.stubGlobal('Blob', NodeBlob);
    try {
      render(<PayloadMeter template={template} />);
      expect(screen.getByRole('status')).toHaveTextContent('Measuring the design’s size…');
      await waitFor(() => expect(screen.getByText(/of the size budget/)).toBeInTheDocument());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('says so when measuring throws, and stays empty on a browser that cannot measure', async () => {
    vi.stubGlobal('Blob', class { stream() { throw new Error('broken'); } });
    const view = render(<PayloadMeter template={template} />);
    expect(await screen.findByText('Size not measured')).toBeInTheDocument();
    view.unmount();
    vi.unstubAllGlobals();

    vi.stubGlobal('CompressionStream', undefined);
    try {
      const none = render(<PayloadMeter template={template} />);
      await waitFor(() => expect(none.container).toBeEmptyDOMElement());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
