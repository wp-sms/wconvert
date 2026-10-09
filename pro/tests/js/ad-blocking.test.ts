import { afterEach, describe, expect, it, vi } from 'vitest';
import { adBlocking } from '../../modules/premium-triggers/loader/ad-blocking';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function start() {
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { width: this.isConnected ? 10 : 0, height: this.isConnected ? 10 : 0 } as DOMRect;
  });
  const changed = vi.fn();
  const evaluator = adBlocking.create(changed);
  const detected = { type: 'ad_blocking', value: 'detected' };
  const clear = { type: 'ad_blocking', value: 'not_detected' };
  return { evaluator, changed, detected, clear };
}

describe('bounded ad-block observation', () => {
  it('matches not detected only after three valid clear samples', () => {
    const { evaluator, changed, detected, clear } = start();
    expect(evaluator.holds(clear)).toBe(false);
    vi.advanceTimersByTime(760);
    expect(evaluator.diagnostic?.()).toBe('not_detected');
    expect(evaluator.holds(clear)).toBe(true);
    expect(evaluator.holds(detected)).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.adsbox')).toBeNull();
  });

  it('detects selective bait hiding while the neutral element stays measurable', () => {
    const { evaluator, changed, detected, clear } = start();
    (document.querySelector('.adsbox') as HTMLElement).style.display = 'none';
    vi.advanceTimersByTime(760);
    expect(evaluator.diagnostic?.()).toBe('detected');
    expect(evaluator.holds(detected)).toBe(true);
    expect(evaluator.holds(clear)).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('returns unknown when the neutral control is removed', () => {
    const { evaluator, changed, detected, clear } = start();
    document.querySelector('.adsbox')?.previousElementSibling?.remove();
    vi.advanceTimersByTime(760);
    expect(evaluator.diagnostic?.()).toBe('unknown');
    expect(evaluator.holds(detected)).toBe(false);
    expect(evaluator.holds(clear)).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('does not turn mixed clear and blocked samples into a detection', () => {
    const { evaluator, detected, clear } = start();
    vi.advanceTimersByTime(60);
    (document.querySelector('.adsbox') as HTMLElement).style.display = 'none';
    vi.advanceTimersByTime(700);
    expect(evaluator.diagnostic?.()).toBe('unknown');
    expect(evaluator.holds(detected)).toBe(false);
    expect(evaluator.holds(clear)).toBe(false);
  });

  it('settles unknown and removes bait when the page becomes hidden', () => {
    const { evaluator, changed } = start();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(evaluator.diagnostic?.()).toBe('unknown');
    expect(document.querySelector('.adsbox')).toBeNull();
    vi.advanceTimersByTime(1100);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('cleans up on stop without notifying the decision engine', () => {
    const { evaluator, changed } = start();
    evaluator.stop?.();
    vi.advanceTimersByTime(1100);
    expect(changed).not.toHaveBeenCalled();
    expect(document.querySelector('.adsbox')).toBeNull();
  });
});
