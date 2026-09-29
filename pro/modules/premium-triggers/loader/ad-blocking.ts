import type { LoaderModule, Rule } from '@loader/types';
import { probeAdBlocking, type AdBlockStatus } from './ad-block-probe';

export const adBlocking: LoaderModule = {
  id: 'ad_blocking',
  kind: 'condition',
  consentCategory: null,
  create(changed) {
    let status: AdBlockStatus = 'pending';
    const stop = probeAdBlocking(next => { status = next; changed(); });
    return {
      holds(rule: Rule) { return status !== 'pending' && status !== 'unknown' && rule.value === status; },
      diagnostic() { return status; },
      stop,
    };
  },
};
