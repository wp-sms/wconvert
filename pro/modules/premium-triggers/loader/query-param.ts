import type { LoaderModule } from '@loader/types';

/**
 * `query_param` — the general form the campaign presets are spelled in.
 *
 * The engine gets `{key, value}` and the builder ships the legible shortcuts
 * over it — the UTM fields are three presets fixing `key` and leaving `value`
 * to the merchant (ADR 0005). A preset is never a rule type of its own, which
 * is what keeps a rich admin affordable over a closed vocabulary.
 *
 * **`value` is SET-VALUED**, which is how the real OR cases are expressed
 * without any boolean structure at all: "from Google or Bing" is one rule
 * carrying two values, not two rules under an `or`. ADR 0005 names this exact
 * case and records the nesting ceiling as permanent.
 *
 * An empty or absent `value` means **present with any value** — "they arrived
 * from some campaign" is a question worth asking, and the alternative reading,
 * "matches the empty string", is a rule nobody would write on purpose.
 *
 * No listener and no storage: the query string is fixed for the page view, and
 * reading it writes nothing to the visitor's device, so this declares no
 * Storage Consent category.
 */
export const queryParam: LoaderModule = {
  id: 'query_param',
  kind: 'condition',
  consentCategory: null,
  create: () => ({
    holds: (rule) => {
      const key = typeof rule.key === 'string' ? rule.key.trim() : '';

      if (key === '') {
        return false;
      }

      // Read live rather than at instantiation, the posture every Condition
      // takes: a history-API navigation can change the query string under a
      // page the loader is still running on.
      const found = new URLSearchParams(window.location.search).get(key);

      if (found === null) {
        return false;
      }

      const wanted = (Array.isArray(rule.value) ? rule.value : [rule.value]).filter(
        (value): value is string => typeof value === 'string' && value !== '',
      );

      return wanted.length === 0 || wanted.includes(found);
    },
  }),
};
