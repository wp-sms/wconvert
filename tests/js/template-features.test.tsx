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
