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
import type { Fit } from '../../resources/admin/src/gallery/conversion';

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
    expect(await screen.findByRole('radio', { name: /Use the template’s sample content/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Keep my words and images/ })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this template' })).toBeEnabled());
    expect(onPrepare).toHaveBeenCalledExactlyOnceWith(ENTRY.id, 'sample', TEMPLATE);
    await userEvent.click(screen.getByRole('button', { name: 'Use this template' }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ENTRY.id, TEMPLATE);
  });

  it('explains the missing offer figure instead of fitting a sentence into the amount', async () => {
    const amount: Template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'stack', children: [
      { type: 'heading', role: 'offer_amount' },
      { type: 'button', role: 'cta_label', label: 'Shop', action: 'link', href: '/shop' },
    ] }] }) };
    const onPrepare = vi.fn().mockResolvedValue(amount);
    detail({ onPrepare });
    expect(await screen.findByText('Add the offer amount for this design. Your previous headline is not a discount figure.')).toBeInTheDocument();
    expect(drawn().querySelector('[data-role="offer_amount"]')?.textContent).toBe('');
  });

  it('defaults to carried content and applies the exact normalized preview', async () => {
    const carried = JSON.parse(JSON.stringify(TEMPLATE).replace('Get 10% off your first order', 'My own invitation')) as Template;
    const onPrepare = vi.fn().mockResolvedValue(carried);
    const { onChoose } = detail({ onPrepare });
    expect(screen.getByRole('radio', { name: /Keep my words and images/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Use this template' })).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => expect(within(drawn()).getByText('My own invitation')).toBeInTheDocument());
    expect(onPrepare).toHaveBeenCalledExactlyOnceWith(ENTRY.id, 'keep', TEMPLATE);
    expect(onChoose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Use this template' }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ENTRY.id, carried);
  });

  it('explains a format change beside Apply, including inline placement', () => {
    const { onChoose } = detail({
      entry: { ...ENTRY, display_type: 'inline' },
      currentDisplayType: 'popup',
      goalLabel: 'Grow my email list',
    });
    const warning = screen.getByText('Changes this campaign from Popup to Inline form. Its goal stays “Grow my email list”. Place its block or shortcode before publishing.');
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
    expect(await screen.findByText(/2 pictures have no clear matching place/)).toBeVisible();
    expect(onChoose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Use this template' }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ENTRY.id, { tree: TEMPLATE.tree, tokens: TEMPLATE.tokens });
    await userEvent.click(screen.getByRole('radio', { name: /Use the template’s sample content/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this template' })).toHaveAttribute('aria-disabled', 'false'));
    expect(screen.queryByText(/pictures? (has|have) no clear/)).not.toBeInTheDocument();
  });

  it('ignores a late carry response after choosing samples and applies only the displayed content', async () => {
    let resolveKeep!: (value: Template) => void;
    const onPrepare = vi.fn().mockImplementation((_id, mode) => mode === 'keep'
      ? new Promise<Template>((resolve) => { resolveKeep = resolve; }) : Promise.resolve(TEMPLATE));
    const { onChoose } = detail({ onPrepare });
    await userEvent.click(screen.getByRole('radio', { name: /Use the template’s sample content/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this template' })).toHaveAttribute('aria-disabled', 'false'));
    const stale = JSON.parse(JSON.stringify(TEMPLATE).replace('Get 10% off your first order', 'Late content')) as Template;
    await act(async () => resolveKeep(stale));
    expect(within(drawn()).queryByText('Late content')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Use this template' }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ENTRY.id, TEMPLATE);
  });

  it('retries a failed chosen content preview without changing the mode or applying the draft', async () => {
    const onPrepare = vi.fn().mockResolvedValueOnce(TEMPLATE)
      .mockRejectedValueOnce(new Error('Preview service is unavailable.')).mockResolvedValueOnce(TEMPLATE);
    const { onChoose } = detail({ onPrepare });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this template' })).toHaveAttribute('aria-disabled', 'false'));
    await userEvent.click(screen.getByRole('radio', { name: /Use the template’s sample content/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Preview service is unavailable.');
    expect(screen.getByRole('button', { name: 'Use this template' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this template' })).toHaveAttribute('aria-disabled', 'false'));
    expect(screen.getByRole('radio', { name: /Use the template’s sample content/ })).toBeChecked();
    expect(onPrepare.mock.calls.map((call) => call[1])).toEqual(['keep', 'sample', 'sample']);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('can reset the current design to its samples while keeping its identity', async () => {
    const onPrepare = vi.fn().mockResolvedValue(TEMPLATE);
    const { onChoose } = detail({ current: true, onPrepare });
    await waitFor(() => expect(onPrepare).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Current template' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('radio', { name: /Use the template’s sample content/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this template' })).toHaveAttribute('aria-disabled', 'false'));
    await userEvent.click(screen.getByRole('button', { name: 'Use this template' }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ENTRY.id, TEMPLATE);
  });

  it('allows Back during preparation and never applies a response after leaving', async () => {
    let resolvePreview!: (value: Template) => void;
    const { onChoose, onBack, unmount } = detail({ onPrepare: () => new Promise((resolve) => { resolvePreview = resolve; }) });
    await userEvent.click(screen.getByRole('button', { name: 'Back to templates' }));
    expect(onBack).toHaveBeenCalledOnce();
    unmount();
    await act(async () => resolvePreview(TEMPLATE));
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('shows actual fields and real screens without applying anything while inspected', async () => {
    const user = userEvent.setup();
    const { onChoose, container } = detail();
    // The dialog's header names the design; the radio already says whose content it is.
    expect(screen.queryByRole('heading', { name: 'Centred card' })).toBeNull();
    expect(screen.queryByText(/Preview with (your|sample) content/)).toBeNull();
    expect(screen.getByText('Email address')).toBeVisible();
    expect(within(drawn()).getByRole('textbox', { name: 'Email address' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Received' }));
    expect(within(drawn()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Received' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Mobile' }));
    expect(container.querySelector('.wconvert-stage')).toHaveAttribute('data-device', 'mobile');
    expect(container.querySelector('.wconvert-stage__design')).toHaveStyle({ inlineSize: '328px' });
    expect(screen.getByRole('radio', { name: 'Received' })).toBeChecked();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('keeps sample controls inside an inert subtree and describes what Apply changes', async () => {
    const user = userEvent.setup();
    const { onChoose, container } = detail();
    const preview = container.querySelector('.wconvert-stage__design');
    expect(preview).toHaveAttribute('inert');
    expect(preview).toHaveAttribute('aria-hidden', 'true');
    const apply = screen.getByRole('button', { name: 'Use this template' });
    expect(apply).toHaveAccessibleDescription(/^Replaces this draft’s template\. You can undo\./);
    expect(screen.getByText('Replaces this draft’s template. You can undo.').closest('footer')).not.toBeNull();
    await user.click(apply);
    expect(onChoose).toHaveBeenCalledExactlyOnceWith('centred-card');
  });

  /** A swap keeps only the mappings the new design can feed; the sentence says so before, not after. */
  it('says field mappings are removed only when this design would remove some', () => {
    const removed = /Field mappings for missing fields are removed\./;
    const { unmount } = detail({ fieldMappings: { primary: { list: { 'field:interest': 'INTEREST' } } } });
    expect(screen.getByRole('button', { name: 'Use this template' })).toHaveAccessibleDescription(removed);
    unmount();

    detail({ fieldMappings: { primary: { list: {} }, gone: { list: {} } } });
    expect(screen.queryByText(removed)).toBeNull();
  });

  it('returns to the gallery without choosing a design', async () => {
    const { onChoose, onBack } = detail();
    await userEvent.click(screen.getByRole('button', { name: 'Back to templates' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('offers only the screens present in a single-screen design', () => {
    detail({ template: { ...TEMPLATE, tree: treeFixture({ ...TEMPLATE.tree, steps: [TEMPLATE.tree.steps[0]] }) } });
    expect(screen.queryByRole('group', { name: 'Preview screen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this template' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('lets a refused design be inspected but makes its Apply reason reachable', async () => {
    const { onChoose } = detail({ fit: { ...FIT, sibling: 'click' } });
    const apply = screen.getByRole('button', { name: 'Use this template' });
    expect(apply).toHaveAttribute('aria-disabled', 'true');
    expect(apply).not.toBeDisabled();
    expect(apply).toHaveAccessibleDescription(/other arm of this test converts on a click/);
    await userEvent.click(apply);
    expect(onChoose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', { name: 'Received' }));
    expect(screen.getByRole('radio', { name: 'Received' })).toBeChecked();
  });

  it('announces the changed counting behavior beside Apply without refusing an allowed switch', async () => {
    const { onChoose } = detail({ fit: { ...FIT, act: 'click' } });
    const apply = screen.getByRole('button', { name: 'Use this template' });
    expect(apply).toHaveAccessibleDescription(/Counts submissions instead of click-throughs/);
    expect(apply).toHaveAttribute('aria-disabled', 'false');
    await userEvent.click(apply);
    expect(onChoose).toHaveBeenCalledOnce();
  });

  it('does not reapply the current design', async () => {
    const { onChoose } = detail({ current: true });
    const apply = screen.getByRole('button', { name: 'Current template' });
    expect(apply).toHaveAttribute('aria-disabled', 'true');
    expect(apply).toHaveAccessibleDescription(/current template/);
    await userEvent.click(apply);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('prevents applying while preview data is missing and offers a local retry on failure', async () => {
    const onRetry = vi.fn();
    const { onChoose } = detail({ template: undefined, loadError: true, onRetry });
    const apply = screen.getByRole('button', { name: 'Use this template' });
    expect(apply).toHaveAttribute('aria-disabled', 'true');
    expect(apply).toHaveAccessibleDescription(/preview could not be loaded/);
    await userEvent.click(apply);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onChoose).not.toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('prevents a second application while the draft is being prepared', async () => {
    const { onChoose } = detail({ busy: true });
    const apply = screen.getByRole('button', { name: 'Applying template…' });
    expect(apply).toBeDisabled();
    await userEvent.click(apply);
    expect(onChoose).not.toHaveBeenCalled();
  });
});

describe('fitting the preview without changing its layout width', () => {
  let stage: { width: number; height: number };
  let designHeight: number;
  let resized: () => void;
  const disconnect = vi.fn();

  beforeEach(() => {
    stage = { width: 800, height: 500 };
    designHeight = 480;
    resized = () => undefined;
    disconnect.mockClear();
    // jsdom does not perform layout. Supply native dimensions, independent of
    // the visual transform, as the browser's layout measurements would be.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('wconvert-stage__design') ? Number.parseFloat(this.style.inlineSize) : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.parentElement?.classList.contains('wconvert-stage__design') ? designHeight : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('wconvert-stage') ? stage.width : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('wconvert-stage') ? stage.height : 0;
    });
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resized = callback; }
      observe() { /* Measurements are supplied above. */ }
      disconnect() { disconnect(); }
    });
  });

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const detail = (template = TEMPLATE, entry = ENTRY) => render(<TemplateDesignDetail entry={entry} template={template} labels={LABELS}
    current={false} fit={FIT} busy={false} onChoose={vi.fn()} onBack={vi.fn()} />);
  const design = (container: HTMLElement) => container.querySelector('.wconvert-stage__design') as HTMLElement;

  it('draws the design at its own width and fits it whole into the popup slot', () => {
    const { container, unmount } = detail();
    act(() => resized());
    // 26rem wide; the slot is 72% × 88% of 800 × 500, and 440 / 480 is the tighter.
    expect(design(container)).toHaveStyle({ inlineSize: '416px', transform: `scale(${440 / 480})` });
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('remeasures and never enlarges a design more than 1.25 times', () => {
    const { container } = detail();
    designHeight = 200;
    stage = { width: 1600, height: 1000 };
    act(() => resized());
    expect(design(container)).toHaveStyle({ inlineSize: '416px', transform: 'scale(1.25)' });
  });

  it('draws a phone at 360 at its own size, and fits the whole phone on request', async () => {
    const { container } = detail();
    await userEvent.click(screen.getByRole('radio', { name: 'Mobile' }));
    act(() => resized());
    expect(design(container)).toHaveStyle({ inlineSize: '328px', transform: 'scale(1)' });
    // A phone opens at its real width, so a tall form is read by scrolling (ADR 0137).
    expect(container.querySelector('.wconvert-stage__page')).toHaveStyle({ transform: 'scale(1)' });
    await userEvent.click(screen.getByRole('button', { name: 'Fit whole design' }));
    act(() => resized());
    expect(container.querySelector('.wconvert-stage__page')).toHaveStyle({ transform: `scale(${500 / 720})` });
  });

  it('scrolls a design bigger than the frame at actual size, and says so', async () => {
    const { container } = detail();
    designHeight = 900;
    act(() => resized());
    await userEvent.click(screen.getByRole('button', { name: 'Actual size' }));
    act(() => resized());
    expect(design(container)).toHaveStyle({ transform: 'scale(1)' });
    expect(screen.getByRole('region', { name: 'Scrollable design preview' })).toBe(container.querySelector('.wconvert-stage'));
    expect(screen.getByText('Scroll inside the preview to see the rest, or choose Fit whole design.')).toBeVisible();
  });

  it('gives a full-width design a stated desktop reference width without changing its tokens', async () => {
    const template = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/inline-benefits.json'), 'utf8')) as Template;
    const before = JSON.stringify(template);
    const { container } = detail(template, { ...ENTRY, display_type: 'inline' });
    expect(design(container)).toHaveStyle({ inlineSize: '640px' });
    expect(screen.getByText('Full-width layout in a sample desktop area')).toBeVisible();
    await userEvent.click(screen.getByRole('radio', { name: 'Mobile' }));
    expect(design(container)).toHaveStyle({ inlineSize: '328px' });
    expect(screen.queryByText('Full-width layout in a sample desktop area')).not.toBeInTheDocument();
    expect(JSON.stringify(template)).toBe(before);
  });
});

describe('a design that converts without a form or link (#375)', () => {
  it.each([
    ['match', 'Shows a matching result'],
    ['add_to_cart', 'Adds to the basket'],
  ] as const)('names %s as its visitor action, in the facts and the meta line', async (act, words) => {
    const { designMeta } = await import('../../resources/admin/src/builder/TemplateDesignDetail');
    const entry: TemplateIndexEntry = { ...ENTRY, facets: { ...ENTRY.facets, act, captures: [] } };
    render(<TemplateDesignDetail entry={entry} template={TEMPLATE} labels={LABELS}
      current={false} fit={{ ...FIT, act }} busy={false} onChoose={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(words)).toBeInTheDocument();
    expect(screen.queryByText('No conversion action')).toBeNull();
    expect(designMeta(entry, LABELS)).toBe(`Popup · ${words}`);
  });
});
