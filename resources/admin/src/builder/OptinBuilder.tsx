import { CampaignAnalytics } from '../analyticsIntegration';
import { useCompactEditor } from '../hooks/useCompactEditor';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../components/ui/dropdown-menu';
import { SubmissionSettings } from './SubmissionSettings';
import { BlockInspector } from './BlockInspector';
import { JourneyEditor } from './JourneyEditor';
import { JourneyReport } from '../stats/JourneyReport';
import { referencedJourney, submissionScreen, walkNodes } from './structure/journey';
import { isResultFirst } from '../../../loader/src/journey-mode';
import type { JourneyRepair } from './structure/journeyReadiness';
import { contentLockDesignCompatible } from '../inlinePlacement';
import './editor.css';
import './preview-test.css';
import { Activity, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  ArrowLeft,
  Blocks,
  Eye,
  Layers,
  MoreHorizontal,
  Redo2,
  SlidersHorizontal,
  Undo2,
  Workflow,
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
import { planFrom } from './rules/plan';
import { summarise } from './rules/summaries';
import { DisplayRules, type DisplayRulesValue } from './rules/DisplayRules';
import { DevExport } from './DevExport';
import { Fullscreen } from './Fullscreen';
import { PayloadMeter } from './PayloadMeter';
import { ScopeStyle } from './ScopeStyle';
import { StructureView } from './StructureView';
import { DesignSettings } from './DesignSettings';
import { InlinePlacementSettings, inlinePlacementLabel, inlinePlacementControls, ContentLockPreview, type ContentLockPreviewState } from '../inlinePlacement';
import { ReopenPreview, reopenControls } from '../reopenControls';
import { EditorCanvas, ScreenControls, DeviceControls, MobileAppearanceNote } from './EditorCanvas';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { draftHistoryLabels, type DraftSnapshot } from './structure/draftEditLabel';
import { canRedo, canUndo, historyOf, redo, remember, undo, type History } from './structure/history';
import { nearestTo, samePath, nodeAt } from './structure/tree';
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
import { readDestinations, type Connection, type DestinationsPayload } from '../destinations/api';
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
  readonly initialTab?: 'rules';
  readonly onEditingStateChange?: (state: EditingState) => void;
  readonly onCreated?: (id: string) => void;
}

const TemplateTransferDialog = lazy(() => import('./TemplateTransferDialog'));

type Config = Record<string, unknown>;

type TabId = 'journey' | 'design' | 'rules' | 'destinations';

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

export function OptinBuilder({ id, onClose, backLabel, initialTab, onEditingStateChange, onCreated }: OptinBuilderProps) {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [analyticsParent, setAnalyticsParent] = useState<string | null>(null);
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
  const compact = useCompactEditor();
  const small = useCompactEditor(640);
  const [drawer, setDrawer] = useState<'layers' | 'settings' | null>(null);
  const designButton = useRef<HTMLButtonElement>(null);
  const [showLayers, setShowLayers] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [editingResult, setEditingResult] = useState<string | undefined>();
  const [lockPreview, setLockPreview] = useState<ContentLockPreviewState>('locked');
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
  const [tab, setTab] = useState<TabId>(initialTab ?? 'journey');
  const [journeyVisited, setJourneyVisited] = useState(true);
  const previewReturnTab = useRef<TabId>('journey');
  const [previewFromRules, setPreviewFromRules] = useState(false);
  const [journeyTestRequest, setJourneyTestRequest] = useState(0);
  useEffect(() => { if (tab === 'journey') setJourneyVisited(true); }, [tab]);
  const [journeyRepair, setJourneyRepair] = useState<(JourneyRepair & { serial: number }) | null>(null);
  const journeyRepairSerial = useRef(0);

  const [openToken, setOpenToken] = useState<string | null>(null);

  const [copiedLook, setCopiedLook] = useState<TokenBag | null>(null);
  const [step, setStep] = useState(0);
  const [reopenScreen, setReopenScreen] = useState(false);
  const [width, setWidth] = useState<Width>('own');
  const [selection, setSelection] = useState<Selection | null>(null);

  const [stats, setStats] = useState<Loadable<OptinNumbers | null>>(LOADING);

  const [transfer, setTransfer] = useState<{ action: 'import' | 'export'; config: Config; name: string } | null>(null);
  const [imported, setImported] = useState(false);
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

  const [displaySection, setDisplaySection] = useState<string>();
  const displayRules = {
    display_rules: planFrom(config?.display_rules),
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

  const displayPlan = displayRules.display_rules;
  const displayAxes = vocabulary && displayPlan ? summarise(displayRules, vocabulary, false) : null;
  const displaySummary = displayAxes
    ? `${displayAxes[1].text} · ${displayAxes[2].text}`
    : __('Review display rules', 'wconvert');
  const destinationNames = bound.map(id => read(destinations)?.destinations.find(item => item.id === id)?.label).filter((name): name is string => !!name);
  const destinationSummary = config?.capture_mode === 'local' ? __('Stored in WConvert', 'wconvert')
    : destinationNames.length === bound.length && bound.length > 0 ? destinationNames.join(' + ')
      : bound.length > 0 ? sprintf(_n('%d connected destination', '%d connected destinations', bound.length, 'wconvert'), bound.length)
        : __('No connected destinations', 'wconvert');

  const template = config?.template as Template | undefined;
  const templateId = typeof config?.template_id === 'string' ? config.template_id : undefined;
  const templates = gallery?.templates;

  const act: ConvertingAct =
    template === undefined ? 'submit' : (convertingActOf(template.tree)[0] ?? 'submit');

  // Results can stand alone, but an optional email signup after them is still
  // a marketing submission. Show the same explicit storage choice as email forms.
  const signupAt = template?.tree.submissions[0] ? submissionScreen(template.tree, template.tree.submissions[0].id) : -1;
  const captureOutcome = entryOfGoal?.outcome && act === 'match' && template && signupAt >= 0 && isResultFirst(template.tree)
    ? { ...entryOfGoal.outcome, audience_channel: 'email' }
    : entryOfGoal?.outcome;
  const readinessGoal = goalEntry.status === 'ready' && goalEntry.data && captureOutcome
    ? ready({ ...goalEntry.data, outcome: captureOutcome }) : goalEntry;

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

  const initializedCampaign = useRef<string | null>(null);
  useEffect(() => {
    if (!entry || initializedCampaign.current === id) return;
    initializedCampaign.current = id;
    setStep(entry.tree.graph ? Math.max(0, entry.tree.steps.findIndex(screen => screen.id === entry.tree.graph?.entry)) : 0);
  }, [entry, id]);

  useEffect(() => {
    getOptin(id)
      .then((optin) => {
        setName(optin.name);
        setConfig(optin.config);
        setBaseline(JSON.stringify({ name: optin.name, config: optin.config }));
        setGoal(optin.goal);
        setPublishedAt(optin.published_at);
        setCanChangeGoal(optin.can_change_goal);
        setAnalyticsParent(optin.parent_id ?? null);
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
    if (changedTemplate) changes = { ...changes, template: { tree: referencedJourney(changedTemplate.tree), tokens: changedTemplate.tokens } };

    setConfig((current) => {
      if (current === null) return current;
      const next = { ...current, ...changes };
      if (changedTemplate && next.submission_settings && typeof next.submission_settings === 'object') {
        const kept = new Set(changedTemplate.tree.submissions.map(sub => sub.id));
        next.submission_settings = Object.fromEntries(Object.entries(next.submission_settings).filter(([id]) => kept.has(id)));
      }
      if (changedTemplate && next.integration_mappings && typeof next.integration_mappings === 'object') {
        const kept = new Set(changedTemplate.tree.submissions.map(sub => sub.id));
        const sources = new Set<string>();
        changedTemplate.tree.steps.flatMap(step => walkNodes(step.content)).forEach((node) => {
          if (node.type === 'question' && 'id' in node) sources.add(String(node.id));
          if (node.type === 'field' && 'name' in node && ['interest', 'message'].includes(String(node.name))) sources.add(`field:${String(node.name)}`);
        });
        const maps = next.integration_mappings as Record<string, Record<string, Record<string, string>>>;
        next.integration_mappings = Object.fromEntries(Object.entries(maps).filter(([submission]) => kept.has(submission)).map(([submission, byDestination]) =>
          [submission, Object.fromEntries(Object.entries(byDestination).map(([id, mapping]) =>
            [id, Object.fromEntries(Object.entries(mapping).filter(([source]) => sources.has(source)))]) )]));
      }
      return next;
    });
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
        setAnalyticsParent(optin.parent_id ?? null);
        setSaved(true);
        setImported(false);
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
    setTab(current => current === 'journey' ? 'journey' : 'design');

    setOpenToken(null);
    setSelection({ path: pathOfKey(key), from: 'preview' });
    setDrawer('settings');
  }, []);

  const chooseFromTree = useCallback((path: Path) => {
    setReopenScreen(false);
    setOpenToken(null);
    setSelection({ path, from: 'tree' });
    setDrawer('settings');

    if (typeof path[0] === 'number') {
      setStep(path[0]);
    }
  }, []);

  const prepareDesign = useCallback((picked: string, mode: 'keep' | 'sample', sample: Template) =>
    mode === 'sample'
      ? prepareTemplate(picked, { tree: sample.tree, tokens: sample.tokens }, picked, goal ?? undefined)
      : prepareTemplate(picked, template ?? { tree: { v: 2, steps: [], submissions: [] }, tokens: {} }, templateId, goal ?? undefined),
  [template, templateId, goal]);

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
      setImported(false);
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

  const historyLabels = useMemo(() => draftHistoryLabels(past), [past]);
  const history = {
    labels: historyLabels,
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

  const canPreviewReopen = !!reopenControls.preview && !!config.teaser && ['popup', 'slide_in'].includes(displayTypeOf(config, templates));
  const showingReopen = canPreviewReopen && reopenScreen;
  const reopenLabel = __('Reopen button', 'wconvert');
  const showReopen = () => {
    setReopenScreen(true);
    setSelection(null);
    setOpenToken(null);
  };
  const showingLock = (tab === 'rules' || (tab === 'journey' && previewFromRules)) && config.content_lock != null && displayTypeOf(config, templates) === 'inline' && !!inlinePlacementControls.preview;
  const selectedResult = entry?.tree.steps[step]?.results?.find(result => result.id === editingResult);
  const canvasTemplate = entry && selectedResult && !previewing ? { ...entry, tree: { ...entry.tree, steps: entry.tree.steps.map((screen, index) => index === step ? { ...screen, results: [{ ...selectedResult, when: undefined }] } : screen) } } : entry;
  const previewPane =
    entry === null ? null : (
      <EditorCanvas
        template={canvasTemplate!}
        name={chosenName(templateId, templates)}
        step={step}
        width={width}
        selected={selection === null ? null : keyOf(selection.path)}
        onSelect={chooseFromPreview}
        interactive={previewing}
        onStep={setStep}
        displayType={displayTypeOf(config, templates)}
        placement={config.placement}
        screen={showingLock ? { inFlow: true, label: __('Content lock', 'wconvert'), controls: <ContentLockPreview controls template={entry} state={lockPreview} onStateChange={setLockPreview} />, content: <ContentLockPreview template={entry} state={lockPreview} onStateChange={setLockPreview} /> } : showingReopen ? { label: reopenLabel, content: <ReopenPreview value={config.teaser} template={entry} mobile={width === 'narrow'} onReopen={() => { setReopenScreen(false); setStep(0); }} /> } : undefined}
        onClose={canPreviewReopen && step === 0 ? showReopen : undefined}
      />
    );
  const shownStep = Math.min(step, Math.max((entry?.tree.steps.length ?? 1) - 1, 0));
  const chooseStep = (next: number) => {
    setReopenScreen(false);
    setStep(next);
    setSelection(null);
    setOpenToken(null);
  };
  const designSettings = () => {
    setDrawer('settings');
    setSelection(null);
    setOpenToken(null);
  };
  const inlineSummary = config.content_lock != null ? __('Content lock', 'wconvert') : config.inline_placement == null
    ? __('Manual', 'wconvert')
    : inlinePlacementLabel(config.inline_placement) ?? __('Check automatic placement', 'wconvert');
  const goToInlinePlacement = () => {
    setTab('rules');
    setPreviewing(false);
    setRevealSection({ id: 'placement', focus: 'wconvert-section-placement-trigger' });
  };

  const displayEditor = (compactPanel = false) => <DisplayRules compact={compactPanel} template={template} cartRequired={entryOfGoal?.cart_required}
              reopenEnabled={canPreviewReopen}
              audienceRequirement={entryOfGoal?.audience_requirement}
              initialSection={displaySection}
              onSectionChange={setDisplaySection}
              act={act}
              vocabulary={vocabulary}
              value={displayRules}
              overlay={overlay}
              onChange={(patch) => edit({ ...asConfigPatch(patch), ...(patch.display_rules ? { rules: undefined } : {}) } as Config)}
              reveal={revealSection}
              placement={displayTypeOf(config, templates) === 'inline' ? {
                summary: inlineSummary,
                controls: <InlinePlacementSettings optinId={id} published={publishedAt !== null} config={config} vocabulary={vocabulary} onChange={edit} />,
              } : undefined}
            />;
  const connectionSaved = (account: Connection) => {
    destinationRequest.current++;
    setDestinations((current) => current.status === 'ready'
      ? ready({ ...current.data, connections: [...current.data.connections.filter((existing) => existing.id !== account.id), account] }) : current);
  };
  const destinationEditor = <>
            {captureOutcome?.audience_channel && <CaptureModeChoice disabled={busy} selectedCount={bound.length} mode={config.capture_mode === 'local' ? 'local' : 'connected'}
              onChange={(mode) => edit({ capture_mode: mode, ...(mode === 'local' ? { destinations: [] } : {}) })} />}
            {captureOutcome?.audience_channel && config.capture_mode === 'local' ? null :
            <DestinationsEditor
              outcome={captureOutcome}
              template={template}
              bound={bound}
              available={
                destinations.status === 'ready' ? ready(destinations.data.destinations) : destinations
              }
              types={read(destinations)?.types ?? []}
              connections={read(destinations)?.connections ?? []}
              onConnectionSaved={connectionSaved}
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
              onChange={(next) => {
                const current = (config.integration_mappings ?? {}) as Record<string, Record<string, Record<string, string>>>;
                const submissionId = template?.tree.submissions[0]?.id;
                edit({ destinations: next, capture_mode: 'connected', ...(submissionId && Object.keys(current).length > 0 ? {
                  integration_mappings: { ...current, [submissionId]: Object.fromEntries(Object.entries(current[submissionId] ?? {}).filter(([id]) => next.includes(id))) },
                } : {}) });
              }}
              mappings={((config.integration_mappings as Record<string, Record<string, Record<string, string>>> | undefined)?.[template?.tree.submissions[0]?.id ?? ''] ?? {})}
              onMappingChange={(destinationId, map) => {
                const current = (config.integration_mappings ?? {}) as Record<string, Record<string, Record<string, string>>>;
                const submissionId = template?.tree.submissions[0]?.id;
                if (submissionId) edit({ integration_mappings: { ...current, [submissionId]: { ...current[submissionId], [destinationId]: map } } });
              }}
            />
            }
            <SubmissionSettings types={read(destinations)?.types ?? []} connections={read(destinations)?.connections ?? []} onConnectionSaved={connectionSaved} onSaved={updated => { destinationRequest.current++; setDestinations(current => current.status === 'ready' ? ready({ ...current.data, destinations: [...updated] }) : current); }} template={template} primaryChannel={captureOutcome?.audience_channel} config={config} destinations={read(destinations)?.destinations ?? []} onChange={edit} />
  </>;

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        flushSync(() => setOpenToken(null));
        setTab(value as TabId);
        setPreviewing(false);
      }}
      className="wconvert-workspace gap-0"
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
        <div className="wconvert-workspace__identity">
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
        </div>
        <TabsList
          className="wconvert-workspace__navigation"
          aria-label={__('What you are editing', 'wconvert')}
        >
          <TabsTrigger value="journey">{__('Edit campaign', 'wconvert')}</TabsTrigger>
          <TabsTrigger value="design">{__('Theme & layout', 'wconvert')}</TabsTrigger>
          <TabsTrigger value="rules">{__('Display rules', 'wconvert')}</TabsTrigger>
          <TabsTrigger ref={destinationsTab} value="destinations">{__('Destinations', 'wconvert')}</TabsTrigger>
        </TabsList>
        <div className="wconvert-workspace__actions">

          {!small && <HistoryControls
            history={{ ...history, canUndo: !busy && history.canUndo, canRedo: !busy && history.canRedo }}
          />}
          <Button
            variant="outline"
            ref={previewButton}
            size={small ? 'icon-sm' : 'default'}
            aria-label={__('Preview & test', 'wconvert')}
            title={__('Preview & test', 'wconvert')}
            disabled={entry === null || busy}
            onClick={() => { previewReturnTab.current = tab; setPreviewFromRules(tab === 'rules'); setTab('journey'); setPreviewing(false); setJourneyTestRequest(value => value + 1); }}
          >
            <Eye aria-hidden="true" />
            {!small && __('Preview & test', 'wconvert')}
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
            goal={readinessGoal}
            goalId={goal ?? ''}
            playbook={playbook}
            playbookId={typeof config.playbook_id === 'string' ? config.playbook_id : ''}
            rules={displayRules}
            vocabulary={vocabulary}
            displayType={displayTypeOf(config, templates)}
            placement={config.placement}
            contentLock={config.content_lock}
            teaser={config.teaser}
            inlinePlacement={config.inline_placement}
            bound={bound}
            template={template}
            destinations={read(destinations)?.destinations ?? null}
            fieldLabels={gallery.labels.fields}
            privacyGuidance={privacyGuidance}
            policyUrl={adminSettings()?.policyUrl}
            onPublish={publish}
            onPreview={() => { previewReturnTab.current = tab; setPreviewFromRules(tab === 'rules'); setTab('journey'); setPreviewing(false); setJourneyTestRequest(value => value + 1); }}
            onEditDesign={() => { setTab('design'); setPreviewing(false); setShowLayers(true); setDrawer('layers'); layersButton.current?.focus(); }}
            onEditJourney={repair => { setTab('journey'); setPreviewing(false); if (repair) setJourneyRepair({ ...repair, serial: ++journeyRepairSerial.current }); }}
            onGoToDesign={() => { setTab('design'); setPreviewing(false); setBrowsing(true); }}
            onGoToPlacement={goToInlinePlacement}
            onGoToDestinations={() => { setTab('destinations'); destinationsTab.current?.focus(); }}
            onGoToRules={(section) => { setTab('rules'); setRevealSection({ id: section }); }}
            onGoTo={goTo}
            onGoToSchedule={goToSchedule}
          />
          <DropdownMenu><DropdownMenuTrigger asChild><Button ref={changeGoal} variant="ghost" size="icon-sm" disabled={busy} aria-label={__('Campaign actions', 'wconvert')}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="wconvert-campaign-actions">
              {small && <><DropdownMenuItem disabled={busy || !history.canUndo} onSelect={history.undo}>{history.labels.undo}</DropdownMenuItem>
              <DropdownMenuItem disabled={busy || !history.canRedo} onSelect={history.redo}>{history.labels.redo}</DropdownMenuItem></>}
              <DropdownMenuItem disabled={busy} onSelect={() => setTransfer({ action: 'import', config, name })}>{__('Import design', 'wconvert')}</DropdownMenuItem>
              <DropdownMenuItem disabled={busy || !template} onSelect={() => setTransfer({ action: 'export', config, name })}>{__('Export design', 'wconvert')}</DropdownMenuItem>
              <DropdownMenuItem disabled={busy} onSelect={() => { detailsTrigger.current = changeGoal.current; setDetails(true); }}>{__('Campaign details', 'wconvert')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {error !== null && <PageError message={error} />}
      {imported && <p role="status">{__('Design imported. Review it, then save your draft.', 'wconvert')}</p>}
      <div className="wconvert-workspace__body" inert={busy}>
        <TabsContent value="journey" forceMount={journeyVisited || undefined} className="wconvert-workspace__journey">
          <Activity mode={tab === 'journey' ? 'visible' : 'hidden'}>
          {!entry && <EmptyState icon={Blocks} title={__('Choose a campaign to customize', 'wconvert')} action={<Button onClick={() => setBrowsing(true)}>{__('Browse designs and formats', 'wconvert')}</Button>}>{__('Start with a ready-made design, then make it yours.', 'wconvert')}</EmptyState>}
          {entry && <JourneyEditor onUndo={history.canUndo ? history.undo : undefined} embedded labels={gallery.labels} onResultSelect={setEditingResult}
            editorCanvas={previewPane}
            appearancePreview={showingLock ? previewPane : undefined}
            editorTools={<DeviceControls width={width} onChange={setWidth} />}
            elementSelection={selection ?? undefined}
            onClearElement={() => setSelection(null)}
            elementPanel={selection && nodeAt(entry.tree, selection.path)?.type !== 'question' ? <BlockInspector template={entry} labels={gallery.labels} path={selection.path} act={act}
              onChange={(next, coalesce) => edit({ template: next }, coalesce)} onSwap={next => edit({ template: next })}
              endsAt={displayRules.schedule.ends_at} onSetEndDate={goToSchedule} onSelect={chooseFromTree}
              onDesign={() => { setTab('design'); designSettings(); }} onShowLayers={() => { setTab('design'); setShowLayers(true); setDrawer('layers'); }}
              look={<ScopeStyle key={selection.path.join('.')} template={entry} labels={gallery.labels} path={selection.path} openToken={openToken} onOpenToken={setOpenToken} onSelect={chooseFromTree}
                onChange={next => edit({ template: next })} copied={copiedLook} onCopy={setCopiedLook} width={width === 'narrow' ? 'narrow' : 'tokens'} />} /> : undefined}
            testRequest={journeyTestRequest} onTestExit={() => setPreviewFromRules(false)} onTestClose={() => { const returnTab = previewReturnTab.current; previewReturnTab.current = 'journey'; setTab(returnTab); }}
            outcomeAction={entryOfGoal?.outcome.action} primaryChannel={entryOfGoal?.outcome.audience_channel} tree={entry.tree} tokens={entry.tokens} step={shownStep} repairRequest={journeyRepair ?? undefined}
            focusActions={<><HistoryControls history={{ ...history, canUndo: !busy && history.canUndo, canRedo: !busy && history.canRedo }} />
              <Button type="button" variant="outline" size="sm" disabled={busy || !dirty} onClick={() => void save()}>{busy ? __('Saving…', 'wconvert') : __('Save draft', 'wconvert')}</Button></>}
            onChange={(tree, coalesce) => edit({ template: { ...entry, tree } }, coalesce)} onSelect={chooseStep} displaySummary={displaySummary} destinationSummary={destinationSummary}
            contextEditors={{ rules: displayEditor(true), destinations: destinationEditor }}
            deliveryMode={config?.capture_mode === 'local' ? 'local' : bound.length > 0 ? 'connected' : 'none'}
            onGoToDesign={() => { setTab('design'); setPreviewing(false); }}
            onGoToRules={() => setTab('rules')} onGoToDestinations={() => { setTab('destinations'); destinationsTab.current?.focus(); }} />}
          </Activity>
        </TabsContent>
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
                      aria-pressed={compact ? drawer === 'layers' : showLayers}
                      onClick={() => compact ? setDrawer('layers') : setShowLayers(!showLayers)}
                      disabled={previewing}
                    >
                      <Layers aria-hidden="true" />
                      {__('Layers', 'wconvert')}
                    </Button>
                    <Button ref={designButton} variant="ghost" onClick={designSettings} disabled={previewing}>
                      <SlidersHorizontal aria-hidden="true" />
                      {__('Design settings', 'wconvert')}
                    </Button>
                  </div>
                  <div className="wconvert-workspace__screens"><ScreenControls template={entry} step={shownStep} onChange={chooseStep} extra={canPreviewReopen ? { label: reopenLabel, selected: showingReopen, onSelect: showReopen } : undefined} />
                    {!previewing && <Button type="button" variant="outline" size="sm" onClick={() => setTab('journey')}><Workflow aria-hidden="true" />{__('Edit screens & conditions', 'wconvert')}</Button>}
                  </div>
                  <div>
                    {compact ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={__('Preview options', 'wconvert')}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setWidth('own')}>{__('Desktop preview', 'wconvert')}</DropdownMenuItem><DropdownMenuItem onSelect={() => setWidth('narrow')}>{__('Mobile preview', 'wconvert')}</DropdownMenuItem></DropdownMenuContent>
                    </DropdownMenu> : <DeviceControls width={width} onChange={setWidth} />}
                    {compact && width === 'narrow' && !previewing && <MobileAppearanceNote />}
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
                    compact={compact} drawer={drawer} onCloseDrawer={() => setDrawer(null)}
                    onDrawerFocusReturn={panel => (panel === 'layers' ? layersButton : designButton).current?.focus()}
                    showLayers={showLayers}
                    onShowLayers={() => compact ? setDrawer('layers') : setShowLayers(true)}
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
                            teaser={config.teaser}
                            onTeaserChange={(teaser) => { edit({ teaser }); setReopenScreen(!!teaser); }}
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
        <TabsContent value="rules" className="wconvert-workspace__secondary wconvert-workspace__display" data-content-lock={showingLock || undefined}>
          <div className="wconvert-workspace__settings">
            {displayEditor()}
          </div>
        </TabsContent>
        <TabsContent value="destinations" className="wconvert-workspace__secondary wconvert-workspace__destinations">
          <div className="wconvert-workspace__settings">
            {destinationEditor}
          </div>
        </TabsContent>
      </div>
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
          <CampaignAnalytics value={config.analytics} parentId={analyticsParent} onChange={analytics => edit({ analytics })} />
          {details && id && <JourneyReport id={id} />}
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
            {__('Undo and Redo cover this session’s draft edits: name, journey, design, display rules and destination selections. They do not change the published version or shared destination settings. Saving a new goal starts a new Undo history.', 'wconvert')}
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

      {transfer && <Suspense fallback={<span role="status">{__('Loading file tools…', 'wconvert')}</span>}>
        <TemplateTransferDialog action={transfer.action} optin={id} config={transfer.config}
          design={{ ...(transfer.config.template as Template), name: transfer.name, display_type: displayTypeOf(transfer.config, templates) }}
          onClose={() => { setTransfer(null); changeGoal.current?.focus(); }}
          onApply={patch => {
            if (config !== transfer.config) { setError(__('Your draft changed during import. Close the preview and review the file again.', 'wconvert')); return; }
            edit(patch); setSelection(null); setStep(0); setImported(true); setTransfer(null); changeGoal.current?.focus();
          }} />
      </Suspense>}

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
        contentLock={config.content_lock != null}
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
            changes.inline_placement = null;
            changes.content_lock = null;
            if (!['popup', 'slide_in'].includes(chosenDesign.display_type)) changes.teaser = null;
          }

          if (config.content_lock != null && !contentLockDesignCompatible(chosenDesign.display_type, prepared)) changes.content_lock = null;
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
    readonly labels: { undo: string; redo: string };
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly undo: () => void;
    readonly redo: () => void;
  };
}) {
  const label = history.labels;

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
    return __('Custom design', 'wconvert');
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
