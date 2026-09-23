import { treeFixture } from '../../../tests/js/support/journey';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { start } from '@loader/shell';
import { createLoader } from '@loader/engine';
import { FREE_MODULES } from '@loader/modules';
import type { PayloadEntry } from '@loader/types';
import { proPresenter } from '../../modules/display-types/loader/present';

const campaign = {
  id: '01JQ0000000000000000000001', display_type: 'popup',
  triggers: [{ type: 'page_load' }], teaser: { label: 'Get my discount' },
  template: { tokens: {}, tree: treeFixture({ steps: [
    { type: 'stack', children: [{ type: 'heading', text: 'Your discount' }, { type: 'field', name: 'email' }, { type: 'button', label: 'Join', action: 'submit' }] },
    { type: 'stack', children: [{ type: 'heading', text: 'Thank you' }] },
  ] }) },
};
beforeEach(() => { vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))); });
let stop: (() => void) | undefined;
afterEach(() => { stop?.(); document.body.innerHTML = ''; sessionStorage.clear(); localStorage.clear(); document.cookie = 'wcv1=; Max-Age=0; path=/'; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('restores only the reminder on the next page even when automatic impressions are capped', () => {
  const entries = [{ ...campaign, frequency: { maxImpressions: 1 } }] as PayloadEntry[];
  const beacon = { report: vi.fn(), flush: vi.fn(), stop: vi.fn() };
  const options = { loader: createLoader(FREE_MODULES), entries, presenter: proPresenter, beacon };
  stop = start(options);
  document.querySelector('dialog')!.close();
  stop(); document.body.innerHTML = ''; beacon.report.mockClear();
  stop = start(options);
  expect(document.querySelector('[data-wconvert-reopen]')).not.toBeNull();
  expect(document.querySelector('dialog')?.open).not.toBe(true);
  expect(beacon.report).not.toHaveBeenCalled();
});

it('offers the same popup after dismissal, retaining inputs without counting another view', () => {
  const shadows: ShadowRoot[] = [];
  const attach = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, options) {
    const root = attach.call(this, options); shadows.push(root); return root;
  });
  const beacon = { report: vi.fn(), flush: vi.fn(), stop: vi.fn() };
  stop = start({ loader: createLoader(FREE_MODULES), entries: [campaign as PayloadEntry], presenter: proPresenter, beacon });
  const input = shadows.flatMap(root => [...root.querySelectorAll('input')]).find(input => input.type === 'email')!;
  input.value = 'reader@example.com';
  const dialog = document.querySelector('dialog')!;
  dialog.close();
  const reopen = shadows.flatMap(root => [...root.querySelectorAll('button')]).find(button => button.textContent === 'Get my discount');
  expect(reopen).toBeDefined();
  reopen!.click();
  expect(dialog.open).toBe(true);
  expect(input.value).toBe('reader@example.com');
  expect(beacon.report.mock.calls.map(call => call[1])).toEqual(['impression', 'dismiss']);
});

function shadowAccess() {
  const roots: ShadowRoot[] = [];
  const attach = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, options) {
    const root = attach.call(this, options); roots.push(root); return root;
  });
  return {
    button: (label: string) => roots.flatMap(root => [...root.querySelectorAll('button')]).find(button => button.textContent === label)!,
    close: () => roots.flatMap(root => [...root.querySelectorAll('button')]).find(button => button.getAttribute('aria-label') === 'Dismiss reminder')!,
    roots,
  };
}
const optionsFor = (entries: PayloadEntry[]) => ({ loader: createLoader(FREE_MODULES), entries, presenter: proPresenter, beacon: { report: vi.fn(), flush: vi.fn(), stop: vi.fn() } });

it('closing a restored reminder counts no dismissal and stops recovery despite permissive frequency', () => {
  const ui = shadowAccess();
  const options = optionsFor([{ ...campaign, frequency: { stopAfterDismiss: false, stopAfterConversion: false } }]);
  stop = start(options); document.querySelector('dialog')!.close();
  stop(); document.body.innerHTML = ''; options.beacon.report.mockClear();
  stop = start(options); ui.close().click();
  expect(options.beacon.report).not.toHaveBeenCalled();
  stop(); document.body.innerHTML = '';
  stop = start(options);
  expect(document.querySelector('dialog,[data-wconvert-reopen]')).toBeNull();
});

it('gives a restored reminder priority over a new automatic overlay without spending another impression', () => {
  const options = optionsFor([campaign]);
  stop = start(options); document.querySelector('dialog')!.close();
  stop(); document.body.innerHTML = ''; options.beacon.report.mockClear();
  options.entries.push({ ...campaign, id: '01JQ0000000000000000000002', priority: 999 });
  stop = start(options);
  expect(document.querySelector('[data-wconvert-reopen]')).not.toBeNull();
  expect(document.querySelector('dialog[open]')).toBeNull();
  expect(options.beacon.report).not.toHaveBeenCalled();
});

it('hides on condition loss, revalidates before reopening, and retains only condition listeners', () => {
  const ui = shadowAccess();
  let eligible = true;
  let signal = () => {};
  const stopTrigger = vi.fn();
  const options = optionsFor([{ ...campaign, conditions: [{ type: 'allowed' }] }]);
  options.loader = createLoader([
    { id: 'page_load', kind: 'trigger', consentCategory: 'functional', create: () => ({ holds: () => true, stop: stopTrigger }) },
    { id: 'allowed', kind: 'condition', consentCategory: 'functional', create: changed => { signal = changed; return { holds: () => eligible }; } },
  ]);
  stop = start(options);
  expect(stopTrigger).toHaveBeenCalledOnce();
  document.querySelector('dialog')!.close();
  eligible = false; signal();
  expect(document.querySelector('[data-wconvert-reopen]')).toBeNull();
  eligible = true; signal(); ui.button('Get my discount').click();
  expect(document.querySelector('dialog')!.open).toBe(true);
  eligible = false; signal();
  expect(document.querySelector('dialog')!.open).toBe(false);
  expect(options.beacon.report.mock.calls.map(call => call[1])).toEqual(['impression', 'dismiss']);
});

it('does not let a stale slide-in closing animation remove the reopened form', async () => {
  const ui = shadowAccess();
  stop = start(optionsFor([{ ...campaign, display_type: 'slide_in' }]));
  const close = ui.roots.flatMap(root => [...root.querySelectorAll('.wc-close')])[0] as HTMLButtonElement;
  close.click(); ui.button('Get my discount').click();
  const popover = document.querySelector('[popover]:not([data-wconvert-reopen])')!;
  popover.dispatchEvent(new Event('transitionend'));
  expect(popover.isConnected).toBe(true);
  expect(popover.hasAttribute('data-leaving')).toBe(false);
  expect(ui.roots[1].querySelector('form')?.style.pointerEvents).not.toBe('none');
});

it('keeps a slow capture alive while minimized and offers success without expanding', async () => {
  const ui = shadowAccess();
  const tag = document.createElement('script'); tag.id = 'wconvert-payload'; tag.setAttribute('data-capture', 'https://example.test/wp-json/wconvert/v1/capture'); document.body.append(tag);
  let resolve!: (response: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done; })).mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'grant' }) } as Response); vi.stubGlobal('fetch', fetch);
  const options = optionsFor([campaign]); stop = start(options);
  const form = ui.roots.flatMap(root => [...root.querySelectorAll('form')])[0];
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  document.querySelector('dialog')!.close();
  ui.button('Get my discount').click();
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  document.querySelector('dialog')!.close();
  resolve({ ok: true, status: 201, json: async () => ({ id: '01JQ0000000000000000000009' }) } as Response);
  await vi.waitFor(() => expect(ui.button('Submission received — View details')).toBeDefined());
  expect(document.querySelector('dialog')!.open).toBe(false);
  ui.button('Submission received — View details').click();
  expect(document.querySelector('dialog')!.open).toBe(true);
  expect(ui.roots.some(root => root.textContent?.includes('Thank you'))).toBe(true);
  expect(options.beacon.report.mock.calls.map(call => call[1])).toEqual(['impression', 'dismiss']);
});

it('decodes compact settings and preserves the exact selected arm', () => {
  const ui = shadowAccess();
  const parent = campaign.id;
  const child = { ...campaign, id: '01JQ0000000000000000000002', campaign: parent, teaser: ['Child offer', 0, 24, '#123456', '#fff', [false]] } as unknown as PayloadEntry;
  const options = optionsFor([child]);
  stop = start(options); document.querySelector('dialog')!.close();
  expect(ui.button('Child offer')).toBeDefined();
  stop(); document.body.innerHTML = ''; options.beacon.report.mockClear();
  stop = start(options);
  expect(document.querySelector('[data-wconvert-reopen]')).not.toBeNull();
  expect(options.beacon.report).not.toHaveBeenCalled();
  stop(); document.body.innerHTML = '';
  // Basic receives all arms; its stable primary must not inherit the child's reminder.
  options.entries = [campaign, child];
  stop = start(options);
  expect(document.querySelector('dialog[open]')).not.toBeNull();
  expect(document.querySelector('[data-wconvert-reopen]')).toBeNull();
});

it('retains a dormant record on failed mounting and spends no allowance', async () => {
  const options = optionsFor([campaign]);
  stop = start(options); document.querySelector('dialog')!.close();
  stop(); document.body.innerHTML = ''; options.beacon.report.mockClear();
  const saved = sessionStorage.getItem(sessionStorage.key(0)!);
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => { throw new Error('Cannot show'); });
  options.entries = [{ ...campaign, id: '01JQ0000000000000000000003' }];
  stop = start(options);
  await Promise.resolve();
  expect(options.beacon.report).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(sessionStorage.key(0)!)).toBe(saved);
});

it('keeps same-page recovery and refusal working when session storage is blocked', () => {
  const ui = shadowAccess();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
  stop = start(optionsFor([campaign]));
  document.querySelector('dialog')!.close();
  ui.button('Get my discount').click();
  expect(document.querySelector('dialog')!.open).toBe(true);
  document.querySelector('dialog')!.close(); ui.close().click();
  window.dispatchEvent(new Event('pageshow'));
  expect(document.querySelector('[data-wconvert-reopen]')).toBeNull();
});

it('expires an expanded recovered offer without adding a dismissal', () => {
  const ui = shadowAccess();
  let now = 100;
  const options = { ...optionsFor([{ ...campaign, ends_at: 500 }]), now: () => now };
  stop = start(options); document.querySelector('dialog')!.close(); ui.button('Get my discount').click();
  now = 500; window.dispatchEvent(new Event('pageshow'));
  expect(document.querySelector('dialog')!.open).toBe(false);
  expect(document.querySelector('[data-wconvert-reopen]')).toBeNull();
  expect(options.beacon.report.mock.calls.map(call => call[1])).toEqual(['impression', 'dismiss']);
});

it('suppresses only teaser-enabled campaigns when the bounded stop set overflows', async () => {
  const { recoveryStore } = await import('../../modules/display-types/loader/recovery-state');
  const store = recoveryStore();
  for (let index = 0; index < 65; index++) store.stop({ id: `01JQ${String(index).padStart(22, '0')}` });
  const options = optionsFor([{ ...campaign, teaser: undefined } as PayloadEntry]);
  stop = start(options);
  expect(document.querySelector('dialog')!.open).toBe(true);
  expect(options.beacon.report).toHaveBeenCalledOnce();
});

it('reloads tab refusal on BFCache pageshow without reopening the remembered document', async () => {
  const options = optionsFor([campaign]);
  stop = start(options); document.querySelector('dialog')!.close();
  const { recoveryStore } = await import('../../modules/display-types/loader/recovery-state');
  // A later document in this tab dismisses the reminder, then Back restores this one.
  recoveryStore().stop(campaign);
  window.dispatchEvent(new Event('pageshow'));
  expect(document.querySelector('[data-wconvert-reopen]')).toBeNull();
});

it('a successfully shown ordinary overlay replaces dormant recovery', () => {
  const options = optionsFor([campaign]);
  stop = start(options); document.querySelector('dialog')!.close();
  stop(); document.body.innerHTML = '';
  options.entries = [{ ...campaign, id: '01JQ0000000000000000000002', teaser: undefined } as PayloadEntry];
  stop = start(options);
  expect(document.querySelector('dialog')!.open).toBe(true);
  expect(JSON.parse(sessionStorage.getItem(sessionStorage.key(0)!)!).active).toBeUndefined();
});

it('partial compact mobile overrides inherit the remaining desktop position', async () => {
  const { unpack } = await import('../../modules/display-types/loader/reopen');
  const { reminder } = await import('../../modules/display-types/loader/reminder');
  const entry = unpack({ ...campaign, teaser: ['Offer', 0, 48, null, null, [null, null, 24]] } as unknown as PayloadEntry);
  const view = reminder(entry.teaser!, {}); view.layout(true);
  expect(view.host.style.getPropertyValue('inset-block-start')).toContain('24px');
  expect(view.host.style.getPropertyValue('inset-inline-start')).toContain('24px');
});

it('closing successful content ends presentation even across responsive changes', async () => {
  const ui = shadowAccess();
  const changes: (() => void)[] = [];
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: (_: string, handler: () => void) => changes.push(handler), removeEventListener: vi.fn() }));
  const tag = document.createElement('script'); tag.id = 'wconvert-payload'; tag.setAttribute('data-capture', '/capture'); document.body.append(tag);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ id: 'lead', grant: 'grant' }) })));
  stop = start(optionsFor([campaign]));
  ui.roots.flatMap(root => [...root.querySelectorAll('form')])[0].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(ui.roots.some(root => root.textContent?.includes('Thank you'))).toBe(true));
  document.querySelector('dialog')!.close();
  changes.forEach(changed => changed());
  expect(document.querySelector('[data-wconvert-reopen]')).toBeNull();
});

it('uses server-translated reminder names and confirmation text as plain text', async () => {
  const { reminder } = await import('../../modules/display-types/loader/reminder');
  const tag = document.createElement('script'); tag.id = 'wconvert-payload'; tag.setAttribute('data-reopen', JSON.stringify(['یادآوری را ببندید', 'ارسال شد — مشاهده جزئیات'])); document.body.append(tag);
  const { reminderLabels } = await import('../../modules/display-types/loader/reopen');
  const view = reminder({ label: 'Offer <b>text</b>' }, {}, reminderLabels());
  expect(view.close.getAttribute('aria-label')).toBe('یادآوری را ببندید');
  expect(view.confirmation).toBe('ارسال شد — مشاهده جزئیات');
  expect(view.button.children).toHaveLength(0);
});
