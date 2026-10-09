import { afterEach, expect, it, vi } from 'vitest';
import { templatePresenter, captureInto } from '@loader/present';
import { mount } from '@renderer/mount';
import { campaignLifecycle } from '@loader/events';
import type { Template } from '@renderer/types';
import source from '../../resources/templates/library/journey-email-then-sms.json';

const template = source as Template;
const controls = () => ({ impression: vi.fn(), dismiss: vi.fn(), convert: vi.fn() });
const listeners: Array<() => void> = [];
function listen() {
  const events: CustomEvent[] = [];
  for (const name of ['open', 'close', 'capture']) {
    const type = `wconvert:${name}`;
    const handler = (event: Event) => { events.push(event as CustomEvent); };
    document.addEventListener(type, handler);
    listeners.push(() => document.removeEventListener(type, handler));
  }
  return events;
}
afterEach(() => {
  listeners.splice(0).forEach(stop => stop());
  document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('notifies the document when a live popup opens and closes, with campaign and design IDs', () => {
  const events = listen();
  templatePresenter.show({ id: 'variant', campaign: 'parent', display_type: 'popup', template }, controls());
  document.querySelector('dialog')!.close();
  expect(events.map(event => event.type)).toEqual(['wconvert:open', 'wconvert:close']);
  expect(events[0].detail).toEqual({ campaignId: 'parent', optinId: 'variant', displayType: 'popup' });
  expect(Object.isFrozen(events[0].detail)).toBe(true);
  expect(events[0].cancelable).toBe(false);
});

it('notifies capture once after accepted email, not again for optional SMS or screen changes', async () => {
  const events = listen();
  document.body.innerHTML = '<script id="wconvert-payload" data-capture="/capture"></script><div id="anchor"></div>';
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'secret' }) })
    .mockResolvedValue({ ok: true, json: async () => ({ id: 'private-lead' }) });
  vi.stubGlobal('fetch', fetcher);
  const mounted = mount({ template, displayType: 'inline', anchor: document.querySelector('#anchor') });
  mounted.show();
  const counts = controls();
  captureInto(mounted, { id: 'campaign', display_type: 'inline', template }, counts);
  const submit = async (name: string, value: string) => {
    mounted.root!.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value = value;
    mounted.root!.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
    mounted.root!.querySelector<HTMLButtonElement>('[data-action="submit"]')!.click();
    for (let i = 0; i < 15; i++) await Promise.resolve();
  };
  await submit('email', 'reader@example.com');
  await submit('phone', '+12025551234');
  expect(events.map(event => event.type)).toEqual(['wconvert:capture']);
  expect(events[0].detail).toEqual({ campaignId: 'campaign', optinId: 'campaign', displayType: 'inline' });
  expect(counts.convert).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('ignores duplicate and stale dialog close callbacks without hiding a reopened campaign', () => {
  const events = listen();
  const mounted = mount({ template, ...campaignLifecycle({ id: 'popup' }) });
  mounted.show(); mounted.show(); mounted.showStep(1);
  mounted.close(); mounted.close(); mounted.show();
  document.querySelector('dialog')!.dispatchEvent(new Event('close'));
  expect(document.querySelector('dialog')!.open).toBe(true);
  expect(document.querySelector('dialog')!.style.display).toBe('block');
  expect(events.map(e => e.type)).toEqual(['wconvert:open', 'wconvert:close', 'wconvert:open']);
  mounted.close();
});

it('keeps bare renderer previews and failed mounts silent', () => {
  const events = listen();
  const preview = mount({ template }); preview.show(); preview.showStep(1); preview.close();
  templatePresenter.show({ id: 'missing' }, controls());
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => { throw new Error('unavailable'); });
  expect(() => templatePresenter.show({ id: 'failed', template }, controls())).toThrow('unavailable');
  expect(events).toEqual([]);
});

it('does not let an event listener exception or preventDefault cancel a live campaign', () => {
  const prevent = (event: Event) => { event.preventDefault(); throw new Error('external listener'); };
  const errors = (event: ErrorEvent) => { event.preventDefault(); };
  document.addEventListener('wconvert:open', prevent);
  window.addEventListener('error', errors);
  try {
    const events = listen(); const counts = controls();
    templatePresenter.show({ id: 'form', template }, counts);
    expect(document.querySelector('dialog')!.open).toBe(true);
    expect(counts.impression).toHaveBeenCalledOnce();
    expect(events[0].defaultPrevented).toBe(false);
    document.querySelector('dialog')!.close();
    expect(events.map(e => e.type)).toEqual(['wconvert:open', 'wconvert:close']);
  } finally {
    document.removeEventListener('wconvert:open', prevent); window.removeEventListener('error', errors);
  }
});

it.each(['rejected', 'malformed', 'network'])('does not notify an unconfirmed capture (%s), then notifies a successful retry once', async (kind) => {
  const events = listen();
  document.body.innerHTML = '<script id="wconvert-payload" data-capture="/capture"></script><div id="anchor"></div>';
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'secret' }) });
  if (kind === 'network') fetcher.mockRejectedValueOnce(new TypeError('offline'));
  else fetcher.mockResolvedValueOnce({ ok: kind === 'malformed', json: async () => ({}) });
  fetcher.mockResolvedValue({ ok: true, json: async () => ({ id: 'lead' }) }); vi.stubGlobal('fetch', fetcher);
  const mounted = mount({ template, displayType: 'inline', anchor: document.querySelector('#anchor') }); mounted.show();
  captureInto(mounted, { id: 'form', template, display_type: 'inline' }, controls());
  mounted.root!.querySelector<HTMLInputElement>('[name="email"]')!.value = 'reader@example.com';
  mounted.root!.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
  const button = mounted.root!.querySelector<HTMLButtonElement>('[data-action="submit"]')!;
  button.click(); button.click();
  for (let i = 0; i < 15; i++) await Promise.resolve();
  expect(events).toEqual([]);
  button.click();
  for (let i = 0; i < 15; i++) await Promise.resolve();
  expect(events.map(e => e.type)).toEqual(['wconvert:capture']);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('notifies accepted capture even while hidden and before a failed acknowledgement render', async () => {
  const events = listen();
  document.body.innerHTML = '<script id="wconvert-payload" data-capture="/capture"></script>';
  let accept!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'secret' }) })
    .mockImplementationOnce(() => new Promise(resolve => { accept = resolve; })));
  const mounted = mount({ template, ...campaignLifecycle({ id: 'form' }) }); mounted.show();
  captureInto(mounted, { id: 'form', template }, controls());
  mounted.root!.querySelector<HTMLInputElement>('[name="email"]')!.value = 'reader@example.com';
  mounted.root!.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="submit"]')!.click();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  mounted.close();
  vi.spyOn(mounted, 'showStep').mockImplementation(() => { throw new Error('render failed'); });
  accept({ ok: true, json: async () => ({ id: 'lead' }) });
  for (let i = 0; i < 15; i++) await Promise.resolve();
  expect(events.map(e => e.type)).toEqual(['wconvert:open', 'wconvert:close', 'wconvert:capture']);
  expect(document.querySelector('dialog')!.open).toBe(false);
});
