import { createContext, useContext } from 'react';

/**
 * Whether this campaign's Goal shows a message and counts nothing (ADR 0163).
 *
 * Read where a structure edit asks "would this leave nothing to count?": under
 * such a Goal, nothing to count is the design rather than a mistake.
 */
export const CountsNothing = createContext(false);

export const useCountsNothing = (): boolean => useContext(CountsNothing);
