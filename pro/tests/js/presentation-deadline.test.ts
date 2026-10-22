import { afterEach, expect, it, vi } from 'vitest';
import { proPresenter } from '../../modules/display-types/loader/present';
import { templatePresenter } from '@loader/present';
import { treeFixture } from '../../../tests/js/support/journey';
import type { PayloadEntry } from '@loader/types';

const template = { tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'heading', text: 'Sale ends soon' }] }] }), tokens: {} };
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

it.each(['popup', 'inline', 'floating_bar', 'slide_in', 'fullscreen'])('closes an open %s at its deadline without recording a dismissal', display_type => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  document.body.innerHTML = '<div data-wconvert-optin="sale"></div>';
  const controls = { impression: vi.fn(), dismiss: vi.fn(), convert: vi.fn() };
  const entry: PayloadEntry = { id: 'sale', display_type, template, ends_at: Date.now() + 5000 };
  const presenter = ['popup', 'inline'].includes(display_type) ? templatePresenter : proPresenter;
  presenter.show(entry, controls);
  const host = document.querySelector('dialog, [popover], [data-wconvert-optin] > *');
  expect(host?.isConnected).toBe(true);
  vi.advanceTimersByTime(4999);
  expect(host?.isConnected).toBe(true);
  vi.advanceTimersByTime(1);
  expect(host instanceof HTMLDialogElement ? host.open : host?.isConnected).toBe(false);
  expect(controls.dismiss).not.toHaveBeenCalled();
  expect(controls.convert).not.toHaveBeenCalled();
});

it('keeps a deadline more than 25 days away without overflowing the browser timer', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  const duration = 30 * 86400000;
  templatePresenter.show({ id: 'sale', template, ends_at: Date.now() + duration }, { impression() {}, dismiss() {}, convert() {} });
  vi.advanceTimersByTime(duration - 1);
  expect(document.querySelector('dialog')?.open).toBe(true);
  vi.advanceTimersByTime(1);
  expect(document.querySelector('dialog')?.open).toBe(false);
});
