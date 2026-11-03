import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Template, TemplateNode } from '@renderer/types';
import type { Mounted } from '../../resources/renderer/src/mount';
import sourceJson from '../../resources/templates/library/journey-email-only.json';
import { consentShown } from './support/designs';

/**
 * The canvas scales its design, so a `position: fixed` list inside it resolves
 * against the stage rather than the window, and the stage clips it. jsdom has
 * no layout, so what is asserted is the cause: on the canvas the list never opens.
 */
const mounts = vi.hoisted(() => [] as Mounted[]);
vi.mock('@renderer/mount', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../resources/renderer/src/mount')>();
  return { ...real, mount: (options: Parameters<typeof real.mount>[0]) => { const mounted = real.mount(options); mounts.push(mounted); return mounted; } };
});
vi.mock('../../resources/admin/src/phoneSiteCountry', () => ({ phoneSiteCountry: () => 'IR' }));

const { Preview } = await import('../../resources/admin/src/builder/Preview');

const source = consentShown(sourceJson);
const phone = (node: TemplateNode): TemplateNode => {
  if (node.type === 'field') return { ...node, name: 'phone', label: 'Phone number' } as TemplateNode;
  if ('children' in node && node.children) return { ...node, children: node.children.map(phone) };
  return node;
};
const template = { ...source, tree: { ...source.tree, steps: source.tree.steps.map(step => ({ ...step, content: phone(step.content as TemplateNode) })) } } as Template;

const drawn = () => mounts.at(-1)?.root as HTMLElement;
const trigger = () => drawn().querySelector<HTMLButtonElement>('.lpi__trigger')!;
const list = () => (drawn().getRootNode() as ShadowRoot).querySelector('.lpi__dropdown');

afterEach(() => { cleanup(); mounts.length = 0; delete (window as Window & { __wcPhone?: unknown }).__wcPhone; });

it('selects the phone field on the canvas instead of opening the country list', () => {
  const onSelect = vi.fn();
  render(<Preview template={template} selected={null} onSelect={onSelect} />);
  fireEvent.click(trigger());
  expect(list()).toBeNull();
  expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it('still opens the country list where the form can be tried', () => {
  render(<Preview template={template} interactive />);
  fireEvent.click(trigger());
  expect(list()).not.toBeNull();
});
