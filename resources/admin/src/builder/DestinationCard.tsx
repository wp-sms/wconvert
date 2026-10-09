import { useEffect, useId, useRef } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CircleMinus, MoreHorizontal, Pencil, Send } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Description } from '../shell/Description';
import { ProviderMark } from '../destinations/ProviderMark';
import { targetSaid } from '../destinations/settings';
import { captureProblems, capturedFields, missingSettings } from '../destinations/requirements';
import { connectionMissing, destinationStatus, setupProblems } from '../destinations/status';
import { sendingIssuesHref } from '../nav';
import type { Connection, Destination, DestinationType } from '../destinations/api';
import type { Template } from '@renderer/types';
import { ExtraAnswerMapping, hasExtraAnswers, UnsupportedAnswerMapping } from './ExtraAnswerMapping';

const automaticNames = (): Record<string, string> => ({ email: __('email', 'wconvert'), name: __('name', 'wconvert'), phone: __('phone', 'wconvert') });

/** "email", "email and name", "email, name and phone". */
export function listedFields(names: readonly string[]): string {
  return names.length === 2
    ? sprintf(__('%1$s and %2$s', 'wconvert'), names[0], names[1])
    : names.length === 3
      ? sprintf(__('%1$s, %2$s and %3$s', 'wconvert'), names[0], names[1], names[2])
      : names[0] ?? '';
}

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
  const status = destinationStatus(destination, type, problems);
  const captures = capturedFields(template, submissionId);
  const fit = template ? captureProblems(destination, captures) : [];
  const names = automaticNames();
  const automatic = captures
    .filter((field) => field.name in names && destination.requirements?.fields.includes(field.name))
    .map((field) => names[field.name]);
  const target = destination.target === '' ? targetSaid('') : destination.target;
  const runnable = destination.availability === 'ready' && problems.length === 0;
  const firstField = connectionMissing(destination, type, connections) ? 'connection' : missingSettings(destination.requirements ?? type?.requirements, destination.settings)[0];

  return (
    <article className="wconvert-destination-card" aria-labelledby={`${id}-name`}>
      <div className="wconvert-destination-card__main">
        <ProviderMark type={type} className="wconvert-destination-card__mark" />
        <div className="min-w-0">
          <h4 id={`${id}-name`} className="m-0 text-body font-semibold [overflow-wrap:anywhere]">{destination.label}</h4>
          <p className="wconvert-destination-card__meta">
            {type !== undefined && <span>{type.label}</span>}
            {target !== null && <span>{target}</span>}
            {destination.health.last_success_at !== null && destination.health.consecutive_failures === 0 &&
              <span>{sprintf(/* translators: %s: a date and time. */ __('Last sent %s', 'wconvert'), destination.health.last_success_at)}</span>}
          </p>
          {automatic.length > 0 && status.state !== 'needs_setup' &&
            <Description className="mt-1 [overflow-wrap:anywhere]">{sprintf(__('Sends %s automatically.', 'wconvert'), listedFields(automatic))}</Description>}
        </div>
        <div className="wconvert-destination-card__side">
          {status.badge}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button ref={actions} variant="ghost" size="icon-sm" aria-label={sprintf(__('Actions for %s', 'wconvert'), destination.label)}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={5}>
              <DropdownMenuItem onSelect={() => onEdit(actions.current)}>
                <Pencil aria-hidden="true" />{__('Edit settings', 'wconvert')}
              </DropdownMenuItem>
              {/*
                **`aria-disabled`, not `disabled`.** Radix skips a disabled item
                in keyboard navigation, which hides the reason with the action.
              */}
              <DropdownMenuItem aria-disabled={runnable ? undefined : true} aria-describedby={runnable ? undefined : `${id}-test-blocked`}
                className={runnable ? undefined : 'text-muted-foreground'}
                onSelect={(event) => { if (!runnable) { event.preventDefault(); return; } onTest(actions.current); }}>
                <Send aria-hidden="true" />
                <span className="flex flex-col">
                  {__('Send a test', 'wconvert')}
                  {!runnable && <span id={`${id}-test-blocked`} className="text-note">{destination.availability === 'ready'
                    ? __('Finish setup first.', 'wconvert')
                    : __('Not running on this site.', 'wconvert')}</span>}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onRemove}>
                <CircleMinus aria-hidden="true" />{__('Remove from this campaign', 'wconvert')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {status.issue !== null ? (
        <div className={`wconvert-destination-card__issue wconvert-destination-card__issue--${status.state === 'failing' ? 'bad' : 'warn'}`}>
          <p className="m-0">{status.issue}</p>
          {status.state === 'needs_setup' && <div>
            <Button type="button" variant="outline" size="sm" onClick={(event) => onEdit(event.currentTarget, firstField)}>
              {__('Finish setup', 'wconvert')}
            </Button>
          </div>}
          {status.state === 'failing' && <div>
            <Button asChild variant="outline" size="sm"><a href={sendingIssuesHref()}>{__('View sending issues', 'wconvert')}</a></Button>
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
        {template && type && !type.supports_mapping && hasExtraAnswers(template, submissionId) && <UnsupportedAnswerMapping />}
      </div>
    </article>
  );
}
