import { __, _n, sprintf } from '@wordpress/i18n';
import { formatCount } from '../lib/format';

export type DecisionKind = 'delete' | 'pause' | 'publish' | 'winner';

/**
 * The words for one decision on a campaign — the list's confirm and Details'
 * in-place strip read the same ones (ADR 0137), so the two never ask the
 * question differently. `arm` is whether the row is an A/B variant;
 * `variants` is how many variants a test's parent row has, which a delete
 * takes with it (#292).
 */
export function decisionCopy(kind: DecisionKind, arm: boolean, name: string, variants: number): { title: string; description: string; confirmLabel: string } {
  switch (kind) {
    case 'delete':
      if (!arm && variants > 0) return {
        title: __('Delete this A/B test?', 'wconvert'),
        description: sprintf(
          /* translators: 1: a campaign's name, 2: how many variants it has. */
          _n('“%1$s” and its %2$s variant stop showing and leave this list. Their leads and results are kept.', '“%1$s” and its %2$s variants stop showing and leave this list. Their leads and results are kept.', variants, 'wconvert'),
          name,
          formatCount(variants),
        ),
        confirmLabel: __('Delete test', 'wconvert'),
      };
      return {
        title: arm ? __('Delete this variant?', 'wconvert') : __('Delete this campaign?', 'wconvert'),
        description: sprintf(
          arm
            ? /* translators: %s: an A/B test variant's name, e.g. “Spring sale B”. */ __('“%s” stops showing and leaves this A/B test. Its leads and results are kept.', 'wconvert')
            : /* translators: %s: a campaign's name, e.g. “Spring sale”. */ __('“%s” stops showing and leaves this list. Its leads and results are kept.', 'wconvert'),
          name,
        ),
        confirmLabel: arm ? __('Delete variant', 'wconvert') : __('Delete campaign', 'wconvert'),
      };
    case 'pause':
      return {
        title: arm ? __('Unpublish this variant?', 'wconvert') : __('Unpublish this campaign?', 'wconvert'),
        description: sprintf(
          arm
            ? /* translators: %s: an A/B test variant's name, e.g. “Spring sale B”. */ __('“%s” stops showing. Its saved draft, leads and results are kept, and the other variants keep running.', 'wconvert')
            : /* translators: %s: a campaign's name, e.g. “Spring sale”. */ __('“%s” stops showing and returns to Draft. Its saved draft, leads and results are kept.', 'wconvert'),
          name,
        ),
        confirmLabel: arm ? __('Unpublish variant', 'wconvert') : __('Unpublish campaign', 'wconvert'),
      };
    case 'winner':
      return {
        title: __('Use this variant?', 'wconvert'),
        description: __('This variant becomes the campaign. The other variants stop showing; their leads and results are kept.', 'wconvert'),
        confirmLabel: __('Use this variant', 'wconvert'),
      };
    case 'publish':
      return {
        title: __('Publish the saved draft?', 'wconvert'),
        description: __('The latest saved draft becomes what visitors see, subject to its display rules.', 'wconvert'),
        confirmLabel: __('Publish saved draft', 'wconvert'),
      };
  }
}
