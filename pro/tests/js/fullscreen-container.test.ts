import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@renderer/mount';
import { mountFullscreen } from '../../modules/display-types/loader/fullscreen';
import { proPresenter } from '../../modules/display-types/loader/present';
import { decorateFullscreen } from '../../modules/display-types/loader/surface';
import editorial from '../../modules/display-types/templates/fullscreen-editorial.json';
import type { Template } from '@renderer/types';

const template = editorial as Template;
const controls = () => ({ impression: vi.fn(), dismiss: vi.fn(), convert: vi.fn() });
const dialog = () => document.querySelector('dialog')!;
const shadow = (root: HTMLElement | null) => root!.getRootNode() as ShadowRoot;

afterEach(() => {
  document.querySelectorAll('dialog').forEach((element) => element.close());
  document.body.innerHTML = '';
  document.documentElement.style.removeProperty('overflow');
  vi.restoreAllMocks();
});

it('Free never renders the premium format, even with a snapshot', () => {
  expect(mount({ displayType: 'fullscreen', template }).mounted).toBe(false);
});

it('fills the viewport with an armoured modal and preserves authored tokens', () => {
  const before = JSON.stringify(template);
  const shown = mountFullscreen({ template });
  shown.show();
  expect(dialog().open).toBe(true);
  expect(dialog().style.inlineSize).toBe('100%');
  expect(dialog().style.blockSize).toBe('100dvh');
  expect(dialog().style.getPropertyPriority('block-size')).toBe('important');
  expect(dialog().style.overflow).toBe('auto');
  expect(shown.root!.style.minBlockSize).toBe('100dvh');
  expect(shown.root!.firstElementChild).toHaveStyle({ maxInlineSize: '36rem' });
  expect(JSON.stringify(template)).toBe(before);
});

it('names the modal across its closed shadow boundary and focuses the heading, never email', () => {
  const shown = mountFullscreen({ template });
  shown.show();
  expect(dialog().getAttribute('aria-label')).toContain('One useful idea.');
  expect(shadow(shown.root).activeElement).toBe(shown.root!.querySelector('h2'));
  expect(shadow(shown.root).host.shadowRoot).toBeNull();
});

it('keeps a 44px close target outside size containment and reuses it after success', () => {
  const dismiss = vi.fn();
  const shown = mountFullscreen({ template, onDismiss: dismiss });
  shown.show();
  const close = shadow(shown.root).querySelector<HTMLButtonElement>('.wc-close')!;
  expect(close.parentNode).toBe(shadow(shown.root));
  expect(close.style.inlineSize).toBe('44px');
  dialog().scrollTop = 500;
  shown.showStep(1);
  expect(dialog().scrollTop).toBe(0);
  expect(dialog().getAttribute('aria-label')).toBe('Request received');
  expect(shadow(shown.root).activeElement).toBe(shown.root!.querySelector('h2'));
  expect(shadow(shown.root).querySelector('.wc-close')).toBe(close);
  close.click();
  expect(dismiss).toHaveBeenCalledOnce();
  expect(document.documentElement.style.overflow).toBe('');
});

it('ignores background clicks and distinguishes visitor dismissal from programmatic close', () => {
  const dismiss = vi.fn();
  const shown = mountFullscreen({ template, onDismiss: dismiss });
  shown.show();
  dialog().click();
  expect(dialog().open).toBe(true);
  shown.close();
  shown.close();
  expect(dismiss).not.toHaveBeenCalled();
});

it('restores the exact existing scroll style and priority on native close', () => {
  document.documentElement.style.setProperty('overflow', 'scroll', 'important');
  const shown = mountFullscreen({ template });
  shown.show();
  expect(document.documentElement.style.overflow).toBe('hidden');
  dialog().close();
  expect(document.documentElement.style.overflow).toBe('scroll');
  expect(document.documentElement.style.getPropertyPriority('overflow')).toBe('important');
});

it('uses the same content surface in admin previews without mutating the snapshot', () => {
  const anchor = document.createElement('div');
  document.body.append(anchor);
  const preview = mount({ displayType: 'inline', template, anchor });
  preview.show();
  decorateFullscreen(preview.root!, template.tokens.width, '32rem');
  const shown = mountFullscreen({ template });
  shown.show();
  const content = shown.root!.cloneNode(true) as HTMLElement;
  content.querySelector('h2')?.removeAttribute('tabindex');
  expect(content.innerHTML).toBe(preview.root!.innerHTML);
  expect(preview.root!.style.minBlockSize).toBe('32rem');
  preview.close();
});

it('reports an impression once shown, not for a missing design or unavailable dialog', () => {
  const seen = controls();
  proPresenter.show({ id: 'full', display_type: 'fullscreen' }, seen);
  expect(seen.impression).not.toHaveBeenCalled();
  proPresenter.show({ id: 'full', display_type: 'fullscreen', template }, seen);
  expect(seen.impression).toHaveBeenCalledOnce();
  dialog().close();
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => { throw new Error('Unavailable'); });
  const failed = controls();
  proPresenter.show({ id: 'failed', display_type: 'fullscreen', template }, failed);
  expect(failed.impression).not.toHaveBeenCalled();
  expect(failed.dismiss).not.toHaveBeenCalled();
  expect(document.documentElement.style.overflow).toBe('');
  expect(document.querySelectorAll('dialog')).toHaveLength(1);
});
