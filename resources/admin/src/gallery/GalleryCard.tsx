import { useCallback, useId } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { AlertTriangle, ExternalLink, Lock, Star } from 'lucide-react';
import { Button } from '../components/ui/button';
import { TryAgain } from '../shell/Region';
import { DesignStage } from '../stage/DesignStage';
import { displayTypeLabel } from '../displayTypes';
import { tierName } from '../goals/availability';
import type { Template } from '@renderer/types';
import { fieldChips, type GalleryCard as Card } from './model';

export interface GalleryCardProps {
  readonly card: Card;
  /** The live tree for a template on this site, once it has arrived. */
  readonly template?: Template;
  readonly saved: boolean;
  readonly onSave?: () => void;
  readonly onInspect: () => void;
  readonly onUse: () => void;
  /** Installs the library's newer revision of this card. */
  readonly onUpdate?: () => void;
  /** This card's template is being added or started from. */
  readonly busy?: boolean;
  /** Another card is busy, so this one waits. */
  readonly disabled?: boolean;
  /** Why the last Use failed, said on the card with its one retry. */
  readonly failed?: string | null;
  /** The card came near the viewport: its tree is worth fetching. */
  readonly onNear?: (key: string) => void;
  /** Its tree could not be fetched; the stage says so and offers the one retry. */
  readonly previewFailed?: boolean;
  readonly onRetryPreview?: () => void;
  /** The editor's word for a form this design would gain or lose (ADR 0163). */
  readonly conversion?: { readonly chip: string; readonly action: string } | null;
  /** The editor's card for the template already in use. */
  readonly current?: boolean;
}

/**
 * One template on a card (ADR 0171), as the approved prototype draws it: the
 * stage, its name and ★, one row of what it is, and one action.
 */
export function GalleryCard({ card, template, saved, onSave, onInspect, onUse, onUpdate, busy = false, disabled = false, failed = null, onNear, previewFailed = false, onRetryPreview, conversion = null, current = false }: GalleryCardProps) {
  const nameId = useId();
  const near = useCallback(() => onNear?.(card.key), [onNear, card.key]);
  const locked = card.availability === 'locked';
  const source = card.thumbnail ? { image: card.thumbnail } : template ? { live: { template } } : undefined;

  const action = current ? null
    : locked ? card.previewUrl && (
      <Button asChild variant="outline" size="sm">
        <a href={card.previewUrl} target="_blank" rel="noopener noreferrer" aria-describedby={nameId}>
          {__('See this design', 'wconvert')}<ExternalLink aria-hidden="true" />
        </a>
      </Button>
    )
      : card.availability === 'update_plugin' || card.availability === 'unavailable' ? (
        <p className="wconvert-template-note m-0">
          <AlertTriangle aria-hidden="true" />
          {card.availability === 'update_plugin' ? __('Needs a newer version of WConvert.', 'wconvert') : __('Needs a plugin this site doesn’t have.', 'wconvert')}
        </p>
      )
        : failed !== null ? null
          : card.newerRevision && onUpdate ? (
            <Button variant="outline" size="sm" disabled={disabled || busy} aria-describedby={nameId} onClick={onUpdate}>
              {busy ? __('Adding…', 'wconvert') : __('Get the newer version', 'wconvert')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={disabled || busy} aria-describedby={nameId} onClick={onUse}>
              {busy ? __('Adding…', 'wconvert') : conversion?.action ?? __('Use template', 'wconvert')}
            </Button>
          );

  return (
    <li className="wconvert-template-card" data-card={card.key} aria-current={current || undefined}>
      <div className="wconvert-template-card__stage">
        <DesignStage displayType={card.displayType} size="card" source={source} onNear={near} />
        <button type="button" className="wconvert-template-card__inspect" onClick={onInspect}
          aria-label={sprintf(/* translators: %s: a template's name. */ __('Preview %s', 'wconvert'), card.name)} />
        {previewFailed && <div className="wconvert-template-card__failed">
          <span>{__('Preview could not be loaded.', 'wconvert')}</span>
          {onRetryPreview && <Button variant="outline" size="sm" onClick={onRetryPreview} aria-describedby={nameId}>{__('Try again', 'wconvert')}</Button>}
        </div>}
      </div>
      <div className="wconvert-template-card__body">
        <div className="wconvert-template-card__title">
          <h3 id={nameId}>{card.name}</h3>
          {onSave && <button type="button" className="wconvert-template-card__save" aria-pressed={saved} onClick={onSave}
            aria-label={sprintf(/* translators: %s: a template's name. */ __('Save %s', 'wconvert'), card.name)}>
            <Star size={17} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
          </button>}
        </div>
        <TemplateMarks card={card} conversion={conversion} current={current} />
        {failed !== null && <div className="wconvert-template-error" role="alert"><span>{failed}</span><TryAgain onClick={onUse} /></div>}
        {action && <div className="wconvert-template-card__action">{action}</div>}
      </div>
    </li>
  );
}

/** What a template is, in one row: its format, what it asks for, and its plan or recommendation. */
export function TemplateMarks({ card, conversion = null, current = false }: { card: Card; conversion?: { readonly chip: string } | null; current?: boolean }) {
  return (
    <div className="wconvert-template-card__marks">
      <span className="wconvert-chip" data-kind="format">{displayTypeLabel(card.displayType)}</span>
      {conversion ? <span className="wconvert-chip" data-kind="conversion">{conversion.chip}</span>
        : fieldChips(card).map(chip => <span key={chip} className="wconvert-chip" data-kind="field">{chip}</span>)}
      {current && <span className="wconvert-chip" data-kind="current">{__('Current template', 'wconvert')}</span>}
      {card.availability === 'locked'
        ? <span className="wconvert-chip" data-kind="locked"><Lock aria-hidden="true" />{tierName(card.tier)}</span>
        : card.recommended !== null && <span className="wconvert-chip" data-kind="recommended" title={card.recommended}>{__('Recommended', 'wconvert')}</span>}
    </div>
  );
}
