import { createContext, useContext } from 'react';
import { __ } from '@wordpress/i18n';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '../components/ui/button';

/**
 * Whether the style panel is showing its exact values (ADR 0135).
 *
 * The plain view is presets, swatches and words; Advanced adds what only
 * someone who knows CSS reads — units, typed values, hex codes, contrast
 * ratios. One switch per panel, read by every field inside it, so a field
 * never needs its own "show more" and the panel never has two.
 */
export const AdvancedContext = createContext(false);

export const useAdvanced = (): boolean => useContext(AdvancedContext);

/** The panel's one switch: an independent toggle, so `aria-pressed` (ADR 0131), with its icon. */
export function AdvancedToggle({ advanced, onToggle }: { advanced: boolean; onToggle(): void }) {
  return <Button type="button" variant="ghost" size="xs" className="wconvert-style-detail-toggle" aria-pressed={advanced} onClick={onToggle}>
    <SlidersHorizontal aria-hidden="true" />
    {__('Advanced', 'wconvert')}
  </Button>;
}

/** What a plain field says in place of a value only CSS can express. */
export const cssOnlyNote = (): string => __('This value is set in CSS. Open Advanced to change it.', 'wconvert');
