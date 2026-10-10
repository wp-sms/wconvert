import { createContext, useContext } from 'react';

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
