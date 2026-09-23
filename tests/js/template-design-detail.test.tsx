import { treeFixture } from './support/journey';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mounted } from '../../resources/renderer/src/mount';
import type { Template } from '../../resources/renderer/src/types';
import type { TemplateIndexEntry, TemplateLabelsWithFacets } from '../../resources/admin/src/templates/api';
import type { Fit } from '../../resources/admin/src/builder/Gallery';

const mounts = vi.hoisted(() => [] as Mounted[]);
vi.mock('@renderer/mount', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../resources/renderer/src/mount')>();
  return { ...real, mount: (options: Parameters<typeof real.mount>[0]) => {
    const mounted = real.mount(options);
    mounts.push(mounted);
    return mounted;
  } };
});

const { TemplateDesignDetail } = await import('../../resources/admin/src/builder/TemplateDesignDetail');
const { Gallery } = await import('../../resources/admin/src/builder/Gallery');

// Stable editor fixture: its nested row is intentional; library curation can change independently.
const FIXTURE = JSON.parse(readFileSync(resolve(import.meta.dirname, '../fixtures/templates/editor-card.json'), 'utf8')) as Template;
const TEMPLATE: Template = { tree: FIXTURE.tree, tokens: FIXTURE.tokens };
const LABELS = {
  fields: { email: 'Email address', phone: 'Phone number', name: 'Name' },
  facetValues: {}, facets: {},
} as unknown as TemplateLabelsWithFacets;
const ENTRY: TemplateIndexEntry = {
  id: 'centred-card', name: 'Centred card', display_type: 'popup', tier: 'free', availability: 'ready',
  facets: { act: 'submit', captures: ['email'], shape: 'stack', has_image: false, asks_consent: false },
};
const FIT: Fit = { bound: false, sibling: null, act: 'submit' };
const drawn = () => mounts.at(-1)?.root as HTMLElement;

beforeEach(() => { mounts.length = 0; });

describe('inspecting a design before replacing the draft', () => {
  const detail = (props: Partial<ComponentProps<typeof TemplateDesignDetail>> = {}) => {
    const onChoose = vi.fn();
    const onBack = vi.fn();
    const view = render(<TemplateDesignDetail entry={ENTRY} template={TEMPLATE} labels={LABELS}
      current={false} fit={FIT} busy={false} onChoose={onChoose} onBack={onBack} {...props} />);
    return { ...view, onChoose, onBack };
  };

  it('requires an explicit choice before an incompatible design turns off Content lock', async () => {
    const { onChoose } = detail({ contentLock: true, currentDisplayType: 'inline' });
    const apply = screen.getByRole('button', { name: 'Switch to Popup' });
    expect(apply).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(apply); expect(onChoose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('checkbox', { name: /Turn off Content lock/ }));
    expect(apply).toHaveAttribute('aria-disabled', 'false');
    await userEvent.click(apply);
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ENTRY.id);
  });

  it('starts a blank draft with sample content instead of carrying an empty form', async () => {
    const onPrepare = vi.fn().mockResolvedValue(TEMPLATE);
    const { onChoose } = detail({ onPrepare, hasCurrentDesign: false });
    expect(await screen.findByRole('radio', { name: /Use this design's sample content/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Keep my content/ })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this design' })).toBeEnabled());
    expect(onPrepare).toHaveBeenCalledExactlyOnceWith(ENTRY.id, 'sample', TEMPLATE);
    await userEvent.click(screen.getByRole('button', { name: 'Use this design' }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ENTRY.id, TEMPLATE);
  });

  it('defaults to carried content and applies the exact normalized preview', async () => {
    const carried = JSON.parse(JSON.stringify(TEMPLATE).replace('Get 10% off your first order', 'My own invitation')) as Template;
    const onPrepare = vi.fn().mockResolvedValue(carried);
    const { onChoose } = detail({ onPrepare });
    expect(screen.getByRole('radio', { name: /Keep my content/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Use this design' })).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => expect(within(drawn()).getByText('My own invitation')).toBeInTheDocument());
    expect(onPrepare).toHaveBeenCalledExactlyOnceWith(ENTRY.id, 'keep', TEMPLATE);
    expect(onChoose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Use this design' }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ENTRY.id, carried);
  });

  it('explains a format change beside Apply, including inline placement', () => {
    const { onChoose } = detail({
      entry: { ...ENTRY, display_type: 'inline' },
      currentDisplayType: 'popup',
      goalLabel: 'Grow my email list',
    });
    const warning = screen.getByText('Changes this campaign from Popup to Inline form. Its Goal remains “Grow my email list”. Place its block or shortcode before publishing.');
    expect(warning).toBeVisible();
    expect(screen.getByRole('button', { name: 'Switch to Inline form' }))
      .toHaveAttribute('aria-describedby', expect.stringContaining(warning.id));
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('does not repeat a format warning when the format stays the same', () => {
    detail({ currentDisplayType: 'popup' });
    expect(screen.queryByText(/Changes this campaign/)).toBeNull();
  });

  it('explains unmatched pictures before applying and never stores the transfer report', async () => {
    const onPrepare = vi.fn().mockResolvedValue({ ...TEMPLATE, transfer: { unplaced: 2, unverified: 0 } });
    const { onChoose } = detail({ onPrepare });
    expect(await screen.findByText(/2 picture\(s\) have no clear matching place/)).toBeVisible();
    expect(onChoose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Use this design' }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ENTRY.id, { tree: TEMPLATE.tree, tokens: TEMPLATE.tokens });
    await userEvent.click(screen.getByRole('radio', { name: /Use this design's sample content/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this design' })).toHaveAttribute('aria-disabled', 'false'));
    expect(screen.queryByText(/picture\(s\) have no clear/)).not.toBeInTheDocument();
  });

  it('ignores a late carry response after choosing samples and applies only the displayed content', async () => {
    let resolveKeep!: (value: Template) => void;
    const onPrepare = vi.fn().mockImplementation((_id, mode) => mode === 'keep'
      ? new Promise<Template>((resolve) => { resolveKeep = resolve; }) : Promise.resolve(TEMPLATE));
    const { onChoose } = detail({ onPrepare });
    await userEvent.click(screen.getByRole('radio', { name: /Use this design's sample content/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this design' })).toHaveAttribute('aria-disabled', 'false'));
    const stale = JSON.parse(JSON.stringify(TEMPLATE).replace('Get 10% off your first order', 'Late content')) as Template;
    await act(async () => resolveKeep(stale));
    expect(within(drawn()).queryByText('Late content')).toBeNull();
    expect(screen.getByText('Preview with sample content')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Use this design' }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ENTRY.id, TEMPLATE);
  });

  it('retries a failed chosen content preview without changing the mode or applying the draft', async () => {
    const onPrepare = vi.fn().mockResolvedValueOnce(TEMPLATE)
      .mockRejectedValueOnce(new Error('Preview service is unavailable.')).mockResolvedValueOnce(TEMPLATE);
    const { onChoose } = detail({ onPrepare });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this design' })).toHaveAttribute('aria-disabled', 'false'));
    await userEvent.click(screen.getByRole('radio', { name: /Use this design's sample content/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Preview service is unavailable.');
    expect(screen.getByRole('button', { name: 'Use this design' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this design' })).toHaveAttribute('aria-disabled', 'false'));
    expect(screen.getByRole('radio', { name: /Use this design's sample content/ })).toBeChecked();
    expect(onPrepare.mock.calls.map((call) => call[1])).toEqual(['keep', 'sample', 'sample']);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('can reset the current design to its samples while keeping its identity', async () => {
    const onPrepare = vi.fn().mockResolvedValue(TEMPLATE);
    const { onChoose } = detail({ current: true, onPrepare });
    await waitFor(() => expect(onPrepare).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Current design' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('radio', { name: /Use this design's sample content/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this design' })).toHaveAttribute('aria-disabled', 'false'));
    await userEvent.click(screen.getByRole('button', { name: 'Use this design' }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ENTRY.id, TEMPLATE);
  });

  it('allows Back during preparation and never applies a response after leaving', async () => {
    let resolvePreview!: (value: Template) => void;
    const { onChoose, onBack, unmount } = detail({ onPrepare: () => new Promise((resolve) => { resolvePreview = resolve; }) });
    await userEvent.click(screen.getByRole('button', { name: 'Back to designs' }));
    expect(onBack).toHaveBeenCalledOnce();
    unmount();
    await act(async () => resolvePreview(TEMPLATE));
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('shows actual fields and real screens without applying anything while inspected', async () => {
    const user = userEvent.setup();
    const { onChoose, container } = detail();
    expect(screen.getByRole('heading', { name: 'Centred card' })).toHaveFocus();
    expect(screen.getByText('Preview with sample content')).toBeVisible();
    expect(screen.getByText('Email address')).toBeVisible();
    expect(within(drawn()).getByRole('textbox', { name: 'Email address' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Success screen' }));
    expect(within(drawn()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Success screen' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(container.querySelector('.wconvert-design-detail__preview')).toHaveStyle({ inlineSize: '22rem' });
    expect(screen.getByRole('button', { name: 'Success screen' })).toHaveAttribute('aria-pressed', 'true');
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('keeps sample controls inside an inert subtree and describes what Apply changes', async () => {
    const user = userEvent.setup();
    const { onChoose, container } = detail();
    const preview = container.querySelector('.wconvert-design-detail__preview');
    expect(preview).toHaveAttribute('inert');
    expect(preview).toHaveAttribute('aria-hidden', 'true');
    const apply = screen.getByRole('button', { name: 'Use this design' });
    expect(apply).toHaveAccessibleDescription(/Replaces your draft’s layout.*Undo restores your previous draft/);
    await user.click(apply);
    expect(onChoose).toHaveBeenCalledExactlyOnceWith('centred-card');
  });

  it('returns to the gallery without choosing a design', async () => {
    const { onChoose, onBack } = detail();
    await userEvent.click(screen.getByRole('button', { name: 'Back to designs' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('offers only the screens present in a single-screen design', () => {
    detail({ template: { ...TEMPLATE, tree: treeFixture({ ...TEMPLATE.tree, steps: [TEMPLATE.tree.steps[0]] }) } });
    expect(screen.queryByRole('group', { name: 'Preview screen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this design' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('lets a refused design be inspected but makes its Apply reason reachable', async () => {
    const { onChoose } = detail({ fit: { ...FIT, sibling: 'click' } });
    const apply = screen.getByRole('button', { name: 'Use this design' });
    expect(apply).toHaveAttribute('aria-disabled', 'true');
    expect(apply).not.toBeDisabled();
    expect(apply).toHaveAccessibleDescription(/other arm of this test converts on a click/);
    await userEvent.click(apply);
    expect(onChoose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Success screen' }));
    expect(screen.getByRole('button', { name: 'Success screen' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('announces the changed counting behavior beside Apply without refusing an allowed switch', async () => {
    const { onChoose } = detail({ fit: { ...FIT, act: 'click' } });
    const apply = screen.getByRole('button', { name: 'Use this design' });
    expect(apply).toHaveAccessibleDescription(/Counts submissions instead of click-throughs/);
    expect(apply).toHaveAttribute('aria-disabled', 'false');
    await userEvent.click(apply);
    expect(onChoose).toHaveBeenCalledOnce();
  });

  it('does not reapply the current design', async () => {
    const { onChoose } = detail({ current: true });
    const apply = screen.getByRole('button', { name: 'Current design' });
    expect(apply).toHaveAttribute('aria-disabled', 'true');
    expect(apply).toHaveAccessibleDescription(/Current design/);
    await userEvent.click(apply);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('prevents applying while preview data is missing and offers a local retry on failure', async () => {
    const onRetry = vi.fn();
    const { onChoose } = detail({ template: undefined, loadError: true, onRetry });
    const apply = screen.getByRole('button', { name: 'Use this design' });
    expect(apply).toHaveAttribute('aria-disabled', 'true');
    expect(apply).toHaveAccessibleDescription(/preview could not be loaded/);
    await userEvent.click(apply);
    await userEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
    expect(onChoose).not.toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('prevents a second application while the draft is being prepared', async () => {
    const { onChoose } = detail({ busy: true });
    const apply = screen.getByRole('button', { name: 'Applying design…' });
    expect(apply).toBeDisabled();
    await userEvent.click(apply);
    expect(onChoose).not.toHaveBeenCalled();
  });
});

describe('fitting the preview without changing its layout width', () => {
  let stageWidth: number;
  let pageHeight: number;
  let resized: () => void;
  const disconnect = vi.fn();

  beforeEach(() => {
    stageWidth = 272;
    pageHeight = 900;
    resized = () => undefined;
    disconnect.mockClear();
    // jsdom does not perform layout. Supply native dimensions, independent of
    // the visual transform, as the browser's layout measurements would be.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('wconvert-design-detail__preview') ? Number.parseFloat(this.style.inlineSize) * 16 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('wconvert-design-detail__preview') ? pageHeight : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('wconvert-design-detail__stage') ? stageWidth : 0;
    });
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resized = callback; }
      observe() { /* Measurements are supplied above. */ }
      disconnect() { disconnect(); }
    });
  });

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const detail = (template = TEMPLATE) => render(<TemplateDesignDetail entry={ENTRY} template={template} labels={LABELS}
    current={false} fit={FIT} busy={false} onChoose={vi.fn()} onBack={vi.fn()} />);

  it('fits the native desktop width into the padded stage and reserves the full scaled height', () => {
    const { container, unmount } = detail();
    const stage = container.querySelector('.wconvert-design-detail__stage') as HTMLElement;
    const preview = container.querySelector('.wconvert-design-detail__preview') as HTMLElement;
    stage.style.paddingInlineStart = '32px';
    stage.style.paddingInlineEnd = '32px';
    stage.style.blockSize = '100px';
    act(() => resized());
    expect(preview).toHaveStyle({ inlineSize: '26rem', transform: 'scale(0.5)' });
    expect(preview.style.maxInlineSize).toBe('');
    // The 450px tall picture must scroll; fitting its height to the 100px
    // stage would make every detail too small to inspect.
    expect(container.querySelector('.wconvert-design-detail__measure')).toHaveStyle({ inlineSize: '208px', blockSize: '450px' });
    expect(screen.getByLabelText('Preview scale')).toHaveTextContent('Fit · 50%');
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('remeasures content and available width without magnifying a design on a wider stage', async () => {
    const { container } = detail();
    pageHeight = 480;
    stageWidth = 800;
    act(() => resized());
    expect(container.querySelector('.wconvert-design-detail__preview')).toHaveStyle({ inlineSize: '26rem', transform: 'scale(1)' });
    expect(container.querySelector('.wconvert-design-detail__measure')).toHaveStyle({ inlineSize: '416px', blockSize: '480px' });
    expect(screen.queryByLabelText('Preview scale')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(container.querySelector('.wconvert-design-detail__preview')).toHaveStyle({ inlineSize: '22rem', transform: 'scale(1)' });
    expect(container.querySelector('.wconvert-design-detail__measure')).toHaveStyle({ inlineSize: '352px', blockSize: '480px' });
  });

  it('gives full-width designs a stated desktop reference area without changing their tokens', async () => {
    const template = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/inline-benefits.json'), 'utf8')) as Template;
    const before = JSON.stringify(template);
    stageWidth = 512;
    const { container } = detail(template);
    expect(container.querySelector('.wconvert-design-detail__preview')).toHaveStyle({ inlineSize: '64rem', transform: 'scale(0.5)' });
    expect(screen.getByText('Full-width layout in a sample desktop area')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(container.querySelector('.wconvert-design-detail__preview')).toHaveStyle({ inlineSize: '22rem', transform: 'scale(1)' });
    expect(screen.queryByText('Full-width layout in a sample desktop area')).not.toBeInTheDocument();
    expect(JSON.stringify(template)).toBe(before);
  });
});

describe('gallery inspection actions', () => {
  it('previews installed designs including current and refused cards without choosing', async () => {
    const onChoose = vi.fn();
    const onPreview = vi.fn();
    const refused = { ...ENTRY, id: 'other', name: 'Other design' };
    const { container } = render(<Gallery entries={[ENTRY, refused]} trees={new Map([[ENTRY.id, TEMPLATE], [refused.id, TEMPLATE]])}
      labels={LABELS} chosen={ENTRY.id} fit={{ ...FIT, sibling: 'click' }} busy={false}
      onChoose={onChoose} onNear={vi.fn()} onPreview={onPreview} />);
    const actions = screen.getAllByRole('button', { name: 'Preview design' });
    await userEvent.click(actions[0]);
    await userEvent.click(actions[1]);
    expect(onPreview.mock.calls).toEqual([[ENTRY.id], [refused.id]]);
    expect(onChoose).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.wconvert-gallery__preview[inert]')).toHaveLength(2);
  });

  it('shows a local preview retry while keeping the inspection action available', async () => {
    const onRetry = vi.fn();
    const onPreview = vi.fn();
    render(<Gallery entries={[ENTRY]} trees={new Map()} labels={LABELS} chosen={undefined} fit={FIT} busy={false}
      onChoose={vi.fn()} onNear={vi.fn()} onPreview={onPreview} failed={new Set([ENTRY.id])} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
    await userEvent.click(screen.getByRole('button', { name: 'Preview design' }));
    expect(onRetry).toHaveBeenCalledExactlyOnceWith(ENTRY.id);
    expect(onPreview).toHaveBeenCalledExactlyOnceWith(ENTRY.id);
  });

  it('preserves the external link for a locked design', () => {
    render(<Gallery entries={[{ ...ENTRY, availability: 'locked', tier: 'pro', preview_url: 'https://wconvert.com/designs/example/' }]}
      trees={new Map()} labels={LABELS} chosen={undefined} fit={FIT} busy={false}
      onChoose={vi.fn()} onNear={vi.fn()} onPreview={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'See this design' })).toHaveAttribute('href', 'https://wconvert.com/designs/example/');
    expect(screen.queryByRole('button', { name: 'Preview design' })).not.toBeInTheDocument();
  });
});
