import { __ } from '@wordpress/i18n';
import type { RuleGroup } from '@loader/display-rules';
import type { Rule, RuleType } from '../api';

/**
 * The numbers a rule may hold — read by the section summaries through
 * {@link groupProblems} and by the Quick picks' inline fields, so the chip and
 * Readiness agree on what is out of range. Kept in parity with DisplayPlan.php.
 */
export const NUMBER_BOUNDS = {
  seconds: { min: 1, max: 3600, whole: false },
  percent: { min: 1, max: 100, whole: true },
} as const;

/** Publication requirements that can be answered without saving or reading a visitor. */
export function groupProblems(group: RuleGroup, types: readonly RuleType[]): string[] {
  const problems: string[] = [];
  for (const row of group.rules) {
    const rule = row as Rule;
    const type = types.find(item => item.type === rule.type);
    if (!type) { problems.push(__('This rule is unavailable.', 'wconvert')); continue; }
    for (const [key, param] of Object.entries(type.params)) {
      const value = rule[key];
      if (rule.type === 'query_param' && key === 'value' && (value === undefined || (Array.isArray(value) && !value.length))) continue;
      let valid = value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
      if (valid) {
        if (param.control === 'enum') valid = typeof value === 'string' && param.options.some(option => option.value === value);
        if (param.control === 'seconds' || param.control === 'percent') {
          const bounds = NUMBER_BOUNDS[param.control];
          valid = typeof value === 'number' && Number.isFinite(value) && value >= bounds.min && value <= bounds.max && (!bounds.whole || Number.isInteger(value));
        }
        if (param.control === 'amount') valid = typeof value === 'number' && Number.isFinite(value) && value >= 0;
        if (param.control === 'selector') { valid = portableSelector(String(value)); }
        if (param.control === 'hours') valid = typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
      }
      if (valid && ['product_set', 'category_set'].includes(param.control)) valid = Array.isArray(value) && value.length <= 20 && value.every(id => Number.isInteger(id) && Number(id) > 0) && new Set(value).size === value.length;
      if (valid && ['quantity_range', 'money_range'].includes(param.control)) valid = validRange(value, param.control === 'money_range');
      if (!valid) problems.push(`${type.label}: ${param.label} — ${__('enter a valid value', 'wconvert')}`);
    }
  }
  if (group.match === 'all') {
    const gestures = group.rules.filter(rule => ['exit_intent', 'scroll_up'].includes(rule.type));
    if (gestures.length > 1 || (gestures.length > 0 && group.rules.some(rule => rule.type === 'inactivity'))) problems.push(__('Use ANY for alternative gestures. Inactivity and a leaving gesture cannot be required together.', 'wconvert'));
    const devices = group.rules.filter(rule => rule.type === 'device' && Array.isArray(rule.in)).map(rule => rule.in as string[]);
    const logins = group.rules.filter(rule => rule.type === 'logged_in').map(rule => rule.value);
    const adStatuses = group.rules.filter(rule => rule.type === 'ad_blocking').map(rule => rule.value);
    if (adStatuses.includes('detected') && adStatuses.includes('not_detected')) problems.push(__('Ad blocking cannot be both detected and not detected. Use ANY or change the values.', 'wconvert'));
    if ((devices.length > 1 && !devices.reduce((left, right) => left.filter(value => right.includes(value))).length) || (logins.includes(true) && logins.includes(false))) problems.push(__('These audience requirements contradict each other. Use ANY or change the values.', 'wconvert'));
  }
  return problems;
}

/** Kept in parity with DisplayPlan::validSelector by the shared selector cases. */
export function portableSelector(value: string): boolean {
  const name = '[a-zA-Z_][a-zA-Z0-9_-]*';
  const attribute = String.raw`\[${name}(?:\s*(?:[~|^$*]?=)\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[a-zA-Z0-9_-]+))?\s*\]`;
  const atom = `(?:[.#]${name}|${attribute})`;
  const compound = `(?:(?:${name}|\\*)${atom}*|${atom}+)`;
  if (value.length > 512 || !new RegExp(`^\\s*${compound}(?:\\s*(?:[>+~,]\\s*|\\s+)${compound})*\\s*$`).test(value)) return false;
  try { document.querySelector(value); return true; } catch { return false; }
}

export function validRange(value: unknown, money: boolean): boolean {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9;
  if (!['min', 'max', 'between'].includes(String(r.operator)) || !number(r.min)) return false;
  if (r.operator === 'between' && (!number(r.max) || r.max < r.min)) return false;
  const decimals = money ? Number(r.decimals) : 0;
  if (money && (typeof r.currency !== 'string' || !/^[A-Z]{3}$/.test(r.currency) || !Number.isInteger(r.decimals) || decimals < 0 || decimals > 6)) return false;
  return [r.min, ...(r.operator === 'between' ? [r.max as number] : [])].every(n => Math.abs(n - Number(n.toFixed(decimals))) < 1e-9);
}
