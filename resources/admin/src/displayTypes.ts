import { __ } from '@wordpress/i18n';

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
  } as Record<string, string>)[type ?? ''] ?? type ?? '';
}

/** A placement-level explanation, deliberately not a promise about the Goal. */
export function displayTypeDescription(type?: string): string {
  return ({
    popup: __('Centred over the page', 'wconvert'),
    inline: __('Inside the page', 'wconvert'),
    floating_bar: __('Bar at the page edge', 'wconvert'),
    slide_in: __('Panel in a page corner', 'wconvert'),
    fullscreen: __('Covers the browser viewport', 'wconvert'),
  } as Record<string, string>)[type ?? ''] ?? type ?? '';
}

export function displayTypeOptions(): readonly { value: string; label: string }[] {
  return DISPLAY_TYPES.map((value) => ({ value, label: displayTypeLabel(value) }));
}
