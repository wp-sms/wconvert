import { __ } from '@wordpress/i18n';
import { isFreeInstall } from './goals/availability';
import { humanize } from './lib/format';

/**
 * User-facing facts for the closed Display Type vocabulary.
 *
 * The domain value remains `display_type`; the admin says Format because that
 * is the merchant language established by ADR 0086. Keep these words in one
 * place so Campaigns, campaign setups, template packs, and the builder never
 * teach four slightly different vocabularies for the same choice.
 */
export const DISPLAY_TYPES = ['popup', 'inline', 'floating_bar', 'slide_in', 'fullscreen'] as const;

export function displayTypeLabel(type?: string): string {
  return ({
    popup: __('Popup', 'wconvert'),
    inline: __('Inline form', 'wconvert'),
    floating_bar: __('Floating bar', 'wconvert'),
    slide_in: __('Slide-in', 'wconvert'),
    fullscreen: __('Fullscreen', 'wconvert'),
  } as Record<string, string>)[type ?? ''] ?? (type ? humanize(type) : __('Other format', 'wconvert'));
}

/** A placement-level explanation, deliberately not a promise about the Goal. */
export function displayTypeDescription(type?: string): string {
  return ({
    popup: __('Centered over the page', 'wconvert'),
    inline: __('Inside the page', 'wconvert'),
    floating_bar: __('Bar at the page edge', 'wconvert'),
    slide_in: __('Panel in a page corner', 'wconvert'),
    fullscreen: __('Covers the browser viewport', 'wconvert'),
  } as Record<string, string>)[type ?? ''] ?? '';
}

/** The formats free ships; every other one arrives with Pro's display-types module. */
const FREE_DISPLAY_TYPES: readonly string[] = ['popup', 'inline'];

/**
 * The formats a picker offers. A free install is offered only the two it can
 * publish — a format it could only buy is not a choice there (ADR 0116).
 *
 * `current` keeps a saved value selectable after Pro was removed, so a select
 * never silently shows a format the draft does not have.
 */
export function displayTypeOptions(current?: string): readonly { value: string; label: string }[] {
  return DISPLAY_TYPES
    .filter((value) => !isFreeInstall() || FREE_DISPLAY_TYPES.includes(value) || value === current)
    .map((value) => ({ value, label: displayTypeLabel(value) }));
}
