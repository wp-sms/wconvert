import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Template } from '../../resources/renderer/src/types';
import * as transfer from '../../resources/admin/src/templates/transfer';
import TemplateTransferDialog from '../../resources/admin/src/builder/TemplateTransferDialog';

vi.mock('../../resources/admin/src/templates/transfer', async importOriginal => ({
  ...await importOriginal<typeof transfer>(),
  transferStatus: vi.fn(), uploadDesign: vi.fn(), prepareImport: vi.fn(), applyImport: vi.fn(), cancelImport: vi.fn(), downloadDesign: vi.fn(), importImage: vi.fn(),
}));
const fixture = JSON.parse(readFileSync(resolve(import.meta.dirname, '../fixtures/templates/editor-card.json'), 'utf8')) as Template;
const config = { template: fixture, display_type: 'popup' };
const preview = { digest: 'reviewed', patch: { template: fixture, display_type: 'popup' }, notes: [], links: [{ url: 'https://old.example/offer', uses: 2 }], assets: [] };
const file = () => new File(['zip'], 'offer.wconvert.zip', { type: 'application/zip' });
beforeEach(() => {
  vi.resetAllMocks();
  URL.revokeObjectURL = vi.fn();
  vi.mocked(transfer.transferStatus).mockResolvedValue({ zip: true, max_bytes: 25000000, upload_images: true });
  vi.mocked(transfer.uploadDesign).mockResolvedValue({ id: 'session', name: 'Offer', images: 0, notes: [] });
  vi.mocked(transfer.prepareImport).mockResolvedValue(preview);
  vi.mocked(transfer.applyImport).mockResolvedValue({ patch: preview.patch });
  vi.mocked(transfer.cancelImport).mockResolvedValue({});
});
afterEach(cleanup);

it('previews file content before one explicit reviewed Apply and leaves persistence to the editor', async () => {
  const onApply = vi.fn(); const user = userEvent.setup();
  render(<TemplateTransferDialog action="import" design={{ ...fixture, name: 'Current', display_type: 'popup' }} config={config} optin="campaign" onClose={vi.fn()} onApply={onApply} />);
  await user.upload(await screen.findByLabelText('Choose a WConvert design file'), file());
  await screen.findByText('Review links');
  expect(transfer.prepareImport).toHaveBeenCalledWith('session', 'campaign', config, 'file', {});
  expect(onApply).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Apply to draft' })).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: 'Keep these links and apply the reviewed changes' }));
  await user.click(screen.getByRole('button', { name: 'Apply to draft' }));
  await waitFor(() => expect(onApply).toHaveBeenCalledExactlyOnceWith(preview.patch));
  expect(transfer.applyImport).toHaveBeenCalledWith('session', 'reviewed');
});

it('requires another preview after changing a link and does not apply on cancellation', async () => {
  const onApply = vi.fn(); const onClose = vi.fn(); const user = userEvent.setup();
  render(<TemplateTransferDialog action="import" design={{ ...fixture, name: 'Current', display_type: 'popup' }} config={config} optin="campaign" onClose={onClose} onApply={onApply} />);
  await user.upload(await screen.findByLabelText('Choose a WConvert design file'), file());
  const link = await screen.findByRole('textbox', { name: 'Link: https://old.example/offer' });
  await user.clear(link); await user.type(link, 'https://new.example/offer');
  expect(screen.getByRole('button', { name: 'Apply to draft' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Update preview' }));
  await waitFor(() => expect(transfer.prepareImport).toHaveBeenLastCalledWith('session', 'campaign', config, 'file', { 'https://old.example/offer': 'https://new.example/offer' }));
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled(); expect(onApply).not.toHaveBeenCalled();
});

it('keeps the current draft untouched when a file is refused', async () => {
  vi.mocked(transfer.uploadDesign).mockRejectedValue({ message: 'This journey needs Pro.' });
  const onApply = vi.fn(); const user = userEvent.setup();
  render(<TemplateTransferDialog action="import" design={{ ...fixture, name: 'Current', display_type: 'popup' }} config={config} optin="campaign" onClose={vi.fn()} onApply={onApply} />);
  await user.upload(await screen.findByLabelText('Choose a WConvert design file'), file());
  expect(await screen.findByRole('alert')).toHaveTextContent('This journey needs Pro.');
  expect(transfer.prepareImport).not.toHaveBeenCalled(); expect(onApply).not.toHaveBeenCalled();
});

it('keeps successive link edits anchored to the file and resets them when switching content', async () => {
  vi.mocked(transfer.prepareImport).mockImplementation(async (_id, _optin, _config, _mode, links) => ({ ...preview, links: [{ url: links['https://old.example/offer'] ?? 'https://old.example/offer', uses: 2 }] }));
  const user = userEvent.setup();
  render(<TemplateTransferDialog action="import" design={{ ...fixture, name: 'Current', display_type: 'popup' }} config={config} optin="campaign" onClose={vi.fn()} onApply={vi.fn()} />);
  await user.upload(await screen.findByLabelText('Choose a WConvert design file'), file());
  for (const [from, to] of [['old', 'new'], ['new', 'final']]) {
    const link = await screen.findByRole('textbox', { name: `Link: https://${from}.example/offer` });
    await user.clear(link); await user.type(link, `https://${to}.example/offer`);
    await user.click(screen.getByRole('button', { name: 'Update preview' }));
    await screen.findByRole('textbox', { name: `Link: https://${to}.example/offer` });
  }
  expect(transfer.prepareImport).toHaveBeenLastCalledWith('session', 'campaign', config, 'file', { 'https://old.example/offer': 'https://final.example/offer' });
  await user.click(screen.getByRole('radio', { name: 'Keep my current content' }));
  await waitFor(() => expect(transfer.prepareImport).toHaveBeenLastCalledWith('session', 'campaign', config, 'keep', {}));
});
