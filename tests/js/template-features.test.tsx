import { afterEach, expect, it, vi } from 'vitest';
import { render as renderReact, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@renderer/render';
import { mount } from '@renderer/mount';
import { loadGoogleFonts } from '@renderer/fonts';
import type { Template } from '@renderer/types';
import { treeFixture } from './support/journey';
import { DecorationsSettings } from '../../resources/admin/src/builder/DecorationsSettings';
import { GoogleFontSettings } from '../../resources/admin/src/settings-page/GoogleFontSettings';
import { FontNotice } from '../../resources/admin/src/builder/FontNotice';
import { withGoogleFont } from '../../resources/admin/src/builder/googleFonts';

const request = vi.hoisted(() => vi.fn());
vi.mock('@wordpress/api-fetch', () => ({ default: request }));
const fixture = (): Template => ({ tokens: { 'heading-font': "'Creepster', cursive" }, tree: {
  ...treeFixture({ steps: [{ type: 'panel', decorations: { label: 'Flying bats', hidden: false, items: [{ kind: 'bat', x: 10, y: 20, size: 48, motion: 'flap' }] }, children: [
    { type: 'heading', text: 'Halloween' }, { type: 'countdown', layout: 'boxes', density: 'compact' },
  ] }] }), fonts: [{ family: 'Creepster', faces: [{ weight: 400 }] }],
} });
afterEach(() => { document.querySelectorAll('link[data-wc-font]').forEach(link => link.remove()); document.querySelectorAll('dialog').forEach(dialog => dialog.remove()); });

it('does not request fonts on render, mount, or a show without explicit site permission', () => {
  const template = fixture();
  render(template.tree, template.tokens);
  const mounted = mount({ displayType: 'popup', template });
  mounted.show(); mounted.close();
  expect(document.querySelector('link[data-wc-font]')).toBeNull();
});
it('loads only declared, used, missing fonts on show and deduplicates repeated appearances', () => {
  const template = fixture();
  const mounted = mount({ displayType: 'popup', template, googleFonts: true });
  expect(document.querySelector('link[data-wc-font]')).toBeNull();
  mounted.show(); mounted.close(); mounted.show();
  expect(document.querySelectorAll('link[data-wc-font]')).toHaveLength(1);
  expect(document.querySelector<HTMLLinkElement>('link[data-wc-font]')?.href).toContain('Creepster:ital,wght@0,400&display=swap');
  mounted.close();
  document.querySelector('link[data-wc-font]')?.remove();
  loadGoogleFonts(template, true, ['creepster']);
  loadGoogleFonts({ ...template, tokens: { 'heading-font': 'serif' } }, true);
  expect(document.querySelector('link[data-wc-font]')).toBeNull();
});
it('rejects arbitrary font URLs and keeps template permission separate from family selection', () => {
  const template = fixture();
  loadGoogleFonts({ ...template, tree: { ...template.tree, fonts: [{ family: 'https://evil.test/font', faces: [{ weight: 400 }] }] } }, true);
  expect(document.querySelector('link[data-wc-font]')).toBeNull();
  const next = withGoogleFont({ ...template, tokens: { 'heading-font': "'Eater', cursive" } }, { family: 'Eater', faces: [{ weight: 400 }] });
  expect(next.tree.fonts?.map(font => font.family)).toEqual(['Eater']);
});
it('rejects a fifth used Google family instead of losing a requirement during save', () => {
  const families = ['Creepster', 'Eater', 'Nosifer', 'Inter', 'Lato'];
  const template: Template = { tokens: {}, tree: {
    ...treeFixture({ steps: families.map(family => ({ type: 'stack', tokens: { font: `'${family}', serif` }, children: [] })) }),
    fonts: families.slice(0, 4).map(family => ({ family, faces: [{ weight: 400 }] })),
  } };
  expect(() => withGoogleFont(template, { family: 'Lato', faces: [{ weight: 400 }] })).toThrow('up to four');
  expect(template.tree.fonts).toHaveLength(4);
});
it('keeps decorations out of accessibility and layout flow, pauses them on close and removes them when hidden', () => {
  const template = fixture();
  const mounted = mount({ displayType: 'popup', template });
  expect(mounted.root?.dataset.motion).toBe('paused');
  mounted.show();
  expect(mounted.root?.dataset.motion).toBe('running');
  expect(mounted.root?.querySelector('.wc-decorations')?.getAttribute('aria-hidden')).toBe('true');
  expect(mounted.root?.querySelectorAll('.wc-wing')).toHaveLength(2);
  mounted.close();
  expect(mounted.root?.dataset.motion).toBe('paused');
  const node = template.tree.steps[0].content as { decorations: { hidden: boolean } };
  node.decorations.hidden = true;
  const root = render(template.tree, template.tokens);
  expect(root.querySelector('.wc-decorations')).toBeNull();
  expect(root.querySelector('h2')?.textContent).toBe('Halloween');
  expect(root.querySelector('.wc-compact')).not.toBeNull();
});
it('offers a switch only for declared decorations and preserves their authored motion when hidden', async () => {
  const user = userEvent.setup(); const change = vi.fn(); const template = fixture();
  const view = renderReact(<DecorationsSettings template={template} onChange={change} />);
  await user.click(screen.getByRole('checkbox', { name: 'Flying bats' }));
  expect(change.mock.calls[0][0].tree.steps[0].content.decorations).toMatchObject({ hidden: true, items: [{ motion: 'flap' }] });
  view.rerender(<DecorationsSettings template={{ ...template, tree: treeFixture({ steps: [{ type: 'stack' }] }) }} onChange={change} />);
  expect(screen.queryByRole('checkbox')).toBeNull();
});
it('requires a separate acknowledgment before enabling Google, and can disable without a second confirmation', async () => {
  const user = userEvent.setup();
  request.mockImplementation(async ({ method, data }) => ({ enabled: method === 'POST' ? data.enabled : false }));
  renderReact(<GoogleFontSettings />);
  const toggle = await screen.findByRole('checkbox', { name: /Load selected fonts from Google/ });
  expect(toggle).not.toBeChecked();
  await user.click(toggle); await user.click(screen.getByRole('button', { name: 'Save Google Fonts' }));
  expect(request.mock.calls.filter(([args]) => args.method === 'POST')).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Keep disabled' }));
  expect(toggle).not.toBeChecked();
  await user.click(toggle);
  expect(request.mock.calls.filter(([args]) => args.method === 'POST')).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Save Google Fonts' }));
  await user.click(screen.getByRole('button', { name: 'Enable Google Fonts' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', data: { enabled: true, acknowledged: true } })));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Google Fonts' })).toBeDisabled());
  await user.click(toggle); await user.click(screen.getByRole('button', { name: 'Save Google Fonts' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', data: { enabled: false, acknowledged: false } })));
});

it('keeps fixed SVG action arrows accessible by their editable label', () => {
  const tree = treeFixture({ steps: [{ type: 'stack', children: [
    { type: 'button', action: 'link', label: 'Shop Black Friday', href: 'https://example.test/shop', icon: 'arrow' },
    { type: 'button', action: 'submit', label: 'Get early access', icon: 'arrow' },
  ] }] });
  const root = render(tree, {});
  expect(root.querySelectorAll('.wc-action-icon')).toHaveLength(2);
  for (const svg of root.querySelectorAll('.wc-action-icon')) {
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelector('path')).not.toBeNull();
  }
  expect(root.querySelector('a')?.textContent).toBe('Shop Black Friday');
  expect(root.querySelector('button')?.textContent).toBe('Get early access');
});

it('preserves ticket sides and stops standalone image motion on close', () => {
  const template: Template = { tokens: { bg: '#ba3430' }, tree: treeFixture({ steps: [{
    type: 'panel', notch: true, notch_position: 'sides', children: [
      { type: 'image', src: 'https://example.test/product.webp', alt: 'Product', motion: 'drift', shape: 'circle' },
    ],
  }] }) };
  const mounted = mount({ displayType: 'popup', template });
  expect(mounted.root?.querySelector('[data-notch-position="sides"]')).not.toBeNull();
  expect(mounted.root?.querySelector('.wc-artwork-motion')?.getAttribute('data-artwork-motion')).toBe('drift');
  expect(mounted.root?.dataset.motion).toBe('paused');
  mounted.show();
  expect(mounted.root?.dataset.motion).toBe('running');
  mounted.close();
  expect(mounted.root?.dataset.motion).toBe('paused');
});


it('does not warn about bundled campaign faces when Google delivery is disabled', async () => {
  request.mockResolvedValue({ fonts: [], bundled_fonts: ['DM Sans', 'Bebas Neue', 'Cormorant Garamond'], google_fonts_enabled: false });
  const template = fixture();
  const view = renderReact(<FontNotice template={{ ...template, tokens: { 'heading-font': "'Bebas Neue', sans-serif" }, tree: { ...template.tree, fonts: [{ family: 'Bebas Neue', faces: [{ weight: 400 }] }] } }} />);
  await waitFor(() => expect(request).toHaveBeenCalled());
  expect(screen.queryByText(/A substitute font is shown/)).toBeNull();
  view.rerender(<FontNotice template={template} />);
  expect(await screen.findByText(/A substitute font is shown/)).toHaveTextContent('Creepster');
});
