import { __, sprintf } from '@wordpress/i18n';

export type DecisionKind = 'delete' | 'pause' | 'publish' | 'winner';

/**
 * The words for one decision on a campaign — the list's confirm and Details'
 * in-place strip read the same ones (ADR 0137), so the two never ask the
 * question differently. `arm` is whether the row is an A/B variant.
 */
export function decisionCopy(kind: DecisionKind, arm: boolean, name: string): { title: string; description: string; confirmLabel: string } {
  switch (kind) {
    case 'delete':
      return {
        title: arm ? __('Delete this variant?', 'wconvert') : __('Delete this campaign?', 'wconvert'),
        description: sprintf(
          arm
            ? __('“%s” stops showing and leaves this A/B test. Its leads and results are kept.', 'wconvert')
            : __('“%s” stops showing and leaves this list. Its leads and results are kept.', 'wconvert'),
          name,
        ),
        confirmLabel: arm ? __('Delete variant', 'wconvert') : __('Delete campaign', 'wconvert'),
      };
    case 'pause':
      return {
        title: arm ? __('Unpublish this variant?', 'wconvert') : __('Unpublish this campaign?', 'wconvert'),
        description: sprintf(
          arm
            ? __('“%s” stops showing. Its saved draft, leads and results are kept, and the other variants keep running.', 'wconvert')
            : __('“%s” stops showing and returns to Draft. Its saved draft, leads and results are kept.', 'wconvert'),
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
