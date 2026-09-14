import { beforeEach, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogStatus, PackPreview } from '../../resources/admin/src/templates/catalog';

const api = vi.hoisted(() => ({ catalogStatus: vi.fn(), refreshCatalog: vi.fn(), previewPack: vi.fn(), installPack: vi.fn() }));
vi.mock('../../resources/admin/src/templates/catalog', () => api);
vi.mock('../../resources/admin/src/builder/Preview', () => ({ Preview: ({ step }: { step: number }) => <div data-testid="preview" data-step={step}>Rendered design</div> }));
const { TemplatePacks } = await import('../../resources/admin/src/templates/TemplatePacks');
const initial: CatalogStatus = { configured: true, source: 'https://catalog.example/index.json', checked_at: null, packs: [] };
const listed: CatalogStatus = { ...initial, checked_at: '2026-09-11T14:00:00Z', packs: [{ id: 'reading', name: 'Reading pack', description: 'A reading design.', version: '1.0.0', installed_version: null, state: 'available' }] };
const preview: PackPreview = { id: 'reading', name: 'Reading pack', version: '1.0.0', digest: 'reviewed-digest', templates: [{ id: 'pack-hash-reading-slip', name: 'Reading slip', display_type: 'inline', tree: { steps: [{ type: 'stack', children: [] }] }, tokens: {} }] };
const installed: CatalogStatus = { ...listed, packs: [{ ...listed.packs[0], installed_version: '1.0.0', state: 'installed' }] };
beforeEach(() => { vi.resetAllMocks(); api.catalogStatus.mockResolvedValue(initial); api.refreshCatalog.mockResolvedValue(listed); api.previewPack.mockResolvedValue(preview); api.installPack.mockResolvedValue(installed); });

it('only contacts the service after an explicit check, then previews, installs and returns to the editor picker', async () => {
  const user = userEvent.setup(); const onInstalled = vi.fn().mockResolvedValue(undefined); const onInspect = vi.fn();
  render(<TemplatePacks displayType="inline" onInstalled={onInstalled} onInspect={onInspect} />);
  await screen.findByRole('button', { name: 'Check for packs' });
  expect(api.refreshCatalog).not.toHaveBeenCalled(); expect(api.previewPack).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Check for packs' }));
  await user.click(await screen.findByRole('button', { name: 'Preview Reading pack' }));
  expect(api.previewPack).toHaveBeenCalledWith('reading', false);
  await screen.findByText('Rendered design'); expect(api.installPack).not.toHaveBeenCalled();
  expect(screen.getByTestId('preview').closest('[inert]')).toHaveAttribute('aria-hidden', 'true');
  await user.click(screen.getByRole('button', { name: 'Install pack' }));
  await screen.findByText('Installed'); expect(api.installPack).toHaveBeenCalledWith('reading', 'reviewed-digest');
  expect(onInspect).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Continue with this design' }));
  await waitFor(() => expect(onInspect).toHaveBeenCalledWith('pack-hash-reading-slip'));
});

it('preserves the installed pack when refresh fails and uses its local preview', async () => {
  api.catalogStatus.mockResolvedValue(installed); api.refreshCatalog.mockRejectedValue(new Error('Offline'));
  const user = userEvent.setup(); render(<TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Check for packs' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Explore designs in Reading pack' }));
  expect(api.previewPack).toHaveBeenCalledWith('reading', true);
  await screen.findByText('Installed');
});

it('can preview the old installed version while an update is available without trying to install it again', async () => {
  api.catalogStatus.mockResolvedValue({ ...installed, packs: [{ ...installed.packs[0], version: '1.1.0', state: 'update' }] });
  const user = userEvent.setup(); render(<TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Explore designs in Reading pack' }));
  await screen.findByText('Installed'); expect(screen.queryByRole('button', { name: 'Install update' })).not.toBeInTheDocument();
});

it('does not offer a popup design for an inline draft', async () => {
  api.catalogStatus.mockResolvedValue(installed); api.previewPack.mockResolvedValue({ ...preview, templates: [{ ...preview.templates[0], display_type: 'popup' }] });
  const user = userEvent.setup(); render(<TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Explore designs in Reading pack' }));
  await screen.findByText('Open a draft in Popup format to use this design. Your current draft is Inline.');
  expect(screen.queryByRole('button', { name: 'Continue with this design' })).not.toBeInTheDocument();
});

it('keeps successful installation visible if reloading the design index fails', async () => {
  api.catalogStatus.mockResolvedValue(listed);
  const user = userEvent.setup(); render(<TemplatePacks displayType="inline" onInstalled={vi.fn().mockRejectedValue(new Error('Index unavailable'))} onInspect={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Preview Reading pack' }));
  await user.click(await screen.findByRole('button', { name: 'Install pack' }));
  await screen.findByText('Index unavailable'); await screen.findByText('Installed');
  expect(screen.queryByRole('button', { name: 'Install pack' })).not.toBeInTheDocument();
});


it('disables retry during the initial request and ignores an obsolete StrictMode response', async () => {
  let first!: (value: CatalogStatus) => void;
  let second!: (value: CatalogStatus) => void;
  api.catalogStatus.mockReturnValueOnce(new Promise<CatalogStatus>((resolve) => { first = resolve; }))
    .mockReturnValueOnce(new Promise<CatalogStatus>((resolve) => { second = resolve; }));
  render(<StrictMode><TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={vi.fn()} /></StrictMode>);
  expect(screen.getByRole('status')).toHaveTextContent('Loading your packs…');
  expect(screen.queryByRole('button', { name: 'Retry loading packs' })).not.toBeInTheDocument();
  await act(async () => { second(installed); });
  await screen.findByRole('button', { name: 'Explore designs in Reading pack' });
  await act(async () => { first(initial); });
  expect(screen.getByRole('button', { name: 'Explore designs in Reading pack' })).toBeInTheDocument();
});


it('separates local packs from available packs and offers updates independently', async () => {
  api.catalogStatus.mockResolvedValue({ ...listed, packs: [
    { ...installed.packs[0], state: 'update', version: '1.1.0' },
    { ...listed.packs[0], id: 'new', name: 'New collection' },
  ] });
  const user = userEvent.setup();
  render(<TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={vi.fn()} />);
  const local = await screen.findByRole('region', { name: 'Installed' });
  expect(within(local).getByRole('button', { name: 'Explore designs in Reading pack' })).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Available to install' })).getByText('New collection')).toBeInTheDocument();
  await user.click(within(local).getByRole('button', { name: 'Preview update for Reading pack' }));
  expect(api.previewPack).toHaveBeenCalledWith('reading', false);
});

it('starts with a matching design, explains other formats and resets the screen when switching', async () => {
  api.catalogStatus.mockResolvedValue(installed);
  api.previewPack.mockResolvedValue({ ...preview, templates: [
    { ...preview.templates[0], id: 'popup', name: 'Popup design', display_type: 'popup' },
    { ...preview.templates[0], name: 'Inline design', tree: { steps: [{ type: 'stack', children: [] }, { type: 'stack', children: [] }] } },
  ] });
  const user = userEvent.setup();
  render(<TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Explore designs in Reading pack' }));
  expect(await screen.findByRole('button', { name: /Inline design/ })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: 'Success' }));
  expect(screen.getByTestId('preview')).toHaveAttribute('data-step', '1');
  await user.click(screen.getByRole('button', { name: /Popup design/ }));
  expect(screen.getByTestId('preview')).toHaveAttribute('data-step', '0');
  expect(screen.queryByRole('group', { name: 'Preview screen' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Continue with this design' })).not.toBeInTheDocument();
  expect(screen.getByText(/Open a draft in Popup format/)).toBeInTheDocument();
});

it('keeps the selected design after installation and clearly continues to content review', async () => {
  api.catalogStatus.mockResolvedValue(listed);
  api.previewPack.mockResolvedValue({ ...preview, templates: [preview.templates[0], { ...preview.templates[0], id: 'second', name: 'Second design' }] });
  const onInspect = vi.fn();
  const user = userEvent.setup();
  render(<TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={onInspect} />);
  await user.click(await screen.findByRole('button', { name: 'Preview Reading pack' }));
  await user.click(await screen.findByRole('button', { name: /Second design/ }));
  await user.click(screen.getByRole('button', { name: 'Install pack' }));
  expect(await screen.findByRole('button', { name: /Second design/ })).toHaveAttribute('aria-pressed', 'true');
  await user.click(await screen.findByRole('button', { name: 'Continue with this design' }));
  await waitFor(() => expect(onInspect).toHaveBeenCalledWith('second'));
});

it('returns focus and the original scroll position even if the list moves while the preview loads', async () => {
  api.catalogStatus.mockResolvedValue(installed);
  let resolvePreview!: (value: PackPreview) => void;
  api.previewPack.mockReturnValue(new Promise<PackPreview>((resolve) => { resolvePreview = resolve; }));
  const user = userEvent.setup();
  render(<TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={vi.fn()} />);
  await screen.findByRole('button', { name: 'Explore designs in Reading pack' });
  const list = screen.getByRole('region', { name: 'Template packs' });
  list.scrollTop = 120;
  await user.click(await screen.findByRole('button', { name: 'Explore designs in Reading pack' }));
  list.scrollTop = 240;
  await act(async () => { resolvePreview(preview); });
  await user.click(await screen.findByRole('button', { name: 'All packs' }));
  expect(screen.getByRole('button', { name: 'Explore designs in Reading pack' })).toHaveFocus();
  expect(screen.getByRole('region', { name: 'Template packs' }).scrollTop).toBe(120);
  expect(api.catalogStatus).toHaveBeenCalledTimes(1);
  expect(api.previewPack).toHaveBeenCalledTimes(1);
});


it('lets the compact design selector choose another format without applying it', async () => {
  api.catalogStatus.mockResolvedValue(installed);
  api.previewPack.mockResolvedValue({ ...preview, templates: [preview.templates[0], { ...preview.templates[0], id: 'popup', name: 'Popup design', display_type: 'popup' }] });
  const onInspect = vi.fn();
  const user = userEvent.setup();
  render(<TemplatePacks displayType="inline" onInstalled={vi.fn()} onInspect={onInspect} />);
  await user.click(await screen.findByRole('button', { name: 'Explore designs in Reading pack' }));
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Design in this pack' }), '1');
  expect(screen.getByRole('heading', { name: 'Popup design' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Continue with this design' })).not.toBeInTheDocument();
  expect(onInspect).not.toHaveBeenCalled();
});


it('explains when installed campaign starts serve a different goal without offering a misleading next action', async () => {
  api.catalogStatus.mockResolvedValue(installed);
  api.previewPack.mockResolvedValue({ ...preview, starting_points: [{ id: 'start', name: 'Campaign', goal: 'different', goal_label: 'Another goal', template_id: preview.templates[0].id }] });
  const choose = vi.fn();
  render(<TemplatePacks displayType="" goal="selected" onInstalled={vi.fn()} onChooseStartingPoints={choose} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Explore designs in Reading pack' }));
  await screen.findByText('This pack has no starting points for your selected goal. Its designs remain available in the editor.');
  expect(screen.queryByRole('button', { name: 'Choose a starting point' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Continue with this design' })).not.toBeInTheDocument();
  expect(choose).not.toHaveBeenCalled();
});

it('explains a goal mismatch before installation while allowing the designs to be installed', async () => {
  api.catalogStatus.mockResolvedValue(listed);
  api.previewPack.mockResolvedValue({ ...preview, starting_points: [{ id: 'start', name: 'Campaign', goal: 'different', goal_label: 'Another goal', template_id: preview.templates[0].id }] });
  render(<TemplatePacks displayType="" goal="selected" onInstalled={vi.fn()} onChooseStartingPoints={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Preview Reading pack' }));
  await screen.findByText('This pack has no starting points for your selected goal. Install it to use its designs in the editor.');
  expect(screen.getByRole('button', { name: 'Install pack' })).toBeEnabled();
  expect(api.installPack).not.toHaveBeenCalled();
});
