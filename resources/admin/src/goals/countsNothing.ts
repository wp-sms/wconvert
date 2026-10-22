/**
 * Show a message: nothing converts, so Impressions are the whole report (ADR 0163).
 *
 * Its own module, free of the builder, because the reading screens ask it too.
 */
export const countsNothing = (outcome: { readonly action: string } | null | undefined): boolean => outcome?.action === 'none';
