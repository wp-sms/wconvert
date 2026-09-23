import { __ } from '@wordpress/i18n';
import type { RuleGroup } from '@loader/display-rules';
import type { Rule, RuleType } from '../api';

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
        if (['seconds', 'percent', 'amount'].includes(param.control)) valid = typeof value === 'number' && Number.isFinite(value) && value >= (param.control === 'amount' ? 0 : 1)
          && (param.control === 'amount' || value <= (param.control === 'seconds' ? 3600 : 100)) && (param.control !== 'percent' || Number.isInteger(value));
        if (param.control === 'selector') { valid = portableSelector(String(value)); }
        if (param.control === 'hours') valid = typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
      }
      if (!valid) problems.push(`${type.label}: ${param.label} — ${__('enter a valid value', 'wconvert')}`);
    }
  }
  if (group.match === 'all') {
    const gestures = group.rules.filter(rule => ['exit_intent', 'scroll_up'].includes(rule.type));
    if (gestures.length > 1 || (gestures.length > 0 && group.rules.some(rule => rule.type === 'inactivity'))) problems.push(__('Use ANY for alternative gestures. Inactivity and a leaving gesture cannot be required together.', 'wconvert'));
    const devices = group.rules.filter(rule => rule.type === 'device' && Array.isArray(rule.in)).map(rule => rule.in as string[]);
    const logins = group.rules.filter(rule => rule.type === 'logged_in').map(rule => rule.value);
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
