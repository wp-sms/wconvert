import { __ } from '@wordpress/i18n';
import { Badge } from '../components/ui/badge';
import type { OptinStatus } from './api';

/**
 * What state an [[Optin]] is in, as one badge.
 *
 * ============================================================================
 * TWO SCREENS SAY THIS NOW, SO IT IS SAID IN ONE PLACE.
 * ============================================================================
 * It was the Optin list's, which was right while the list was the only screen
 * that knew whether an Optin was on the site. The builder's readiness panel
 * asks the same question of the Optin being edited — *"is this live?"* is the
 * first thing a merchant opening a campaign wants — and a second copy would be
 * two maps of colours and two `switch`es of words, drifting the first time a
 * state was renamed.
 *
 * **The colours are ADR 0037's reserved palette spent on the meaning it was
 * reserved for.** Green for *published* and amber for *suspended*: the site is
 * serving one and holding the other back. A draft and a deleted Optin have no
 * such meaning and are deliberately quiet.
 */
export function StatusBadge({ status }: { readonly status: OptinStatus }) {
  return <Badge variant={BADGE[status]}>{statusLabel(status)}</Badge>;
}

const BADGE: Record<OptinStatus, 'success' | 'warning' | 'secondary' | 'outline'> = {
  published: 'success',
  suspended: 'warning',
  draft: 'secondary',
  deleted: 'outline',
};

/**
 * A state, in the merchant's language.
 *
 * **The screen used to render the raw token** — `published`, `draft`,
 * `deleted` — which are values this bundle computes, not words anybody wrote,
 * and therefore untranslated in every locale (ADR 0039). A `switch` rather than
 * a map, so adding a state to `OptinStatus` is a type error here rather than a
 * blank badge on a real install.
 *
 * A function rather than a constant because `__()` must not run at module
 * scope: the catalogue is not loaded when the bundle is evaluated, so a
 * top-level call would freeze the English string into every locale.
 */
export function statusLabel(status: OptinStatus): string {
  switch (status) {
    case 'published':
      return __('Published', 'wconvert');
    case 'suspended':
      return __('Suspended', 'wconvert');
    case 'draft':
      return __('Draft', 'wconvert');
    case 'deleted':
      return __('Deleted', 'wconvert');
  }
}
