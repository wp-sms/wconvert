import { useCallback, useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Plus } from 'lucide-react';
import { GoalScreen, OptinBuilder } from './builder/lazy';
import { LeadLog } from './leads/LeadLog';
import { OptinList } from './optins/OptinList';
import { SiteAllowance } from './optins/SiteAllowance';
import { Dashboard } from './stats/Dashboard';
import { Destinations } from './destinations/Destinations';
import { Button } from './components/ui/button';
import { BackLink } from './shell/BuilderSkeleton';
import { Shell } from './shell/Shell';
import { NarrowScreenNotice } from './shell/NarrowScreenNotice';
import { useBuilderViewport } from './hooks/useBuilderViewport';
import { editorHref, leadsHref, reportHref } from './nav';
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
  const { route, navigate } = navigation;
  const section = route.section;
  const [creating, setCreating] = useState(false);

  const createButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden="true" />
      {__('Create a campaign', 'wconvert')}
    </Button>
  );

  // Navigation keeps the editor mounted while unsaved changes await a decision.
  // Its accepted route changes only after the merchant discards or saves them.
  if (route.editId !== undefined) {
    return <>
      <BuilderScreen key={navigation.hash} id={route.editId}
        backLabel={route.returnTo.startsWith('#analytics') ? __('Back to Analytics', 'wconvert')
          : route.returnTo.startsWith('#leads') ? __('Back to Leads', 'wconvert') : __('Back to Campaigns', 'wconvert')}
        onEditingStateChange={navigation.onEditingStateChange}
        onCreated={(createdId) => navigate(editorHref(createdId, route.returnTo))}
        onNarrowClose={() => navigation.requestNavigation(route.returnTo)}
        onClose={() => navigate(route.returnTo)} />
      <ConfirmDialog open={navigation.pending} onOpenChange={(open) => { if (!open) navigation.stay(); }}
        title={__('Leave without saving?', 'wconvert')}
        description={__('Your changes to this Campaign will be lost.', 'wconvert')}
        confirmLabel={__('Discard changes', 'wconvert')} cancelLabel={__('Keep editing', 'wconvert')}
        onConfirm={navigation.discard} returnFocusTo={navigation.returnFocusTo} />
    </>;
  }

  return (
    <Shell section={section} hidePageHeading={section === 'optins' && creating}
      actions={section === 'optins' && !creating ? createButton : undefined}>
      {section === 'optins' && (
        <OptinsSection
          creating={creating}
          onEditingStateChange={navigation.onEditingStateChange}
          onCreate={() => setCreating(true)}
          onCancelCreate={() => setCreating(false)}
          onEdit={(id) => navigate(editorHref(id, navigation.hash || '#optins'))}
        />
      )}
      {section === 'analytics' && <Dashboard query={route.report} onQueryChange={(query) => navigate(reportHref(query))} />}
      {section === 'leads' && <LeadLog query={route.leads} onQueryChange={(query) => navigate(leadsHref(query))} />}
      {section === 'destinations' && <Destinations destinationId={route.destinationId} />}
    </Shell>
  );
}

/**
 * The builder, or the sentence that stands where it would.
 *
 * Initial arrival below 782px does not fetch the lazy editor or its data
 * (ADR 0038). Once opened, a draft survives window resizing or rotation:
 * the editor stays mounted, hidden and inert, behind the narrow notice.
 * A dialog already open may finish or close without losing its own edits.
 * The visible way out uses the same unsaved-work guard as browser navigation.
 */
function BuilderScreen({ id, onClose, onNarrowClose, backLabel, onEditingStateChange, onCreated }: {
  id: string; onClose: () => void; onNarrowClose: () => void; backLabel: string; onEditingStateChange: (state: EditingState) => void; onCreated: (id: string) => void;
}) {
  const fits = useBuilderViewport();
  const [opened, setOpened] = useState(fits);
  useEffect(() => { if (fits) setOpened(true); }, [fits]);

  return (
    <>
      {!fits && <Shell>
        <BackLink className="mb-4" onClose={onNarrowClose} label={backLabel} />
        <NarrowScreenNotice />
      </Shell>}
      {/* First arrival on a phone still avoids the lazy chunk and reads. Once
          mounted, keep the draft alive if the window narrows or rotates. */}
      {(fits || opened) && <div hidden={!fits} inert={!fits}>
        <OptinBuilder id={id} onClose={onClose} backLabel={backLabel} onEditingStateChange={onEditingStateChange} onCreated={onCreated} />
      </div>}
    </>
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
  onCancelCreate,
  onEdit,
}: {
  creating: boolean;
  onEditingStateChange: (state: EditingState) => void;
  onCreate: () => void;
  onCancelCreate: () => void;
  onEdit: (id: string) => void;
}) {
  if (creating) {
    return <CreationFlow onCancel={onCancelCreate} onEdit={onEdit} onEditingStateChange={onEditingStateChange} />;
  }

  /*
   * `onCreate` is the SAME door the page header opens, handed down so the
   * empty state can carry it. An empty screen whose only way forward is a
   * button in a band the merchant has already read past is an empty screen
   * with a dead end in it (ADR 0039).
   */
  /*
   * Two regions, because this screen holds two objects (ADR 0039). The list is
   * what exists; the allowance below it is how often a visitor may meet ANY of
   * them, which is a site-wide decision with no Optin to hang on and therefore
   * nowhere in the builder to live.
   */
  return (
    <div className="flex flex-col gap-5">
      <OptinList onEdit={onEdit} onCreate={onCreate} />
      <SiteAllowance />
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
