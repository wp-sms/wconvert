import { useEffect, useId, useRef } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { formatWhen } from '../lib/format';
import { CircleMinus, MoreHorizontal, Pencil, Send } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { OptionItem, OptionMenuContent, OptionSeparator, refusal } from '../components/ui/option-menu';
import { Description } from '../shell/Description';
import { ProviderMark } from '../destinations/ProviderMark';
import { targetShown } from '../destinations/settings';
import { listWithAnd } from './rules/sentence';
import { captureProblems, capturedFields, contactFieldNames, missingSettings } from '../destinations/requirements';
import { connectionMissing, destinationStatus, setupProblems } from '../destinations/status';
import { sendingIssuesHref } from '../nav';
import type { Connection, Destination, DestinationType } from '../destinations/api';
import type { Template } from '@renderer/types';
import { ExtraAnswerMapping, hasExtraAnswers, UnsupportedAnswerMapping } from './ExtraAnswerMapping';

/**
 * One [[Destination]] this Campaign sends a save point to, and whether that is
 * working.
 *
 * **Only bound routes are cards**, so every warning on one is a warning about
 * this Campaign. The status badge is the Settings screen's own
 * ({@see destinationStatus}); the inset under it says why, once, with the one
 * action that fixes it. Health outranks form fit: a route that cannot send at
 * all makes "the phone field is optional" a later problem.
 */
export function DestinationCard({
  destination, type, template, submissionId, connections, mapping, focusOnMount = false,
  onEdit, onTest, onRemove, onMappingChange,
}: {
  destination: Destination;
  type: DestinationType | undefined;
  template?: Template;
  submissionId: string;
  connections: readonly Connection[];
  mapping: Readonly<Record<string, string>>;
  /** Moves focus to this card's actions — after it was just created and selected. */
  focusOnMount?: boolean;
  onEdit: (trigger: HTMLElement | null, focusField?: string) => void;
  onTest: (trigger: HTMLElement | null) => void;
  onRemove: () => void;
  onMappingChange?: (map: Record<string, string>) => void;
}) {
  const id = useId();
  const actions = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (focusOnMount) actions.current?.focus(); }, [focusOnMount]);
  const problems = setupProblems(destination, type, connections);
  const status = destinationStatus(destination, type, problems, true);
  const captures = capturedFields(template, submissionId);
  const fit = template ? captureProblems(destination, captures, mapping) : [];
  const names = contactFieldNames();
  const automatic = captures
    .filter((field) => field.name in names && destination.requirements?.fields.includes(field.name))
    .map((field) => names[field.name]);
  const target = targetShown(destination.target);
  const runnable = destination.availability === 'ready' && problems.length === 0;
  const firstField = connectionMissing(destination, type, connections) ? 'connection' : missingSettings(destination.requirements ?? type?.requirements, destination.settings)[0];

  return (
    <article className="wconvert-destination-card" aria-labelledby={`${id}-name`}>
      <div className="wconvert-destination-card__main">
        <ProviderMark type={type} className="wconvert-destination-card__mark" />
        <div className="min-w-0">
          <h4 id={`${id}-name`} className="m-0 text-body font-semibold [overflow-wrap:anywhere]"><bdi>{destination.label || __('Unnamed destination', 'wconvert')}</bdi></h4>
          <p className="wconvert-destination-card__meta">
            {type !== undefined && <span>{type.label}</span>}
            {target !== null && <span>{target}</span>}
            {destination.health.last_success_at !== null && destination.health.consecutive_failures === 0 &&
              <span>{sprintf(/* translators: %s: when, e.g. “Today, 2:22 PM” or “Oct 3”. */ __('Last sent %s', 'wconvert'), formatWhen(destination.health.last_success_at, 'list'))}</span>}
          </p>
          {/* A type that forwards the whole submission has nothing to map: it says so instead of naming fields. */}
          {type?.forwards_submission ? status.state !== 'needs_setup' &&
            <Description className="mt-1">{__('Sends every field and answer.', 'wconvert')}</Description>
            : automatic.length > 0 && status.state !== 'needs_setup' &&
            <Description className="mt-1 [overflow-wrap:anywhere]">{sprintf(/* translators: %s: contact fields, e.g. “email and name”. */ __('Sends %s automatically.', 'wconvert'), listWithAnd(automatic))}</Description>}
        </div>
        <div className="wconvert-destination-card__side wconvert-toolbar">
          {status.badge}
          {/* Review & publish asks for a test before launch, so the door is on the card, not in a menu. */}
          {runnable && <Button type="button" variant="outline" aria-describedby={`${id}-name`} onClick={(event) => onTest(event.currentTarget)}>
            <Send aria-hidden="true" />{__('Send a test', 'wconvert')}
          </Button>}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button ref={actions} variant="ghost" size="icon-sm" aria-label={sprintf(/* translators: %s: a destination's name. */ __('Actions for %s', 'wconvert'), destination.label)}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <OptionMenuContent align="end" sideOffset={5}>
              <OptionItem icon={Pencil} name={__('Edit settings', 'wconvert')} onSelect={() => onEdit(actions.current)} />
              <OptionItem icon={Send} name={__('Send a test', 'wconvert')} onSelect={() => onTest(actions.current)}
                refused={runnable ? null : refusal(destination.availability === 'ready'
                  ? __('Finish setup first.', 'wconvert')
                  : __('Not running on this site.', 'wconvert'))} />
              <OptionSeparator />
              <OptionItem icon={CircleMinus} name={__('Remove from this campaign', 'wconvert')} onSelect={onRemove} />
            </OptionMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {status.issue !== null ? (
        <div className={`wconvert-destination-card__issue wconvert-destination-card__issue--${status.state === 'failing' ? 'bad' : 'warn'}`}>
          <p className="m-0">{status.issue}</p>
          {status.state === 'needs_setup' && <div>
            <Button type="button" variant="outline" onClick={(event) => onEdit(event.currentTarget, firstField)}>
              {__('Finish setup', 'wconvert')}
            </Button>
          </div>}
          {status.state === 'failing' && <div>
            <Button asChild variant="outline"><a href={sendingIssuesHref()}>{__('View sending issues', 'wconvert')}</a></Button>
          </div>}
        </div>
      ) : fit.length > 0 && (
        <div className="wconvert-destination-card__issue wconvert-destination-card__issue--warn">
          {fit.length === 1 ? <p className="m-0">{fit[0]}</p>
            : <ul className="m-0 ps-4">{fit.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
        </div>
      )}

      <div className="wconvert-destination-card__extra empty:hidden">
        {template && onMappingChange && type?.supports_mapping &&
          <ExtraAnswerMapping providerLabel={type.label} destination={destination} submissionId={submissionId} template={template}
            value={mapping} onChange={onMappingChange} onSettings={(trigger) => onEdit(trigger)} />}
        {template && type && !type.supports_mapping && !type.forwards_submission && hasExtraAnswers(template, submissionId) && <UnsupportedAnswerMapping />}
      </div>
    </article>
  );
}
