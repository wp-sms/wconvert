import { useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Plug, Plus, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { DestinationSetupDialog } from './DestinationSetupDialog';
import { Description } from '../shell/Description';
import { Toolbar } from '../shell/Toolbar';
import { EmptyState } from '../shell/EmptyState';
import {
  Region,
  RegionBody,
  RegionErrorState,
  RegionFooter,
  RegionHeader,
} from '../shell/Region';
import { RowsSkeleton } from '../shell/RowsSkeleton';
import { isFreeInstall, tierProductName } from '../goals/availability';
import { outcomeHandoffIssue, type OutcomeContract } from '../goals/outcome';
import { ProviderMark } from '../destinations/ProviderMark';
import { targetSaid } from '../destinations/settings';
import type { Loadable } from '../shell/loadable';
import type { Connection, Destination, DestinationType } from '../destinations/api';
import { capturedFields, compatibilityProblems } from '../destinations/requirements';
import type { Template } from '@renderer/types';
import { ExtraAnswerMapping, hasExtraAnswers, UnsupportedAnswerMapping } from './ExtraAnswerMapping';

/**
 * Which [[Destination]]s this [[Optin]] pushes to.
 *
 * A Campaign binds shared Destination ids. Its optional extra-answer map is
 * stored beside the binding and frozen with the accepted submission. Basic
 * contact fields remain provider-owned and need no merchant mapping.
 *
 * A Destination whose type is not `ready` is still shown and still bindable —
 * the binding is a decision the merchant made, and unbinding it because a
 * plugin was deactivated for an afternoon would lose it silently. It is the
 * DISPATCH that skips it, on every capture, and self-heals when the dependency
 * comes back (ADR 0027 draws the same line for a suspended [[Condition]]).
 *
 * ============================================================================
 * IT NO LONGER FETCHES. THE SCREEN DOES.
 * ============================================================================
 * The list is site-level configuration rather than a function of this Optin, so
 * it was read here, once. {@see ReadinessPanel} needs the same payload to say
 * where the Leads go and whether anything is failing — and two components
 * fetching one list is two round trips, two failure paths, and two moments at
 * which one of them is holding a stale answer.
 */
export interface DestinationsEditorProps {
  readonly outcome?: OutcomeContract;
  readonly template?: Template;
  readonly bound: readonly string[];
  /**
   * The site's Destinations, in the three states a read has.
   *
   * **This was `readonly Destination[] | null`, and `null` meant two things.**
   * Its own comment said so: *in flight* AND *after one that failed*. The read
   * is `.then(setDestinations).catch(…)` and this branched
   * `available === null ? 'Loading…' : …`, so a failed fetch left the tab
   * showing a placeholder that would never resolve.
   *
   * The reasoning around it was right and the type could not carry it: falling
   * back to `[]` was deliberately declined, because *"an empty one would read
   * as 'you have none' rather than 'we could not ask'"*. `Loadable` is the
   * union the rest of the admin already uses, and it makes the confusion
   * unrepresentable rather than merely fixed.
   */
  readonly available: Loadable<readonly Destination[]>;
  /**
   * The types those routes run over, for the two absences that are not one.
   *
   * A `Destination` carries the resolved [[Availability]] and nothing about
   * WHY, so this row could say only *"not running here"* — one sentence for
   * *you have not bought the tier* and *this site is missing a plugin*. That
   * is the collapse `Destinations` and `AddRule` both warn against in comments
   * and ADR 0026 exists to stop: it is how a paying customer is shown an
   * advertisement and a merchant is offered a licence we do not sell.
   */
  readonly types: readonly DestinationType[];
  /**
   * What the [[Playbook]] this Optin started from expected, in words — or null
   * where it started from none, or named nothing this install can say
   * anything about.
   *
   * **Written by prefill since prefill shipped, and read by nothing until
   * now.** It travels to this screen because this is where the decision it is
   * about gets made: *"the playbook captures an email address and expects a
   * destination like WP SMS"* is an instruction while nothing is bound, and
   * history the moment something is — which is why the caller passes it only in
   * the first case (ADR 0042 rule 2).
   */
  readonly hint: string | null;
  readonly onChange: (bound: string[]) => void;
  readonly connections: readonly Connection[];
  readonly onRefresh: () => void;
  readonly onSaved: (destinations: readonly Destination[]) => void;
  readonly onConnectionSaved?: (connection: Connection) => void;
  readonly mappings?: Readonly<Record<string, Record<string, string>>>;
  readonly onMappingChange?: (destinationId: string, map: Record<string, string>) => void;
}

/** Choices edit this Optin's draft; setup edits a shared site destination. */
export function DestinationsEditor({
  bound, available, types, hint, connections, onChange, onRefresh, onSaved, onConnectionSaved, template, outcome, mappings = {}, onMappingChange,
}: DestinationsEditorProps) {
  const [setup, setSetup] = useState<'add' | Destination | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const missing = available.status === 'ready'
    ? bound.filter((id) => !available.data.some((destination) => destination.id === id)) : [];
  const handoffIssue = outcome && available.status === 'ready'
    ? outcomeHandoffIssue(outcome, bound, available.data) : null;

  return (
    <>
      <Region>
        <RegionHeader title={__('Send leads to', 'wconvert')} level={3}
          description={bound.length > 0
            ? sprintf(__('%d selected', 'wconvert'), bound.length)
            : __('No destinations selected', 'wconvert')} />
        <Toolbar>
            <Button variant="outline" disabled={available.status === 'loading'} onClick={onRefresh}>
              <RefreshCw aria-hidden="true" />{__('Refresh', 'wconvert')}
            </Button>
            <Button disabled={available.status !== 'ready'} onClick={(event) => {
              returnFocus.current = event.currentTarget;
              setNotice(null);
              setSetup('add');
            }}><Plus aria-hidden="true" />{__('Add destination', 'wconvert')}</Button>
        </Toolbar>

        {notice !== null && <RegionBody className="border-b border-border"><p role="status" className="m-0 text-note">{notice}</p>{available.status === 'ready' && available.data.filter(item => addedIds.includes(item.id) && !bound.includes(item.id)).map(item => <Button key={item.id} type="button" size="sm" variant="outline" onClick={() => onChange([...bound, item.id])}>{sprintf(__('Select %s for this campaign', 'wconvert'), item.label)}</Button>)}</RegionBody>}
        {handoffIssue && <RegionBody className="border-b border-border"><Description>{handoffIssue}</Description></RegionBody>}

        {available.status === 'loading' ? <RowsSkeleton />
          : available.status === 'failed' ? <RegionErrorState message={available.message} hint={__('Refresh to retry. Your draft is unchanged.', 'wconvert')} />
          : available.data.length === 0 ? (
            <EmptyState icon={Plug} title={__('No destinations yet', 'wconvert')}>
              {outcome && !handoffIssue
                ? __('Leads stay in WConvert. Add a destination only if you want to forward them.', 'wconvert')
                : __('Add a destination, then select it for this Campaign.', 'wconvert')}
            </EmptyState>
          ) : (
            <RegionBody>
              <ul className="wconvert-choices">
                {available.data.map((destination) => {
                  const said = targetSaid(destination.target);
                  const compatibility = template ? compatibilityProblems(destination, capturedFields(template)) : [];
                  const automaticNames: Record<string, string> = { email: __('email', 'wconvert'), name: __('name', 'wconvert'), phone: __('phone', 'wconvert') };
                  const automatic = template ? capturedFields(template)
                    .filter((field) => ['email', 'name', 'phone'].includes(field.name) && destination.requirements?.fields.includes(field.name))
                    .map((field) => automaticNames[field.name]) : [];
                  const automaticText = automatic.length === 2
                    ? sprintf(__('%1$s and %2$s', 'wconvert'), automatic[0], automatic[1])
                    : automatic.length === 3
                      ? sprintf(__('%1$s, %2$s and %3$s', 'wconvert'), automatic[0], automatic[1], automatic[2])
                      : automatic[0] ?? '';
                  const control = `wconvert-bind-${destination.id}`;
                  const type = types.find((candidate) => candidate.id === destination.type);
                  const missingConnection = type?.needs_connection === true
                    && !connections.some((connection) => connection.id === destination.connection && connection.type === destination.type);
                  const description = [type ? `${control}-provider` : null, said === null ? null : `${control}-target`,
                    destination.availability === 'ready' ? null : `${control}-availability`,
                    missingConnection ? `${control}-connection` : null,
                    compatibility.length ? `${control}-compatibility` : null].filter(Boolean).join(' ');
                  return (
                    <li key={destination.id} className="min-w-0">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                        <input id={control} type="checkbox" className="mt-1" aria-describedby={description || undefined}
                          checked={bound.includes(destination.id)} onChange={(event) => onChange(event.target.checked
                            ? [...bound, destination.id] : bound.filter((id) => id !== destination.id))} />
                        <div className="min-w-0">
                          <label htmlFor={control} className="inline-flex items-center gap-2 text-body font-medium">{type && <ProviderMark type={type} className="size-4 shrink-0" />}{destination.label}</label>
                          <div className="flex flex-wrap gap-x-2">
                            {type !== undefined && <Description as="span" id={`${control}-provider`}>{type.label}</Description>}
                            {said !== null && <Description as="span" id={`${control}-target`}>{said}</Description>}
                          </div>
                          {bound.includes(destination.id) && automatic.length > 0 &&
                            <Description className="mt-1 [overflow-wrap:anywhere]">{sprintf(__('Sending %s automatically.', 'wconvert'), automaticText)}</Description>}
                          {compatibility.length > 0 && <ul id={`${control}-compatibility`} className="mb-0 mt-2 ps-4 text-note text-warning">
                            {compatibility.map((problem) => <li key={problem}>{problem}</li>)}
                          </ul>}
                          {missingConnection && <Description as="span" id={`${control}-connection`} className="block text-warning">
                            {__('Account connection needed. Open Settings to connect.', 'wconvert')}
                          </Description>}
                          {destination.availability !== 'ready' && (
                            <Description as="span" id={`${control}-availability`} className="block text-warning">
                              {destination.availability === 'locked' && isFreeInstall()
                                ? __('This destination type isn’t available on this site, so captures are kept here, not sent.', 'wconvert')
                                : destination.availability === 'locked'
                                ? sprintf(__('Needs %s, so captures are kept here, not sent. Re-push from Destinations once it runs.', 'wconvert'), tierProductName(type?.tier))
                                : sprintf(__('Needs %s on this site, so captures are kept here, not sent. Re-push from Destinations once it runs.', 'wconvert'), type?.requires_label ?? __('something this site does not have', 'wconvert'))}
                            </Description>
                          )}
                        </div>
                        {type !== undefined && <Button variant="outline" size="sm" aria-label={sprintf(__('Settings for %s', 'wconvert'), destination.label)}
                          onClick={(event) => {
                            returnFocus.current = event.currentTarget;
                            setNotice(null);
                            setSetup(destination);
                          }}><Settings2 aria-hidden="true" />{__('Settings', 'wconvert')}</Button>}
                      </div>
                      {bound.includes(destination.id) && template && onMappingChange && type?.supports_mapping &&
                        <ExtraAnswerMapping providerLabel={type.label} destination={destination} submissionId={template.tree.submissions[0]?.id ?? ''} template={template} value={mappings[destination.id] ?? {}} onChange={(map) => onMappingChange(destination.id, map)} />}
                      {bound.includes(destination.id) && template && type && !type.supports_mapping && hasExtraAnswers(template, template.tree.submissions[0]?.id ?? '') &&
                        <UnsupportedAnswerMapping />}
                    </li>
                  );
                })}
              </ul>
            </RegionBody>
          )}

        {missing.length > 0 && <RegionBody className="border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/5 p-3">
            <div>
              <p className="m-0 font-medium">{sprintf(_n('%d selected destination has been deleted.', '%d selected destinations have been deleted.', missing.length, 'wconvert'), missing.length)}</p>
              <Description>{__('Remove deleted destinations, then choose replacements if needed.', 'wconvert')}</Description>
            </div>
            <Button variant="outline" size="sm" onClick={() => onChange(bound.filter((id) => !missing.includes(id)))}>
              {__('Remove missing destinations', 'wconvert')}
            </Button>
          </div>
        </RegionBody>}

        {hint !== null && <RegionFooter><details className="text-note">
          <summary className="cursor-pointer">{__('Setup guidance', 'wconvert')}</summary>
          <Description className="mt-2">{hint}</Description>
        </details></RegionFooter>}
      </Region>
      {setup !== null && <DestinationSetupDialog destination={setup === 'add' ? undefined : setup}
        types={types} connections={connections} onConnectionSaved={onConnectionSaved} returnFocusTo={returnFocus} onClose={() => setSetup(null)}
        onSaved={(destinations) => {
          if (setup === 'add' && available.status === 'ready') setAddedIds(destinations.filter(item => !available.data.some(old => old.id === item.id)).map(item => item.id));
          onSaved(destinations);
          setNotice(setup === 'add'
            ? __('Destination added. Select it to use it for this campaign.', 'wconvert')
            : __('Destination updated for all campaigns using it.', 'wconvert'));
        }} />}
    </>
  );
}
