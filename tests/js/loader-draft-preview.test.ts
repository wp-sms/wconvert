import { describe, expect, it } from 'vitest';
import { decide } from '@loader/decide';
import type { PayloadEntry, VisitorState } from '@loader/types';

/**
 * A draft preview (ADR 0151) is a payload entry, not a loader mode.
 *
 * `DraftPreview::shownNow()` rewrites the draft before it is projected: no
 * schedule, a frequency nothing can stop, everyone, opening immediately. These
 * prove that rewrite is enough for the unchanged loader to show it on a device
 * that has already dismissed, converted on and used up the live campaign.
 */

const ID = '01JQ0000000000000000000001';
const DAY = 20_000;
const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);

/** Exactly the shape the projection gives a previewed draft. */
const preview: PayloadEntry = {
  id: ID,
  display_type: 'popup',
  frequency: { stopAfterDismiss: false, stopAfterConversion: false },
  display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'immediate' } },
};

/** This device saw it today, closed it, and submitted it. */
const spent: VisitorState = { [ID]: { i: 3, l: DAY, d: 1, c: 1 } };

const standing = (entry: PayloadEntry, state: VisitorState) => decide({
  entries: [entry],
  evaluators: new Map(),
  withheld: new Set<string>(),
  state,
  day: DAY,
  now: NOW,
  shown: new Set<string>(),
  overlayDone: false,
  // The whole site's allowance is spent too. The preview prints none.
  siteFrequency: undefined,
}).candidates[0].standing;

describe('a draft preview', () => {
  it('shows on a device that dismissed, converted on and was capped by the campaign', () => {
    expect(standing(preview, spent)).toBe('ready');
  });

  it('is held back by that same device without the rewrite', () => {
    // The control: the state above really does stop an ordinary entry, so
    // the case above is the rewrite working rather than the state doing nothing.
    expect(standing({ ...preview, frequency: { cooldownDays: 30 } }, spent)).toBe('capped');
    expect(standing({ ...preview, frequency: undefined }, spent)).toBe('capped');
  });

  it('is held back by a schedule it no longer carries', () => {
    // A window that closed last year, and one that opens next year. The
    // projection drops both from a preview, which is what this proves it must.
    expect(standing({ ...preview, ends_at: NOW - 1 }, {})).toBe('capped');
    expect(standing({ ...preview, starts_at: NOW + 1 }, {})).toBe('waiting');
  });
});
