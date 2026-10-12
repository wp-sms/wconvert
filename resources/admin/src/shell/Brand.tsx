import { __ } from '@wordpress/i18n';
import { tierName } from '../goals/availability';
import { usePlanBadge } from './planBadge';

const TILE = 'M12 8h32c0 6.627 5.373 12 12 12v32c0 5.523-4.477 10-10 10H12C6.477 62 2 57.523 2 52V18C2 12.477 6.477 8 12 8Z';
const LETTER = 'M12 24h8l-.2 16L29 24h7l-.4 16L44 24h8L38 49h-8l.5-16L21 49h-8L12 24Z';
const ESPRESSO = '#302720';
const PAPER = '#faf6ed';
const CITRON = '#e2f475';

/**
 * The wconvert.io mark (ADR 0130), inline so it costs no request and stays
 * crisp at 29–34px. `inverse` is the cream tile, for the espresso frame bands,
 * where the default espresso tile would vanish into the background. The paths
 * are `assets/branding/wconvert-mark*.svg`, copied from the site unchanged.
 */
export function BrandMark({ variant = 'default', className }: { variant?: 'default' | 'inverse'; className?: string }) {
  const [tile, letter] = variant === 'inverse' ? [PAPER, ESPRESSO] : [ESPRESSO, PAPER];
  return (
    <svg
      className={className ? `wconvert-brand-mark ${className}` : 'wconvert-brand-mark'}
      data-variant={variant}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path fill={tile} d={TILE} />
      <path fill={letter} d={LETTER} />
      <circle cx="56" cy="8" r="7" fill={CITRON} stroke={ESPRESSO} strokeWidth="1.5" />
    </svg>
  );
}

/**
 * The plan's name, and — when another bundle supplies one — a link with a dot.
 *
 * A link only when the server said where it goes (`planBadge`), so a free
 * install and a reader who may not follow it keep the plain label. The dot is
 * decoration with its reason beside it: in the `title` for a pointer, and in
 * the link's own text for a screen reader.
 */
export function PlanBadge({ tier, currentPage, plain = false }: { tier: string; currentPage?: string; plain?: boolean }) {
  const live = usePlanBadge();
  // The footer names the plan and nothing more; the header's badge is the door.
  const badge = plain ? null : live;
  const name = tier === 'free' ? __('Free', 'wconvert') : tierName(tier);

  if (badge === null) {
    return <span className="wconvert-plan-badge" data-paid={tier === 'free' ? undefined : ''}>{name}</span>;
  }

  const said = badge.reason ?? badge.hint ?? null;

  return (
    <a
      className="wconvert-plan-badge"
      href={badge.href}
      data-paid={badge.prompt || tier === 'free' ? undefined : ''}
      data-prompt={badge.prompt ? '' : undefined}
      title={said ?? undefined}
      aria-current={currentPage !== undefined && badge.href === `#${currentPage}` ? 'page' : undefined}
    >
      {badge.tone && <span className="wconvert-plan-dot" data-tone={badge.tone} aria-hidden="true" />}
      {badge.label ?? name}
      {said && <span className="sr-only">{`: ${said}`}</span>}
    </a>
  );
}
