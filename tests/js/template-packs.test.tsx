import { beforeEach, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogStatus, PackPreview } from '../../resources/admin/src/templates/catalog';

const api = vi.hoisted(() => ({ catalogStatus: vi.fn(), refreshCatalog: vi.fn(), previewPack: vi.fn(), installPack: vi.fn() }));
vi.mock('../../resources/admin/src/templates/catalog', () => api);
vi.mock('../../resources/admin/src/builder/Preview', () => ({ Preview: () => <div>Rendered design</div> }));
const { TemplatePacks } = await import('../../resources/admin/src/templates/TemplatePacks');
const initial: CatalogStatus = { configured: true, source: 'https://catalog.example/index.json', checked_at: null, packs: [] };
const listed: CatalogStatus = { ...initial, checked_at: '2026-09-11T14:00:00Z', packs: [{ id: 'reading', name: 'Reading pack', description: 'A reading design.', version: '1.0.0', installed_version: null, state: 'available' }] };
const preview: PackPreview = { id: 'reading', name: 'Reading pack', version: '1.0.0', digest: 'reviewed-digest', templates: [{ id: 'pack-hash-reading-slip', name: 'Reading slip', display_type: 'inline', tree: { steps: [{ type: 'stack', children: [] }] }, tokens: {} }] };
const installed: CatalogStatus = { ...listed, packs: [{ ...listed.packs[0], installed_version: '1.0.0', state: 'installed' }] };
beforeEach(() => { vi.resetAllMocks(); api.catalogStatus.mockResolvedValue(initial); api.refreshCatalog.mockResolvedValue(listed); api.previewPack.mockResolvedValue(preview); api.installPack.mockResolvedValue(installed); });

it('only contacts the service after an explicit check, then previews, installs and returns to the editor picker', async () => {
  const user = userEvent.setup(); const onInstalled = vi.fn().mockResolvedValue(undefined); const onInspect = vi.fn();
  render(<TemplatePacks displayType="inline" onInstalled={onInstalled} onInspect={onInspect} />);
  await screen.findByRole('button', { name: 'Check catalog' });
  expect(api.refreshCatalog).not.toHaveBeenCalled(); expect(api.previewPack).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Check catalog' }));
  await user.click(await screen.findByRole('button', { name: 'Preview pack' }));
  expect(api.previewPack).toHaveBeenCalledWith('reading', false);
  await screen.findByText('Rendered design'); expect(api.installPack).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Install pack' }));
  await screen.findByText('Installed on this site'); expect(api.installPack).toHaveBeenCalledWith('reading', 'reviewed-digest');
  expect(onInspect).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Preview and use this design' }));
  await waitFor(() => expect(onInspect).toHaveBeenCalledWith('pack-hash-reading-slip'));
});

it('preserves the installed pack when refresh fails and uses its local preview', async () => {
  api.catalogStatus.mockResolvedValue(installed); api.refreshCatalog.mockRejectedValue(new Error('Offline'));
  const user = userEvent.setup(); render(<TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Refresh catalog' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Preview installed pack' }));
  expect(api.previewPack).toHaveBeenCalledWith('reading', true);
  await screen.findByText('Installed on this site');
});

it('can preview the old installed version while an update is available without trying to install it again', async () => {
  api.catalogStatus.mockResolvedValue({ ...installed, packs: [{ ...installed.packs[0], version: '1.1.0', state: 'update' }] });
  const user = userEvent.setup(); render(<TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Preview installed version' }));
  await screen.findByText('Installed on this site'); expect(screen.queryByRole('button', { name: 'Install update' })).not.toBeInTheDocument();
});

it('does not offer a popup design for an inline draft', async () => {
  api.catalogStatus.mockResolvedValue(installed); api.previewPack.mockResolvedValue({ ...preview, templates: [{ ...preview.templates[0], display_type: 'popup' }] });
  const user = userEvent.setup(); render(<TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Preview installed pack' }));
  await screen.findByText('This design is for Popup. Open a draft in that format to use it.');
  expect(screen.queryByRole('button', { name: 'Preview and use this design' })).not.toBeInTheDocument();
});

it('keeps successful installation visible if reloading the design index fails', async () => {
  api.catalogStatus.mockResolvedValue(listed);
  const user = userEvent.setup(); render(<TemplatePacks displayType="inline" onInstalled={vi.fn().mockRejectedValue(new Error('Index unavailable'))} onInspect={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Preview pack' }));
  await user.click(await screen.findByRole('button', { name: 'Install pack' }));
  await screen.findByText('Index unavailable'); await screen.findByText('Installed on this site');
  expect(screen.queryByRole('button', { name: 'Install pack' })).not.toBeInTheDocument();
});


it('disables retry during the initial request and ignores an obsolete StrictMode response', async () => {
  let first!: (value: CatalogStatus) => void;
  let second!: (value: CatalogStatus) => void;
  api.catalogStatus.mockReturnValueOnce(new Promise<CatalogStatus>((resolve) => { first = resolve; }))
    .mockReturnValueOnce(new Promise<CatalogStatus>((resolve) => { second = resolve; }));
  render(<StrictMode><TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={vi.fn()} /></StrictMode>);
  expect(screen.getByRole('button', { name: 'Loading packs…' })).toBeDisabled();
  await act(async () => { second(installed); });
  await screen.findByRole('button', { name: 'Preview installed pack' });
  await act(async () => { first(initial); });
  expect(screen.getByRole('button', { name: 'Preview installed pack' })).toBeInTheDocument();
});
