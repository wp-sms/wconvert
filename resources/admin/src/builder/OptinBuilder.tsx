import './editor.css';
import { Activity, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  ArrowLeft,
  Blocks,
  Eye,
  Layers,
  MoreHorizontal,
  MousePointer2,
  Redo2,
  SlidersHorizontal,
  Target,
  Undo2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BackLink, BuilderSkeleton } from '../shell/BuilderSkeleton';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { EmptyState } from '../shell/EmptyState';
import { PageAction } from '../shell/PageActions';
import { PageError, Region, RegionErrorState } from '../shell/Region';
import { Skeleton } from '../components/ui/skeleton';
import { Stat, StatRow, StatRowSkeleton } from '../shell/Stat';
import { LOADING, failed, messageOf, read, ready, type Loadable } from '../shell/loadable';
import { TemplatePickerDialog } from './TemplatePickerDialog';
import { useTemplateTrees } from './TemplatePicker';
import { DestinationsEditor } from './DestinationsEditor';
import { CaptureModeChoice } from './CaptureModeChoice';
import { ReadinessDialog } from './ReadinessDialog';
import { hintIn, hintSaid } from './destinations';
import { DisplayRules, type DisplayRulesValue } from './rules/DisplayRules';
import { DevExport } from './DevExport';
import { Fullscreen } from './Fullscreen';
import { PayloadMeter } from './PayloadMeter';
import { ScopeStyle } from './ScopeStyle';
import { StructureView } from './StructureView';
import { DesignSettings } from './DesignSettings';
import { EditorCanvas, ScreenControls, DeviceControls } from './EditorCanvas';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { canRedo, canUndo, historyOf, redo, remember, undo, type History } from './structure/history';
import { nearestTo, samePath } from './structure/tree';
import { convertingActOf } from './structure/guards';
import type { ConvertingAct } from './structure/catalogue';
import { listGoals, listPlaybooks, type GoalEntry } from '../goals/api';
import { offerableGoals } from '../goals/GoalCard';
import { goalSaid } from '../goals/said';
import { ChangeGoalDialog } from './ChangeGoalDialog';
import { slotsOf, type Path } from './panel';
import { validDraftInterestOptions } from './InterestOptions';
import {
  getOptin,
  getRules,
  saveOptin,
  type Frequency,
  type Rule,
  type RuleVocabulary,
  type Targeting,
} from './api';
import { keyOf, pathOfKey, type Selection, type SlotKey } from './slots';
import {
  getTemplateTrees,
  listTemplates,
  prepareTemplate,
  type TemplateIndex,
  type TemplateIndexEntry,
  type TemplateEntry,
} from '../templates/api';
import { numbersByOptin, readDashboard, type OptinNumbers } from '../stats/api';
import { formatCount, formatRate } from '../stats/format';
import { readDestinations, type DestinationsPayload } from '../destinations/api';
import { adminSettings } from '../settings';
import { readPrivacyGuidance } from '../privacy/api';
import { createOptin, publishOptin } from '../optins/api';
import { editorHref } from '../nav';
import type { EditingState } from '../hooks/useAdminNavigation';
import type { Template, Tokens as TokenBag } from '@renderer/types';

export interface OptinBuilderProps {
  readonly id: string;
  readonly onClose: () => void;
  readonly backLabel?: string;
  readonly onEditingStateChange?: (state: EditingState) => void;
  readonly onCreated?: (id: string) => void;
}

type Config = Record<string, unknown>;
interface DraftSnapshot {
  name: string;
  config: Config;
}

type TabId = 'design' | 'rules' | 'destinations';

type Width = 'own' | 'narrow';

const TYPES_INTO = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number']);

function typesInto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && TYPES_INTO.has(target.type))
  );
}

export function OptinBuilder({ id, onClose, backLabel, onEditingStateChange, onCreated }: OptinBuilderProps) {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [canChangeGoal, setCanChangeGoal] = useState(true);
  const [unpublishedChanges, setUnpublishedChanges] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [suspended, setSuspended] = useState<string | null>(null);
  const [deletedAt, setDeletedAt] = useState<string | null>(null);
  const [vocabulary, setVocabulary] = useState<RuleVocabulary | null>(null);
  const [gallery, setGallery] = useState<TemplateIndex | null>(null);

  const [browsing, setBrowsing] = useState(false);
  const browse = useRef<HTMLButtonElement>(null);
  const restoreBrowseFocus = useRef(false);

  const [fatal, setFatal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState('');
  const dirty = config !== null && baseline !== JSON.stringify({ name, config });
  useEffect(() => { onEditingStateChange?.({ dirty, busy }); }, [dirty, busy, onEditingStateChange]);
  const [showLayers, setShowLayers] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => {
    if (!browsing && !busy && restoreBrowseFocus.current) {
      restoreBrowseFocus.current = false;
      browse.current?.focus();
    }
  }, [browsing, busy]);
  const [details, setDetails] = useState(false);
  const detailsTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    document.body.classList.add('wconvert-editing');
    return () => document.body.classList.remove('wconvert-editing');
  }, []);
  const [tab, setTab] = useState<TabId>('design');

  const [openToken, setOpenToken] = useState<string | null>(null);

  const [copiedLook, setCopiedLook] = useState<TokenBag | null>(null);
  const [step, setStep] = useState(0);
  const [width, setWidth] = useState<Width>('own');
  const [selection, setSelection] = useState<Selection | null>(null);

  const [stats, setStats] = useState<Loadable<OptinNumbers | null>>(LOADING);

  const [past, setPast] = useState<History<DraftSnapshot> | null>(null);

  const [goals, setGoals] = useState<Loadable<GoalEntry[]>>(LOADING);

  const [changingGoal, setChangingGoal] = useState(false);
  const changeGoal = useRef<HTMLButtonElement>(null);

  const [siblingAct, setSiblingAct] = useState<ConvertingAct | null>(null);

  const [playbook, setPlaybook] = useState<Loadable<string | null>>(LOADING);

  const [destinations, setDestinations] = useState<Loadable<DestinationsPayload>>(LOADING);

  const [privacyGuidance, setPrivacyGuidance] = useState(false);

  const [focusRow, setFocusRow] = useState<{ path: Path } | null>(null);

  const [revealSection, setRevealSection] = useState<{ id: string; focus?: string } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  const destinationsTab = useRef<HTMLButtonElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);
  const layersButton = useRef<HTMLButtonElement>(null);

  const coalescing = useRef<string | null>(null);

  const report = useCallback((cause: unknown) => setError(messageOf(cause)), []);

  const goalEntry: Loadable<GoalEntry | null> = useMemo(() => {
    if (goals.status === 'loading' || goal === null) {
      return LOADING;
    }

    return ready(goals.status === 'ready' ? (goals.data.find((each) => each.id === goal) ?? null) : null);
  }, [goals, goal]);

  const entryOfGoal = goalEntry.status === 'ready' ? goalEntry.data : null;

  const numbers = stats.status === 'ready' ? stats.data : null;

  const bound = Array.isArray(config?.destinations) ? (config.destinations as string[]) : [];

  const displayRules = {
    rules: Array.isArray(config?.rules) ? (config.rules as Rule[]) : [],
    targeting: (config?.targeting ?? {}) as Targeting,
    frequency: (config?.frequency ?? {}) as Frequency,
    // **Two flat keys, read into one value.** They are stored beside
    // `frequency` and `priority` rather than nested, which is what
    // `PublishedProjection` ships and what `src/Optin/Schedule.php`
    // normalises; the object is this screen's shape for them, because one
    // control writing both is one patch and one undo step.
    schedule: {
      ...(typeof config?.starts_at === 'string' ? { starts_at: config.starts_at } : {}),
      ...(typeof config?.ends_at === 'string' ? { ends_at: config.ends_at } : {}),
    },
    priority: typeof config?.priority === 'number' ? config.priority : 0,
  };

  const template = config?.template as Template | undefined;
  const templateId = typeof config?.template_id === 'string' ? config.template_id : undefined;
  const templates = gallery?.templates;

  const act: ConvertingAct =
    template === undefined ? 'submit' : (convertingActOf(template.tree)[0] ?? 'submit');

  const overlay = config === null || displayTypeOf(config, templates) !== 'inline';

  const { trees, want, failed: failedTrees, retry: retryTree } = useTemplateTrees(getTemplateTrees);

  useEffect(() => {
    if (templateId !== undefined) {
      want(templateId);
    }
  }, [templateId, want]);

  const entry = useMemo(
    () =>
      template === undefined || templates === undefined ? null : entryFor(template, templateId, templates),
    [template, templateId, templates],
  );

  useEffect(() => {
    getOptin(id)
      .then((optin) => {
        setName(optin.name);
        setConfig(optin.config);
        setBaseline(JSON.stringify({ name: optin.name, config: optin.config }));
        setGoal(optin.goal);
        setPublishedAt(optin.published_at);
        setCanChangeGoal(optin.can_change_goal);
        setUnpublishedChanges(optin.has_unpublished_changes);
        setSuspended(optin.suspended);
        setDeletedAt(optin.deleted_at);
        setSiblingAct(optin.sibling_act);
      })
      .catch((cause: unknown) => setFatal(messageOf(cause)));
  }, [id]);

  useEffect(() => {
    getRules()
      .then(setVocabulary)
      .catch((cause: unknown) => setFatal(messageOf(cause)));
    listTemplates()
      .then(setGallery)
      .catch((cause: unknown) => setFatal(messageOf(cause)));
    listGoals()
      .then((entries) => setGoals(ready(entries)))

      .catch((cause: unknown) => setGoals(failed(cause)));
  }, []);

  useEffect(() => {
    const from = config?.playbook_id;

    if (typeof from !== 'string' || from === '') {
      setPlaybook(ready(null));

      return;
    }

    if (goal === null) {
      return;
    }

    listPlaybooks(goal)
      .then((entries) => setPlaybook(ready(entries.find((each) => each.id === from)?.name ?? null)))
      .catch(() => setPlaybook(ready(null)));
  }, [goal, config?.playbook_id]);

  const destinationRequest = useRef(0);
  const refreshDestinations = useCallback(() => {
    const request = ++destinationRequest.current;
    setDestinations(LOADING);
    void readDestinations()
      .then((payload) => { if (request === destinationRequest.current) setDestinations(ready(payload)); })
      .catch((cause: unknown) => { if (request === destinationRequest.current) setDestinations(failed(cause)); });
  }, []);
  useEffect(() => {
    const requests = destinationRequest;
    refreshDestinations();
    return () => { requests.current++; };
  }, [refreshDestinations]);

  useEffect(() => {
    let active = true;
    void readPrivacyGuidance()
      .then(({ enabled }) => { if (active) setPrivacyGuidance(enabled); })
      // Guidance is additive. A failed preference read must not block editing
      // or publishing, and it must not guess that the merchant enabled it.
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (config === null) return;

    const key = coalescing.current;

    coalescing.current = null;

    const into = key === null ? null : { key, at: Date.now() };

    setPast((current) => {
      const snapshot = { name, config };
      if (current === null) return historyOf(snapshot);
      if (current.present.name === name && current.present.config === config) return current;
      return remember(current, snapshot, into);
    });
  }, [name, config]);

  useEffect(() => {
    if (template === undefined) {
      return;
    }

    setSelection((current) => {
      if (current === null) {
        return current;
      }

      const path = nearestTo(template.tree, current.path);

      if (path === null) {
        return null;
      }

      return samePath(path, current.path) ? current : { ...current, path };
    });
  }, [template]);

  useEffect(() => {
    if (publishedAt === null || goal === null) {
      return;
    }

    readDashboard(null)
      .then((payload) => setStats(ready(numbersByOptin(payload)[id] ?? null)))
      // Swallowed, but not left LOADING: a failed read that kept the row
      // reserved would be a skeleton pulsing over a working builder forever.
      .catch(() => setStats(ready(null)));
  }, [id, goal, publishedAt]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // The wording is the browser's and has been for years; what this does is
      // opt in to being asked at all.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const edit = useCallback((changes: Config, coalesce?: string) => {
    coalescing.current = coalesce ?? null;
    // Gallery metadata is display-only; edits store the renderer's document.
    const changedTemplate = changes.template as Template | undefined;
    if (changedTemplate && Object.keys(changedTemplate).some((key) => key !== 'tree' && key !== 'tokens')) {
      changes = { ...changes, template: { tree: changedTemplate.tree, tokens: changedTemplate.tokens } };
    }
    setConfig((current) => (current === null ? current : { ...current, ...changes }));
    setSaved(false);
  }, []);

  const persistDraft = (next: Config = config ?? {}, nextGoal?: string) => {
    const design = next.template as Template | undefined;
    if (design && slotsOf(design.tree).some((slot) => slot.captures === 'interest'
      && !validDraftInterestOptions(slot.values.options))) {
      return Promise.reject(new Error(__('Fix the interest choices before saving: each entered choice needs a label and a unique valid sent value. Your changes are still here.', 'wconvert')));
    }
    return saveOptin(
      id,
      name,
      next,
      nextGoal,
      typeof next.template_id === 'string' ? next.template_id : undefined,
    )
      .then((optin) => {
        // The server's copy wins: it normalises against both vocabularies on
        // the way in, and a screen that kept its own would show a rule or a
        // node that was dropped at the boundary.
        setName(optin.name);
        setConfig(optin.config);
        setUnpublishedChanges(optin.has_unpublished_changes);
        // Normalization accepts this edit; it is not another user action.
        // Changing an unpublished Goal saves immediately, so
        // that explicit save starts a new local history rather than offering
        // an Undo that would silently need another server write.
        const present = { name: optin.name, config: optin.config };
        coalescing.current = null;
        setPast((current) => current === null || nextGoal !== undefined
          ? historyOf(present) : { ...current, present, merged: null });
        // And its copy of the Goal wins for the same reason. It is the column
        // the save actually wrote, so a refused correction leaves the band
        // saying what the Optin still holds rather than what was asked for.
        setGoal(optin.goal);
        setCanChangeGoal(optin.can_change_goal);
        setSaved(true);
        setBaseline(JSON.stringify({ name: optin.name, config: optin.config }));
      });
  };

  const save = (next: Config = config ?? {}, nextGoal?: string) => {
    if (busy) return Promise.resolve();
    setBusy(true);
    setError(null);
    return persistDraft(next, nextGoal).catch(report).finally(() => setBusy(false));
  };

  const publish = async () => {
    setBusy(true);
    setPublishing(true);
    setError(null);
    try {
      // A refused save must never promote the previously saved draft.
      if (dirty) await persistDraft();
      const accepted = await publishOptin(id);
      setPublishedAt(accepted.published_at);
      setCanChangeGoal(false);
      setUnpublishedChanges(accepted.has_unpublished_changes);
      setSuspended(accepted.suspended);
      setDeletedAt(accepted.deleted_at);
      setSaved(false);
    } finally {
      setBusy(false);
      setPublishing(false);
    }
  };

  const chooseFromPreview = useCallback((key: SlotKey) => {
    // One editing surface now, so there is no longer a tab this must NOT yank
    // a merchant away from: clicking a block asks to edit that block.
    setTab('design');

    setOpenToken(null);
    setSelection({ path: pathOfKey(key), from: 'preview' });
  }, []);

  const chooseFromTree = useCallback((path: Path) => {
    setOpenToken(null);
    setSelection({ path, from: 'tree' });

    if (typeof path[0] === 'number') {
      setStep(path[0]);
    }
  }, []);

  const prepareDesign = useCallback((picked: string, mode: 'keep' | 'sample', sample: Template) =>
    mode === 'sample'
      ? prepareTemplate(picked, { tree: sample.tree, tokens: sample.tokens }, picked)
      : prepareTemplate(picked, template ?? { tree: { steps: [] }, tokens: {} }, templateId),
  [template, templateId]);

  const stepping = useCallback(
    (move: (held: History<DraftSnapshot>) => History<DraftSnapshot>) => () => {
      if (past === null || busy) {
        return;
      }

      const next = move(past);

      if (next === past) {
        return;
      }

      setPast(next);
      coalescing.current = null;
      setName(next.present.name);
      setConfig(next.present.config);
      setSaved(false);
    },
    [past, busy],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'z') {
        return;
      }

      if (typesInto(event.target) || (event.target instanceof HTMLElement && event.target.closest('[role="dialog"], [role="alertdialog"]'))) {
        return;
      }

      event.preventDefault();
      stepping(event.shiftKey ? redo : undo)();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stepping]);

  const goTo = (path: Path) => {
    setTab('design');
    chooseFromTree(path);
    setShowLayers(true);
    setFocusRow({ path });
  };

  const goToSchedule = () => {
    setTab('rules');
    setRevealSection({ id: 'how-often', focus: 'wconvert-ends-at' });
  };

  const history = {
    canUndo: past !== null && canUndo(past),
    canRedo: past !== null && canRedo(past),
    undo: stepping(undo),
    redo: stepping(redo),
  };

  const leave = () => (dirty ? setLeaving(true) : onClose());


  if (fatal !== null) {
    return (
      <div className="flex flex-col gap-5">
        <PageAction>
          <BackLink onClose={onClose} label={backLabel} />
        </PageAction>
        <Region label={__('Campaign builder', 'wconvert')}>
          <RegionErrorState message={fatal} />
        </Region>
      </div>
    );
  }

  if (config === null || vocabulary === null || gallery === null) {
    return <BuilderSkeleton onClose={onClose} backLabel={backLabel} />;
  }

  const previewPane =
    entry === null ? null : (
      <EditorCanvas
        template={entry}
        name={chosenName(templateId, templates)}
        step={step}
        width={width}
        selected={tab !== 'design' || selection === null ? null : keyOf(selection.path)}
        onSelect={chooseFromPreview}
        interactive={previewing}
        onStep={setStep}
        displayType={displayTypeOf(config, templates)}
        placement={config.placement}
      />
    );
  const shownStep = Math.min(step, Math.max((entry?.tree.steps.length ?? 1) - 1, 0));
  const chooseStep = (next: number) => {
    setStep(next);
    setSelection(null);
    setOpenToken(null);
  };
  const designSettings = () => {
    setSelection(null);
    setOpenToken(null);
  };

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        flushSync(() => setOpenToken(null));
        setTab(value as TabId);
        setPreviewing(false);
      }}
      className="wconvert-workspace"
      data-preview={previewing ? 'true' : undefined}
    >
      <header className="wconvert-workspace__header">
        <Button
          ref={back}
          disabled={busy}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={backLabel ?? __('Back to Campaigns', 'wconvert')}
          title={backLabel ?? __('Back to Campaigns', 'wconvert')}
          onClick={leave}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <span className="wc-brand-mark wconvert-workspace__brand-mark" aria-hidden="true">
          w
        </span>
        <span className="sr-only">{__('WConvert', 'wconvert')}</span>
        <h1 className="sr-only">{name || __('Untitled Campaign', 'wconvert')}</h1>
        <label className="sr-only" htmlFor="wconvert-optin-name">
          {__('Name', 'wconvert')}
        </label>
        <input
          id="wconvert-optin-name"
          className="wconvert-workspace__name"
          value={name}
          placeholder={__('Untitled Campaign', 'wconvert')}
          disabled={busy}
          onChange={(event) => {
            coalescing.current = 'name';
            setName(event.target.value);
            setSaved(false);
          }}
        />
        <TabsList
          className="wconvert-workspace__navigation"
          aria-label={__('What you are editing', 'wconvert')}
        >
          <TabsTrigger value="design">{__('Design', 'wconvert')}</TabsTrigger>
          <TabsTrigger value="rules">{__('Display rules', 'wconvert')}</TabsTrigger>
          <TabsTrigger ref={destinationsTab} value="destinations">{__('Destinations', 'wconvert')}</TabsTrigger>
        </TabsList>
        <div className="wconvert-workspace__actions">

          <HistoryControls
            history={{ ...history, canUndo: !busy && history.canUndo, canRedo: !busy && history.canRedo }}
          />
          <Button
            variant="outline"
            ref={previewButton}
            disabled={entry === null || busy}
            onClick={() => {
              setTab('design');
              setPreviewing(!previewing);
              setSelection(null);
            }}
          >
            {previewing ? <MousePointer2 aria-hidden="true" /> : <Eye aria-hidden="true" />}
            {previewing ? __('Edit', 'wconvert') : __('Preview', 'wconvert')}
          </Button>
          <Button variant="outline" disabled={busy || !dirty} onClick={() => void save()}>
            {busy
              ? publishing ? __('Publishing…', 'wconvert') : __('Saving…', 'wconvert')
              : __('Save draft', 'wconvert')}
          </Button>
          <ReadinessDialog
            captureMode={config.capture_mode === 'local' ? 'local' : 'connected'}
            optinId={id}
            optin={{ published_at: publishedAt, deleted_at: deletedAt, suspended, has_unpublished_changes: unpublishedChanges }}
            dirty={dirty}
            busy={busy}
            goal={goalEntry}
            goalId={goal ?? ''}
            playbook={playbook}
            playbookId={typeof config.playbook_id === 'string' ? config.playbook_id : ''}
            rules={displayRules}
            vocabulary={vocabulary}
            displayType={displayTypeOf(config, templates)}
            placement={config.placement}
            bound={bound}
            template={template}
            destinations={read(destinations)?.destinations ?? null}
            fieldLabels={gallery.labels.fields}
            privacyGuidance={privacyGuidance}
            policyUrl={adminSettings()?.policyUrl}
            onPublish={publish}
            onPreview={() => { setTab('design'); setPreviewing(true); setSelection(null); previewButton.current?.focus(); }}
            onEditDesign={() => { setTab('design'); setPreviewing(false); setShowLayers(true); layersButton.current?.focus(); }}
            onGoToDesign={() => { setTab('design'); setPreviewing(false); setBrowsing(true); }}
            onGoToDestinations={() => { setTab('destinations'); destinationsTab.current?.focus(); }}
            onGoToRules={(section) => { setTab('rules'); setRevealSection({ id: section }); }}
            onGoTo={goTo}
            onGoToSchedule={goToSchedule}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            ref={changeGoal}
            disabled={busy}
            aria-label={__('Campaign details', 'wconvert')}
            onClick={(event) => { detailsTrigger.current = event.currentTarget; setDetails(true); }}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </div>
      </header>
      {error !== null && <PageError message={error} />}
      <div className="wconvert-workspace__body" inert={busy}>
        <TabsContent value="design" forceMount className="wconvert-workspace__design">
          <Activity mode={tab === 'design' ? 'visible' : 'hidden'}>
            {entry === null ? (
              <EmptyState
                icon={Blocks}
                title={__('Choose how this campaign appears', 'wconvert')}
                action={
                  <Button ref={browse} variant="outline" onClick={() => setBrowsing(true)}>
                    {__('Browse designs and formats', 'wconvert')}
                  </Button>
                }
              >
                {entryOfGoal
                  ? sprintf(
                      /* translators: %s: campaign goal. */
                      __('Start with a design that fits “%s”. You can explore other formats in the library.', 'wconvert'),
                      entryOfGoal.label,
                    )
                  : __('Start with a design and format that fit this campaign.', 'wconvert')}
              </EmptyState>
            ) : (
              <>
                <div className="wconvert-workspace__toolbar">
                  <div>
                    <Button
                      variant="ghost"
                      ref={layersButton}
                      aria-pressed={showLayers}
                      onClick={() => setShowLayers(!showLayers)}
                      disabled={previewing}
                    >
                      <Layers aria-hidden="true" />
                      {__('Layers', 'wconvert')}
                    </Button>
                    <Button variant="ghost" onClick={designSettings} disabled={previewing}>
                      <SlidersHorizontal aria-hidden="true" />
                      {__('Design settings', 'wconvert')}
                    </Button>
                  </div>
                  <ScreenControls template={entry} step={shownStep} onChange={chooseStep} />
                  <div>
                    <DeviceControls width={width} onChange={setWidth} />
                    <Fullscreen />
                  </div>
                </div>
                {previewing ? (
                  previewPane
                ) : (
                  <StructureView
                    template={entry}
                    labels={gallery.labels}
                    act={act}
                    selected={selection?.path ?? null}
                    onSelect={chooseFromTree}
                    onChange={(next, coalesce) => edit({ template: next }, coalesce)}
                    focus={focusRow}
                    endsAt={displayRules.schedule.ends_at}
                    onSetEndDate={goToSchedule}
                    showLayers={showLayers}
                    onShowLayers={() => setShowLayers(true)}
                    onDesign={designSettings}
                    step={shownStep}
                    width={width === 'narrow' ? 'narrow' : 'tokens'}
                    preview={previewPane}
                    look={
                      <>
                        {selection === null ? (
                          <DesignSettings
                            browseRef={browse}
                            mobile={width === 'narrow'}
                            template={entry}
                            labels={gallery.labels}
                            name={chosenName(templateId, templates)}
                            openToken={openToken}
                            onOpenToken={setOpenToken}
                            design={templateId === undefined ? {} : (trees.get(templateId)?.tokens ?? {})}
                            onChange={(next) => edit({ template: next })}
                            onError={report}
                            onBrowse={() => setBrowsing(true)}
                            displayType={displayTypeOf(config, templates)}
                            placement={config.placement}
                            onPlacementChange={(placement) => edit({ placement })}
                          />
                        ) : (
                          <ScopeStyle
                            key={selection.path.join('.')}
                            template={entry}
                            labels={gallery.labels}
                            path={selection.path}
                            openToken={openToken}
                            onOpenToken={setOpenToken}
                            onSelect={chooseFromTree}
                            onChange={(next) => edit({ template: next })}
                            copied={copiedLook}
                            onCopy={setCopiedLook}
                            width={width === 'narrow' ? 'narrow' : 'tokens'}
                          />
                        )}
                      </>
                    }
                  />
                )}
              </>
            )}
          </Activity>
        </TabsContent>
        <TabsContent value="rules" className="wconvert-workspace__secondary">
          <div className="wconvert-workspace__settings">
            <DisplayRules
              act={act}
              vocabulary={vocabulary}
              value={displayRules}
              overlay={overlay}
              onChange={(patch) => edit(asConfigPatch(patch) as Config)}
              reveal={revealSection}
            />
          </div>
          {previewPane}
        </TabsContent>
        <TabsContent value="destinations" className="wconvert-workspace__secondary">
          <div className="wconvert-workspace__settings">
            {entryOfGoal?.outcome.audience_channel && <CaptureModeChoice disabled={busy} selectedCount={bound.length} mode={config.capture_mode === 'local' ? 'local' : 'connected'}
              onChange={(mode) => edit({ capture_mode: mode, ...(mode === 'local' ? { destinations: [] } : {}) })} />}
            {entryOfGoal?.outcome.audience_channel && config.capture_mode === 'local' ? null :
            <DestinationsEditor
              outcome={entryOfGoal?.outcome}
              template={template}
              bound={bound}
              available={
                destinations.status === 'ready' ? ready(destinations.data.destinations) : destinations
              }
              types={read(destinations)?.types ?? []}
              connections={read(destinations)?.connections ?? []}
              onRefresh={refreshDestinations}
              onSaved={(updated) => {
                destinationRequest.current++;
                setDestinations((current) => current.status === 'ready'
                  ? ready({ ...current.data, destinations: [...updated] }) : current);
              }}
              hint={
                bound.length > 0
                  ? null
                  : hintSaid(
                      hintIn(config),
                      read(destinations)?.types ?? [],
                      gallery.labels.fields,
                      read(destinations)?.destinations ?? [],
                    )
              }
              onChange={(next) => edit({ destinations: next, capture_mode: 'connected' })}
            />
            }
          </div>
          {previewPane}
        </TabsContent>
      </div>
      <footer className="wconvert-workspace__footer">
        <Button variant="ghost" size="sm" disabled={busy} onClick={(event) => { detailsTrigger.current = event.currentTarget; setDetails(true); }}
          className="wconvert-workspace__goal">
          <Target aria-hidden="true" />
          {entryOfGoal ? sprintf(__('Goal: %s', 'wconvert'), entryOfGoal.label)
            : goalEntry.status === 'loading' ? __('Goal', 'wconvert') : sprintf(__('Goal: %s', 'wconvert'), goal ?? '')}
        </Button>
        {width === 'narrow' && tab === 'design' && !previewing && <span>
          {__('Editing mobile appearance. Text and blocks are shared across sizes.', 'wconvert')}
        </span>}

          <span className="wconvert-workspace__save-state" role="status">
            {busy
              ? publishing ? __('Publishing…', 'wconvert') : __('Saving…', 'wconvert')
              : dirty
                ? __('Unsaved changes', 'wconvert')
                : unpublishedChanges
                  ? __('Unpublished changes', 'wconvert')
                  : saved
                  ? __('Draft saved', 'wconvert')
                  : publishedAt
                    ? __('Published', 'wconvert')
                    : __('Draft', 'wconvert')}
          </span>
      </footer>
      <Dialog open={details} onOpenChange={setDetails}>
        <DialogContent className="wconvert-optin-details" onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!changingGoal) detailsTrigger.current?.focus();
        }}>
          <DialogHeader>
            <DialogTitle>{__('Campaign details', 'wconvert')}</DialogTitle>
            <DialogDescription>
              {name || __('Untitled Campaign', 'wconvert')}
            </DialogDescription>
          </DialogHeader>
          <div className="wconvert-details-status"><span>{publishedAt ? __('Published', 'wconvert') : __('Draft', 'wconvert')}</span><span>{dirty ? __('Unsaved changes', 'wconvert') : unpublishedChanges ? __('Unpublished changes', 'wconvert') : __('All edits saved', 'wconvert')}</span></div>
          <div className="wconvert-details-section"><h3>{__('Goal', 'wconvert')}</h3>
          <div className="mt-1 flex min-h-[1lh] flex-wrap items-center gap-x-2 text-note text-muted-foreground">
            <span>{goalSaid(goalEntry, goal ?? '')}</span>

            {goals.status === 'ready' &&
              offerableGoals(goals.data, 'creation_flow', goal ?? '').length > 1 && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 align-baseline"
                  onClick={() => {
                    setDetails(false);
                    setChangingGoal(true);
                  }}
                >
                  {canChangeGoal ? __('Change goal', 'wconvert') : __('Duplicate for another goal', 'wconvert')}
                </Button>
              )}
          </div>
          </div>
          {entryOfGoal?.outcome && <p className="text-note text-muted-foreground">{entryOfGoal.outcome.measurement}</p>}
          {(numbers !== null || (publishedAt !== null && stats.status === 'loading')) && (
            <div className="wconvert-details-section"><h3>{__('Performance', 'wconvert')}</h3>
              {numbers !== null ? (
                <>
                  <StatRow>
                    <Stat
                      emphasis
                      label={entryOfGoal?.headline_label ?? numbers.label}
                      value={formatCount(numbers.report.headline)}
                    />
                    <Stat
                      label={__('Impressions', 'wconvert')}
                      value={formatCount(numbers.report.impressions)}
                    />
                    <Stat
                      label={__('Conversion rate', 'wconvert')}
                      value={formatRate(numbers.report.conversion_rate)}
                    />
                  </StatRow>

                  <p className="mt-2 mb-0 text-body text-muted-foreground">
                    {sprintf(
                      _n('The last %s day', 'The last %s days', numbers.days, 'wconvert'),
                      String(numbers.days),
                    )}
                  </p>
                </>
              ) : (
                <>
                  <StatRowSkeleton stats={3} />

                  <Skeleton aria-hidden="true" className="mt-2 h-[1lh] w-28 text-body" />
                </>
              )}
            </div>
          )}
          {numbers === null && publishedAt === null && <div className="wconvert-details-section"><h3>{__('Performance', 'wconvert')}</h3><p>{__('Publish this Campaign to start collecting impressions and conversions.', 'wconvert')}</p></div>}
          <details className="wconvert-details-history"><summary>{__('About draft history', 'wconvert')}</summary>
          <p className="text-note text-muted-foreground">
            {__('Undo and Redo cover this session’s draft edits: name, design, display rules and destination selections. They do not change the published version or shared destination settings. Saving a new goal starts a new Undo history.', 'wconvert')}
          </p>
          </details>
          {entry && adminSettings()?.dev === true && (
            <details>
              <summary>{__('Developer tools', 'wconvert')}</summary>
              <PayloadMeter template={entry} />
              <DevExport entry={entry} onChange={(next) => edit({ template: next })} />
            </details>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={__('Leave without saving?', 'wconvert')}
        description={__('Your changes to this Campaign will be lost.', 'wconvert')}
        confirmLabel={__('Discard changes', 'wconvert')}
        cancelLabel={__('Keep editing', 'wconvert')}
        returnFocusTo={back}
        onConfirm={() => {
          setLeaving(false);
          onClose();
        }}
      />

      <TemplatePickerDialog
        open={browsing}
        onOpenChange={setBrowsing}
        onClosed={() => browse.current?.focus()}
        onCatalogInstalled={async () => { setGallery(await listTemplates()); }}
        index={gallery}
        trees={trees}
        displayType={displayTypeOf(config, templates)}
        chosen={templateId}
        hasCurrentDesign={template !== undefined}
        fit={{
          outcome: entryOfGoal?.outcome,
          bound: bound.length > 0,
          sibling: siblingAct,
          act,
        }}
        goalLabel={entryOfGoal?.label}
        busy={busy}
        onNear={want}
        failed={failedTrees}
        onRetry={retryTree}
        onPrepare={prepareDesign}
        onChoose={(picked, prepared) => {
          if (prepared === undefined) return;
          restoreBrowseFocus.current = true;
          const chosenDesign = gallery.templates.find((design) => design.id === picked);
          if (!chosenDesign) return;
          const changes: Config = {
            template: prepared,
            template_id: picked,
            display_type: chosenDesign.display_type,
          };

          if (displayTypeOf(config, templates) !== chosenDesign.display_type) {
            changes.placement = null;
          }

          edit(changes);
          setSelection(null);
          setStep(0);
          setBrowsing(false);
        }}
      />

      <ChangeGoalDialog
        open={changingGoal}
        onOpenChange={(next) => {
          setChangingGoal(next);

          // Radix restores focus to its own trigger and this dialog has none,
          // exactly as the picker above: naming the control is what puts the
          // caret back rather than on `<body>`.
          if (!next) {
            changeGoal.current?.focus();
          }
        }}
        goals={goals}
        current={goal ?? ''}
        duplicate={!canChangeGoal}
        onChange={(picked) => {
          if (canChangeGoal) { void save(config ?? {}, picked); return; }
          setBusy(true);
          void createOptin(sprintf(__('%s — copy', 'wconvert'), name), picked, config ?? {})
            .then((created) => {
              onEditingStateChange?.({ dirty: false, busy: false });
              if (onCreated) onCreated(created.id);
              else window.location.hash = editorHref(created.id);
            })
            .catch((cause: unknown) => setError(sprintf(__('The copied draft could not be confirmed. Check the Campaigns list before trying again. %s', 'wconvert'), messageOf(cause))))
            .finally(() => setBusy(false));
        }}
      />
    </Tabs>
  );
}

function HistoryControls({
  history,
}: {
  readonly history: {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly undo: () => void;
    readonly redo: () => void;
  };
}) {
  const label = { undo: __('Undo draft edit', 'wconvert'), redo: __('Redo draft edit', 'wconvert') };

  return (
    <span className="wconvert-history">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={label.undo}
        disabled={!history.canUndo}
        onClick={history.undo}
      >
        <Undo2 aria-hidden="true" />
        <span className="sr-only">{label.undo}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={label.redo}
        disabled={!history.canRedo}
        onClick={history.redo}
      >
        <Redo2 aria-hidden="true" />
        <span className="sr-only">{label.redo}</span>
      </Button>
    </span>
  );
}

const EVERY_INSTALL_HAS = 'popup';

function asConfigPatch(patch: Partial<DisplayRulesValue>): Record<string, unknown> {
  if (patch.schedule === undefined) {
    return patch as Record<string, unknown>;
  }

  const { schedule, ...rest } = patch;

  return { ...rest, starts_at: schedule.starts_at, ends_at: schedule.ends_at };
}

function displayTypeOf(config: Config, templates: readonly TemplateIndexEntry[] | undefined): string {
  const declared = config.display_type;
  const templateId = config.template_id;
  const chosen = typeof templateId === 'string'
    ? templates?.find((entry) => entry.id === templateId)
    : undefined;

  return typeof declared === 'string' ? declared : (chosen?.display_type ?? EVERY_INSTALL_HAS);
}

function chosenName(
  templateId: string | undefined,
  templates: readonly TemplateIndexEntry[] | undefined,
): string {
  if (templateId === undefined) {
    return __('No design chosen yet.', 'wconvert');
  }

  return templates?.find((each) => each.id === templateId)?.name ?? templateId;
}

function entryFor(
  template: Template,
  templateId: string | undefined,
  templates: readonly TemplateIndexEntry[],
): TemplateEntry {
  const source = templates.find((each) => each.id === templateId);

  return {
    id: templateId ?? 'optin',
    name: source?.name ?? templateId ?? '',
    display_type: source?.display_type ?? EVERY_INSTALL_HAS,
    // Carried so the dev-only export writes the library entry a design would
    // ACTUALLY ship as: `tier` is one of the entry's five keys now, and an
    // export missing it is an entry that reads as free by default rather than
    // by decision (`entry.ts`).
    tier: source?.tier,
    tree: template.tree,
    tokens: template.tokens,
  };
}
