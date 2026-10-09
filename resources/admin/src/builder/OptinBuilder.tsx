import { CampaignAnalytics } from '../analyticsIntegration';
import { useCompactEditor } from '../hooks/useCompactEditor';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../components/ui/dropdown-menu';
import { SubmissionSettings } from './SubmissionSettings';
import { BlockInspector } from './BlockInspector';
import { JourneyEditor } from './JourneyEditor';
import { ProductActivityReport } from '../stats/ProductActivityReport';
import { JourneyReport } from '../stats/JourneyReport';
import { referencedJourney, submissionScreen } from './structure/journey';
import { isResultFirst } from '../../../loader/src/journey-mode';
import type { JourneyRepair } from './structure/journeyReadiness';
import { contentLockDesignCompatible } from '../inlinePlacement';
import './editor.css';
import './preview-test.css';
import { Activity, Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  Blocks,
  Eye,
  Info,
  Layers,
  MoreHorizontal,
  Redo2,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BackLink, BuilderSkeleton } from '../shell/BuilderSkeleton';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { EmptyState } from '../shell/EmptyState';
import { PageAction } from '../shell/PageActions';
import { PageError, Region, RegionErrorState, TryAgain } from '../shell/Region';
import { Skeleton } from '../components/ui/skeleton';
import { Stat, StatRow, StatRowSkeleton } from '../shell/Stat';
import { LOADING, failed, messageOf, read, ready, type Loadable } from '../shell/loadable';
import { TemplatePickerDialog } from './TemplatePickerDialog';
import { useTemplateTrees } from './TemplatePicker';
import { DestinationsEditor } from './DestinationsEditor';
import { CaptureModeChoice } from './CaptureModeChoice';
import { ReadinessDialog } from './ReadinessDialog';
import { captureModeOf, routedMode } from './captureMode';
import { campaignIssues, followIssue, type IssueRoutes } from './readiness/campaignIssues';
import { ForDevelopers } from '../optins/DetailsDialog';
import { fieldMappingsKept, hintIn, type FieldMappings } from './destinations';
import { planFrom } from './rules/plan';
import { summarise, summaryOf } from './rules/summaries';
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
import { AdminDialog, AdminDialogBody, AdminDialogContent, AdminDialogHeader } from '../components/ui/admin-dialog';
import { Disclosure } from '../shell/Disclosure';
import { StatusBadge } from '../optins/StatusBadge';
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
import { readDestinations, type Connection, type Destination, type DestinationsPayload } from '../destinations/api';
import { adminSettings, catalogConfigured } from '../settings';
import { readPrivacyGuidance } from '../privacy/api';
import { createOptin, publishOptin, statusOf } from '../optins/api';
import { editorHref } from '../nav';
import { BrandMark } from '../shell/Brand';
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
  // Bumped by Try again after a failed first read, so every read runs again.
  const [attempt, setAttempt] = useState(0);
  const attentionId = useId();
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
  const [statsRead, setStatsRead] = useState(0);

  const [transfer, setTransfer] = useState<{ action: 'import' | 'export'; config: Config; name: string } | null>(null);
  const [imported, setImported] = useState(false);
  const [past, setPast] = useState<History<DraftSnapshot> | null>(null);

  const [goals, setGoals] = useState<Loadable<GoalEntry[]>>(LOADING);

  const [changingGoal, setChangingGoal] = useState(false);
  const changeGoal = useRef<HTMLButtonElement>(null);

  const [siblingAct, setSiblingAct] = useState<ConvertingAct | null>(null);

  const [playbook, setPlaybook] = useState<Loadable<string | null>>(LOADING);

  const [destinations, setDestinations] = useState<Loadable<DestinationsPayload>>(LOADING);
  /** A re-read that failed while routes were on screen: they stay, and this says so (ADR 0060). */
  const [destinationsStale, setDestinationsStale] = useState<string | null>(null);

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
  const displayAxes = vocabulary && displayPlan ? summarise(displayRules, vocabulary) : null;
  const displaySummary = displayAxes
    ? `${summaryOf(displayAxes, 'who').text} · ${summaryOf(displayAxes, 'when').text}`
    : __('Review display rules', 'wconvert');
  const destinationNames = bound.map(id => read(destinations)?.destinations.find(item => item.id === id)?.label).filter((name): name is string => !!name);
  const captureMode = captureModeOf(config);
  const destinationSummary = captureMode === 'local' ? __('Keep in WConvert only', 'wconvert')
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

  // A draft started without a setup has no design yet; the library is the
  // first thing it needs, so it opens once rather than waiting to be found.
  const offeredLibrary = useRef<string | null>(null);
  useEffect(() => {
    if (config === null || gallery === null || config.template !== undefined || offeredLibrary.current === id) return;
    offeredLibrary.current = id;
    setBrowsing(true);
  }, [config, gallery, id]);

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
  }, [id, attempt]);

  useEffect(() => {
    getRules()
      .then(setVocabulary)
      .catch((cause: unknown) => setFatal(messageOf(cause)));
    listTemplates()
      .then(setGallery)
      .catch((cause: unknown) => setFatal(messageOf(cause)));
  }, [attempt]);

  const loadGoals = useCallback(() => {
    setGoals(LOADING);
    listGoals()
      .then((entries) => setGoals(ready(entries)))
      .catch((cause: unknown) => setGoals(failed(cause)));
  }, []);
  useEffect(loadGoals, [loadGoals]);

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
    // A refresh keeps the routes on screen (ADR 0060): the Add picker refreshes
    // as it opens, and must not blank itself while the answer arrives. Only a
    // read with nothing to keep shows loading; a failed re-read keeps the
    // routes and reports itself beside them.
    setDestinations((current) => current.status === 'ready' ? current : LOADING);
    setDestinationsStale(null);
    void readDestinations()
      .then((payload) => { if (request === destinationRequest.current) setDestinations(ready(payload)); })
      .catch((cause: unknown) => {
        if (request !== destinationRequest.current) return;
        setDestinations((current) => current.status === 'ready' ? current : failed(cause));
        setDestinationsStale(messageOf(cause));
      });
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

    setStats(LOADING);
    readDashboard(null)
      .then((payload) => setStats(ready(numbersByOptin(payload)[id] ?? null)))
      // Not left LOADING, and not swallowed into "no numbers": a failed read is
      // drawn in Campaign details with a way to try again (§13).
      .catch((cause: unknown) => setStats(failed(cause)));
  }, [id, goal, publishedAt, statsRead]);

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
        // One rule for what a new design keeps, shared with the swap note that warns about it.
        next.integration_mappings = fieldMappingsKept(next.integration_mappings as FieldMappings, changedTemplate.tree);
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
    setRevealSection({ id: 'dates', focus: 'wconvert-ends-at' });
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
          <RegionErrorState message={fatal} onRetry={() => { setFatal(null); setAttempt((value) => value + 1); }} />
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
  const canvasTemplate = entry && selectedResult ? { ...entry, tree: { ...entry.tree, steps: entry.tree.steps.map((screen, index) => index === step ? { ...screen, results: [{ ...selectedResult, when: undefined }] } : screen) } } : entry;
  const previewPane =
    entry === null ? null : (
      <EditorCanvas
        template={canvasTemplate!}
        name={chosenName(templateId, templates)}
        step={step}
        width={width}
        selected={selection === null ? null : keyOf(selection.path)}
        onSelect={chooseFromPreview}
        displayType={displayTypeOf(config, templates)}
        placement={config.placement}
        screen={showingLock ? { inFlow: true, label: __('Content lock', 'wconvert'), controls: <ContentLockPreview controls template={entry} state={lockPreview} onStateChange={setLockPreview} />, content: <ContentLockPreview template={entry} state={lockPreview} onStateChange={setLockPreview} /> } : showingReopen ? { label: reopenLabel, content: <ReopenPreview value={config.teaser} template={entry} mobile={width === 'narrow'} onReopen={() => { setReopenScreen(false); setStep(0); }} /> } : undefined}
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
    setRevealSection({ id: 'placement', focus: 'wconvert-display-placement' });
  };

  // The campaign's one issue list (ADR 0133): the review, the header count,
  // each screen's warning, each map badge and each tab's dot all read it.
  const issues = campaignIssues({ template, rules: displayRules, vocabulary, displayType: displayTypeOf(config, templates),
    contentLock: config.content_lock, inlinePlacement: config.inline_placement,
    outcome: readinessGoal.status === 'ready' ? readinessGoal.data?.outcome : undefined,
    bound, destinations: read(destinations)?.destinations ?? null, captureMode,
    submissionSettings: config.submission_settings, uncheckedLinks: config.unchecked_links,
    privacyGuidance, policyUrl: adminSettings()?.policyUrl });
  // A blocker answered inside the review (a failed goal read) belongs to no tab.
  const blockedTabs = new Set(issues.flatMap(issue => issue.blocks && issue.tab !== null ? [issue.tab] : []));
  // Where each issue's fix is, for the review and the screens alike (ADR 0133).
  const issueRoutes: IssueRoutes = {
    onEditDesign: () => { setTab('design'); setShowLayers(true); setDrawer('layers'); layersButton.current?.focus(); },
    onEditJourney: repair => { setTab('journey'); if (repair) setJourneyRepair({ ...repair, serial: ++journeyRepairSerial.current }); },
    onGoToDesign: () => { setTab('design'); setBrowsing(true); },
    onGoToPlacement: goToInlinePlacement,
    onGoToDestinations: () => { setTab('destinations'); destinationsTab.current?.focus(); },
    onGoToRules: (section) => { setTab('rules'); setRevealSection({ id: section }); },
    onGoTo: goTo,
    onGoToSchedule: goToSchedule,
    onRetryGoal: loadGoals,
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
                // The same condition Review & publish blocks on, held here instead (ADR 0132).
                opensRightAway: config.inline_placement != null || config.content_lock != null,
                heldBy: config.content_lock != null ? 'content_lock' : 'automatic',
                controls: <InlinePlacementSettings optinId={id} published={publishedAt !== null} config={config} vocabulary={vocabulary} onChange={edit} />,
              } : undefined}
            />;
  const connectionSaved = (account: Connection) => {
    destinationRequest.current++;
    setDestinations((current) => current.status === 'ready'
      ? ready({ ...current.data, connections: [...current.data.connections.filter((existing) => existing.id !== account.id), account] }) : current);
  };
  const destinationsSaved = (updated: readonly Destination[]) => {
    destinationRequest.current++;
    setDestinations((current) => current.status === 'ready'
      ? ready({ ...current.data, destinations: [...updated] }) : current);
  };
  const routes: Loadable<readonly Destination[]> = destinations.status === 'ready' ? ready(destinations.data.destinations) : destinations;
  const localCapture = captureMode === 'local';
  // Every design that saves a lead asks where it goes, whatever the goal (ADR 0133).
  const capturesLead = template !== undefined && template.tree.submissions.some(signup => submissionScreen(template.tree, signup.id) >= 0);
  const hint = hintIn(config);
  const destinationEditor = <>
            {capturesLead && <CaptureModeChoice disabled={busy} selectedCount={bound.length} mode={captureMode}
              onChange={(mode) => edit({ capture_mode: mode, ...(mode === 'local' ? { destinations: [] } : {}) })} />}
            <DestinationsEditor
              outcome={captureOutcome}
              template={template}
              bound={bound}
              local={localCapture}
              title={template?.tree.submissions[1] ? __('Main signup', 'wconvert') : undefined}
              available={routes}
              types={read(destinations)?.types ?? []}
              connections={read(destinations)?.connections ?? []}
              testEmail={read(destinations)?.test_sample?.email ?? null}
              channel={captureOutcome?.audience_channel ? { channel: captureOutcome.audience_channel, strict: false } : null}
              suggested={[...(hint?.types ?? []), ...(captureOutcome?.destination_type ? [captureOutcome.destination_type] : [])]}
              onConnectionSaved={connectionSaved}
              onKeepLocal={() => edit({ capture_mode: 'local', destinations: [] })}
              onRefresh={refreshDestinations}
              refreshError={destinationsStale}
              onSaved={destinationsSaved}
              onChange={(next) => {
                const current = (config.integration_mappings ?? {}) as Record<string, Record<string, Record<string, string>>>;
                const submissionId = template?.tree.submissions[0]?.id;
                // Choosing a service connects; removing the last one anywhere keeps leads here (ADR 0133).
                edit({ destinations: next, capture_mode: routedMode({ ...config, destinations: next }), ...(submissionId && Object.keys(current).length > 0 ? {
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
            <SubmissionSettings types={read(destinations)?.types ?? []} connections={read(destinations)?.connections ?? []} onConnectionSaved={connectionSaved}
              onSaved={destinationsSaved} onRefresh={refreshDestinations} refreshError={destinationsStale} testEmail={read(destinations)?.test_sample?.email ?? null}
              template={template} primaryChannel={captureOutcome?.audience_channel} config={config}
              available={routes} onChange={edit} />
  </>;

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        flushSync(() => setOpenToken(null));
        setTab(value as TabId);
      }}
      className="wconvert-workspace gap-0"
    >
      <header className="wconvert-workspace__header">
        <Button
          ref={back}
          disabled={busy}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={backLabel ?? __('Back to campaigns', 'wconvert')}
          title={backLabel ?? __('Back to campaigns', 'wconvert')}
          onClick={leave}
        >
          <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
        </Button>
        <BrandMark className="wconvert-workspace__brand-mark" />
        <span className="sr-only">{__('WConvert', 'wconvert')}</span>
        <h1 className="sr-only">{name || __('Untitled campaign', 'wconvert')}</h1>
        <label className="sr-only" htmlFor="wconvert-optin-name">
          {__('Name', 'wconvert')}
        </label>
        <div className="wconvert-workspace__identity">
          <input
            id="wconvert-optin-name"
            className="wconvert-workspace__name"
            value={name}
            placeholder={__('Untitled campaign', 'wconvert')}
            disabled={busy}
            onChange={(event) => {
              coalescing.current = 'name';
              setName(event.target.value);
              setSaved(false);
            }}
          />
          <span
            className="wconvert-workspace__save-state"
            role="status"
            data-published={!busy && !dirty && !unpublishedChanges && !saved && publishedAt && suspended === null && deletedAt === null ? '' : undefined}
            data-suspended={!busy && !dirty && !unpublishedChanges && !saved && publishedAt && suspended !== null ? '' : undefined}
          >
            {busy
              ? publishing ? __('Publishing…', 'wconvert') : __('Saving…', 'wconvert')
              : dirty
                ? imported ? __('Design imported, not saved', 'wconvert') : __('Unsaved changes', 'wconvert')
                : unpublishedChanges
                  ? __('Unpublished changes', 'wconvert')
                  : saved
                  ? __('Draft saved', 'wconvert')
                  : deletedAt !== null
                    ? __('In trash', 'wconvert')
                    : publishedAt && suspended !== null
                      ? __('Suspended', 'wconvert')
                      : publishedAt
                        ? __('Published', 'wconvert')
                        : __('Draft', 'wconvert')}
          </span>
        </div>
        <TabsList
          className="wconvert-workspace__navigation"
          aria-label={__('What you are editing', 'wconvert')}
        >
          {/* A tab holding something that blocks publishing carries a dot, described rather than renamed. */}
          <TabsTrigger value="journey" aria-describedby={blockedTabs.has('journey') ? attentionId : undefined}>{__('Screens', 'wconvert')}{blockedTabs.has('journey') && <AttentionDot />}</TabsTrigger>
          <TabsTrigger value="design" aria-describedby={blockedTabs.has('design') ? attentionId : undefined}>{__('Design', 'wconvert')}{blockedTabs.has('design') && <AttentionDot />}</TabsTrigger>
          <TabsTrigger value="rules" aria-describedby={blockedTabs.has('rules') ? attentionId : undefined}>{__('Display rules', 'wconvert')}{blockedTabs.has('rules') && <AttentionDot />}</TabsTrigger>
          <TabsTrigger ref={destinationsTab} value="destinations" aria-describedby={blockedTabs.has('destinations') ? attentionId : undefined}>{__('Destinations', 'wconvert')}{blockedTabs.has('destinations') && <AttentionDot />}</TabsTrigger>
          <span id={attentionId} hidden>{__('Needs fixing before publishing', 'wconvert')}</span>
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
            onClick={() => { previewReturnTab.current = tab; setPreviewFromRules(tab === 'rules'); setTab('journey'); setJourneyTestRequest(value => value + 1); }}
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
            name={name}
            captureMode={captureMode}
            issues={issues}
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
            onKeepLocal={() => edit({ capture_mode: 'local', destinations: [] })}
            onGoToLook={() => { setTab('design'); designSettings(); designButton.current?.focus(); }}
            onPreview={() => { previewReturnTab.current = tab; setPreviewFromRules(tab === 'rules'); setTab('journey'); setJourneyTestRequest(value => value + 1); }}
            {...issueRoutes}
          />
          <DropdownMenu><DropdownMenuTrigger asChild><Button ref={changeGoal} variant="ghost" size="icon-sm" disabled={busy} aria-label={__('Campaign actions', 'wconvert')}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="wconvert-campaign-actions">
              {small && <><DropdownMenuItem disabled={busy || !history.canUndo} onSelect={history.undo}><Undo2 aria-hidden="true" className="rtl:-scale-x-100" />{history.labels.undo}</DropdownMenuItem>
              <DropdownMenuItem disabled={busy || !history.canRedo} onSelect={history.redo}><Redo2 aria-hidden="true" className="rtl:-scale-x-100" />{history.labels.redo}</DropdownMenuItem></>}
              <DropdownMenuItem disabled={busy} onSelect={() => setTransfer({ action: 'import', config, name })}><ArrowUpFromLine aria-hidden="true" />{__('Import design', 'wconvert')}</DropdownMenuItem>
              <DropdownMenuItem disabled={busy || !template} onSelect={() => setTransfer({ action: 'export', config, name })}><ArrowDownToLine aria-hidden="true" />{__('Export design', 'wconvert')}</DropdownMenuItem>
              <DropdownMenuItem disabled={busy} onSelect={() => { detailsTrigger.current = changeGoal.current; setDetails(true); }}><Info aria-hidden="true" />{__('Campaign details', 'wconvert')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {error !== null && <PageError message={error} />}
      <div className="wconvert-workspace__body" inert={busy}>
        <TabsContent value="journey" forceMount={journeyVisited || undefined} className="wconvert-workspace__journey">
          <Activity mode={tab === 'journey' ? 'visible' : 'hidden'}>
          {!entry && <EmptyState icon={Blocks} title={__('Choose a design', 'wconvert')} action={<Button onClick={() => setBrowsing(true)}>{__('Browse designs and formats', 'wconvert')}</Button>}>{__('Start from a ready-made design, then make it yours.', 'wconvert')}</EmptyState>}
          {entry && <JourneyEditor onUndo={history.canUndo ? history.undo : undefined} embedded labels={gallery.labels} onResultSelect={setEditingResult}
            editorCanvas={previewPane}
            appearancePreview={showingLock ? previewPane : undefined}
            editorTools={<DeviceControls width={width} onChange={setWidth} />}
            elementSelection={selection ?? undefined}
            onClearElement={() => setSelection(null)}
            elementPanel={selection && nodeAt(entry.tree, selection.path)?.type !== 'question' ? <BlockInspector template={entry} labels={gallery.labels} path={selection.path} act={act}
              onChange={(next, coalesce) => edit({ template: next }, coalesce)} onSwap={next => edit({ template: next })}
              endsAt={displayRules.schedule.ends_at} onSetEndDate={goToSchedule} onPlacement={goToInlinePlacement} onSelect={chooseFromTree}
              onDesign={() => { setTab('design'); designSettings(); }} onShowLayers={() => { setTab('design'); setShowLayers(true); setDrawer('layers'); }}
              look={<ScopeStyle key={selection.path.join('.')} template={entry} labels={gallery.labels} path={selection.path} openToken={openToken} onOpenToken={setOpenToken} onSelect={chooseFromTree}
                onChange={(next, coalesce) => edit({ template: next }, coalesce)} copied={copiedLook} onCopy={setCopiedLook} width={width === 'narrow' ? 'narrow' : 'tokens'} />} /> : undefined}
            testRequest={journeyTestRequest} onTestExit={() => setPreviewFromRules(false)} onTestClose={() => { const returnTab = previewReturnTab.current; previewReturnTab.current = 'journey'; setTab(returnTab); }}
            issues={issues} onIssue={issue => followIssue(issue.go, issueRoutes)} primaryChannel={entryOfGoal?.outcome.audience_channel} tree={entry.tree} tokens={entry.tokens} step={shownStep} repairRequest={journeyRepair ?? undefined}
            focusActions={<><HistoryControls history={{ ...history, canUndo: !busy && history.canUndo, canRedo: !busy && history.canRedo }} />
              <Button type="button" variant="outline" size="sm" disabled={busy || !dirty} onClick={() => void save()}>{busy ? __('Saving…', 'wconvert') : __('Save draft', 'wconvert')}</Button></>}
            onChange={(tree, coalesce) => edit({ template: { ...entry, tree } }, coalesce)} onSelect={chooseStep} displaySummary={displaySummary} destinationSummary={destinationSummary}
            contextEditors={{ rules: displayEditor(true), destinations: destinationEditor }}
            deliveryMode={captureMode === 'local' ? 'local' : bound.length > 0 ? 'connected' : 'none'}
            onGoToDesign={() => { setTab('design'); }}
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
                    >
                      <Layers aria-hidden="true" />
                      {__('Layers', 'wconvert')}
                    </Button>
                    <Button ref={designButton} variant="ghost" onClick={designSettings}>
                      <SlidersHorizontal aria-hidden="true" />
                      {__('Design settings', 'wconvert')}
                    </Button>
                  </div>
                  <div className="wconvert-workspace__screens"><ScreenControls template={entry} step={shownStep} onChange={chooseStep} extra={canPreviewReopen ? { label: reopenLabel, selected: showingReopen, onSelect: showReopen } : undefined} />
                  </div>
                  <div>
                    {compact ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={__('Preview options', 'wconvert')}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setWidth('own')}>{__('Desktop preview', 'wconvert')}</DropdownMenuItem><DropdownMenuItem onSelect={() => setWidth('narrow')}>{__('Mobile preview', 'wconvert')}</DropdownMenuItem></DropdownMenuContent>
                    </DropdownMenu> : <DeviceControls width={width} onChange={setWidth} />}
                    {compact && width === 'narrow' && <MobileAppearanceNote />}
                    <Fullscreen />
                  </div>
                </div>
                  <StructureView onUndo={history.canUndo && !busy ? history.undo : undefined} draft={config}
                    template={entry}
                    labels={gallery.labels}
                    act={act}
                    selected={selection?.path ?? null}
                    onSelect={chooseFromTree}
                    onChange={(next, coalesce) => edit({ template: next }, coalesce)}
                    focus={focusRow}
                    endsAt={displayRules.schedule.ends_at}
                    onSetEndDate={goToSchedule} onPlacement={goToInlinePlacement}
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
                            onChange={(next, coalesce) => edit({ template: next }, coalesce)}
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
                            onChange={(next, coalesce) => edit({ template: next }, coalesce)}
                            copied={copiedLook}
                            onCopy={setCopiedLook}
                            width={width === 'narrow' ? 'narrow' : 'tokens'}
                          />
                        )}
                      </>
                    }
                  />
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
      <AdminDialog open={details} onOpenChange={setDetails}>
        <AdminDialogContent size="md" className="wconvert-optin-details" onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!changingGoal) detailsTrigger.current?.focus();
        }}>
          <AdminDialogHeader
            title={name || __('Untitled campaign', 'wconvert')}
            badge={<StatusBadge status={statusOf({ published_at: publishedAt, deleted_at: deletedAt, suspended, has_unpublished_changes: unpublishedChanges })} />}
            meta={dirty ? __('Unsaved changes', 'wconvert') : unpublishedChanges ? __('Unpublished changes', 'wconvert') : undefined}
          />
          <AdminDialogBody className="grid gap-4">
            <section className="wconvert-details-section"><h3>{__('Goal', 'wconvert')}</h3>
              <div className="flex min-h-[1lh] flex-wrap items-center gap-x-3 gap-y-2 text-note text-muted-foreground">
                <span>{goalSaid(goalEntry, goal ?? '')}</span>
                {goals.status === 'ready' &&
                  offerableGoals(goals.data, 'creation_flow', goal ?? '').length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDetails(false);
                        setChangingGoal(true);
                      }}
                    >
                      {canChangeGoal ? __('Change goal', 'wconvert') : __('Duplicate for another goal', 'wconvert')}
                    </Button>
                  )}
              </div>
              {entryOfGoal?.outcome && <p className="mt-2">{entryOfGoal.outcome.measurement}</p>}
            </section>
            <CampaignAnalytics value={config.analytics} parentId={analyticsParent} onChange={analytics => edit({ analytics })} />
            <section className="wconvert-details-section"><h3>{__('Results', 'wconvert')}</h3>
              {publishedAt === null ? (
                <p>{__('Publish this campaign to start counting views and conversions.', 'wconvert')}</p>
              ) : stats.status === 'loading' ? (
                <>
                  <StatRowSkeleton stats={3} />
                  <Skeleton aria-hidden="true" className="mt-2 h-[1lh] w-28 text-body" />
                </>
              ) : stats.status === 'failed' ? (
                <div className="grid justify-items-start gap-2">
                  <p role="alert" className="text-destructive">{__('The numbers could not be loaded.', 'wconvert')}</p>
                  <TryAgain onClick={() => setStatsRead((value) => value + 1)} />
                </div>
              ) : numbers === null ? (
                <p>{__('Nothing recorded yet.', 'wconvert')}</p>
              ) : (
                <>
                  <StatRow>
                    <Stat
                      emphasis
                      label={entryOfGoal?.headline_label ?? numbers.label}
                      value={formatCount(numbers.report.headline)}
                    />
                    <Stat
                      label={__('Shown', 'wconvert')}
                      value={formatCount(numbers.report.impressions)}
                    />
                    <Stat
                      label={__('Conversion rate', 'wconvert')}
                      value={formatRate(numbers.report.conversion_rate)}
                    />
                  </StatRow>
                  <p className="mt-2">
                    {sprintf(
                      _n('The last %s day', 'The last %s days', numbers.days, 'wconvert'),
                      formatCount(numbers.days),
                    )}
                  </p>
                </>
              )}
            </section>
            {details && id && <><ProductActivityReport id={id} /><JourneyReport id={id} /></>}
            {/* The one place a developer finds the ID page events carry, as in the list's Details (ADR 0131). */}
            <ForDevelopers value={id} variant={analyticsParent !== null} />
            {entry && adminSettings()?.dev === true && (
              <Disclosure variant="inline" title={__('Developer tools', 'wconvert')}>
                <PayloadMeter template={entry} />
                <DevExport entry={entry} onChange={(next) => edit({ template: next })} />
              </Disclosure>
            )}
          </AdminDialogBody>
        </AdminDialogContent>
      </AdminDialog>
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={__('Leave without saving?', 'wconvert')}
        description={__('Your unsaved changes will be lost. The last saved draft and the published version stay as they are.', 'wconvert')}
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
            if (config !== transfer.config) return __('Your draft changed during import. Close this and review the file again.', 'wconvert');
            edit(patch); setSelection(null); setStep(0); setImported(true); setTransfer(null); changeGoal.current?.focus();
          }} />
      </Suspense>}

      <TemplatePickerDialog fieldMappings={config.integration_mappings}
        open={browsing}
        onOpenChange={setBrowsing}
        onClosed={() => browse.current?.focus()}
        onCatalogInstalled={catalogConfigured() ? async () => { setGallery(await listTemplates()); } : undefined}
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
        onRetry={loadGoals}
        // Both paths resolve or reject into the dialog, which stays open and
        // shows a refusal beside its button rather than on the page behind it.
        onChange={(picked) => {
          setBusy(true);
          setError(null);
          if (canChangeGoal) return persistDraft(config ?? {}, picked).finally(() => setBusy(false));
          return createOptin(sprintf(__('%s — copy', 'wconvert'), name), picked, config ?? {})
            .then((created) => {
              onEditingStateChange?.({ dirty: false, busy: false });
              if (onCreated) onCreated(created.id);
              else window.location.hash = editorHref(created.id);
            })
            .catch((cause: unknown) => {
              throw new Error(sprintf(__('The copy could not be confirmed. Check the campaigns list before trying again. %s', 'wconvert'), messageOf(cause)));
            })
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
        <Undo2 aria-hidden="true" className="rtl:-scale-x-100" />
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
        <Redo2 aria-hidden="true" className="rtl:-scale-x-100" />
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

  // Never the stored ID on screen (ADR 0131): a design no longer installed is named as such.
  return templates?.find((each) => each.id === templateId)?.name ?? __('Removed design', 'wconvert');
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

/** A tab's mark for something that blocks publishing; the words are its description. */
function AttentionDot() {
  return <span className="wconvert-tab-attention" aria-hidden="true" />;
}
