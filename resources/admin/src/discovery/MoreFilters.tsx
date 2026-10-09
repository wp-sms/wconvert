import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Disclosure } from '../shell/Disclosure';

/**
 * Every filter past the first row, folded under one (ADR 0131). The design
 * library and the creation flow both use it, so a merchant meets it once.
 * Closed, its summary says how many are on, so nobody opens it to check.
 */
export function MoreFilters({ active, open, onToggle, children }: {
  active: number; open?: boolean; onToggle?: (open: boolean) => void; children: ReactNode;
}) {
  return <Disclosure variant="inline" className="wconvert-picker__more" bodyClassName="wconvert-picker__extra" title={__('More filters', 'wconvert')}
    summary={active > 0 ? sprintf(/* translators: %s: how many filters are on. */ _n('%s on', '%s on', active, 'wconvert'), String(active)) : undefined}
    open={open} onToggle={onToggle}>
    {children}
  </Disclosure>;
}

/** "Saved designs only", with how many there are, for both libraries. */
export function SavedLabel({ count }: { count: number }) {
  return <>{__('Saved designs only', 'wconvert')} <span aria-hidden="true" className="wconvert-picker__option-count">{count}</span></>;
}
