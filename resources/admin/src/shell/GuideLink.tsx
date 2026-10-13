import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowUpRight } from 'lucide-react';
import { isFreeInstall } from '../goals/availability';
import { suspensionGuide } from './docs';

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

/**
 * "What to check" after a suspended campaign's sentence, or nothing (ADR 0147):
 * the missing plugin's guide, or the Pro guide where Pro is installed.
 */
export function SuspensionGuideLink({ needs }: { needs?: string | null }) {
  const href = suspensionGuide(needs, isFreeInstall());
  return href ? <>{' '}<GuideLink href={href}>{__('What to check', 'wconvert')}</GuideLink></> : null;
}
