import { __, sprintf } from '@wordpress/i18n';
import type { RuleType, Targeting } from '../api';
import { whereSummary } from './sentence';

/** Small card facts may count unresolved sets; replacement reviews show every stored rule. */
export function targetingSummary(targeting: Targeting, types: readonly RuleType[], mode: 'compact' | 'review'): string {
  const read = (rules: NonNullable<Targeting['include']>): string | null => {
    if (mode === 'compact' && rules.length > 2) return null;
    const descriptions = rules.map((rule): string | null => {
      const type = types.find((entry) => entry.type === rule.type && entry.kind === 'page');
      const param = type?.params.value;
      let value = param?.options.find((option) => option.value === String(rule.value))?.label
        ?? (param?.control === 'path_glob' && typeof rule.value === 'string' ? rule.value.trim() : null);
      if (mode === 'compact' && (!type || !value)) return null;
      if (!value) {
        if (rule.value === undefined || rule.value === null || rule.value === '') {
          value = __('No value selected', 'wconvert');
        } else if (param?.control === 'post_id' || param?.control === 'term_id') {
          value = `#${String(rule.value)}`;
        } else {
          value = typeof rule.value === 'object' ? JSON.stringify(rule.value) : String(rule.value);
        }
      }
      return sprintf(
        /* translators: 1: the page rule's name. 2: the selected content type, URL path or stored object ID. */
        __('%1$s: %2$s', 'wconvert'), type?.label ?? __('Unavailable rule', 'wconvert'), value,
      );
    });
    if (!descriptions.every((value): value is string => value !== null)) return null;
    return descriptions.reduce((joined, description) => joined ? sprintf(
      /* translators: 1 and 2: alternative page rules, joined using OR. */
      __('%1$s or %2$s', 'wconvert'), joined, description,
    ) : description, '');
  };
  const include = read(targeting.include ?? []);
  const exclude = read(targeting.exclude ?? []);
  if (include === null || exclude === null || (!include && !exclude)) return whereSummary(targeting).text;
  if (!include) return sprintf(
    /* translators: %s: the page rule or rules excluded from the whole site. */
    __('Everywhere except %s', 'wconvert'), exclude,
  );
  if (!exclude) return include;
  return sprintf(
    /* translators: 1: the included page rules. 2: the excluded page rules, which take precedence. */
    __('%1$s, except %2$s', 'wconvert'), include, exclude,
  );
}
