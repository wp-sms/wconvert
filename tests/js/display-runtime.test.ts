import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { start } from '@loader/shell';
import { FREE_MODULES } from '@loader/modules';
import { createLoader } from '@loader/engine';
import type { OptinControls, PayloadEntry } from '@loader/types';
import { inactivity } from '@loader/modules/inactivity';
import { exitIntent } from '../../pro/modules/premium-triggers/loader/exit-intent';
import { clickElement } from '../../pro/modules/premium-triggers/loader/click-element';
import { sessionCounts, SESSION_KEY } from '@loader/session-counts';

const immediate: PayloadEntry = { id: 'a', display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'immediate' } } };
let stop: (() => void) | undefined;
beforeEach(() => { sessionStorage.clear(); document.body.innerHTML = ''; vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] }); });
afterEach(() => { stop?.(); vi.restoreAllMocks(); vi.useRealTimers(); });
const store = { read: () => null, write: () => {} };
function run(entry: PayloadEntry, modules = FREE_MODULES) {
  const show = vi.fn((_entry: PayloadEntry, controls: OptinControls) => { controls.impression(); });
  stop = start({ entries: [entry], loader: createLoader(modules), presenter: { show }, store });
  return show;
}
describe('integrated display timing', () => {
  it('wakes an immediate campaign when its future schedule starts', () => {
    const show = run({ ...immediate, starts_at: Date.now() + 1000 });
    expect(show).not.toHaveBeenCalled(); vi.advanceTimersByTime(1000); expect(show).toHaveBeenCalledOnce();
  });
  it('does not replay an early exit when minimum dwell is reached', () => {
    const show = run({ ...immediate, display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'automatic', match: 'all', minimum_seconds: 15, rules: [{ type: 'exit_intent' }] } } }, [...FREE_MODULES, exitIntent]);
    document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0 })); vi.advanceTimersByTime(15000);
    expect(show).not.toHaveBeenCalled(); document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0 })); expect(show).toHaveBeenCalledOnce();
  });
  it('resets inactivity on activity and never counts hidden time', () => {
    let hidden = false; vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const show = run({ ...immediate, display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'automatic', match: 'all', rules: [{ type: 'inactivity', seconds: 10 }] } } }, [inactivity]);
    vi.advanceTimersByTime(9000); window.dispatchEvent(new Event('pointermove')); vi.advanceTimersByTime(9000); expect(show).not.toHaveBeenCalled();
    hidden = true; document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(30000);
    hidden = false; document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(9999); expect(show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(show).toHaveBeenCalledOnce();
  });
  it('click activation bypasses dismissal pacing, never queues, and can reopen after closing', () => {
    document.body.innerHTML = '<button class="offer">Offer</button>';
    const entry: PayloadEntry = { ...immediate, display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'click', rules: [{ type: 'click_element', selector: '.offer' }] } } };
    const show = run(entry, [clickElement]); const button = document.querySelector('button')!;
    button.click(); expect(show).toHaveBeenCalledOnce(); button.click(); expect(show).toHaveBeenCalledOnce();
    show.mock.calls[0][1].dismiss(); button.click(); expect(show).toHaveBeenCalledTimes(2);
  });
  it('shares the session allowance across A/B arms and navigation', () => {
    const first = run({ ...immediate, campaign: 'family', frequency: { maxPerSession: 1 } }); expect(first).toHaveBeenCalledOnce(); stop!();
    const second = run({ ...immediate, id: 'b', campaign: 'family', frequency: { maxPerSession: 1 } }); expect(second).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(SESSION_KEY)!)).toEqual({ family: 1 });
  });
  it('bounds the session record and retains document pacing when storage is denied', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const counts = sessionCounts(); for (let index = 0; index < 130; index++) counts.increment(String(index));
    expect(Object.keys(counts.read())).toHaveLength(128); expect(counts.read()['0']).toBeUndefined(); expect(counts.read()['129']).toBe(1);
  });
});
