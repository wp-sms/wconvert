import { useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Inbox, Plug, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { DestinationSetupDialog } from './DestinationSetupDialog';
import { DestinationCard } from './DestinationCard';
import { listWithAnd } from './rules/sentence';
import { AddDestinationPicker, ProviderTiles, type ChannelRule } from './AddDestinationPicker';
import { Description } from '../shell/Description';
import { EmptyState } from '../shell/EmptyState';
import { Region, RegionBody, RegionError, RegionErrorState, RegionHeader } from '../shell/Region';
import { RowsSkeleton } from '../shell/RowsSkeleton';
import { outcomeHandoffIssue, type OutcomeContract } from '../goals/outcome';
import { SendTestDialog } from '../destinations/SendTestDialog';
import { capturedFields, contactFieldNames } from '../destinations/requirements';
import type { Loadable } from '../shell/loadable';
import type { Connection, Destination, DestinationType } from '../destinations/api';
import type { Template } from '@renderer/types';

/**
 * Where one save point of this [[Optin]] sends its [[Lead]]s, and whether that
 * is working.
 *
 * A Campaign binds shared Destination ids. Its optional extra-answer map is
 * stored beside the binding and frozen with the accepted submission. Basic
 * contact fields remain provider-owned and need no merchant mapping.
 *
 * ============================================================================
 * ONLY THE BOUND ROUTES ARE DRAWN.
 * ============================================================================
 * This listed every site route as a checkbox, so a site with twelve showed
 * twelve and the two this Campaign used had to be found among them — with the
 * warnings of the other ten beside them. Now each bound route is a card with
 * the Settings screen's own health badge, and **Add destination** opens a
 * picker over the rest. A route created from here is selected in the same
 * draft edit, so Undo removes it (ADR 0074).
 *
 * A Destination whose type is not `ready` is still shown and still bound — the
 * binding is a decision the merchant made, and unbinding it because a plugin
 * was deactivated for an afternoon would lose it silently. It is the DISPATCH
 * that skips it, on every capture, and self-heals when the dependency comes
 * back (ADR 0027 draws the same line for a suspended [[Condition]]).
 *
 * The site's list is read by the screen, not here: {@see ReadinessPanel} needs
 * the same payload, and two components fetching one list is two failure paths.
 */
export interface DestinationsEditorProps {
  readonly outcome?: OutcomeContract;
  readonly template?: Template;
  readonly bound: readonly string[];
  /**
   * The site's Destinations, in the three states a read has. A failed read is
   * never shown as an empty site, nor as proof that bound routes were deleted.
   */
  readonly available: Loadable<readonly Destination[]>;
  /**
   * The types those routes run over, for the two absences that are not one —
   * *you have not bought the tier* and *this site is missing a plugin* (ADR 0026).
   */
  readonly types: readonly DestinationType[];
  /**
   * Type ids the [[Playbook]] this Optin started from works well with, tagged
   * *Suggested* where a new route is set up.
   */
  readonly suggested?: readonly string[];
  readonly onChange: (bound: string[]) => void;
  readonly connections: readonly Connection[];
  /** Re-reads the site's routes: when the picker opens, and to retry a failed read. */
  readonly onRefresh: () => void;
  /** Why the last re-read failed, while the routes from before it stay on screen. */
  readonly refreshError?: string | null;
  readonly onSaved: (destinations: readonly Destination[]) => void;
  readonly onConnectionSaved?: (connection: Connection) => void;
  readonly mappings?: Readonly<Record<string, Record<string, string>>>;
  readonly onMappingChange?: (destinationId: string, map: Record<string, string>) => void;
  /** The save point these routes receive. The template's first submission unless named. */
  readonly submissionId?: string;
  /** The audience this save point subscribes, if any, for what the picker refuses. */
  readonly channel?: ChannelRule | null;
  readonly title?: string;
  readonly description?: string;
  /** What an empty selection means for this save point. */
  readonly emptyText?: string;
  /** The main save point shows the always-on Lead log row and the publish requirement. */
  readonly primary?: boolean;
  /** "Keep in WConvert only": no routes, and the Lead log row says what that means. */
  readonly local?: boolean;
  /** The visible email suggestion for a test send. Sending always requires an explicit address. */
  readonly testEmail?: string | null;
  /** Answers a "connect a service or keep them here" blocker in place. */
  readonly onKeepLocal?: () => void;
}

type Setup = { destination?: Destination; type?: string; focusField?: string } | null;

/** Choices edit this Optin's draft; setup edits a shared site destination. */
export function DestinationsEditor({
  bound, available, types, suggested = [], connections, onChange, onRefresh, onSaved, onConnectionSaved, template, outcome,
  mappings = {}, onMappingChange, submissionId, channel = null, refreshError = null, title, description, emptyText, primary = true, local = false, testEmail = null, onKeepLocal,
}: DestinationsEditorProps) {
  const [picking, setPicking] = useState(false);
  const [setup, setSetup] = useState<Setup>(null);
  const [testing, setTesting] = useState<Destination | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const submission = submissionId ?? template?.tree.submissions[0]?.id ?? '';
  const site = available.status === 'ready' ? available.data : [];
  const cards = bound.map((id) => site.find((destination) => destination.id === id)).filter((each): each is Destination => each !== undefined);
  const missing = available.status === 'ready' ? bound.filter((id) => !site.some((destination) => destination.id === id)) : [];
  const handoffIssue = primary && outcome && available.status === 'ready' ? outcomeHandoffIssue(outcome, bound, site) : null;
  const names = contactFieldNames();
  const saved = capturedFields(template, submission).filter((field) => field.name in names).map((field) => names[field.name]);
  /* translators: %s: the contact fields a signup collects, e.g. “email and name”. */
  const subtitle = description ?? (saved.length > 0 ? sprintf(__('Receives %s from this signup.', 'wconvert'), listWithAnd(saved)) : undefined);
  const typeOf = (destination: Destination) => types.find((type) => type.id === destination.type);

  const openPicker = (trigger: HTMLElement) => {
    returnFocus.current = trigger;
    onRefresh();
    setPicking(true);
  };
  const add = (
    <Button ref={addButton} variant="outline" size="sm" disabled={available.status !== 'ready'} onClick={(event) => openPicker(event.currentTarget)}>
      <Plus aria-hidden="true" />{__('Add destination', 'wconvert')}
    </Button>
  );
  const remove = (id: string) => {
    onChange(bound.filter((each) => each !== id));
    // The card that held focus is gone; Add — on the heading, or in the empty
    // state once the last card goes — is the next thing on this region.
    requestAnimationFrame(() => addButton.current?.focus());
  };

  return (
    <>
      <Region className="wconvert-destinations-region">
        {refreshError !== null && available.status === 'ready' && !local &&
          <RegionError message={refreshError} onRetry={onRefresh} />}

        <RegionHeader title={title ?? __('Where leads go', 'wconvert')} level={3} description={subtitle}
          trailing={!local && cards.length > 0 ? add : undefined} />

        {handoffIssue && !local && <RegionBody className="border-b border-border">
          <div role="status" className="wconvert-destination-callout">
            <p className="m-0">{handoffIssue}</p>
            {/* The answer beside the question: one click, undoable (ADR 0132). */}
            {onKeepLocal && outcome?.audience_channel && <Button type="button" variant="outline" onClick={onKeepLocal}>{__('Keep in WConvert only', 'wconvert')}</Button>}
          </div>
        </RegionBody>}

        <RegionBody className="flex flex-col gap-3">
          {primary && <div className="wconvert-destination-always">
            <Inbox aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="m-0 font-medium">{__('Saved in Leads', 'wconvert')}</p>
              <Description>{local
                ? __('Kept for review or export. Nothing is sent to another service.', 'wconvert')
                : __('Every submission is saved here first, even if a destination fails.', 'wconvert')}</Description>
            </div>
            <span className="text-note font-semibold text-muted-foreground">{__('Always', 'wconvert')}</span>
          </div>}

          {local ? null
            : available.status === 'loading' ? <RowsSkeleton />
            : available.status === 'failed' ? <RegionErrorState message={available.message} hint={__('Your draft is unchanged.', 'wconvert')} onRetry={onRefresh} />
            : site.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="m-0 font-medium">{__('Choose a service to set up', 'wconvert')}</p>
                {outcome && !handoffIssue && primary && <Description>{__('Leads stay in WConvert. Add a destination only if you want to send them on.', 'wconvert')}</Description>}
                <ProviderTiles types={types} rule={channel} suggested={suggested}
                  onChoose={(type, trigger) => { returnFocus.current = trigger; setSetup({ type: type.id }); }} />
              </div>
            ) : cards.length === 0 ? (
              <EmptyState icon={Plug} title={__('No destinations selected', 'wconvert')}
                action={<Button ref={addButton} variant="outline" onClick={(event) => openPicker(event.currentTarget)}><Plus aria-hidden="true" />{__('Add destination', 'wconvert')}</Button>}>
                {emptyText ?? __('Leads stay in WConvert. Add a destination to also send them to your email or SMS service.', 'wconvert')}
              </EmptyState>
            ) : cards.map((destination) => (
              <DestinationCard key={destination.id} destination={destination} type={typeOf(destination)} template={template}
                submissionId={submission} connections={connections} mapping={mappings[destination.id] ?? {}}
                focusOnMount={focusId === destination.id}
                onEdit={(trigger, focusField) => { returnFocus.current = trigger; setSetup({ destination, focusField }); }}
                onTest={(trigger) => { returnFocus.current = trigger; setTesting(destination); }}
                onRemove={() => remove(destination.id)}
                onMappingChange={onMappingChange ? (map) => onMappingChange(destination.id, map) : undefined} />
            ))}

          {missing.length > 0 && !local &&
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning-surface p-3">
              <div>
                <p className="m-0 font-medium">{sprintf(_n('%d selected destination has been deleted.', '%d selected destinations have been deleted.', missing.length, 'wconvert'), missing.length)}</p>
                <Description>{__('Remove deleted destinations, then choose replacements if needed.', 'wconvert')}</Description>
              </div>
              <Button variant="outline" onClick={() => onChange(bound.filter((id) => !missing.includes(id)))}>
                {__('Remove missing destinations', 'wconvert')}
              </Button>
            </div>}
        </RegionBody>
      </Region>

      {picking && <AddDestinationPicker destinations={site} types={types} connections={connections} bound={bound} rule={channel}
        suggested={suggested} returnFocusTo={returnFocus}
        description={title === undefined ? __('Choose one you already use, or set up a new one.', 'wconvert')
          /* translators: %s: the signup this route is for, e.g. “Optional SMS signup”. */
          : sprintf(__('For %s. Choose one you already use, or set up a new one.', 'wconvert'), title)}
        onClose={() => setPicking(false)}
        onPick={(id) => { returnFocus.current = null; setFocusId(id); setPicking(false); onChange([...bound, id]); }}
        onCreate={(type) => { setPicking(false); setSetup({ type: type.id }); }} />}

      {setup !== null && <DestinationSetupDialog destination={setup.destination} initialType={setup.type} focusField={setup.focusField}
        types={types} connections={connections} onConnectionSaved={onConnectionSaved} returnFocusTo={returnFocus} onClose={() => setSetup(null)}
        onSaved={(destinations) => {
          if (setup.destination === undefined) {
            const created = destinations.filter((item) => !site.some((old) => old.id === item.id)).map((item) => item.id);
            if (created.length > 0) {
              returnFocus.current = null;
              setFocusId(created[0]);
              onChange([...bound, ...created.filter((id) => !bound.includes(id))]);
            }
          }
          onSaved(destinations);
        }} />}

      {testing !== null && <SendTestDialog destination={testing} type={typeOf(testing)} initialEmail={testEmail} settingsDirty={false}
        returnFocusTo={returnFocus} onClose={() => setTesting(null)} onSent={() => undefined} />}
    </>
  );
}
