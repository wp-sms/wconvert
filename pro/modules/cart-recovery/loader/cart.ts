import type { Rule } from '@loader/types';
/** Existing count/total rules use the session cookie when no rich context is needed. */
export function cookieMatches(rule: Rule): boolean {
  try {
    const raw = document.cookie.match(/(?:^|; )wconvert_cart=([^;]*)/);
    const parts = decodeURIComponent(raw?.[1] ?? '').split(':');
    const count = Number(parts[0]), total = Number(parts[1]);
    if (parts.length !== 2 || !parts[0] || !parts[1] || !Number.isFinite(count) || !Number.isFinite(total) || count <= 0) return false;
    return rule.type === 'cart_has_items' || (rule.type === 'cart_value_min' && typeof rule.amount === 'number' && Number.isFinite(rule.amount) && total >= rule.amount);
  } catch { return false; }
}
