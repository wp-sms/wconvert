import { lazy, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Copy, FilePlus2, Maximize2, Minimize2, Plus, Search, Trash2, MoreHorizontal, Workflow, X } from 'lucide-react';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { Disclosure } from '../shell/Disclosure';
import { OptionStrip } from '../shell/OptionStrip';
import { DropdownMenu, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { OptionGroup, OptionItem, OptionMenuContent, OptionSeparator, refusal } from '../components/ui/option-menu';
import { Dialog, DialogTrigger, DialogTitle, DialogDescription, DialogClose } from '../components/ui/dialog';
import { AdminDialogContent } from '../components/ui/admin-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertDialog, AlertDialogContent } from '../components/ui/alert-dialog';
import { EditTree, screenIconOf, type EditTreeLook, type EditTreeRow } from './EditTree';
import { FactList, FactRow, PanelHeader, PanelSection } from './PanelSection';
import { QuestionPanelContext, ScreenAnswers, ScreenChips, ScreenIssues, ScreenThen } from './ScreenPanel';
import { contactWording, privacyLink } from './structure/captureWording';
import { useCaptureRequest } from './CaptureSwitch';
import { nodesOf } from './structure/tree';
import type { Path } from './panel';
import type { JourneyChange } from './structure/changeTestGuide';
import { followupGroups, followupGroupSource } from './structure/followupGroups';
import { JourneyScreenCard } from './JourneyScreenCard';
import { JourneyArrivalSummary } from './JourneyArrivalSummary';
import { FlowMapBoundary } from './FlowMapBoundary';
import { FlowSkeleton } from './flow/FlowSkeleton';
import { journeyAuthoring, NO_AUTHORING, type JourneyAuthoringUI, type JourneyEditorContext, type QuestionReviewContext } from '../journeyAuthoring';
import { JourneyTest } from './JourneyTest';
import { JourneyScreenContent } from './JourneyScreenContent';
import type { TemplateLabels } from '../templates/api';
import { JourneyConsentSettings } from './JourneyConsentSettings';
import { JourneyCaptureSettings } from './JourneyCaptureSettings';
import { GraphCaptureRemove } from './GraphCaptureRemove';
import { captureOnScreen, graphCaptureRemovalPlan } from './structure/graphCaptureRemoval';
import { GraphScreenRemove } from './GraphScreenRemove';
import { graphRemovalPlan } from './structure/graphRemoval';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import type { TemplateNode, TemplateScreen, TemplateTree, Tokens } from '@renderer/types';
import { duplicateScreen, freshScreen, referencedJourney, usesJourneyElements, walkNodes, submissionScreen, movedScreen, screenMoveRefusal, screenRemoval, whyScreenStays, removedScreen, unreachableScreenIds, withBackButton } from './structure/journey';
import { conditionText } from './structure/conditionText';
import { graphDisplayOrder } from './structure/graph';
import { isRefusal, straightenedJourney } from './structure/straighten';
import type { JourneyRepair } from './structure/journeyReadiness';
import type { CampaignIssue } from './readiness/campaignIssues';
import { journeysSupported } from '../settings';
import { ProHint } from '../shell/ProHint';

const EMPTY_TOKENS: Tokens = {};
const NO_ISSUES: readonly CampaignIssue[] = [];
const JourneyMap = lazy(() => import('./JourneyMap').then(module => ({ default: module.JourneyMap })));

/** Whether a screen holds any of the main form: its fields, consent or button. */
function holdsMainForm(tree: TemplateTree, index: number): boolean {
  const main = tree.submissions[0];
  if (!main?.required || !tree.steps[index]) return false;
  return walkNodes(tree.steps[index].content).some(node => ('id' in node && typeof node.id === 'string' && [...main.fields, ...main.consents].includes(node.id))
    || (node.type === 'button' && 'submission' in node && node.submission === main.id));
}

export function JourneyEditor({ labels, onResultSelect, onUndo, tree, tokens = EMPTY_TOKENS, step, primaryChannel, issues = NO_ISSUES, onIssue, look, formSwitch, announce, lookPanel, elements, extraRows, editingScreen = true, onSelectElement, onChange, onSelect, displaySummary, destinationSummary, deliveryMode, onGoToRules, onGoToDestinations, onGoToDesign, openRequest, repairRequest: requestedRepair, embedded = false, focusActions, editorCanvas, elementPanel, elementSelection, onClearElement, testRequest, testReturnFocus, onTestClose, onTestExit, previewTitle, whoSeesIt, displayType }: {
  onUndo?(): void; labels?: TemplateLabels; onResultSelect?(id: string | undefined): void; tokens?: Tokens; primaryChannel?: string | null; tree: TemplateTree;
  /** The campaign's one issue list (ADR 0133); the screens and the map show the ones about a screen. */
  issues?: readonly CampaignIssue[];
  /** Follows an issue whose fix is outside this editor. */
  onIssue?(issue: CampaignIssue): void;
  /** The Edit tree's pinned Look row, and the panel it opens (ADR 0134). */
  look?: EditTreeLook; lookPanel?: ReactNode;
  /** The Contact form switch, drawn above the screens (ADR 0163). */
  formSwitch?: ReactNode;
  /** What the form switch just changed, said in the footer beside Undo. */
  announce?: { readonly said: string; readonly serial: number };
  /** The open screen's elements, nested under its row in the Edit tree. */
  elements?: ReactNode;
  /** Tree rows that are not screens: the reopen button, the locked content preview. */
  extraRows?: readonly EditTreeRow[];
  /** False while the Look or an extra row is what the panel shows. */
  editingScreen?: boolean;
  /** Opens one element's own panel: a field from the Form section, a chip, the question. */
  onSelectElement?(path: Path): void; step: number; onChange(tree: TemplateTree, coalesce?: string): void; onSelect(step: number): void;
  displaySummary?: string; destinationSummary?: string; deliveryMode?: 'local' | 'connected' | 'none'; onGoToRules?(): void; onGoToDestinations?(): void; onGoToDesign?(): void; openRequest?: number;
  repairRequest?: JourneyRepair & { readonly serial: number }; embedded?: boolean;
  editorCanvas?: ReactNode; elementPanel?: ReactNode; elementSelection?: object; onClearElement?(): void; testRequest?: number; onTestClose?(): void; onTestExit?(): void;
  /** Preview's title: the campaign's name. */
  previewTitle?: string;
  /** The campaign's format, so each screen's thumb stands in its slot (ADR 0170). */
  displayType: string;
  /** Preview's second tab, Who sees it; `close` closes Preview. */
  whoSeesIt?(close: () => void): ReactNode;
  /** Where focus returns when a requested test closes: the menu item that asked is gone by then. */
  testReturnFocus?: RefObject<HTMLElement | null>;
  focusActions?: ReactNode;
}) {
  const id = useId();
  // Questions, results, screen conditions and answer paths are Pro's editors,
  // in Pro's bundle (ADR 0147). Free's bundle has none of them, so a free
  // install keeps linear screens and can still delete a journey's screens.
  const journeys = journeysSupported();
  // Stable for the page's life: the flag is boot data and Pro registers before the app mounts.
  const useAuthoring = (journeys && journeyAuthoring.useAuthoring) || useNoAuthoring;
  const testTemplate = useMemo(() => ({ tree, tokens }), [tree, tokens]);
  const [referenceRequest, setReferenceRequest] = useState<(JourneyRepair & { serial: number }) | undefined>(requestedRepair);
  const referenceSerial = useRef(0);
  useEffect(() => { setReferenceRequest(requestedRepair); }, [requestedRepair]);
  const repairRequest = referenceRequest;
  // A different element starts at the top of its panel; edits to the same one keep their place.
  const elementPane = useRef<HTMLElement>(null);
  const elementKey = JSON.stringify((elementSelection as { path?: unknown } | undefined)?.path ?? null);
  useLayoutEffect(() => { if (elementPane.current) elementPane.current.scrollTop = 0; }, [elementKey]);
  // Followed by the builder, which sends a repair back as `repairRequest` (ADR 0133).
  const openIssue = (issue: CampaignIssue) => onIssue?.(issue);

  const [open, setOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testChange, setTestChange] = useState<JourneyChange | undefined>();
  const [testMode, setTestMode] = useState<'journey' | 'visit'>('journey');
  const previewMode = testMode === 'visit' && whoSeesIt ? 'visit' : 'journey';
  const leaveTest = () => { setTestOpen(false); onTestExit?.(); };
  const closeTest = () => { leaveTest(); setTestChange(undefined); onTestClose?.(); if (!embedded) setOpen(true); };
  const addTrigger = useRef<HTMLButtonElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const deletedGraphScreen = useRef(false);
  const [widePanel, setWidePanel] = useState(false);
  const [focused, setFocused] = useState(false);
  const focusTrigger = useRef<HTMLButtonElement>(null);
  const workspaceRoot = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focused || !embedded) return;
    document.body.classList.add('wconvert-journey-focus');
    return () => document.body.classList.remove('wconvert-journey-focus');
  }, [focused, embedded]);
  const testHeading = useRef<HTMLHeadingElement>(null);
  const settingsHeading = useRef<HTMLHeadingElement>(null);
  const inspectorTrigger = useRef<HTMLElement | null>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const returnToTestTrigger = useRef(true);
  const [view, setView] = useState<'edit' | 'flow' | 'screens'>(editorCanvas ? 'edit' : 'flow');
  // Flow is always offered, a straight campaign too (ADR 0142).
  const externalTestTrigger = useRef<HTMLElement | null>(null);
  const handledTestRequest = useRef(0);
  useEffect(() => { if (testRequest && testRequest !== handledTestRequest.current) { handledTestRequest.current = testRequest; externalTestTrigger.current = testReturnFocus?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null); returnToTestTrigger.current = true; setTestChange(undefined); setTestMode('journey'); setTestOpen(true); } }, [testRequest]); // eslint-disable-line react-hooks/exhaustive-deps -- only a new request opens it
  // A question's line clicked on the map opens the question with that line marked (ADR 0134).
  const lineToMark = useRef<number | 'hidden' | null>(null);
  useEffect(() => { if (elementSelection) { setInspecting(true); setRequestedSection('content'); setMobilePane('details'); setPathFocus(lineToMark.current); lineToMark.current = null; } }, [elementSelection]);
  const [query, setQuery] = useState('');
  const [inspecting, setInspecting] = useState(!!editorCanvas || !embedded);
  const [sampleEdges, setSampleEdges] = useState<readonly string[] | null>(null);
  const [samplePath, setSamplePath] = useState<readonly number[] | null>(null);
  useEffect(() => { setSamplePath(null); setSampleEdges(null); }, [tree]);
  const [requestedSection, setRequestedSection] = useState<'content' | 'paths'>('content');
  // "Next screen" edits answer paths, so it exists only where Pro authors them.
  const panelSection = journeys ? requestedSection : 'content';
  const [returnInspection, setReturnInspection] = useState<{ screenId: string; section: 'content' | 'paths'; review?: QuestionReviewContext } | null>(null);
  const [resumeReview, setResumeReview] = useState<(QuestionReviewContext & { serial: number }) | undefined>();
  const [mobilePane, setMobilePane] = useState<'tree' | 'map' | 'details'>('map');
  // Narrow, a tree row shows what it opens: the Look's panel, or the preview a
  // Reopen or Locked content row puts on the canvas.
  const lookOpen = !!look?.open;
  useEffect(() => { if (lookOpen) setMobilePane('details'); else if (!editingScreen) setMobilePane('map'); }, [lookOpen, editingScreen]);
  const [pathFocus, setPathFocus] = useState<number | 'hidden' | null>(null);
  const selectedScreenId = tree.steps[step]?.id;
  useEffect(() => {
    const body = settingsHeading.current?.closest('.wconvert-journey-pane')?.querySelector('.wconvert-journey-dialog__details');
    if (body) body.scrollTop = 0;
  }, [selectedScreenId, panelSection]);
  const selectedId = useRef(tree.steps[step]?.id);
  useEffect(() => { if (openRequest) setOpen(true); }, [openRequest]);
  const handledRepair = useRef(0);
  useEffect(() => {
    if (!repairRequest || handledRepair.current === repairRequest.serial) return;
    handledRepair.current = repairRequest.serial;
    inspectorTrigger.current = null;
    const index = tree.steps.findIndex(screen => screen.id === repairRequest.screenId);
    if (index < 0) return;
    selectedId.current = repairRequest.screenId;
    setInspecting(true);
    if (!editorCanvas) setView('flow');
    onClearElement?.();
    setMobilePane('details');
    setRequestedSection(repairRequest.section);
    const answerPaths = tree.graph?.edges.filter(edge => edge.from === repairRequest.screenId && edge.kind === 'answer');
    const repairEdge = tree.graph?.edges.find(edge => edge.id === repairRequest.edgeId);
    const priority = repairEdge?.kind === 'default' ? answerPaths?.length
      : repairRequest.edgeId ? answerPaths?.findIndex(edge => edge.id === repairRequest.edgeId)
      : repairRequest.pathPriority;
    setPathFocus(repairRequest.focus === 'hidden-route' ? 'hidden' : priority !== undefined && priority >= 0 ? priority : null);
    onSelect(index);
    // On the Edit tab a question's settings and paths are its own panel (ADR 0134):
    // a repair to either opens the question rather than its screen.
    const question = nodesOf(tree).find(block => block.path[0] === index && block.type === 'question')?.path;
    if (editorCanvas && view === 'edit' && question && onSelectElement && (repairRequest.section === 'paths' || repairRequest.questionId)) {
      onSelectElement(question);
      return;
    }
    if (!repairRequest.resultId && repairRequest.focus !== 'products-required' && (repairRequest.section === 'content' || priority === undefined || priority < 0)) requestAnimationFrame(() => {
      const heading = settingsHeading.current;
      const pane = heading?.closest('.wconvert-journey-pane');
      if (repairRequest.questionId) {
        const question = [...(pane?.querySelectorAll<HTMLElement>('[data-question-id]') ?? [])].find(item => item.dataset.questionId === repairRequest.questionId);
        const target = repairRequest.choiceIndex !== undefined
          ? question?.querySelectorAll<HTMLElement>('.wconvert-journey-settings__choice input')[repairRequest.choiceIndex] ?? question?.querySelector<HTMLElement>('button')
          : question?.querySelector<HTMLElement>('textarea');
        (target ?? heading)?.focus(); return;
      }
      if (repairRequest.focus === 'screen-name') { pane?.querySelector<HTMLElement>('.wconvert-journey-pane__name')?.focus(); return; }
      const disclosure = pane?.querySelector<HTMLDetailsElement>('.wconvert-journey-visibility');
      if (disclosure && (!repairRequest.focus || repairRequest.focus === 'hidden-route')) disclosure.open = true;
      const condition = repairRequest.focus === 'hidden-route'
        ? heading?.closest('.wconvert-journey-pane')?.querySelector<HTMLElement>('.wconvert-journey-settings__skip select')
        : repairRequest.section === 'content'
        ? heading?.closest('.wconvert-journey-pane')?.querySelector<HTMLElement>(repairRequest.focus === 'questions'
          ? '.wconvert-journey-settings__question textarea' : '.wconvert-journey-settings__clause select') : null;
      (condition ?? heading)?.focus();
    });
  }, [repairRequest, tree.steps, tree.graph, onSelect, editorCanvas, onClearElement]); // eslint-disable-line react-hooks/exhaustive-deps -- a repair is handled once, against the tree and view it arrived with
  const [notice, setNotice] = useState<JourneyChange>({ text: '', screenId: '', screenName: '' });
  const setSaid = (text: string, screen = tree.steps[step]) => setNotice({ text, screenId: screen?.id ?? '', screenName: screen?.name ?? '' });
  const said = notice.text;
  const previousNotice = useRef(notice);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [confirmGraphRemoval, setConfirmGraphRemoval] = useState(false);
  // The ⋯ menu's confirm for a plain delete.
  const [deleting, setDeleting] = useState(false);
  const requestCapture = useCaptureRequest();
  const [straightening, setStraightening] = useState(false);
  // Why a campaign without answer lines takes no more screens, in two lengths (ADR 0139).
  const capRefusal = refusal(__('Up to 7 screens', 'wconvert'), __('A campaign without answer lines holds up to 7 screens.', 'wconvert'));
  const capped = !tree.graph && tree.steps.length >= 7;
  const editorContext: JourneyEditorContext = {
    tree, step, primaryChannel, slim: !!editorCanvas, panelSection, pathFocus, repairRequest, resumeReview, addTrigger, settingsHeading,
    capRefusal: capped ? capRefusal : null, onChange, onResultSelect,
    select: index => select(index), write: (next, index) => write(next, index), insertScreen: make => insertScreen(make), addOptional: () => addOptional(),
    say: (text, screen) => setSaid(text, screen), showSection: setRequestedSection, showDetails: () => setMobilePane('details'),
    showFlow: () => { setView('flow'); setMobilePane('map'); },
    returnHere: review => setReturnInspection({ screenId: tree.steps[step]?.id ?? '', section: panelSection, review }),
    openReference: repair => setReferenceRequest({ ...repair, serial: --referenceSerial.current }),
  };
  const authoring = useAuthoring(editorContext);
  useEffect(() => {
    if (!focused) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || testOpen || authoring.busy || confirmRemoval || confirmGraphRemoval
        || !(event.target instanceof Node) || !workspaceRoot.current?.contains(event.target)) return;
      event.preventDefault(); setFocused(false); focusTrigger.current?.focus();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [focused, testOpen, authoring.busy, confirmRemoval, confirmGraphRemoval]);
  const screenList = useRef<HTMLOListElement>(null);
  const previousTree = useRef(tree);
  const select = (index: number) => { setDeleting(false); authoring.reset(); setResumeReview(undefined); onClearElement?.(); setReturnInspection(null); setReferenceRequest(undefined); inspectorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; selectedId.current = tree.steps[index]?.id; setInspecting(true); setSamplePath(null); setSampleEdges(null); setRequestedSection('content'); setPathFocus(null); setMobilePane('details'); onSelect(index); };
  useEffect(() => {
    if (previousTree.current !== tree) {
      // A later edit or Undo invalidates instructions about a prior operation.
      // Keep a new notice issued in the same render as its own draft change.
      if (notice === previousNotice.current && notice.text) setNotice({ text: '', screenId: '', screenName: '' });
      const index = tree.steps.findIndex(screen => screen.id === selectedId.current);
      if (index >= 0 && index !== step) onSelect(index);
      else selectedId.current = tree.steps[step]?.id;
      previousTree.current = tree;
    } else selectedId.current = tree.steps[step]?.id;
    previousNotice.current = notice;
  }, [tree, step, onSelect, notice]);
  // A change made outside this editor (the form switch) says itself here, with Undo.
  // After the effect above, so the same render's draft change does not clear it.
  useEffect(() => { if (announce) setSaid(announce.said, tree.steps[0]); }, [announce]); // eslint-disable-line react-hooks/exhaustive-deps -- each announcement is said once
  useEffect(() => { screenList.current?.querySelector('[data-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }); }, [step]);
  const current = tree.steps[step];
  const disconnected = useMemo(() => new Set(unreachableScreenIds(tree)), [tree]);
  if (!current) return null;
  const displayOrder = graphDisplayOrder(tree);
  const currentFollowups = followupGroups(tree).find(group => group.screens.includes(step));
  const followupSource = currentFollowups ? followupGroupSource(tree, currentFollowups) : undefined;
  const matches = tree.steps.map((screen, index) => ({ screen, index })).filter(item => item.screen.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const write = (next: TemplateTree, index: number) => { selectedId.current = next.steps[index]?.id; setInspecting(true); onChange(referencedJourney(next)); onSelect(index); };
  const move = (from: number, to: number) => {
    const next = movedScreen(tree, from, to);
    if (next === tree) { setSaid(__('Keep the main signup before the optional signup, and the thank-you screen last.', 'wconvert')); return; }
    write(next, to);
    setSaid(sprintf(/* translators: 1: a screen's name, e.g. “Skin type”, 2: its new position in the journey, e.g. 3. */ __('%1$s moved to screen %2$d.', 'wconvert'), tree.steps[from].name, to + 1));
  };
  const saving = (index: number) => tree.submissions.find(sub => submissionScreen(tree, sub.id) === index);
  const saveLabel = (id: string) => {
    const optional = tree.submissions.find(sub => sub.id === id)?.required === false;
    if (!primaryChannel) {
      if (!optional) return tree.steps.some(screen => screen.kind === 'result')
        ? __('Save details before result', 'wconvert') : __('Save request', 'wconvert');
      const fields = tree.submissions.find(sub => sub.id === id)?.fields ?? [];
      const phone = tree.steps.flatMap(screen => walkNodes(screen.content)).some(node => node.type === 'field'
        && 'id' in node && fields.includes(node.id ?? '') && 'name' in node && node.name === 'phone');
      return phone ? __('Save optional SMS signup', 'wconvert') : __('Save optional email signup', 'wconvert');
    }
    const email = optional ? (primaryChannel === 'sms' || primaryChannel === 'phone') : primaryChannel === 'email';
    return optional
      ? email ? __('Save optional email signup', 'wconvert') : __('Save optional SMS signup', 'wconvert')
      : email ? __('Save email signup', 'wconvert') : __('Save SMS signup', 'wconvert');
  };
  const screenLabel = (index: number) => tree.steps[index].kind === 'result' ? __('Shows a selected result', 'wconvert')
    : tree.steps[index].kind === 'acknowledgement' ? __('Ends the campaign', 'wconvert')
    : saving(index) ? saveLabel(saving(index)!.id) : __('Continue only', 'wconvert');
  // A screen inserted after the open one in a campaign without a graph; `make` builds it for its place.
  const insertScreen = (make: (at: number) => TemplateScreen) => {
    const steps = [...tree.steps]; const boundary = steps.findIndex(s => s.kind === 'result' || walkNodes(s.content).some(n => 'action' in n && n.action === 'submit'));
    const at = Math.min(step + 1, boundary < 0 ? steps.length - 1 : boundary);
    let screen = make(at);
    if (at === 0 && steps[0]) steps[0] = withBackButton(steps[0]);
    const optional = tree.submissions[1];
    const primaryEnd = steps.findIndex(s => walkNodes(s.content).some(n => 'submission' in n && n.submission === tree.submissions[0]?.id && 'action' in n && n.action === 'submit'));
    if (optional && at > primaryEnd && 'children' in screen.content) {
      screen = { ...screen, content: { ...screen.content, children: [...(screen.content.children ?? []),
        { type: 'button', label: __('No thanks', 'wconvert'), tokens: { accent: 'transparent', 'accent-fg': 'fg' }, action: 'skip', submission: optional.id, role: 'skip_label' }] } };
    }
    if (at === step + 1 && steps[step].paths?.length) {
      const paths = [...steps[step].paths!];
      const fallback = paths[paths.length - 1];
      screen = { ...screen, paths: [{ to: fallback.to }] };
      paths[paths.length - 1] = { to: screen.id };
      steps[step] = { ...steps[step], paths };
    } else if (at <= step && steps[at] && steps.some(item => item.paths)) {
      // Only an explicit route needs rewiring. Without one, screen order
      // already continues to the boundary, and a `paths` key here would make a
      // linear draft read as a journey (`CaptureJourney::requiresPremium()`).
      const boundaryId = steps[at].id;
      screen = { ...screen, paths: [{ to: boundaryId }] };
      for (let index = 0; index < at; index++) if (steps[index].paths) {
        steps[index] = { ...steps[index], paths: steps[index].paths!.map(path => path.to === boundaryId ? { ...path, to: screen.id } : path) };
      }
    }
    steps.splice(at, 0, screen); write({ ...tree, steps }, at);
  };
  // Free adds message screens to a campaign without a graph. Questions, follow-ups
  // and screens on a graph are Pro's (ADR 0147).
  const add = (kind: 'content' | 'input', conditional = false) => {
    if (tree.graph || kind === 'input' || conditional) { authoring.add(kind, conditional); return; }
    insertScreen(at => freshScreen(tree, 'content', at > 0));
  };
  const addOptional = () => {
    if (tree.graph) { authoring.addOptional(); return; }
    const channel = (primaryChannel === 'sms' || primaryChannel === 'phone') || tree.submissions.length === 0 ? 'email' : 'phone';
    const id = channel === 'email' ? 'email-signup' : 'sms-signup';
    // Keep an earned reward visible before asking for an optional channel.
    // Leave the original in acknowledgement so removing SMS cannot remove it.
    const rewards = walkNodes(tree.steps[tree.steps.length - 1].content, false)
      .filter(node => ['code', 'followup'].includes(node.type) && !('hidden' in node && node.hidden))
      .map(node => { const copy = { ...node } as Record<string, unknown>; delete copy.id; return copy as unknown as TemplateNode; });
    const screen = { ...freshScreen(tree, 'input'), name: channel === 'email' ? __('Optional email signup', 'wconvert') : __('Optional SMS signup', 'wconvert'), content: { type: 'stack', children: [
      { type: 'heading', text: __('Your signup was received', 'wconvert'), role: 'headline' },
      ...rewards,
      { type: 'text', text: channel === 'email' ? __('Would you also like email updates?', 'wconvert') : __('Would you also like text updates?', 'wconvert'), role: 'body' },
      { type: 'field', name: channel, required: true, label: contactWording(channel).label },
      { type: 'consent', text: contactWording(channel).optionalConsent, link: privacyLink(), hidden: false, role: 'consent_text' },
      { type: 'button', label: channel === 'email' ? __('Sign up for email', 'wconvert') : __('Sign up for SMS', 'wconvert'), action: 'submit', submission: id },
      { type: 'button', label: __('No thanks', 'wconvert'), tokens: { accent: 'transparent', 'accent-fg': 'fg' }, action: 'skip', submission: id },
      { type: 'button', label: __('Back', 'wconvert'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
    ] } } as const;
    const steps = [...tree.steps];
    if (tree.submissions.length === 0 && steps[steps.length - 1].kind === 'result') {
      const result = steps[steps.length - 1];
      steps[steps.length - 1] = { ...result, content: { type: 'stack', children: [result.content,
        { type: 'button', label: __('Optional email updates', 'wconvert'), action: 'next' }] } };
      steps.push(screen, { id: 'received', name: __('Thanks', 'wconvert'), kind: 'acknowledgement', content: { type: 'stack', children: [
        { type: 'heading', text: __('You can return to your result', 'wconvert') },
        { type: 'button', label: __('Back', 'wconvert'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
      ] } });
      write({ ...tree, steps, submissions: [{ id, required: false, fields: [], consents: [] }] }, steps.length - 2);
    } else {
      const previous = steps[steps.length - 2];
      const end = steps[steps.length - 1];
      if (previous.paths?.length) {
        steps[steps.length - 2] = { ...previous, paths: previous.paths.map(path => path.to === end.id ? { ...path, to: screen.id } : path) };
      }
      steps.splice(steps.length - 1, 0, screen);
      if (previous.paths?.length) steps[steps.length - 2] = { ...steps[steps.length - 2], paths: [{ to: end.id }] };
      write({ ...tree, steps, submissions: [...tree.submissions, { id, required: false, fields: [], consents: [] }] }, steps.length - 2);
    }
  };
  const removal = screenRemoval(tree, step, journeys);
  const selectedCapture = tree.graph ? captureOnScreen(tree, current.id) : undefined;
  const optionalRemoval = selectedCapture && !selectedCapture.required ? graphCaptureRemovalPlan(tree, selectedCapture.id) : null;
  const graphDelete = tree.graph ? graphRemovalPlan(tree, current.id, journeys) : null;
  const deletionReason = optionalRemoval ? optionalRemoval.reason : graphDelete?.reason;
  // Why Delete is refused, in two lengths for its menu row (ADR 0139).
  // Deleting the main form's screen removes the form, through the same box as
  // the Contact form switch, where the switch is offered (ADR 0163).
  const takesForm = requestCapture !== null && holdsMainForm(tree, step);
  const deletionRefusal = takesForm ? null : tree.graph
    ? deletionReason ? refusal((optionalRemoval ?? graphDelete)?.short ?? deletionReason, deletionReason) : null
    : removal.screens.length === 0 ? whyScreenStays(tree, step, journeys) : null;
  const applyGraphRemoval = (next: TemplateTree, destination: string) => {
    deletedGraphScreen.current = true;
    const target = next.steps.findIndex(screen => screen.id === destination);
    write(next, target >= 0 ? target : 0);
    setRequestedSection('content'); setMobilePane('details'); setConfirmGraphRemoval(false);
    setSaid(optionalRemoval ? __('Optional signup removed. Check the remaining screens. Undo restores the signup and its lines.', 'wconvert')
      : __('Screen removed. Check the remaining lines. Undo restores the screen and its lines.', 'wconvert'));
  };
  const duplicate = () => {
    const steps = [...tree.steps];
    let copy = duplicateScreen(tree, step);
    if (steps.slice(0, step).some(screen => screen.paths?.some(path => path.to === current.id))) {
      for (let index = 0; index < step; index++) if (steps[index].paths?.some(path => path.to === current.id)) {
        steps[index] = { ...steps[index], paths: steps[index].paths!.map(path => path.to === current.id ? { ...path, to: copy.id } : path) };
      }
      copy = { ...copy, paths: [{ to: current.id }] };
    }
    steps.splice(step, 0, copy); write({ ...tree, steps }, step);
  };
  // A plain delete confirms in place; one that takes a signup or other screens
  // with it opens the dialog that says what goes.
  const askToDelete = () => {
    if (takesForm) { requestCapture('none'); return; }
    if (tree.graph) { if (!deletionReason) { deletedGraphScreen.current = false; setConfirmGraphRemoval(true); } return; }
    if (removal.screens.length > 1 || captureOnScreen(tree, current.id)) setConfirmRemoval(true);
    else setDeleting(true);
  };
  const remove = () => {
    const next = removedScreen(tree, step, journeys);
    write(next, Math.min(step, next.steps.length - 1));
    setSaid(__('Screen removed. Undo brings it back.', 'wconvert'));
  };
  const submission = saving(step);
  const boundary = tree.steps.findIndex(s => s.kind === 'result' || walkNodes(s.content).some(n => 'action' in n && n.action === 'submit'));
  const insertionAt = Math.min(step + 1, boundary < 0 ? tree.steps.length - 1 : boundary);
  const insertionLabel = tree.graph ? __('Choose where it goes', 'wconvert') : insertionAt <= step
    ? sprintf(/* translators: %s: a screen's name, e.g. “Thank you”. */ __('Before %s', 'wconvert'), tree.steps[insertionAt].name)
    : sprintf(/* translators: %s: a screen's name, e.g. “Skin type”. */ __('After %s', 'wconvert'), current.name);
  const panelOpen = inspecting;
  // Display rules and Destinations are tabs of their own, one click away (ADR 0134).
  const openContext = (kind: 'rules' | 'destinations') => { setOpen(false); (kind === 'rules' ? onGoToRules : onGoToDestinations)?.(); };
  // Opens one of a screen's lines where it is edited, from the map or the panel.
  const openLine = (index: number, priority: number | 'hidden') => {
    // A question's lines live on the question (ADR 0134), in Flow as on the canvas.
    const question = slim && onSelectElement ? nodesOf(tree).find(block => block.path[0] === index && block.type === 'question')?.path : undefined;
    setPathFocus(priority);
    if (question) { if (JSON.stringify(question) !== elementKey) lineToMark.current = priority; onSelectElement!(question); return; }
    select(index); setRequestedSection(priority === 'hidden' && !tree.graph ? 'content' : 'paths'); setPathFocus(priority);
    // "Then → X" opens the select that sets it: the screen's own Then, where it has no other lines.
    if (priority !== 'hidden') requestAnimationFrame(() => {
      const pane = settingsHeading.current?.closest('.wconvert-journey-pane');
      if (pane && !pane.querySelector('.wconvert-journey-routes')) pane.querySelector<HTMLElement>('[data-then]')?.focus();
    });
  };
  // The Edit tab on its canvas view: the tree is a pane of its own there.
  const onCanvas = !!editorCanvas && view === 'edit';
  // The Edit tab's screen panel is the slim one in Flow too (ADR 0135): one panel, whatever the view.
  const slim = !!editorCanvas;
  // The question element's panel on the Edit tab: its settings, then where
  // visitors go next (ADR 0134). Pro's, so null on free.
  const questionPanel = () => authoring.questionPanel;
  const isFirst = current.id === (tree.graph?.entry ?? tree.steps[0]?.id);
  const questionPath = nodesOf(tree).find(block => block.path[0] === step && block.type === 'question')?.path;
  // "+ Add screen" sits at the foot of the Edit tree: one menu for every kind
  // of screen a campaign can gain (ADR 0134). Free keeps its seven-screen cap
  // and offers what it can add; questions come from Pro's authoring (ADR 0147).
  const canAddOptional = tree.graph ? authoring.canAddOptional
    : !!primaryChannel && tree.submissions.length === 1 || tree.submissions.length === 0 && tree.steps.some(screen => screen.kind === 'result');
  const capHelp = authoring.capHelp ?? __('A campaign without answer lines holds up to 7 screens.', 'wconvert');
  // What "Make it a straight campaign" would leave, on a site that can't show this draft.
  const straight = !journeys && usesJourneyElements(tree) ? straightenedJourney(tree) : null;
  // A campaign with lines, on a site that can't edit them: straighten it before adding to it.
  const straightFirst = tree.graph && !authoring.lines
    ? refusal(__('Make it straight first', 'wconvert'), __('Make this a straight campaign before adding screens.', 'wconvert')) : null;
  // An optional signup after the result adds a thank-you screen too, so it needs two places.
  const optionalRefusal = !tree.graph && tree.steps.length >= (tree.submissions.length === 0 ? 6 : 7) ? capRefusal : null;
  const addScreenMenu = <DropdownMenu>
    <DropdownMenuTrigger asChild><button ref={addTrigger} type="button" className="wconvert-edit-tree__add wconvert-tree-add"><Plus aria-hidden="true" />{__('Add screen', 'wconvert')}</button></DropdownMenuTrigger>
    <OptionMenuContent align="start" aria-label={__('Add screen', 'wconvert')}>
      <OptionGroup note={capped ? capRefusal.short : null} noteTip={capped ? capHelp : null}>
        <OptionItem icon={FilePlus2} name={__('Message', 'wconvert')} refused={straightFirst ?? (capped ? capRefusal : null)} onSelect={() => add('content')} />
        {authoring.treeAddItems}
        {canAddOptional && <OptionItem icon={Plus} name={__('Optional signup', 'wconvert')} refused={optionalRefusal} onSelect={addOptional} />}
      </OptionGroup>
      {authoring.answersGroup}
    </OptionMenuContent>
  </DropdownMenu>;
  // Canvas | Flow is always there (ADR 0142).
  const workspace = <>
        <div className="wconvert-journey-dialog__header">
          <div>{embedded ? <h2 className={editorCanvas ? 'sr-only' : undefined}>{__('Screens', 'wconvert')}</h2> : <DialogTitle>{__('Manage screens', 'wconvert')}</DialogTitle>}
            {embedded ? <p className="wconvert-journey-description sr-only">{__('Select a screen to edit its content and lines.', 'wconvert')}</p>
              : <DialogDescription>{__('Select a screen to edit its content and lines.', 'wconvert')}</DialogDescription>}</div>
        <div className="wconvert-journey-view">
          <OptionStrip label={__('Edit view', 'wconvert')} value={view} options={[
            ...(editorCanvas ? [{ value: 'edit', label: __('Canvas', 'wconvert') }] : []),
            { value: 'flow', label: __('Flow', 'wconvert') },
            ...(!editorCanvas ? [{ value: 'screens', label: __('Screens', 'wconvert') }] : []),
          ]} onChange={value => { setView(value as typeof view); if (value !== 'flow') setInspecting(true); setMobilePane('map'); }} />
          {/* Edit has its own screen list; finding by name is a Flow-view tool. */}
          {view !== 'edit' && <div className="wconvert-journey-find"><label><Search aria-hidden="true" /><span className="sr-only">{__('Find a screen', 'wconvert')}</span><input ref={findInput} type="search" value={query} placeholder={__('Find a screen…', 'wconvert')} onChange={event => setQuery(event.target.value)} /></label>
            {query.trim() && <div className="wconvert-journey-find__results" role="group" aria-label={__('Matching screens', 'wconvert')}>
              {matches.length ? matches.map(({ screen, index }) => <button type="button" key={screen.id} onClick={() => { select(index); setQuery(''); }}><bdi>{screen.name}</bdi></button>)
                : <p>{__('No matching screens.', 'wconvert')}</p>}
            </div>}
          </div>}
        </div>
          {!journeys && usesJourneyElements(tree) && <div className="wconvert-journey-settings__warning" role="status"><p>{__('This design uses elements this site can’t display. This campaign can’t be published, and a live copy is paused; your draft keeps saving. Remove them to publish.', 'wconvert')}</p>
            {/* One undoable edit to everything this site can't show (ADR 0147). */}
            {straight && (isRefusal(straight)
              ? <><Button type="button" variant="outline" size="sm" aria-disabled="true" aria-describedby={`${id}-straight`}>{__('Make it a straight campaign', 'wconvert')}</Button>
                <small id={`${id}-straight`}>{straight.reason}</small></>
              : <Button type="button" variant="outline" size="sm" onClick={() => setStraightening(true)}>{__('Make it a straight campaign', 'wconvert')}</Button>)}
          </div>}
          <div className="wconvert-journey-dialog__header-actions">
            {embedded && view !== 'edit' && <Button ref={focusTrigger} type="button" variant="outline" aria-pressed={focused} onClick={() => setFocused(value => !value)}>
              {focused ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
              {focused ? __('Back to campaign', 'wconvert') : __('Focus', 'wconvert')}
            </Button>}
            {focused && focusActions}
            {!editorCanvas && (authoring.headerAdd ? authoring.headerAdd
              : !tree.graph && <Button ref={addTrigger} type="button" variant="outline" aria-disabled={tree.steps.length >= 7 || undefined} aria-describedby={tree.steps.length >= 7 ? `${id}-limit` : undefined}
                title={tree.steps.length >= 7 ? __('A campaign without answer lines holds up to 7 screens.', 'wconvert') : undefined}
                onClick={() => { if (tree.steps.length < 7) add('content'); }}><Plus aria-hidden="true" />{__('Add screen', 'wconvert')}</Button>)}
            {!tree.graph && tree.steps.length >= 7 && <span id={`${id}-limit`} className="sr-only">{__('A campaign without answer lines holds up to 7 screens.', 'wconvert')}</span>}
            {!editorCanvas && !tree.graph && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label={__('More screen options', 'wconvert')}><MoreHorizontal aria-hidden="true" /></Button>
              </DropdownMenuTrigger>
              <OptionMenuContent align="end" aria-label={__('More screen options', 'wconvert')}>
                <OptionGroup heading={insertionLabel}>
                  <OptionItem icon={FilePlus2} name={__('Add offer screen', 'wconvert')} refused={capped ? capRefusal : null} onSelect={() => add('content')} />
                  {authoring.headerAddItems}
                </OptionGroup>
                {canAddOptional &&
                  <OptionGroup heading={tree.submissions.length === 0
                    ? __('After the result', 'wconvert')
                    : tree.graph ? __('After the primary signup', 'wconvert') : sprintf(/* translators: %s: a screen's name. */ __('Before %s', 'wconvert'), tree.steps[tree.steps.length - 1].name)}>
                    <OptionItem icon={Plus} name={__('Add optional signup', 'wconvert')} refused={optionalRefusal} onSelect={addOptional} />
                  </OptionGroup>}
                {authoring.answersGroup}
              </OptionMenuContent>
            </DropdownMenu>}
            {!embedded && <DialogClose asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={__('Close screen manager', 'wconvert')}><X aria-hidden="true" /></Button></DialogClose>}
          </div>
        </div>
        {(panelOpen || onCanvas) && <OptionStrip className="wconvert-journey-mobile-tabs" label={__('Phone view', 'wconvert')} value={mobilePane}
          options={[
            // Narrow, the Edit tab is three panes taken one at a time (ADR 0134).
            ...(onCanvas ? [{ value: 'tree', label: __('Screens', 'wconvert') }] : []),
            { value: 'map', label: view === 'flow' ? __('Map', 'wconvert') : view === 'edit' ? __('Preview', 'wconvert') : __('Screens', 'wconvert') },
            { value: 'details', label: onCanvas ? __('Edit', 'wconvert') : __('Edit screen', 'wconvert') },
          ]} onChange={value => setMobilePane(value as typeof mobilePane)} />}
        <QuestionPanelContext.Provider value={editorCanvas ? questionPanel : null}>
        <div className="wconvert-journey-side" data-mobile-pane={mobilePane} data-panel-open={panelOpen} data-editing={view === 'edit' || undefined} data-wide-panel={widePanel || undefined}>
          <div className="wconvert-journey-mobile-picker"><label>{__('Screen', 'wconvert')}<select value={step} onChange={event => select(Number(event.target.value))}>{displayOrder.map(index => <option key={tree.steps[index].id} value={index}>{tree.steps[index].name}</option>)}</select></label></div>
          {view === 'edit' && <><EditTree tree={tree} step={step} editingScreen={editingScreen && !look?.open} issues={issues} onIssue={openIssue} onSelect={select}
            look={look} formSwitch={formSwitch} elements={elements} extraRows={extraRows} addScreen={addScreenMenu} /><div className="wconvert-campaign-canvas">{editorCanvas}</div></>}
          {view === 'flow' && <FlowMapBoundary><Suspense fallback={<FlowSkeleton />}>
            <JourneyMap issues={issues} onIssue={openIssue} tree={tree} selected={inspecting ? step : null} focusedPath={inspecting && (panelSection === 'paths' || !!elementPanel) ? pathFocus : null}
              onSelect={select} onSelectPath={openLine} samplePath={samplePath} sampleEdges={sampleEdges}
              onClearTrace={() => { setSamplePath(null); setSampleEdges(null); setSaid(__('Cleared. Every screen and line is shown again.', 'wconvert')); }}
              onAdd={authoring.flowAdd} nudge={authoring.flowNudge ?? <ProHint medium="flow-map" features={[__('Quizzes that branch on answers', 'wconvert')]} />}
              destinationSummary={destinationSummary} />
          </Suspense></FlowMapBoundary>}
          {view === 'screens' && <aside className="wconvert-journey-rail" aria-label={__('Screens', 'wconvert')}>
            {formSwitch}
            <div className="wconvert-journey-rail__heading"><strong>{__('Screens', 'wconvert')}</strong><span>{tree.graph ? tree.steps.length : sprintf(/* translators: %d: how many screens the journey has; 7 is the most allowed. */ __('%d of 7', 'wconvert'), tree.steps.length)}</span><small>{tree.graph ? __('Lines may skip screens', 'wconvert') : __('Up to 7 screens without answer lines', 'wconvert')}</small></div>
            <ol ref={screenList} className="wconvert-journey-dialog__screens" aria-label={__('All screens', 'wconvert')}>
              {displayOrder.map((index, position) => <JourneyScreenCard key={tree.steps[index].id} template={{ tree, tokens }} displayType={displayType} index={index} ordinal={position + 1} selected={index === step}
                scope={id} label={disconnected.has(tree.steps[index].id) ? __('Unreachable', 'wconvert') : screenLabel(index)} condition={tree.steps[index].when ? sprintf(/* translators: %s: the rule that shows the screen, e.g. “Skin type is Oily”. */ __('Only if %s', 'wconvert'), conditionText(tree, tree.steps[index].when!))
                  : tree.steps[index].kind === 'result' && (tree.steps[index].results?.length ?? 0) > 1 ? sprintf(/* translators: %d: how many results the result screen can show. */ __('%d possible results', 'wconvert'), tree.steps[index].results?.length ?? 0) : undefined}
                onSelect={() => select(index)}
                onMove={tree.graph ? undefined : (from, to) => move(tree.steps.findIndex(s => s.id === from), Math.min(tree.steps.findIndex(s => s.id === to), tree.steps.length - 2))} />)}
            </ol>
          </aside>}
          {lookPanel && view === 'edit' && (look?.open || !editingScreen) ? <section className="wconvert-journey-pane wconvert-journey-pane--look" aria-label={__('Look', 'wconvert')}>{lookPanel}</section>
            : inspecting && elementPanel ? <section ref={elementPane} className="wconvert-journey-pane wconvert-journey-pane--element" aria-label={__('Selected element settings', 'wconvert')}>{elementPanel}</section>
            : inspecting && <section className="wconvert-journey-pane" aria-label={__('Selected screen settings', 'wconvert')}>
            {(() => {
              const returning = returnInspection && tree.steps.find(item => item.id === returnInspection.screenId);
              const ScreenIcon = screenIconOf(current);
              const kindWord = current.kind === 'acknowledgement' ? __('Ending', 'wconvert') : current.kind === 'result' ? __('Result', 'wconvert')
                : walkNodes(current.content).some(node => node.type === 'question') ? __('Question', 'wconvert')
                : submission ? submission.required === false ? __('Optional form', 'wconvert') : __('Form', 'wconvert')
                : walkNodes(current.content).some(node => node.type === 'field' || node.type === 'consent') ? __('Form', 'wconvert') : __('Message', 'wconvert');
              /*
                One header for every panel (ADR 0136): the kind's icon, the
                name as its own rename box, one muted caption, and two actions
                — Preview and ⋯. Expand lives in ⋯; Close went, because the
                Edit tab always shows a panel.
              */
              return <PanelHeader className="wconvert-journey-pane__heading"
                back={returning ? { label: returning.name, onClick: () => {
                  const previous = returnInspection!; select(tree.steps.findIndex(item => item.id === previous.screenId)); setRequestedSection(previous.section);
                  if (previous.review) setResumeReview({ ...previous.review, serial: --referenceSerial.current });
                  else requestAnimationFrame(() => settingsHeading.current?.focus());
                } } : undefined}
                icon={<ScreenIcon />}
                title={<><h3 ref={settingsHeading} tabIndex={-1} className="sr-only"><bdi>{current.name}</bdi></h3>
                  <input className="wconvert-journey-pane__name" type="text" maxLength={120} aria-label={__('Screen name', 'wconvert')} value={current.name}
                    onChange={e => onChange({ ...tree, steps: tree.steps.map((s, i) => i === step ? { ...s, name: e.target.value } : s) }, `journey:${current.id}:name`)} /></>}
                caption={kindWord}
                actions={<>
                  <DropdownMenu><DropdownMenuTrigger asChild><button ref={deleteTrigger} type="button" className="wconvert-journey-pane__menu" aria-label={sprintf(/* translators: %s: a screen's name, e.g. “Skin type”. */ __('Actions for %s', 'wconvert'), current.name)} title={sprintf(/* translators: %s: a screen's name, e.g. “Skin type”. */ __('Actions for %s', 'wconvert'), current.name)}><MoreHorizontal aria-hidden="true" /></button></DropdownMenuTrigger>
                    <OptionMenuContent align="end" aria-label={sprintf(/* translators: %s: a screen's name. */ __('Actions for %s', 'wconvert'), current.name)}>
                      {!tree.graph && <OptionItem icon={Copy} name={__('Duplicate', 'wconvert')} onSelect={duplicate}
                        refused={current.kind === 'acknowledgement' || current.kind === 'result'
                          ? refusal(__('Endings stay single', 'wconvert'), __('Endings and result screens can’t be duplicated.', 'wconvert'))
                          : tree.steps.length >= 7 ? capRefusal : null} />}
                      {!tree.graph && <OptionItem icon={ArrowUp} name={__('Move up', 'wconvert')} refused={screenMoveRefusal(tree, step, step - 1)} onSelect={() => move(step, step - 1)} />}
                      {!tree.graph && <OptionItem icon={ArrowDown} name={__('Move down', 'wconvert')} refused={screenMoveRefusal(tree, step, step + 1)} onSelect={() => move(step, step + 1)} />}
                      {authoring.screenItems}
                      <OptionItem className="wconvert-expand-settings" icon={widePanel ? Minimize2 : Maximize2} name={widePanel ? __('Narrow panel', 'wconvert') : __('Expand panel', 'wconvert')} onSelect={() => setWidePanel(value => !value)} />
                      <OptionSeparator />
                      {/* A refused delete stays reachable and says why, rather than vanishing from the keyboard (GUIDELINES §6). */}
                      <OptionItem icon={Trash2} destructive onSelect={askToDelete}
                        refused={deletionRefusal}
                        name={(tree.graph ? optionalRemoval : captureOnScreen(tree, current.id)?.required === false) ? __('Remove optional signup', 'wconvert') : __('Delete screen', 'wconvert')} />
                    </OptionMenuContent>
                  </DropdownMenu>
                  {!slim && <button type="button" aria-label={__('Close screen settings', 'wconvert')} title={__('Close screen settings', 'wconvert')} onClick={() => {
                    setInspecting(false); setPathFocus(null); setMobilePane('map');
                    requestAnimationFrame(() => {
                      const trigger = inspectorTrigger.current;
                      (trigger?.isConnected ? trigger : findInput.current)?.focus();
                    });
                  }}><X aria-hidden="true" /></button>}
                </>} />;
            })()}
            <div className="wconvert-journey-dialog__details">
          {authoring.screenPanel}
          {slim && <ScreenIssues issues={issues.filter(issue => issue.screenId === current.id)} onIssue={openIssue} />}
          {disconnected.has(current.id) && <PanelSection label={__('To fix on this screen', 'wconvert')}><p className="wconvert-panel-warn">{__('No line reaches this screen. Connect one to it, or delete it.', 'wconvert')}</p></PanelSection>}
          {view !== 'edit' && !currentFollowups && <PanelSection><JourneyArrivalSummary tree={tree} step={step} onSelectPath={(index, priority) => { select(index); setRequestedSection('paths'); setPathFocus(priority); }} /></PanelSection>}
          {/*
            **Facts first** (ADR 0136): where this screen goes, when it shows,
            when it opens, and what happens when it is submitted — label, value
            and the way to where each is changed, one row each.
          */}
          {/* Drawn only where it has something to say: an empty section would bring back a stray rule. */}
          {(followupSource !== undefined || (slim && tree.steps.length > 1) || (slim && isFirst) || !!submission || !!authoring.screenCondition) && <PanelSection label={__('About this screen', 'wconvert')} className="wconvert-screen-facts">
            <FactList>
              {followupSource !== undefined && <FactRow label={__('Follow-up for', 'wconvert')} action={__('Open', 'wconvert')} onAction={() => select(followupSource)}>{tree.steps[followupSource].name}</FactRow>}
              {slim && <ScreenThen tree={tree} step={step} editor={authoring.then}
                onEditPaths={authoring.lines && questionPath && onSelectElement ? () => onSelectElement(questionPath) : undefined}
                onEditLine={authoring.lines && questionPath && onSelectElement ? priority => openLine(step, priority) : undefined} />}
              {slim && isFirst && <FactRow label={__('When it opens', 'wconvert')} action={__('Display rules', 'wconvert')} onAction={onGoToRules}>{displaySummary ?? ''}</FactRow>}
              {submission && <FactRow label={__('When submitted', 'wconvert')}>{__('Save the lead', 'wconvert')}</FactRow>}
              {submission && onGoToDestinations && <FactRow label={__('Where leads go', 'wconvert')} action={__('Destinations', 'wconvert')} onAction={() => openContext('destinations')}>{destinationSummary || __('Keep in WConvert only', 'wconvert')}</FactRow>}
            </FactList>
            {authoring.screenCondition}
          </PanelSection>}
            {!slim && <OptionStrip className="wconvert-journey-pane__tabs" label={__('Screen settings section', 'wconvert')} value={panelSection} onChange={value => setRequestedSection(value as typeof requestedSection)}
              options={[
                { value: 'content', label: walkNodes(current.content).some(node => node.type === 'question') ? __('Content & answers', 'wconvert') : __('Content', 'wconvert') },
                ...(authoring.lines ? [{ value: 'paths', label: __('Lines', 'wconvert'), count: tree.graph ? tree.graph.edges.filter(edge => edge.from === current.id && edge.kind !== 'hidden').length : undefined }] : []),
              ]} />}

          {slim || panelSection === 'content' ? <>

          {!slim && authoring.question}
          {authoring.followupOrder}
          {!slim && <JourneyScreenContent tree={tree} step={step} onChange={onChange} />}
          <JourneyCaptureSettings onSelectField={slim ? onSelectElement : undefined} consentEditor={labels && <JourneyConsentSettings labels={labels} tree={tree} step={step} onChange={onChange} />} tree={tree} step={step} onChange={onChange} />


          {/* Pro's: results, and when visitors see them. A free install only removes them (ADR 0147). */}
          {authoring.result}
          {!slim && <Disclosure variant="inline" className="wconvert-journey-behavior-help" title={__('What happens to answers here?', 'wconvert')}><p>{current.kind === 'acknowledgement'
            ? tree.graph ? __('The campaign ends here.', 'wconvert') : __('The campaign ends here. This screen always stays last.', 'wconvert')
            : submission?.required === false
              ? tree.submissions[0]?.id === submission.id
                ? __('Visitors may skip this signup and finish without saving contact details.', 'wconvert')
                : __('Adds details to the same lead. Visitors can skip this signup; their earlier signup stays saved.', 'wconvert')
              : submission
                ? current.kind === 'input' && tree.steps.some(screen => screen.kind === 'result')
                  ? __('Visitors must submit their details here before seeing the result. An accepted save creates one submission.', 'wconvert')
                  : __('Saves the signup or request here, even if the visitor leaves a later screen.', 'wconvert')
                : current.kind === 'result'
                  ? __('Shows the selected result. Viewing it does not save contact details or create a submission.', 'wconvert')
                : __('New answers stay on this page until the visitor submits. Going to the next screen does not save new details.', 'wconvert')}</p></Disclosure>}
          {authoring.nextSummary}
          {authoring.route && slim && tree.graph && !questionPath && (tree.graph.edges.some(edge => edge.from === current.id && edge.kind !== 'default') || !!current.when) && <PanelSection><Disclosure variant="inline" className="wconvert-screen-paths"
            open={panelSection === 'paths' || undefined} title={__('Lines', 'wconvert')} summary={sprintf(/* translators: %d: how many paths leave this screen. */ _n('%d line', '%d lines', tree.graph.edges.filter(edge => edge.from === current.id && edge.kind !== 'hidden').length, 'wconvert'), tree.graph.edges.filter(edge => edge.from === current.id && edge.kind !== 'hidden').length)}>{authoring.route}</Disclosure></PanelSection>}
          {slim && tree.graph && <ScreenAnswers tree={tree} step={step} onSelect={select} followup={authoring.followup} />}
          {slim && <ScreenChips tree={tree} step={step} labels={labels} onSelect={onSelectElement} />}

          </> : authoring.route}
            {!onCanvas && <PanelSection><Button type="button" variant="outline" className="wconvert-journey-appearance" onClick={() => { if (editorCanvas) setView('edit'); else if (embedded) onGoToDesign?.(); else setOpen(false); }}>{editorCanvas ? __('Edit on the canvas', 'wconvert') : __('Edit design', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" /></Button></PanelSection>}
            </div>

          </section>}
        </div>
        </QuestionPanelContext.Provider>
        <div className={embedded && !said ? 'sr-only' : 'wconvert-journey-dialog__footer wconvert-toolbar'}><p role="status">{said}</p>{said && onUndo && <Button type="button" variant="ghost" onClick={onUndo}>{__('Undo change', 'wconvert')}</Button>}{said && <Button type="button" variant="outline" onClick={() => { setTestChange(notice); setTestMode('journey'); setTestOpen(true); }}>{__('Test this change', 'wconvert')}</Button>}{!embedded && <DialogClose asChild><Button variant="outline">{__('Done', 'wconvert')}</Button></DialogClose>}</div>
        <ConfirmDialog variant="destructive" open={deleting} onOpenChange={setDeleting} title={sprintf(/* translators: %s: a screen's name, e.g. “Skin type”. */ __('Delete “%s”?', 'wconvert'), current.name)} returnFocusTo={deleteTrigger}
          description={__('Other screens, their lines and saved leads stay. Undo brings this screen back.', 'wconvert')}
          confirmLabel={__('Delete screen', 'wconvert')} onConfirm={() => { setDeleting(false); remove(); }} />
        <ConfirmDialog variant="destructive" open={confirmRemoval} onOpenChange={setConfirmRemoval} title={__('Remove this optional signup?', 'wconvert')}
          description={sprintf(/* translators: %s: a comma-separated list of the optional signup's screen names, e.g. “Get updates, Thanks”. */ __('Removes %s, with its contact fields, consent and signup settings. Other screens and saved leads stay. Undo restores this draft edit.', 'wconvert'), tree.steps.filter(s => removal.screens.includes(s.id)).map(s => s.name).join(', '))}
          confirmLabel={__('Remove signup', 'wconvert')} onConfirm={remove} />
        <ConfirmDialog open={straightening} onOpenChange={setStraightening} title={__('Make it a straight campaign?', 'wconvert')}
          description={__('Removes the questions, results, answer lines and “Only if…” this site can’t display, and the screens that only asked questions. The rest stay in the order the Flow map shows. Undo brings it all back.', 'wconvert')}
          confirmLabel={__('Make it straight', 'wconvert')} onConfirm={() => {
            setStraightening(false);
            if (straight && !isRefusal(straight)) { write(straight, 0); setSaid(__('Now one screen after another. Check what the campaign still needs before publishing.', 'wconvert')); }
          }} />
  </>;
  return <>
    {embedded ? <section ref={workspaceRoot} className="wconvert-journey-workspace" data-focused={focused || undefined} aria-label={__('Screens', 'wconvert')}>{workspace}</section>
      : <Dialog open={open} onOpenChange={value => { setOpen(value); setSaid(''); }}>
        <DialogTrigger asChild><Button type="button" variant="outline" size="sm"><Workflow aria-hidden="true" />{__('Manage screens', 'wconvert')}</Button></DialogTrigger>
        <AdminDialogContent size="lg" className="wconvert-journey-dialog" showCloseButton={false}>{workspace}</AdminDialogContent>
      </Dialog>}
    <AlertDialog open={confirmGraphRemoval} onOpenChange={setConfirmGraphRemoval}>
      <AlertDialogContent className="wconvert-graph-remove" onCloseAutoFocus={event => {
        event.preventDefault();
        requestAnimationFrame(() => (deletedGraphScreen.current ? settingsHeading.current : deleteTrigger.current)?.focus());
      }}>
        {confirmGraphRemoval && (optionalRemoval && selectedCapture
          ? <GraphCaptureRemove tree={tree} submissionId={selectedCapture.id} onCancel={() => setConfirmGraphRemoval(false)} onRemove={applyGraphRemoval} />
          : <GraphScreenRemove tree={tree} screenId={current.id} journeys={journeys} onCancel={() => setConfirmGraphRemoval(false)} onRemove={applyGraphRemoval} />)}
      </AlertDialogContent>
    </AlertDialog>
    {authoring.dialogs}
    <Dialog open={testOpen} onOpenChange={value => { setTestOpen(value); if (!value) { setTestChange(undefined); onTestExit?.(); onTestClose?.(); } if (!value && !embedded) setOpen(true); }}>
      <AdminDialogContent size="lg" className="wconvert-journey-test-dialog" onOpenAutoFocus={event => { event.preventDefault(); testHeading.current?.focus(); }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const restore = () => (returnToTestTrigger.current ? externalTestTrigger.current?.isConnected ? externalTestTrigger.current : findInput.current : settingsHeading.current)?.focus();
          // The embedded workspace stays mounted. Deferring its restoration can
          // steal focus from a subsequent Escape that leaves Focus journey.
          if (embedded) restore();
          else requestAnimationFrame(restore);
        }}>
        {/* Drawn here rather than by `AdminDialogHeader` because the title takes focus on open. */}
        <div data-slot="dialog-header" className="wconvert-dialog__header">
          <div className="wconvert-dialog__identity"><DialogTitle ref={testHeading} tabIndex={-1} className="wconvert-dialog__title leading-snug">{previewTitle || __('Preview', 'wconvert')}</DialogTitle></div>
          <DialogDescription className="wconvert-dialog__meta">{__('Preview · Nothing you enter is saved or sent.', 'wconvert')}</DialogDescription>
        </div>
        {/* One Preview, two tabs (ADR 0138): the form as a visitor uses it, and who it shows to. */}
        <Tabs value={previewMode} onValueChange={value => setTestMode(value as typeof testMode)} className="wconvert-preview-tabs">
          {whoSeesIt && <TabsList variant="line" className="wconvert-preview-tabs__list w-full justify-start px-5">
            <TabsTrigger value="journey" className="flex-none px-3">{__('Try the form', 'wconvert')}</TabsTrigger>
            <TabsTrigger value="visit" className="flex-none px-3">{__('Who sees it', 'wconvert')}</TabsTrigger>
          </TabsList>}
          {/* Kept mounted, so a run survives a look at Who sees it. */}
          <TabsContent value="journey" forceMount className="wconvert-journey-test-dialog__body data-[state=inactive]:hidden">
            <JourneyTest onClose={closeTest} active={previewMode === 'journey'} changeToCheck={testChange} onShowPath={(screens, edges) => { setSamplePath(screens); setSampleEdges(edges); setInspecting(false); setMobilePane('map'); setView('flow'); leaveTest(); setOpen(true); setSaid(__('The screens and lines visited in your test are highlighted. Future screens are not predicted.', 'wconvert')); }} template={testTemplate} deliveryMode={deliveryMode} destinationSummary={destinationSummary}
              onEdit={(index, focus) => { returnToTestTrigger.current = false; select(index); leaveTest(); setOpen(true); if (focus === 'condition') setReferenceRequest({ screenId: tree.steps[index].id, section: 'content', serial: --referenceSerial.current }); }} />
          </TabsContent>
          {whoSeesIt && <TabsContent value="visit" className="wconvert-preview-tabs__visit wconvert-sample-dialog">{whoSeesIt(closeTest)}</TabsContent>}
        </Tabs>
      </AdminDialogContent>
    </Dialog>
  </>;
}



/** Free's journey authoring: none (ADR 0147). Named as a hook so the call site reads as one. */
function useNoAuthoring(context: JourneyEditorContext): JourneyAuthoringUI {
  void context;
  return NO_AUTHORING;
}
