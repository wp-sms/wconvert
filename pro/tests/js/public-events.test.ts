import { afterEach, expect, it, vi } from 'vitest';
import { proPresenter } from '../../modules/display-types/loader/present';
import { premiumCaptureInto } from '../../modules/journeys/loader';
import { mount } from '@renderer/mount';
import type { Template } from '@renderer/types';
import guide from '../../modules/journeys/templates/journey-content-guide.json';
import { resultAccess } from '../../../resources/admin/src/builder/structure/journey';
import { mountPopover } from '../../modules/display-types/loader/popover';
import { campaignLifecycle } from '@loader/events';
import { showReopen } from '../../modules/display-types/loader/reopen';

const listeners: Array<() => void> = [];
function listen() {
  const events: CustomEvent[] = [];
  for (const kind of ['open', 'close', 'capture']) {
    const handler = (e: Event) => { events.push(e as CustomEvent); };
    document.addEventListener(`wconvert:${kind}`, handler);
    listeners.push(() => document.removeEventListener(`wconvert:${kind}`, handler));
  }
  return events;
}
const controls = () => ({ impression: vi.fn(), dismiss: vi.fn(), convert: vi.fn() });
afterEach(() => {
  listeners.splice(0).forEach(stop => stop()); document.body.replaceChildren();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

it.each(['floating_bar', 'slide_in', 'fullscreen'])('reports %s transitions only after opening / hiding', (display_type) => {
  vi.useFakeTimers();
  const events = listen();
  const roots: ShadowRoot[] = [];
  const attach = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, options) {
    const root = attach.call(this, options); roots.push(root); return root;
  });
  proPresenter.show({ id: 'paid', display_type, template: guide as Template }, controls());
  expect(events.map(e => e.type)).toEqual(['wconvert:open']);
  roots[0].querySelector<HTMLButtonElement>('.wc-close')!.click();
  if (display_type !== 'fullscreen') expect(events.map(e => e.type)).toEqual(['wconvert:open']);
  vi.runAllTimers();
  expect(events.map(e => e.type)).toEqual(['wconvert:open', 'wconvert:close']);
});

it.each([false, true])('reports quiz contact capture independently of result conversion (capture first: %s)', async (first) => {
  const events = listen();
  document.body.innerHTML = '<script id="wconvert-payload" data-capture="/capture"></script><div id="anchor"></div>';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'private' }) })
    .mockResolvedValue({ ok: true, json: async () => ({ id: 'private-lead' }) }));
  const template = { ...guide, tree: resultAccess((guide as Template).tree, first) } as Template;
  const mounted = mount({ template, displayType: 'inline', anchor: document.querySelector('#anchor') });
  mounted.show(); const counts = controls();
  premiumCaptureInto(mounted, { id: 'quiz', display_type: 'inline', template }, counts);
  const act = (action: string) => mounted.root!.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  mounted.root!.querySelector<HTMLInputElement>('input[value="grow"]')!.click(); act('next');
  if (!first) { expect(counts.convert).toHaveBeenCalledOnce(); act('next'); }
  expect(events).toHaveLength(0);
  mounted.root!.querySelector<HTMLInputElement>('[name="email"]')!.value = 'reader@example.com';
  const consent = mounted.root!.querySelector<HTMLInputElement>('[name="consent"]');
  if (consent) consent.checked = true;
  act('submit');
  await vi.waitFor(() => expect(events.map(e => e.type)).toEqual(['wconvert:capture']));
  expect(counts.convert).toHaveBeenCalledOnce();
});

it('does not publish a stale close when a slide-in reopens during its closing animation', () => {
  vi.useFakeTimers(); const events = listen();
  const mounted = mountPopover({ template: guide as Template, displayType: 'slide_in', ...campaignLifecycle({ id: 'slide', display_type: 'slide_in' }) });
  mounted.show(); mounted.show();
  mounted.root!.querySelector<HTMLButtonElement>('.wc-close')!.click();
  mounted.show(); vi.runAllTimers();
  expect(events.map(e => e.type)).toEqual(['wconvert:open']);
  expect(document.querySelector('.wcv-p')?.isConnected).toBe(true);
  mounted.root!.querySelector<HTMLButtonElement>('.wc-close')!.click();
  vi.runAllTimers(); mounted.close();
  expect(events.map(e => e.type)).toEqual(['wconvert:open', 'wconvert:close']);
});

it('keeps restored reminders silent, and reports every complete open/close cycle', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const events = listen();
  const view = showReopen({ id: 'reminder', display_type: 'popup', template: guide as Template, teaser: { label: 'Read more' } }, controls(), {
    restoring: true, allowed: () => true, minimized: vi.fn(), stopped: vi.fn(), opened: vi.fn(),
  });
  expect(events).toHaveLength(0); expect(view).not.toBe(false);
  if (!view) return;
  view.open(); view.open(); document.querySelector('dialog')!.close();
  view.open(); view.dispose(); view.dispose();
  expect(events.map(e => e.type)).toEqual(['wconvert:open', 'wconvert:close', 'wconvert:open', 'wconvert:close']);
});
