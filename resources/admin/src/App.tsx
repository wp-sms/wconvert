import { useCallback, useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowLeft, Plus, TriangleAlert } from 'lucide-react';
import { GoalScreen, OptinBuilder } from './builder/lazy';
import { LeadLog } from './leads/LeadLog';
import { OptinList } from './optins/OptinList';
import { Settings } from './settings-page/Settings';
import { Dashboard } from './stats/Dashboard';
import { Destinations } from './destinations/Destinations';
import { readDestinations } from './destinations/api';
import { issueCount } from './destinations/issueCount';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { BackLink } from './shell/BuilderSkeleton';
import { Shell } from './shell/Shell';
import { createHref, editorHref, hashFor, leadsHref, reportHref, sendingIssuesHref } from './nav';
import { useAdminNavigation, type EditingState } from './hooks/useAdminNavigation';
import { ConfirmDialog } from './shell/ConfirmDialog';

/**
 * The WConvert admin screen.
 *
 * **One section at a time, and the builder replaces even the tabs.** The
 * builder is a place a merchant sits down with; everything else is a list or a
 * report they read in passing, and the two do not belong on one page. That
 * distinction was always the design — what was missing until #62 is the nav
 * the v1 map decided ("conventional nav in v1"), without which the four
 * reading screens were one scroll and the create flow sat permanently on top
 * of them.
 *
 * Creating an Optin still lands IN the builder, which is what the goal-first
 * flow has always described: pick a [[Goal]], pick a [[Playbook]] under it,
 * land in an editor holding a prefilled Optin. What changed is where that flow
 * starts from — a button on the Optin list rather than the top of every visit.
 *
 * **The frame is WConvert's as of ADR 0035** and the hash router underneath it
 * extends #62 with addressable reading state and guarded editor routes. `nav.ts` was always the load-bearing half of that
 * ticket; the `nav-tab` strip it fed was scaffolding, and {@see Shell} is what
 * replaced it.
 */
export function App() {
  const navigation = useAdminNavigation();
  const { route, navigate, onEditingStateChange } = navigation;
  const section = route.section;
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [campaignsEmpty, setCampaignsEmpty] = useState(false);
  const campaignBusyRef = useRef(false);
  const onCampaignEditingStateChange = useCallback((state: EditingState) => {
    campaignBusyRef.current = state.busy;
    setCampaignBusy(state.busy);
    onEditingStateChange(state);
  }, [onEditingStateChange]);
  const creating = route.creating;
  const startCreating = () => { if (!campaignBusyRef.current) navigate(createHref()); };
  const [sendingCount, setSendingCount] = useState<number | null>(null);
  const [sendingRefresh, setSendingRefresh] = useState(0);
  useEffect(() => {
    if (section !== 'leads' || route.leadsView === 'issues') return;
    let active = true;
    setSendingCount(null);
    void readDestinations().then((data) => { if (active) setSendingCount(issueCount(data)); }).catch(() => { if (active) setSendingCount(null); });
    return () => { active = false; };
  }, [section, route.leadsView, sendingRefresh]);

  const createButton = (
    <Button variant="brand" disabled={campaignBusy} onClick={startCreating}>
      <Plus aria-hidden="true" />
      {__('Create campaign', 'wconvert')}
    </Button>
  );

  // Navigation keeps the editor mounted while unsaved changes await a decision.
  // Its accepted route changes only after the merchant discards or saves them.
  if (route.editId !== undefined) {
    return <>
      <OptinBuilder key={navigation.hash} id={route.editId} initialTab={route.editorTab}
        backLabel={route.returnTo.startsWith('#analytics') ? __('Back to Analytics', 'wconvert')
          : route.returnTo.startsWith('#leads') ? __('Back to Leads', 'wconvert') : __('Back to Campaigns', 'wconvert')}
        onEditingStateChange={navigation.onEditingStateChange}
        onCreated={(createdId) => navigate(editorHref(createdId, route.returnTo))}
        onClose={() => navigate(route.returnTo)} />
      <ConfirmDialog open={navigation.pending} onOpenChange={(open) => { if (!open) navigation.stay(); }}
        title={__('Leave without saving?', 'wconvert')}
        description={__('Changes since your last save will be lost. The saved campaign stays as it is.', 'wconvert')}
        confirmLabel={__('Discard changes', 'wconvert')} cancelLabel={__('Keep editing', 'wconvert')}
        onConfirm={navigation.discard} returnFocusTo={navigation.returnFocusTo} />
    </>;
  }

  return (
    <Shell section={section} hidePageHeading={section === 'optins' && creating}
      hideDescription={section === 'leads'}
      pageTitle={section === 'leads' && route.leadsView === 'issues' ? __('Sending issues', 'wconvert') : undefined}
      // An empty list carries its own Create button; one primary action per screen.
      actions={section === 'optins' && !creating ? (campaignsEmpty ? undefined : createButton) : section === 'leads'
        ? route.leadsView === 'issues'
          ? <Button asChild variant="outline"><a href={leadsHref(route.leads)}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Back to Leads', 'wconvert')}</a></Button>
          : sendingCount !== null && sendingCount > 0
            // The count is destinations with a known problem, not undelivered
            // submissions; the amber badge is the shared "held back" colour.
            ? <Button asChild variant="outline"><a href={sendingIssuesHref()}>
              <TriangleAlert aria-hidden="true" />{__('Sending issues', 'wconvert')}
              <Badge variant="warning" className="tabular-nums">{sendingCount}</Badge>
            </a></Button>
            : undefined
        : undefined}>
      {section === 'optins' && (
        <OptinsSection
          creating={creating}
          onEditingStateChange={onCampaignEditingStateChange}
          onCreate={startCreating}
          onEmptyChange={setCampaignsEmpty}
          onCancelCreate={() => navigate(hashFor('optins'))}
          // A new campaign's editor returns to the list, never back into creation.
          onEdit={(id) => navigation.requestNavigation(editorHref(id, creating ? hashFor('optins') : navigation.hash || hashFor('optins')))}
        />
      )}
      {section === 'analytics' && <Dashboard query={route.report} onQueryChange={(query) => navigate(reportHref(query))} />}
      {section === 'leads' && <>
        {route.leadsView === 'issues' ? <Destinations mode="issues" onIssueCount={setSendingCount} onEditingStateChange={navigation.onEditingStateChange} /> : <LeadLog query={route.leads} onRefresh={() => setSendingRefresh((value) => value + 1)} onQueryChange={(query) => navigate(leadsHref(query))} />}
      </>}
      {section === 'settings' && <Settings key={navigation.hash} group={route.settingsGroup} destinationId={route.destinationId} onEditingStateChange={navigation.onEditingStateChange} />}
      <ConfirmDialog open={navigation.pending} onOpenChange={(open) => { if (!open) navigation.stay(); }}
        title={__('Leave without saving?', 'wconvert')} description={__('Changes since your last save will be lost. What you saved stays as it is.', 'wconvert')}
        confirmLabel={__('Discard changes', 'wconvert')} cancelLabel={__('Keep editing', 'wconvert')}
        onConfirm={navigation.discard} returnFocusTo={navigation.returnFocusTo} />
    </Shell>
  );
}

/**
 * The Optin list, with creation behind the button that starts it.
 *
 * **Not two doors into creation.** {@see OptinList} says in as many words that
 * it does not create an Optin, because a second door skipping the [[Goal]]
 * registry is the drift the registry exists to stop (ADR 0026). This keeps
 * that: the button opens the same goal-first flow, and the only thing it
 * changes is that the flow is not already open.
 *
 * The button itself now lives in the page header — a screen's primary action
 * beside the screen's name, rather than floating above the table it does not
 * act on.
 */
function OptinsSection({
  creating,
  onEditingStateChange,
  onCreate,
  onEmptyChange,
  onCancelCreate,
  onEdit,
}: {
  creating: boolean;
  onEditingStateChange: (state: EditingState) => void;
  onCreate: () => void;
  onEmptyChange: (empty: boolean) => void;
  onCancelCreate: () => void;
  onEdit: (id: string) => void;
}) {
  const onListBusyChange = useCallback((busy: boolean) => onEditingStateChange({ dirty: false, busy }), [onEditingStateChange]);
  if (creating) {
    return <CreationFlow onCancel={onCancelCreate} onEdit={onEdit} onEditingStateChange={onEditingStateChange} />;
  }

  /*
   * `onCreate` is the SAME door the page header opens, handed down so the
   * empty state can carry it. An empty screen whose only way forward is a
   * button in a band the merchant has already read past is an empty screen
   * with a dead end in it (ADR 0039).
   */
  return (
    <div className="flex flex-col gap-5">
      <OptinList onEdit={onEdit} onCreate={onCreate} onBusyChange={onListBusyChange} onEmptyChange={onEmptyChange} />
    </div>
  );
}

/** Owns creation's temporary navigation guard until the editor takes over. */
function CreationFlow({ onCancel, onEdit, onEditingStateChange }: {
  onCancel: () => void;
  onEdit: (id: string) => void;
  onEditingStateChange: (state: EditingState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const ownsGuard = useRef(true);
  useEffect(() => {
    ownsGuard.current = true;
    return () => { ownsGuard.current = false; };
  }, []);
  const onBusyChange = useCallback((next: boolean) => {
    if (!ownsGuard.current) return;
    setBusy(next);
    onEditingStateChange({ dirty: false, busy: next });
  }, [onEditingStateChange]);
  const leave = () => {
    if (busy) return;
    ownsGuard.current = false;
    onEditingStateChange({ dirty: false, busy: false });
    onCancel();
  };
  return <>
    <BackLink className="mb-4" onClose={leave} disabled={busy} />
    <GoalScreen onBusyChange={onBusyChange} onCheckOptins={leave} onCreated={(id) => {
      // Release before navigating; a late child cleanup must not overwrite
      // the newly mounted editor's dirty/busy state.
      ownsGuard.current = false;
      onEditingStateChange({ dirty: false, busy: false });
      onCancel();
      onEdit(id);
    }} />
  </>;
}
