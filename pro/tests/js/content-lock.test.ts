import { displayEntry } from '../../../tests/js/support/display-entry';
import { treeFixture } from '../../../tests/js/support/journey';
import { afterEach, expect, it, vi } from 'vitest';
import { start } from '@loader/shell';
import { createLoader } from '@loader/engine';
import { FREE_MODULES } from '@loader/modules';
import { proPresenter } from '../../modules/display-types/loader/present';

const campaign = displayEntry({
  id: '01JQ0000000000000000000001', display_type: 'inline', content_lock: { mode: 'hide' },
  triggers: [{ type: 'page_load' }], frequency: { stopAfterConversion: false },
  template: { tokens: {}, tree: treeFixture({ steps: [
    { type: 'stack', children: [{ type: 'field', name: 'email' }, { type: 'button', label: 'Unlock', action: 'submit' }] },
    { type: 'stack', children: [{ type: 'heading', text: 'Received' }] },
  ] }) },
});
let stop: (() => void) | undefined;
afterEach(() => { stop?.(); document.body.innerHTML = ''; localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function page() {
  document.body.innerHTML = `<script id="wconvert-payload" type="application/json" data-capture="/wp-json/wconvert/v1/capture">[]</script><div data-wconvert-content-lock="${campaign.id}"><div data-wconvert-optin="${campaign.id}"></div><div data-wconvert-locked-content><h2>Bonus</h2><a href="#download">Download</a></div></div>`;
  return document.querySelector<HTMLElement>('[data-wconvert-locked-content]')!;
}
function run() {
  const beacon = { report: vi.fn(), flush: vi.fn(), stop: vi.fn() };
  stop = start({ loader: createLoader(FREE_MODULES), entries: [campaign], presenter: proPresenter, beacon, store: { read: () => null, write() {} } });
  return beacon;
}
function formAccess() {
  const roots: ShadowRoot[] = [];
  const attach = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, options) {
    const root = attach.call(this, options); roots.push(root); return root;
  });
  return () => roots.flatMap(root => [...root.querySelectorAll('form')])[0];
}
function submit(form: HTMLFormElement) {
  form.querySelector('input')!.value = 'reader@example.com';
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
it('reveals only after acknowledged capture and remembers this campaign across documents without another conversion', async () => {
  const roots: ShadowRoot[] = [];
  const attach = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, options) {
    const root = attach.call(this, options); roots.push(root); return root;
  });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'lead', grant: 'grant' }) })));
  const content = page();
  const beacon = run();
  expect(content.hidden).toBe(true);
  const form = roots.flatMap(root => [...root.querySelectorAll('form')])[0];
  form.querySelector('input')!.value = 'reader@example.com';
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(content.hidden).toBe(false));
  expect(beacon.report.mock.calls.filter(call => call[1] === 'conversion')).toHaveLength(0);
  stop!();
  const next = page();
  const later = run();
  expect(next.hidden).toBe(false);
  expect(next.previousElementSibling!.childElementCount).toBe(0);
  expect(later.report).not.toHaveBeenCalled();
});

it.each([
  ['offline', () => Promise.reject(new Error('offline'))],
  ['missing acknowledgement', async () => ({ ok: true, status: 200, json: async () => ({}) })],
  ['rate limited', async () => ({ ok: false, status: 429, json: async () => ({ code: 'rate_limit' }) })],
])('leaves content readable on %s without claiming capture or remembering success', async (_label, response) => {
  const form = formAccess();
  vi.stubGlobal('fetch', vi.fn(response));
  const content = page(); const beacon = run();
  expect(content.hidden).toBe(true);
  submit(form());
  await vi.waitFor(() => expect(content.hidden).toBe(false));
  expect(form().textContent).toContain('could not be confirmed');
  expect(beacon.report.mock.calls.filter(call => call[1] === 'conversion')).toHaveLength(0);
  expect(localStorage.length).toBe(0);
});

it('retains the gate and field values on a correctable refusal, then permits an explicit retry', async () => {
  const form = formAccess();
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ code: 'wconvert_field_required', message: 'Email required', data: { field: 'email' } }) })
    .mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'lead', grant: 'grant' }) });
  vi.stubGlobal('fetch', fetch);
  const content = page(); run(); submit(form());
  await vi.waitFor(() => expect(form().textContent).toContain('Email required'));
  expect(content.hidden).toBe(true);
  expect(form().querySelector('input')!.value).toBe('reader@example.com');
  submit(form()); await vi.waitFor(() => expect(content.hidden).toBe(false));
});

it('opens on condition loss and does not re-lock when eligibility returns', () => {
  const content = page(); let allowed = true; let changed = () => {};
  stop = start({ loader: createLoader([...FREE_MODULES, { id: 'audience', kind: 'condition', consentCategory: null,
    create: (notify) => { changed = notify; return { holds: () => allowed }; } }]),
    entries: [displayEntry({ ...campaign, conditions: [{ type: 'audience' }] })], presenter: proPresenter, store: { read: () => null, write() {} } });
  expect(content.hidden).toBe(true);
  allowed = false; changed(); expect(content.hidden).toBe(false);
  allowed = true; changed(); expect(content.hidden).toBe(false);
});

it('does not take readable content away after initially withheld eligibility changes', () => {
  const content = page(); let allowed = false; let changed = () => {};
  stop = start({ loader: createLoader([...FREE_MODULES, { id: 'audience', kind: 'condition', consentCategory: null,
    create: (notify) => { changed = notify; return { holds: () => allowed }; } }]),
    entries: [displayEntry({ ...campaign, conditions: [{ type: 'audience' }] })], presenter: proPresenter, store: { read: () => null, write() {} } });
  expect(content.hidden).toBe(false);
  allowed = true; changed(); expect(content.hidden).toBe(false);
  expect(content.previousElementSibling!.childElementCount).toBe(0);
});

it('retains acknowledged capture when storage is unavailable', async () => {
  const form = formAccess();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'lead', grant: 'grant' }) })));
  const content = page(); const beacon = run(); submit(form());
  await vi.waitFor(() => expect(content.hidden).toBe(false));
  expect(beacon.report.mock.calls.filter(call => call[1] === 'conversion')).toHaveLength(0);
});

it('leaves a duplicate region readable and releases owned state on teardown', () => {
  const content = page();
  const duplicate = content.parentElement!.cloneNode(true) as HTMLElement;
  document.body.append(duplicate); run();
  expect(content.hidden).toBe(true);
  expect(duplicate.querySelector<HTMLElement>('[data-wconvert-locked-content]')!.hidden).toBe(false);
  stop!(); expect(content.hidden).toBe(false); expect(content.style.display).toBe('');
});

it('opens when a theme removes the mounted form', async () => {
  const content = page(); run(); expect(content.hidden).toBe(true);
  content.previousElementSibling!.replaceChildren();
  await vi.waitFor(() => expect(content.hidden).toBe(false));
});

it('honors an earlier ordinary anchor without gating the later content region', async () => {
  const form = formAccess();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'lead', grant: 'grant' }) })));
  const content = page(); const anchor = document.createElement('div');
  anchor.setAttribute('data-wconvert-optin', campaign.id); document.body.prepend(anchor);
  run(); expect(content.hidden).toBe(false); expect(anchor.childElementCount).toBe(1);
  submit(form()); await vi.waitFor(() => expect(localStorage.length).toBe(1));
});

it('retains an in-flight acknowledgement after eligibility loss without reopening the form', async () => {
  const form = formAccess(); const content = page(); let allowed = true; let changed = () => {};
  let resolve!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise(done => { resolve = done; })).mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'grant' }) }));
  const beacon = { report: vi.fn(), flush: vi.fn(), stop: vi.fn() };
  stop = start({ loader: createLoader([...FREE_MODULES, { id: 'audience', kind: 'condition', consentCategory: null,
    create: (notify) => { changed = notify; return { holds: () => allowed }; } }]),
    entries: [displayEntry({ ...campaign, conditions: [{ type: 'audience' }] })], presenter: proPresenter, beacon, store: { read: () => null, write() {} } });
  submit(form()); await vi.waitFor(() => expect(resolve).toBeTypeOf('function')); allowed = false; changed();
  expect(content.hidden).toBe(false); expect(form().isConnected).toBe(false);
  resolve({ ok: true, status: 200, json: async () => ({ id: 'lead', grant: 'grant' }) });
  await vi.waitFor(() => expect(localStorage.length).toBe(1));
  expect(beacon.report.mock.calls.filter(call => call[1] === 'conversion')).toHaveLength(0);
});

it.each([true, false])('never opens another Campaign’s gate when an ordinary form settles (success: %s)', async success => {
  const form = formAccess();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: success, status: success ? 200 : 503, json: async () => success ? { id: 'lead', grant: 'grant' } : {} })));
  const content = page();
  const other = { ...campaign, id: '01JQ0000000000000000000002' };
  const anchor = document.createElement('div'); anchor.setAttribute('data-wconvert-optin', other.id); document.body.prepend(anchor);
  stop = start({ loader: createLoader(FREE_MODULES), entries: [campaign, other], presenter: proPresenter, store: { read: () => null, write() {} } });
  expect(content.hidden).toBe(true); submit(form());
  await vi.waitFor(() => success ? expect(localStorage.length).toBe(1) : expect(form().textContent).toContain('Submission not confirmed'));
  expect(content.hidden).toBe(true);
});

it('opens at the schedule boundary and never relocks on a page restore', async () => {
  vi.useFakeTimers(); const content = page();
  stop = start({ loader: createLoader(FREE_MODULES), entries: [{ ...campaign, ends_at: Date.now() + 1000 }], presenter: proPresenter, store: { read: () => null, write() {} } });
  expect(content.hidden).toBe(true); await vi.advanceTimersByTimeAsync(1001); expect(content.hidden).toBe(false);
  window.dispatchEvent(new Event('pageshow')); expect(content.hidden).toBe(false);
  vi.useRealTimers();
});

it('opens for a cross-tab receipt without reporting another conversion', async () => {
  const { unlockStore } = await import('../../modules/content-lock/loader/state');
  const content = page(); const beacon = run(); const store = unlockStore(); store.remember(campaign.id);
  window.dispatchEvent(new StorageEvent('storage', { key: store.key }));
  expect(content.hidden).toBe(false);
  expect(beacon.report.mock.calls.filter(call => call[1] === 'conversion')).toHaveLength(0);
});

it('never hides focused content or nested content regions', () => {
  const content = page(); content.querySelector('a')!.focus(); run(); expect(content.hidden).toBe(false); stop!();
  const outer = page(); outer.append(outer.parentElement!.cloneNode(true)); run();
  for (const region of document.querySelectorAll<HTMLElement>('[data-wconvert-locked-content]')) expect(region.hidden).toBe(false);
});
