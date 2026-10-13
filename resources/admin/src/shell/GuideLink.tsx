import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowUpRight } from 'lucide-react';

/**
 * A link to one guide on wconvert.io (ADR 0145): a new tab, so the screen
 * someone was stuck on stays open, and said aloud for a screen reader.
 *
 * @param href A `docsUrl()` from `shell/docs.ts`, never a hand-written address.
 */
export function GuideLink({ href, children, className }: { href: string; children?: ReactNode; className?: string }) {
  return <a className={className ? `wconvert-guide-link ${className}` : 'wconvert-guide-link'} href={href} target="_blank" rel="noreferrer">
    {children ?? __('Read the guide', 'wconvert')}
    <ArrowUpRight aria-hidden="true" />
    <span className="sr-only">{__('(opens in a new tab)', 'wconvert')}</span>
  </a>;
}
