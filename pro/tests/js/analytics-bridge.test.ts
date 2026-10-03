import { afterEach, expect, it, vi } from 'vitest';
import { observePresentation } from '../../modules/analytics/loader/bridge';
import type { OptinControls, PayloadEntry } from '../../../resources/loader/src/types';

const entry = { id: 'one' } as PayloadEntry;
const controls = (): OptinControls => ({ impression: vi.fn(), dismiss: vi.fn(), convert: vi.fn() });
afterEach(() => { delete window.__wcvObserve; vi.unstubAllGlobals(); });

it('keeps the presenter functional when analytics is absent or its observer fails', () => {
  const show = vi.fn();
  const session = observePresentation({ show });
  const acts = controls();
  session.show(entry, acts);
  expect(show).toHaveBeenCalledWith(entry, acts);
  window.__wcvObserve = () => { throw new Error('Broken observer'); };
  observePresentation({ show }).show(entry, acts);
  expect(show).toHaveBeenCalledTimes(2);
  acts.convert();
  expect(acts.convert).toHaveBeenCalledOnce();
});

it('installs wrappers only with the adapter and preserves actions when a tag throws', async () => {
  const element = document.createElement('script');
  element.type = 'application/json';
  element.id = 'wconvert-analytics-config';
  element.textContent = JSON.stringify({ route: 'gtag', measurement_id: 'G-TEST123', consent: 'site', dismissals: true,
    campaigns: { one: { campaign: 'one', goal: 'click', outcome: 'click', label: '' } } });
  document.head.append(element);
  const listeners = vi.spyOn(document, 'addEventListener');
  const tag = vi.fn(); vi.stubGlobal('gtag', tag);
  try {
    await import('../../modules/analytics/loader/main');
    if (!window.__wcvObserve) document.dispatchEvent(new Event('DOMContentLoaded'));
    const original = controls(); const acts = { ...original };
    observePresentation({ show: () => {} }).show(entry, acts);
    acts.impression(); acts.convert(); acts.dismiss();
    expect(tag.mock.calls.map(call => call[1])).toEqual(['wconvert_impression', 'wconvert_conversion', 'wconvert_dismiss']);
    tag.mockImplementation(() => { throw new Error('Tag failed'); });
    acts.convert();
    expect(original.convert).toHaveBeenCalledTimes(2);
    expect(original.impression).toHaveBeenCalledOnce();
    expect(original.dismiss).toHaveBeenCalledOnce();
  } finally {
    for (const [event, listener] of listeners.mock.calls) document.removeEventListener(event, listener);
    listeners.mockRestore(); element.remove();
  }
});
