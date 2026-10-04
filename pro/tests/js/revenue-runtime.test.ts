import { afterEach, expect, it, vi } from 'vitest';
import { startRevenue } from '../../modules/analytics/loader/revenue';
import type { PresentationSession } from '../../../resources/loader/src/types';
afterEach(() => { vi.unstubAllGlobals(); delete window.__wcvRevenue; delete window.__wcvRevenueResult; });
it('records only a consented converting click or quiz result link and preserves the action', () => {
  const send = vi.fn().mockResolvedValue({}); vi.stubGlobal('fetch', send);
  vi.stubGlobal('wp_consent_type', 'optin'); vi.stubGlobal('wp_has_consent', () => true);
  startRevenue({ endpoint: '/tracking', campaigns: {
    offer: { campaign: 'offer', outcome: 'click', label: 'Offer', goal: 'promote_offer' },
    quiz: { campaign: 'quiz', outcome: 'quiz', label: 'Quiz', goal: 'find_match' },
  } });
  const convert = vi.fn();
  const session = { show: vi.fn((_entry, controls) => { controls.convert(); }) } as unknown as PresentationSession;
  const observed = window.__wcvRevenue!(session);
  observed.show({ id: 'offer' } as Parameters<PresentationSession['show']>[0], { convert, impression: vi.fn(), dismiss: vi.fn() });
  expect(convert).toHaveBeenCalledOnce(); expect(send).toHaveBeenCalledOnce();
  observed.show({ id: 'quiz' } as Parameters<PresentationSession['show']>[0], { convert, impression: vi.fn(), dismiss: vi.fn() });
  expect(send).toHaveBeenCalledOnce();
  window.__wcvRevenueResult!('quiz'); expect(send).toHaveBeenCalledTimes(2);
  vi.stubGlobal('wp_has_consent', () => false);
  window.__wcvRevenueResult!('quiz'); expect(send).toHaveBeenCalledTimes(2);
  document.dispatchEvent(new Event('wp_listen_for_consent_change'));
  expect(send.mock.calls[2][1].body.get('clear')).toBe('1');
});
it('unknown consent creates no attribution', () => {
  const send = vi.fn().mockResolvedValue({}); vi.stubGlobal('fetch', send);
  startRevenue({ endpoint: '/tracking', campaigns: { quiz: { campaign: 'quiz', outcome: 'quiz', label: 'Quiz', goal: 'find_match' } } });
  window.__wcvRevenueResult!('quiz');
  expect(send).toHaveBeenCalledOnce(); expect(send.mock.calls[0][1].body.get('clear')).toBe('1');
});

it('generates a one-use event on HTTP sites without randomUUID', () => {
  const send = vi.fn().mockResolvedValue({}); vi.stubGlobal('fetch', send);
  vi.stubGlobal('wp_consent_type', 'optin'); vi.stubGlobal('wp_has_consent', () => true);
  vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(1) });
  startRevenue({ endpoint: '/tracking', campaigns: { quiz: { campaign: 'quiz', outcome: 'quiz', label: 'Quiz', goal: 'find_match' } } });
  window.__wcvRevenueResult!('quiz');
  expect(send.mock.calls[0][1].body.get('event')).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
