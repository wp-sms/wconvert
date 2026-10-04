import { registerLeafRenderer } from '@renderer/render';
import type { RuleEvaluator } from '@loader/types';
import type * as Commerce from './context';
import { cookieMatches } from './cart';

/** A shared browser module is fetched only on pages with a commerce projection. */
export function createCartEvaluator(changed: () => void): RuleEvaluator {
  let runtime: typeof Commerce | undefined, stop: (() => void) | undefined, stopped = false, status = 'pending';
  const url = document.getElementById('wconvert-payload')?.getAttribute('data-commerce-runtime');
  if (url) void import(/* @vite-ignore */ url).then((module: typeof Commerce) => {
    if (stopped) return;
    runtime = module; registerLeafRenderer(module.renderProductNode);
    stop = module.watchCart(changed); changed();
  }).catch(() => { status = 'unavailable'; changed(); });
  return {
    holds: rule => rule.context_key ? runtime?.cartMatch(rule.context_key) ?? false : cookieMatches(rule),
    diagnostic: () => runtime?.contextStatus() ?? (url ? status : ''),
    stop: url ? () => { stopped = true; stop?.(); } : undefined,
  };
}
