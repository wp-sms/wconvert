import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Copy, FilePlus2, ListPlus, Maximize2, Minimize2, Plus, Search, Trash2, Workflow, X } from 'lucide-react';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { Input } from '../components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../components/ui/dialog';
import { JourneyScreenCard } from './JourneyScreenCard';
import { JourneyArrivalSummary } from './JourneyArrivalSummary';
import { QuestionSettings, ResultSettings, RouteSettings, ScreenConditionSettings } from './JourneySettings';
import { JourneyScreenPreview } from './JourneyScreenPreview';
import { JourneyTest } from './JourneyTest';
import { JourneySample } from './JourneySample';
import { GraphRouteSettings } from './GraphRouteSettings';
import { JourneyScreenContent } from './JourneyScreenContent';
import { JourneyCaptureSettings } from './JourneyCaptureSettings';
import { GraphScreenActions } from './GraphScreenActions';
import { GraphScreenInsert } from './GraphScreenInsert';
import { GraphCaptureInsert } from './GraphCaptureInsert';
import { addGraphCapture } from './structure/graphCaptureInsertion';
import { GraphCaptureRemove } from './GraphCaptureRemove';
import { captureOnScreen, graphCaptureRemovalPlan } from './structure/graphCaptureRemoval';
import { GraphScreenRemove } from './GraphScreenRemove';
import { graphRemovalPlan } from './structure/graphRemoval';
import { addGraphBranchScreen, addGraphScreen, type GraphScreenKind } from './structure/graphInsertion';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import type { TemplateTree, TemplateNode, QuestionNode, Tokens } from '@renderer/types';
import { addGraphResultSignup, graphResultSignupTarget, duplicateScreen, freshScreen, referencedJourney, walkNodes, submissionScreen, movedScreen, screenRemoval, removedScreen, resultAccess, graphResultAccessIssue, unreachableScreenIds, unreachableScreens, withBackButton } from './structure/journey';
import { graphChangeImpact } from './structure/graphChangeImpact';
import { addGraphConnection, reconnectGraphEdge } from './structure/graphConnections';
import { conditionText } from './structure/conditionText';
import { graphDisplayOrder, graphReaches, upgradeToGraph } from './structure/graph';
import type { JourneyRepair } from './structure/journeyReadiness';

const JourneyMap = lazy(() => import('./JourneyMap').then(module => ({ default: module.JourneyMap })));

export function JourneyEditor({ tree, tokens = {}, step, primaryChannel, onChange, onSelect, displaySummary, destinationSummary, deliveryMode, onGoToRules, onGoToDestinations, onGoToDesign, openRequest, repairRequest, embedded = false, focusActions, contextEditors }: {
  tokens?: Tokens; primaryChannel?: string | null; tree: TemplateTree; step: number; onChange(tree: TemplateTree, coalesce?: string): void; onSelect(step: number): void;
  displaySummary?: string; destinationSummary?: string; deliveryMode?: 'local' | 'connected' | 'none'; onGoToRules?(): void; onGoToDestinations?(): void; onGoToDesign?(): void; openRequest?: number;
  repairRequest?: JourneyRepair & { readonly serial: number }; embedded?: boolean;
  focusActions?: ReactNode;
  contextEditors?: { rules: ReactNode; destinations: ReactNode };
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [addCapture, setAddCapture] = useState(false);
  const [previewScreen, setPreviewScreen] = useState<number | null>(null);
  const previewTrigger = useRef<HTMLElement | null>(null);
  const previewAction = useRef<'edit' | 'test' | null>(null);
  const contextAddTrigger = useRef<HTMLElement | null>(null);
  const [insertIntent, setInsertIntent] = useState<'branch' | undefined>();
  const [insertLocation, setInsertLocation] = useState<string | undefined>();
  const [addKind, setAddKind] = useState<GraphScreenKind | null>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const insertedScreen = useRef(false);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const deletedGraphScreen = useRef(false);
  const [focused, setFocused] = useState(false);
  const focusTrigger = useRef<HTMLButtonElement>(null);
  const workspaceRoot = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focused || !embedded) return;
    document.body.classList.add('wconvert-journey-focus');
    return () => document.body.classList.remove('wconvert-journey-focus');
  }, [focused, embedded]);
  const testTrigger = useRef<HTMLButtonElement>(null);
  const settingsHeading = useRef<HTMLHeadingElement>(null);
  const inspectorTrigger = useRef<HTMLElement | null>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const returnToTestTrigger = useRef(true);
  const [view, setView] = useState<'flow' | 'screens'>('flow');
  const [query, setQuery] = useState('');
  const [sampleOpen, setSampleOpen] = useState(false);
  const [contextPanel, setContextPanel] = useState<'rules' | 'destinations' | null>(null);
  const contextHeading = useRef<HTMLHeadingElement>(null);
  const contextTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => { if (contextPanel) contextHeading.current?.focus(); }, [contextPanel]);
  const [inspecting, setInspecting] = useState(!embedded);
  const [sampleEdges, setSampleEdges] = useState<readonly string[] | null>(null);
  const [samplePath, setSamplePath] = useState<readonly number[] | null>(null);
  useEffect(() => { setSamplePath(null); setSampleEdges(null); }, [tree]);
  const [panelSection, setPanelSection] = useState<'content' | 'paths'>('content');
  const [mobilePane, setMobilePane] = useState<'map' | 'details'>('map');
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
    setContextPanel(null);
    inspectorTrigger.current = null;
    const index = tree.steps.findIndex(screen => screen.id === repairRequest.screenId);
    if (index < 0) return;
    selectedId.current = repairRequest.screenId;
    setInspecting(true);
    setSampleOpen(false);
    setView('flow');
    setMobilePane('details');
    setPanelSection(repairRequest.section);
    const answerPaths = tree.graph?.edges.filter(edge => edge.from === repairRequest.screenId && edge.kind === 'answer');
    const repairEdge = tree.graph?.edges.find(edge => edge.id === repairRequest.edgeId);
    const priority = repairEdge?.kind === 'default' ? answerPaths?.length
      : repairRequest.edgeId ? answerPaths?.findIndex(edge => edge.id === repairRequest.edgeId)
      : repairRequest.pathPriority;
    setPathFocus(priority !== undefined && priority >= 0 ? priority : null);
    onSelect(index);
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
      if (repairRequest.focus === 'screen-name') { const options = pane?.querySelector<HTMLDetailsElement>('.wconvert-journey-options'); if (options) options.open = true; pane?.querySelector<HTMLElement>('.wconvert-journey__field input')?.focus(); return; }
      const disclosure = pane?.querySelector<HTMLDetailsElement>('.wconvert-journey-visibility');
      if (disclosure && (!repairRequest.focus || repairRequest.focus === 'hidden-route')) disclosure.open = true;
      const condition = repairRequest.focus === 'hidden-route'
        ? heading?.closest('.wconvert-journey-pane')?.querySelector<HTMLElement>('.wconvert-journey-settings__skip select')
        : repairRequest.section === 'content'
        ? heading?.closest('.wconvert-journey-pane')?.querySelector<HTMLElement>(repairRequest.focus === 'questions'
          ? '.wconvert-journey-settings__question textarea' : '.wconvert-journey-settings__clause select') : null;
      (condition ?? heading)?.focus();
    });
  }, [repairRequest, tree.steps, tree.graph, onSelect]);
  const [notice, setNotice] = useState({ text: '' });
  const setSaid = (text: string) => setNotice({ text });
  const said = notice.text;
  const previousNotice = useRef(notice);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [confirmGraphRemoval, setConfirmGraphRemoval] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<{ tree: TemplateTree; description: string; selected?: number } | null>(null);
  useEffect(() => {
    if (!focused) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || testOpen || previewScreen !== null || addKind || addCapture || confirmRemoval || confirmGraphRemoval || pendingRoute
        || !(event.target instanceof Node) || !workspaceRoot.current?.contains(event.target)) return;
      event.preventDefault(); setFocused(false); focusTrigger.current?.focus();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [focused, testOpen, previewScreen, addKind, addCapture, confirmRemoval, confirmGraphRemoval, pendingRoute]);
  const screenList = useRef<HTMLOListElement>(null);
  const previousTree = useRef(tree);
  const select = (index: number) => { setContextPanel(null); inspectorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; selectedId.current = tree.steps[index]?.id; setInspecting(true); setSampleOpen(false); setSamplePath(null); setSampleEdges(null); setPanelSection('content'); setPathFocus(null); setMobilePane('details'); onSelect(index); };
  useEffect(() => {
    if (previousTree.current !== tree) {
      // A later edit or Undo invalidates instructions about a prior operation.
      // Keep a new notice issued in the same render as its own draft change.
      if (notice === previousNotice.current && notice.text) setNotice({ text: '' });
      const index = tree.steps.findIndex(screen => screen.id === selectedId.current);
      if (index >= 0 && index !== step) onSelect(index);
      else selectedId.current = tree.steps[step]?.id;
      previousTree.current = tree;
    } else selectedId.current = tree.steps[step]?.id;
    previousNotice.current = notice;
  }, [tree, step, onSelect, notice]);
  useEffect(() => { screenList.current?.querySelector('[data-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }); }, [step]);
  const current = tree.steps[step];
  const disconnected = useMemo(() => new Set(unreachableScreenIds(tree)), [tree]);
  if (!current) return null;
  const canAddGraphResultSignup = !!graphResultSignupTarget(tree);
  const resultAccessIssue = tree.graph && tree.submissions.length === 1
    ? graphResultAccessIssue(tree, !tree.submissions[0].required) : null;
  const canAddGraphCapture = !!tree.graph && tree.submissions.length === 1 && ['email', 'sms'].includes(primaryChannel ?? '');
  const canCondition = tree.steps.some((screen, index) => (tree.graph
    ? screen.id === current?.id || graphReaches(tree.graph, screen.id, current?.id ?? '')
    : index <= step) && walkNodes(screen.content).some(node => node.type === 'question' && 'answer_type' in node && node.answer_type !== 'text'));
  const displayOrder = graphDisplayOrder(tree);
  const ordinal = (index: number) => displayOrder.indexOf(index) + 1;
  const matches = tree.steps.map((screen, index) => ({ screen, index })).filter(item => item.screen.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const write = (next: TemplateTree, index: number) => { setContextPanel(null); selectedId.current = next.steps[index]?.id; setInspecting(true); onChange(referencedJourney(next)); onSelect(index); };
  const move = (from: number, to: number) => {
    const next = movedScreen(tree, from, to);
    if (next === tree) { setSaid(__('Keep the main signup before the optional signup, and the thank-you screen last.', 'wconvert')); return; }
    write(next, to);
    setSaid(sprintf(__('%1$s moved to screen %2$d.', 'wconvert'), tree.steps[from].name, to + 1));
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
    const email = optional ? primaryChannel === 'sms' : primaryChannel === 'email';
    return optional
      ? email ? __('Save optional email signup', 'wconvert') : __('Save optional SMS signup', 'wconvert')
      : email ? __('Save email signup', 'wconvert') : __('Save SMS signup', 'wconvert');
  };
  const screenLabel = (index: number) => tree.steps[index].kind === 'result' ? __('Shows a selected result', 'wconvert')
    : tree.steps[index].kind === 'acknowledgement' ? __('Journey complete', 'wconvert')
    : saving(index) ? saveLabel(saving(index)!.id) : __('Continue only', 'wconvert');
  const add = (kind: 'content' | 'input', conditional = false) => {
    if (tree.graph) { contextAddTrigger.current = null; setInsertLocation(undefined); insertedScreen.current = false; setInsertIntent(undefined); setAddKind(conditional ? 'followup' : kind); return; }
    const steps = [...tree.steps]; const boundary = steps.findIndex(s => s.kind === 'result' || walkNodes(s.content).some(n => 'action' in n && n.action === 'submit'));
    const at = Math.min(step + 1, boundary < 0 ? steps.length - 1 : boundary);
    let screen = freshScreen(tree, kind, at > 0);
    if (at === 0 && steps[0]) steps[0] = withBackButton(steps[0]);
    if (conditional) {
      const question = tree.steps.slice(0, step + 1).flatMap(item => walkNodes(item.content)).find(node => node.type === 'question'
        && 'id' in node && typeof node.id === 'string' && 'answer_type' in node && node.answer_type !== 'text') as (QuestionNode & { id: string }) | undefined;
      if (!question) { setSaid(__('Add a choice question here or earlier before making a conditional follow-up.', 'wconvert')); return; }
      screen = { ...screen, name: __('Relevant follow-up', 'wconvert'), when: { match: 'all', clauses: [{ question: question.id,
        operator: question.answer_type === 'multi' ? 'includes_any' : 'is', values: [''] }] } };
    }
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
    } else if (at <= step && steps[at]) {
      const boundaryId = steps[at].id;
      screen = { ...screen, paths: [{ to: boundaryId }] };
      for (let index = 0; index < at; index++) if (steps[index].paths) {
        steps[index] = { ...steps[index], paths: steps[index].paths!.map(path => path.to === boundaryId ? { ...path, to: screen.id } : path) };
      }
    }
    steps.splice(at, 0, screen); write({ ...tree, steps }, at);
    if (conditional) setSaid(__('Follow-up added. Choose the matching answer in Screen visibility.', 'wconvert'));
  };
  const insertOnPath = (priority: number, kind: 'content' | 'input') => {
    if (tree.graph) {
      const edge = [...tree.graph.edges.filter(item => item.from === current.id && item.kind === 'answer'),
        ...tree.graph.edges.filter(item => item.from === current.id && item.kind === 'default')][priority];
      if (edge) insertOnGraphPath(edge.id, kind);
      return;
    }
    if (tree.steps.length >= 7 || step >= tree.steps.length - 1) return;
    const source = tree.steps[step];
    const paths = source.paths ?? [{ to: tree.steps[step + 1].id }];
    const path = paths[priority];
    if (!path) return;
    // A hidden source continues to the next ordered screen. Mirror its visibility
    // so inserting on a branch does not make that new screen appear on the skip path.
    const screen = { ...freshScreen(tree, kind), ...(source.when ? { when: source.when } : {}), paths: [{ to: path.to }] };
    const steps = [...tree.steps];
    if (source.paths) steps[step] = { ...source, paths: paths.map((item, index) => index === priority ? { ...item, to: screen.id } : item) };
    steps.splice(step + 1, 0, screen);
    write({ ...tree, steps }, step + 1);
    setPanelSection('content');
    setSaid(sprintf(__('Screen inserted on this path. Its condition and continuation to %s are preserved.', 'wconvert'), tree.steps.find(item => item.id === path.to)?.name ?? path.to));
  };
  const insertOnGraphPath = (edgeId: string, kind: 'content' | 'input') => {
    const next = addGraphScreen(tree, `edge:${edgeId}`, kind);
    if (next === tree) return;
    write(next, next.steps.length - 1);
    setPanelSection('content');
    setSaid(__('Screen inserted on this connection. The original path and its priority are preserved.', 'wconvert'));
  };
  const addOptional = () => {
    if (tree.graph && tree.submissions.length) { insertedScreen.current = false; setAddCapture(true); return; }
    if (tree.graph) {
      const next = addGraphResultSignup(tree);
      if (next === tree) return;
      write(next, submissionScreen(next, next.submissions[0]?.id));
      setSaid(__('Optional signup added after the result. Visitors may finish without submitting details.', 'wconvert'));
      return;
    }
    const channel = primaryChannel === 'sms' || tree.submissions.length === 0 ? 'email' : 'phone';
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
      { type: 'field', name: channel, required: true, label: channel === 'email' ? __('Email address', 'wconvert') : __('Phone number', 'wconvert') },
      { type: 'consent', text: channel === 'email' ? __('Send me email updates. %s', 'wconvert') : __('Send me text updates. %s', 'wconvert'), link: { label: __('Privacy Policy', 'wconvert') }, hidden: false, role: 'consent_text' },
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
  const removal = screenRemoval(tree, step);
  const selectedCapture = tree.graph ? captureOnScreen(tree, current.id) : undefined;
  const optionalRemoval = selectedCapture && !selectedCapture.required ? graphCaptureRemovalPlan(tree, selectedCapture.id) : null;
  const graphDelete = tree.graph ? graphRemovalPlan(tree, current.id) : null;
  const deletionReason = optionalRemoval ? optionalRemoval.reason : graphDelete?.reason;
  const applyGraphRemoval = (next: TemplateTree, destination: string) => {
    deletedGraphScreen.current = true;
    const target = next.steps.findIndex(screen => screen.id === destination);
    write(next, target >= 0 ? target : 0);
    setPanelSection('content'); setMobilePane('details'); setConfirmGraphRemoval(false);
    setSaid(optionalRemoval ? __('Optional signup removed. Review the remaining screens. Undo restores the signup and its connections.', 'wconvert')
      : __('Screen removed. Review the remaining paths. Undo restores the screen and its connections.', 'wconvert'));
  };
  const remove = () => {
    const next = removedScreen(tree, step);
    write(next, Math.min(step, next.steps.length - 1));
    setSaid(__('Screen removed. Undo brings it back.', 'wconvert'));
  };
  const submission = saving(step);
  const boundary = tree.steps.findIndex(s => s.kind === 'result' || walkNodes(s.content).some(n => 'action' in n && n.action === 'submit'));
  const insertionAt = Math.min(step + 1, boundary < 0 ? tree.steps.length - 1 : boundary);
  const insertionLabel = tree.graph ? __('Choose a location in the journey', 'wconvert') : insertionAt <= step
    ? sprintf(__('Before %s', 'wconvert'), tree.steps[insertionAt].name)
    : sprintf(__('After %s', 'wconvert'), current.name);
  const panelOpen = !!contextPanel || sampleOpen || inspecting;
  const openContext = (kind: 'rules' | 'destinations') => {
    if (!contextEditors) { setOpen(false); (kind === 'rules' ? onGoToRules : onGoToDestinations)?.(); return; }
    contextTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setContextPanel(kind); setSampleOpen(false); setMobilePane('details');
  };
  const closeContext = () => { setContextPanel(null); setMobilePane(inspecting ? 'details' : 'map'); requestAnimationFrame(() => contextTrigger.current?.isConnected && contextTrigger.current.focus()); };
  const connect = (source: string, target: string) => {
    const from = tree.steps.findIndex(screen => screen.id === source);
    if (from < 0) return;
    if (tree.graph) {
      const changed = addGraphConnection(tree, source, target);
      if (changed === tree) return;
      const edge = changed.graph!.edges.at(-1)!;
      const description = graphChangeImpact(tree, changed);
      if (description) setPendingRoute({ tree: changed, description });
      else onChange(changed);
      select(from); setPanelSection('paths');
      setPathFocus(changed.graph!.edges.filter(item => item.from === source && item.kind === 'answer').length - (edge.kind === 'answer' ? 1 : 0));
      if (!description) setSaid(edge.kind === 'answer' ? __('Answer path added after the existing priorities. Choose its condition before publishing; Everyone else is unchanged.', 'wconvert')
        : __('Next connection added. Review where visitors continue in the right panel.', 'wconvert'));
      return;
    }
    const screen = tree.steps[from];
    const fallback = { to: tree.steps[from + 1]?.id ?? target };
    const paths = screen.paths ?? [fallback];
    if (paths.some(path => path.to === target)) { select(from); return; }
    const question = tree.steps.slice(0, from + 1).flatMap(item => walkNodes(item.content)).find(node => node.type === 'question'
      && 'id' in node && typeof node.id === 'string' && 'answer_type' in node && node.answer_type !== 'text') as (QuestionNode & { id: string }) | undefined;
    if (!question) {
      if (!screen.paths) {
        const changed = { ...tree, steps: tree.steps.map((item, index) => index === from ? { ...item, paths: [{ to: target }] } : item) };
        const previously = new Set(unreachableScreens(tree));
        const disconnected = unreachableScreens(changed).filter(name => !previously.has(name));
        if (disconnected.length) setPendingRoute({ tree: changed, description: sprintf(__('These screens would become unreachable: %s. They stay in the draft, but visitors cannot reach or submit from them. You can Undo after applying.', 'wconvert'), disconnected.join(', ')) });
        else onChange(changed);
      }
      else setSaid(__('Add a choice question here or earlier before drawing another branch.', 'wconvert'));
      select(from); return;
    }
    const when = { match: 'all' as const, clauses: [{ question: question.id, operator: question.answer_type === 'multi' ? 'includes_any' as const : 'is' as const, values: [''] }] };
    onChange({ ...tree, steps: tree.steps.map((item, index) => index === from ? { ...item, paths: [{ to: target, when }, ...paths] } : item) });
    select(from); setPanelSection('paths'); setSaid(__('Path added. Choose its answer in the right panel before publishing.', 'wconvert'));
  };
  const reconnect = (edgeId: string, target: string) => {
    const changed = reconnectGraphEdge(tree, edgeId, target);
    if (changed === tree) return;
    const edge = tree.graph!.edges.find(item => item.id === edgeId)!;
    const description = graphChangeImpact(tree, changed);
    if (description) setPendingRoute({ tree: changed, description });
    else onChange(changed);
    select(tree.steps.findIndex(screen => screen.id === edge.from)); setPanelSection('paths');
    setPathFocus(edge.kind === 'hidden' ? 'hidden' : [...tree.graph!.edges.filter(item => item.from === edge.from && item.kind === 'answer'),
      ...tree.graph!.edges.filter(item => item.from === edge.from && item.kind === 'default')].findIndex(item => item.id === edgeId));
    if (!description) setSaid(__('Connection updated. Its condition and priority are unchanged.', 'wconvert'));
  };
  const workspace = <>
        <div className="wconvert-journey-dialog__header">
          <div>{embedded ? <h2>{__('Journey', 'wconvert')}</h2> : <DialogTitle>{__('Manage screens', 'wconvert')}</DialogTitle>}
            {embedded ? <p className="wconvert-journey-description sr-only">{__('Plan the visitor journey, then select a screen to edit its questions and paths.', 'wconvert')}</p>
              : <DialogDescription>{__('Plan the visitor journey, then select a screen to edit its questions and paths.', 'wconvert')}</DialogDescription>}</div>
        <div className="wconvert-journey-view" role="group" aria-label={__('Journey view', 'wconvert')}>
          <button type="button" aria-pressed={view === 'flow'} onClick={() => { setView('flow'); setMobilePane('map'); }}>{__('Flow', 'wconvert')}</button>
          <button type="button" aria-pressed={view === 'screens'} onClick={() => { setView('screens'); setInspecting(true); setMobilePane('map'); }}>{__('Screens', 'wconvert')}</button>
          <div className="wconvert-journey-find"><label><Search aria-hidden="true" /><span className="sr-only">{__('Find a screen', 'wconvert')}</span><input ref={findInput} type="search" value={query} placeholder={__('Find a screen…', 'wconvert')} onChange={event => setQuery(event.target.value)} /></label>
            {query.trim() && <div className="wconvert-journey-find__results" role="group" aria-label={__('Matching screens', 'wconvert')}>
              {matches.length ? matches.map(({ screen, index }) => <button type="button" key={screen.id} onClick={() => { select(index); setView('flow'); setQuery(''); }}>{screen.name}<small>{sprintf(__('Screen %d', 'wconvert'), ordinal(index))}</small></button>)
                : <p>{__('No matching screens.', 'wconvert')}</p>}
            </div>}
          </div>
        </div>
          <div className="wconvert-journey-dialog__header-actions">
            {embedded && <Button ref={focusTrigger} type="button" size="sm" variant="outline" aria-pressed={focused} onClick={() => setFocused(value => !value)}>
              {focused ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
              {focused ? __('Back to campaign', 'wconvert') : __('Focus journey', 'wconvert')}
            </Button>}
            {focused && focusActions}
            <Button type="button" size="sm" variant={sampleOpen ? 'secondary' : 'outline'} onClick={() => { setView('flow'); setContextPanel(null); setSampleEdges(null); setSampleOpen(true); setMobilePane('details'); }}>{__('Try answers', 'wconvert')}</Button>
            <Button ref={testTrigger} type="button" size="sm" variant="outline" onClick={() => { returnToTestTrigger.current = true; setOpen(false); setTestOpen(true); }}>{__('Test journey', 'wconvert')}</Button>
            <Button ref={addTrigger} type="button" size="sm" variant="outline" onClick={() => { contextAddTrigger.current = null; setInsertLocation(undefined); insertedScreen.current = false; setInsertIntent(undefined); setAddKind('input'); }}><Plus aria-hidden="true" />{__('Add screen', 'wconvert')}</Button>
            {!tree.graph && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="ghost">{__('Ordered screen actions', 'wconvert')}<ChevronDown aria-hidden="true" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{insertionLabel}</DropdownMenuLabel>
                <DropdownMenuItem disabled={!tree.graph && tree.steps.length >= 7} onSelect={() => add('content')}><FilePlus2 aria-hidden="true" />{__('Add offer screen', 'wconvert')}</DropdownMenuItem>
                <DropdownMenuItem disabled={!tree.graph && tree.steps.length >= 7} onSelect={() => add('input')}><ListPlus aria-hidden="true" />{__('Add question screen', 'wconvert')}</DropdownMenuItem>
                <DropdownMenuItem disabled={!tree.graph && (tree.steps.length >= 7 || !canCondition)} onSelect={() => add('input', true)}><ListPlus aria-hidden="true" />{__('Add relevant follow-up', 'wconvert')}</DropdownMenuItem>
                {(tree.graph ? canAddGraphResultSignup || canAddGraphCapture
                  : primaryChannel && tree.submissions.length === 1 || tree.submissions.length === 0 && tree.steps.some(s => s.kind === 'result')) && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{tree.submissions.length === 0
                    ? __('After the result', 'wconvert')
                    : tree.graph ? __('After the primary signup', 'wconvert') : sprintf(__('Before %s', 'wconvert'), tree.steps[tree.steps.length - 1].name)}</DropdownMenuLabel>
                  <DropdownMenuItem disabled={!tree.graph && tree.steps.length >= (tree.submissions.length === 0 ? 6 : 7)} onSelect={addOptional}><Plus aria-hidden="true" />{__('Add optional signup', 'wconvert')}</DropdownMenuItem>
                </>}
                {!tree.graph && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => {
                  onChange(upgradeToGraph(tree));
                  setSaid(__('Flexible paths enabled for this draft. Screen order no longer determines visitor navigation. Undo restores the earlier model.', 'wconvert'));
                }}><Workflow aria-hidden="true" />{__('Enable flexible paths', 'wconvert')}</DropdownMenuItem></>}
              </DropdownMenuContent>
            </DropdownMenu>}
            {!embedded && <DialogClose asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={__('Close screen manager', 'wconvert')}><X aria-hidden="true" /></Button></DialogClose>}
          </div>
        </div>
        {samplePath && !sampleOpen && <div className="wconvert-journey-context"><span>{sampleEdges !== null ? __('Showing the path visited in your test', 'wconvert') : __('Showing the route for your sample answers', 'wconvert')}</span><button type="button" onClick={() => { setSamplePath(null); setSampleEdges(null); setSaid(__('Test path cleared. All screens and connections are shown.', 'wconvert')); }}>{__('Clear test path', 'wconvert')}</button></div>}
        {(displaySummary || destinationSummary) && <div className="wconvert-journey-context">
          {displaySummary && <div><small>{__('When this appears', 'wconvert')}</small><strong>{displaySummary}</strong>
            {onGoToRules && <button type="button" onClick={() => openContext('rules')}>{__('Edit display rules', 'wconvert')}</button>}</div>}
          {destinationSummary && <div><small>{__('After a visitor submits', 'wconvert')}</small><strong>{destinationSummary}</strong>
            {onGoToDestinations && <button type="button" onClick={() => openContext('destinations')}>{__('Edit destinations', 'wconvert')}</button>}</div>}
        </div>}
        {panelOpen && <div className="wconvert-journey-mobile-tabs" role="group" aria-label={__('Mobile journey view', 'wconvert')}>
          <button type="button" aria-pressed={mobilePane === 'map'} onClick={() => setMobilePane('map')}>{view === 'flow' ? __('Map', 'wconvert') : __('Screens', 'wconvert')}</button>
          <button type="button" aria-pressed={mobilePane === 'details'} onClick={() => setMobilePane('details')}>{contextPanel ? contextPanel === 'rules' ? __('Display rules', 'wconvert') : __('Destinations', 'wconvert') : sampleOpen ? __('Sample answers', 'wconvert') : __('Edit screen', 'wconvert')}</button>
        </div>}
        <div className="wconvert-journey-side" data-mobile-pane={mobilePane} data-panel-open={panelOpen}>
          <div className="wconvert-journey-mobile-picker"><label>{__('Screen', 'wconvert')}<select value={step} onChange={event => select(Number(event.target.value))}>{displayOrder.map((index, position) => <option key={tree.steps[index].id} value={index}>{position + 1}. {tree.steps[index].name}</option>)}</select></label></div>
          {view === 'flow' && <Suspense fallback={<div className="wconvert-journey-map">{__('Loading journey map…', 'wconvert')}</div>}>
            <JourneyMap tree={tree} selected={inspecting ? step : null} focusedPath={inspecting && panelSection === 'paths' ? pathFocus : null}
              onSelect={select} onSelectPath={(index, priority) => { select(index); setPanelSection(priority === 'hidden' && !tree.graph ? 'content' : 'paths'); setPathFocus(priority); }} onConnect={connect} onReconnect={reconnect} samplePath={samplePath} sampleEdges={sampleEdges}
              onPreview={index => { previewAction.current = null; previewTrigger.current = document.activeElement as HTMLElement; setPreviewScreen(index); }}
              onAdd={tree.graph ? (index, edgeId) => {
                contextAddTrigger.current = document.activeElement as HTMLElement;
                select(index); setInsertLocation(edgeId ? `edge:${edgeId}` : undefined); insertedScreen.current = false; setInsertIntent(undefined); setAddKind('input');
              } : undefined}
              destinationSummary={destinationSummary} onGoToDestinations={onGoToDestinations ? () => openContext('destinations') : undefined} />
          </Suspense>}
          {view === 'screens' && <aside className="wconvert-journey-rail" aria-label={__('Journey screens', 'wconvert')}>
            <div className="wconvert-journey-rail__heading"><strong>{__('Screens', 'wconvert')}</strong><span>{tree.graph ? tree.steps.length : `${tree.steps.length} / 7`}</span><small>{__('Screen inventory · paths may skip screens', 'wconvert')}</small></div>
            <ol ref={screenList} className="wconvert-journey-dialog__screens" aria-label={__('Journey screen inventory', 'wconvert')}>
              {displayOrder.map((index, position) => <JourneyScreenCard key={tree.steps[index].id} template={{ tree, tokens }} index={index} ordinal={position + 1} selected={index === step}
                scope={id} label={disconnected.has(tree.steps[index].id) ? __('Unreachable', 'wconvert') : screenLabel(index)} condition={tree.steps[index].when ? sprintf(__('Show if %s', 'wconvert'), conditionText(tree, tree.steps[index].when!))
                  : tree.steps[index].kind === 'result' && (tree.steps[index].results?.length ?? 0) > 1 ? sprintf(__('%d possible results', 'wconvert'), tree.steps[index].results?.length ?? 0) : undefined}
                onSelect={() => select(index)}
                onMove={tree.graph ? undefined : (from, to) => move(tree.steps.findIndex(s => s.id === from), Math.min(tree.steps.findIndex(s => s.id === to), tree.steps.length - 2))} />)}
            </ol>
          </aside>}
          {contextPanel && contextEditors ? <section className="wconvert-journey-pane wconvert-journey-context-pane" aria-label={contextPanel === 'rules' ? __('Journey display rules', 'wconvert') : __('Journey destinations', 'wconvert')}>
            <div className="wconvert-journey-pane__heading"><h3 ref={contextHeading} tabIndex={-1}>{contextPanel === 'rules' ? __('When this appears', 'wconvert') : __('Where submissions go', 'wconvert')}</h3><button type="button" className="wconvert-journey-pane__close" aria-label={__('Close campaign settings', 'wconvert')} onClick={closeContext}><X aria-hidden="true" /></button></div>
            <div className="wconvert-journey-dialog__details"><p className="wconvert-journey-context-help">{contextPanel === 'rules' ? __('These rules decide when the journey starts. Screen conditions decide what visitors see after it starts.', 'wconvert') : __('Destinations receive saved submissions. They do not decide the next screen in the journey.', 'wconvert')}</p>{contextEditors[contextPanel]}</div>
            <div className="wconvert-journey-dialog__actions-row"><Button type="button" size="sm" variant="outline" onClick={closeContext}>{__('Back to journey', 'wconvert')}</Button><small>{__('Campaign draft · Undo available', 'wconvert')}</small></div>
          </section> : sampleOpen ? <JourneySample tree={tree} onTrace={setSamplePath} onSelect={select} onClose={() => { setSampleOpen(false); setSamplePath(null); setMobilePane('map'); }} />
            : inspecting && <section className="wconvert-journey-pane" aria-label={__('Selected screen settings', 'wconvert')}>
            <div className="wconvert-journey-pane__heading"><div className="wconvert-journey-dialog__selected"><span>{ordinal(step)}</span><div><h3 ref={settingsHeading} tabIndex={-1}><bdi>{current.name}</bdi></h3><small>{sprintf(__('Screen %1$d of %2$d', 'wconvert'), ordinal(step), tree.steps.length)} · {screenLabel(step)}</small></div></div>
              <button type="button" className="wconvert-journey-pane__close" aria-label={__('Close screen settings', 'wconvert')} onClick={() => {
                setInspecting(false); setPathFocus(null); setMobilePane('map');
                requestAnimationFrame(() => {
                  const trigger = inspectorTrigger.current;
                  (trigger?.isConnected ? trigger : findInput.current)?.focus();
                });
              }}><X aria-hidden="true" /></button>
            </div>
            <div className="wconvert-journey-dialog__details">
          {disconnected.has(current.id) && <p className="wconvert-graph-insert__summary">{__('Visitors cannot reach this screen. Connect an incoming path from a reachable screen to include it in the journey.', 'wconvert')}</p>}
          <JourneyArrivalSummary tree={tree} step={step} onSelectPath={(index, priority) => { select(index); setPanelSection('paths'); setPathFocus(priority); }} />
          <ScreenConditionSettings key={`visibility:${current.id}`} reveal={repairRequest?.screenId === current.id && repairRequest.section === 'content' && !repairRequest.focus ? repairRequest.serial : undefined} tree={tree} step={step} onChange={onChange} onSelect={select} />
            <div className="wconvert-journey-pane__tabs" role="group" aria-label={__('Screen settings section', 'wconvert')}>
              <button type="button" aria-pressed={panelSection === 'content'} onClick={() => setPanelSection('content')}>{walkNodes(current.content).some(node => node.type === 'question') ? __('Content & answers', 'wconvert') : __('Content', 'wconvert')}</button>
              <button type="button" aria-pressed={panelSection === 'paths'} onClick={() => setPanelSection('paths')}>{__('Next screen', 'wconvert')}</button>
            </div>

          {panelSection === 'content' ? <>

          <QuestionSettings tree={tree} step={step} onChange={onChange} onSelect={select} />
          <JourneyScreenContent tree={tree} step={step} onChange={onChange} />
          <JourneyCaptureSettings tree={tree} step={step} onChange={onChange} destinationSummary={destinationSummary} onDestinations={onGoToDestinations ? () => openContext('destinations') : undefined} />


          <ResultSettings tree={tree} step={step} onChange={onChange} repairRequest={repairRequest?.screenId === current.id ? repairRequest : undefined} />
          {current.kind === 'result' && <fieldset className="wconvert-journey-settings__group">
            <legend>{__('When visitors see their result', 'wconvert')}</legend>
            <label><input type="radio" name={`${id}-result-access`} disabled={tree.graph ? tree.submissions.length > 0 && !!graphResultAccessIssue(tree, false) : tree.steps.some(screen => screen.paths?.length)} checked={tree.submissions.length === 0 || (tree.graph
              ? !tree.submissions[0].required : step < submissionScreen(tree, tree.submissions[0]?.id))}
              onChange={() => { if (tree.submissions.length) { const next = resultAccess(tree, false); write(next, next.steps.findIndex(s => s.id === current.id));
                if (next !== tree) setSaid(__('Result moved before contact details. Signup is optional and visitors may finish without submitting.', 'wconvert')); } }} />{__('Immediately after the questions', 'wconvert')}</label>
            <label><input type="radio" name={`${id}-result-access`} disabled={tree.submissions.length !== 1 || (tree.graph ? !!graphResultAccessIssue(tree, true) : tree.steps.some(screen => screen.paths?.length))}
              checked={tree.submissions.length === 1 && (tree.graph ? tree.submissions[0].required : step > submissionScreen(tree, tree.submissions[0].id))}
              onChange={() => { const next = resultAccess(tree, true); write(next, next.steps.findIndex(s => s.id === current.id));
                if (next !== tree) setSaid(__('Contact details are now required before the result. Tell visitors on the first screen.', 'wconvert')); }} />{__('After required contact details', 'wconvert')}</label>
            {!tree.graph && tree.steps.some(screen => screen.paths?.length) && <p>{__('Remove answer paths before changing when results appear.', 'wconvert')}</p>}
            {tree.submissions.length === 0 && <p>{__('Add a signup screen first to make contact details required.', 'wconvert')} {(!tree.graph || canAddGraphResultSignup) && <button type="button" onClick={addOptional}>{__('Add optional signup', 'wconvert')}</button>}</p>}
            {resultAccessIssue && <div><p>{resultAccessIssue.message}</p>{resultAccessIssue.screenId && <button type="button" onClick={() => {
              const index = tree.steps.findIndex(screen => screen.id === resultAccessIssue.screenId);
              if (index >= 0) { select(index); setPanelSection(resultAccessIssue.section); requestAnimationFrame(() => settingsHeading.current?.focus()); }
            }}>{sprintf(__('Review %s', 'wconvert'), tree.steps.find(screen => screen.id === resultAccessIssue.screenId)?.name ?? '')}</button>}</div>}
            {tree.submissions.length > 0 && <p>{__('Tell visitors about any contact requirement on the first screen. Changing this choice is one undoable draft edit.', 'wconvert')}</p>}
          </fieldset>}
          <div className="wconvert-journey-dialog__behavior"><strong>{screenLabel(step)}</strong><p>{current.kind === 'acknowledgement'
            ? tree.graph ? __('The journey ends here. Visitors arrive through its incoming paths.', 'wconvert') : __('The journey ends here. This screen always stays last.', 'wconvert')
            : submission?.required === false
              ? tree.submissions[0]?.id === submission.id
                ? __('Visitors may skip this signup and finish without saving contact details.', 'wconvert')
                : __('Adds details to the same Lead. Visitors can skip this signup; their earlier signup stays saved.', 'wconvert')
              : submission
                ? current.kind === 'input' && tree.steps.some(screen => screen.kind === 'result')
                  ? __('Visitors must submit their details here before seeing the result. An accepted save creates one Lead.', 'wconvert')
                  : __('Saves the signup or request here, even if the visitor leaves a later screen.', 'wconvert')
                : current.kind === 'result'
                  ? __('Shows the selected result. Viewing it does not save contact details or create a Lead.', 'wconvert')
                : __('New answers stay on this page until the visitor submits. Going to the next screen does not save new details.', 'wconvert')}</p></div>
          {(tree.graph ? tree.graph.edges.some(edge => edge.from === current.id) : step < tree.steps.length - 1) && <button type="button" className="wconvert-journey-next-summary" onClick={() => setPanelSection('paths')}>
            <strong>{tree.graph ? tree.graph.edges.filter(edge => edge.from === current.id && edge.kind === 'answer').length ? sprintf(__('%d answer paths and Everyone else', 'wconvert'), tree.graph.edges.filter(edge => edge.from === current.id && edge.kind === 'answer').length) : sprintf(__('Next: %s', 'wconvert'), tree.steps.find(item => item.id === tree.graph?.edges.find(edge => edge.from === current.id && edge.kind === 'default')?.to)?.name ?? __('Choose a connection', 'wconvert'))
              : current.paths?.length && current.paths.length > 1 ? sprintf(__('%d answer paths and Everyone else', 'wconvert'), current.paths.length - 1)
                : sprintf(__('Next: %s', 'wconvert'), tree.steps.find(item => item.id === current.paths?.[0]?.to)?.name ?? tree.steps[step + 1].name)}</strong>
            <small>{__('Review where visitors go next', 'wconvert')}</small>
          </button>}

          </> : tree.graph ? <GraphRouteSettings tree={tree} step={step} focusPath={pathFocus} focusTarget={repairRequest?.screenId === current.id && repairRequest.focus === 'route-target'} onChange={onChange} onInsert={insertOnGraphPath} onAdd={intent => {
              contextAddTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              setInsertLocation(undefined); insertedScreen.current = false;
              setInsertIntent(intent === 'branch' ? 'branch' : undefined); setAddKind(intent === 'followup' ? 'followup' : 'input');
            }} onOpenInsert={edgeId => {
              contextAddTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              setInsertLocation(`edge:${edgeId}`); insertedScreen.current = false; setInsertIntent(undefined); setAddKind('input');
            }} />
            : <RouteSettings tree={tree} step={step} focusPath={typeof pathFocus === 'number' ? pathFocus : null} onChange={onChange} onInsert={insertOnPath} />}
            <Button type="button" size="sm" variant="outline" className="wconvert-journey-appearance" onClick={() => { if (embedded) onGoToDesign?.(); else setOpen(false); }}>{__('Edit design', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:rotate-180" /></Button>
          <details className="wconvert-journey-options"><summary>{__('Screen options', 'wconvert')}</summary>
          <div className="wconvert-journey-dialog__fields">

            <label className="wconvert-journey__field">{__('Screen name', 'wconvert')}
              <Input type="text" maxLength={120} value={current.name} onChange={e => onChange({ ...tree, steps: tree.steps.map((s, i) => i === step ? { ...s, name: e.target.value } : s) }, `journey:${current.id}:name`)} />
            </label>
            {current.kind === 'input' && <label className="wconvert-journey__field">{__('When this screen is completed', 'wconvert')}
              <select value={tree.submissions.find(sub => walkNodes(current.content).some(n => 'submission' in n && n.submission === sub.id && 'action' in n && n.action === 'submit'))?.id ?? 'next'}
                onChange={event => {
                  const chosen = event.target.value;
                  const rewrite = (node: import('@renderer/types').TemplateNode, at: number): import('@renderer/types').TemplateNode => {
                    const n = { ...node } as Record<string, unknown>;
                    if (n.type === 'button' && n.action === 'submit' && (at === step || n.submission === chosen)) { n.action = 'next'; delete n.submission; }
                    for (const key of ['children', 'start', 'end']) if (Array.isArray(n[key])) n[key] = (n[key] as import('@renderer/types').TemplateNode[]).map(c => rewrite(c, at));
                    return n as unknown as import('@renderer/types').TemplateNode;
                  };
                  const steps = tree.steps.map((s, at) => ({ ...s, content: rewrite(s.content, at) }));
                  if (chosen !== 'next') {
                    let replaced = false;
                    const submit = (node: import('@renderer/types').TemplateNode): import('@renderer/types').TemplateNode => {
                      const n = { ...node } as Record<string, unknown>;
                      if (!replaced && n.type === 'button' && n.action === 'next') { replaced = true; n.action = 'submit'; n.submission = chosen; n.label = __('Submit', 'wconvert'); }
                      for (const key of ['children', 'start', 'end']) if (Array.isArray(n[key])) n[key] = (n[key] as import('@renderer/types').TemplateNode[]).map(submit);
                      return n as unknown as import('@renderer/types').TemplateNode;
                    };
                    steps[step] = { ...steps[step], content: submit(steps[step].content) };
                  }
                  write({ ...tree, steps }, step);
                }}>
                <option value="next">{__('Go to the next screen', 'wconvert')}</option>
                {tree.submissions.map(sub => <option key={sub.id} value={sub.id}>{saveLabel(sub.id)}</option>)}
              </select>
            </label>}
          </div>
          {tree.graph && <GraphScreenActions key={`actions:${current.id}`} tree={tree} step={step} onChange={(next, selected) => { write(next, selected); requestAnimationFrame(() => settingsHeading.current?.focus()); }} />}
            <div className="wconvert-journey-dialog__actions-row">
              {tree.graph && <Button ref={deleteTrigger} type="button" size="sm" variant="outline" aria-disabled={!!deletionReason} aria-describedby={deletionReason ? `${id}-delete-reason` : undefined} onClick={() => { if (!deletionReason) { deletedGraphScreen.current = false; setConfirmGraphRemoval(true); } }}>
                <Trash2 aria-hidden="true" />{optionalRemoval ? __('Remove optional signup', 'wconvert') : __('Delete screen', 'wconvert')}
              </Button>}
              {!tree.graph && <DropdownMenu>
                <DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline">{__('Screen actions', 'wconvert')}<ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem disabled={current.kind === 'acknowledgement' || current.kind === 'result' || tree.steps.length >= 7} onSelect={() => {
                    const steps = [...tree.steps];
                    let copy = duplicateScreen(tree, step);
                    if (steps.slice(0, step).some(screen => screen.paths?.some(path => path.to === current.id))) {
                      for (let index = 0; index < step; index++) if (steps[index].paths?.some(path => path.to === current.id)) {
                        steps[index] = { ...steps[index], paths: steps[index].paths!.map(path => path.to === current.id ? { ...path, to: copy.id } : path) };
                      }
                      copy = { ...copy, paths: [{ to: current.id }] };
                    }
                    steps.splice(step, 0, copy); write({ ...tree, steps }, step);
                  }}><Copy aria-hidden="true" />{__('Duplicate', 'wconvert')}</DropdownMenuItem>
                  <DropdownMenuItem disabled={movedScreen(tree, step, step - 1) === tree} onSelect={() => move(step, step - 1)}><ArrowLeft aria-hidden="true" />{__('Move earlier', 'wconvert')}</DropdownMenuItem>
                  <DropdownMenuItem disabled={movedScreen(tree, step, step + 1) === tree} onSelect={() => move(step, step + 1)}><ArrowRight aria-hidden="true" />{__('Move later', 'wconvert')}</DropdownMenuItem>
                  <DropdownMenuItem disabled={removal.screens.length === 0} onSelect={() => removal.screens.length > 1 ? setConfirmRemoval(true) : remove()}><Trash2 aria-hidden="true" />{__('Delete screen', 'wconvert')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}

            </div>
            {deletionReason && <p id={`${id}-delete-reason`} className="wconvert-journey-delete-reason">{deletionReason}</p>}
          </details>
            </div>

          </section>}
        </div>
        <div className="wconvert-journey-dialog__footer"><p role="status">{said || __('Changes are part of your campaign draft. Save the draft to keep them.', 'wconvert')}</p>{!embedded && <DialogClose asChild><Button variant="outline">{__('Done', 'wconvert')}</Button></DialogClose>}</div>
        <ConfirmDialog open={confirmRemoval} onOpenChange={setConfirmRemoval} title={__('Remove this optional signup?', 'wconvert')}
          description={sprintf(__('These screens collect details for the same signup and will be removed: %s. Other screens stay. Undo brings them back.', 'wconvert'), tree.steps.filter(s => removal.screens.includes(s.id)).map(s => s.name).join(', '))}
          confirmLabel={__('Remove signup screens', 'wconvert')} onConfirm={remove} />
        <ConfirmDialog open={pendingRoute !== null} onOpenChange={value => { if (!value) setPendingRoute(null); }} title={__('Review this path change', 'wconvert')} returnFocusTo={settingsHeading}
          description={pendingRoute?.description ?? ''}
          confirmLabel={__('Apply path change', 'wconvert')} onConfirm={() => { if (pendingRoute) { if (pendingRoute.selected !== undefined) write(pendingRoute.tree, pendingRoute.selected); else onChange(pendingRoute.tree); } setPendingRoute(null); }} />
  </>;
  return <>
    {embedded ? <section ref={workspaceRoot} className="wconvert-journey-workspace" data-focused={focused || undefined} aria-label={__('Journey', 'wconvert')}>{workspace}</section>
      : <Dialog open={open} onOpenChange={value => { setOpen(value); setSaid(''); }}>
        <DialogTrigger asChild><Button type="button" variant="outline" size="sm"><Workflow aria-hidden="true" />{__('Manage screens', 'wconvert')}</Button></DialogTrigger>
        <DialogContent className="wconvert-journey-dialog" showCloseButton={false}>{workspace}</DialogContent>
      </Dialog>}
    <Dialog open={confirmGraphRemoval} onOpenChange={setConfirmGraphRemoval}>
      <DialogContent className="wconvert-graph-insert" onCloseAutoFocus={event => {
        event.preventDefault();
        requestAnimationFrame(() => (deletedGraphScreen.current ? settingsHeading.current : deleteTrigger.current)?.focus());
      }}>
        {confirmGraphRemoval && (optionalRemoval && selectedCapture
          ? <GraphCaptureRemove tree={tree} submissionId={selectedCapture.id} onCancel={() => setConfirmGraphRemoval(false)} onRemove={applyGraphRemoval} />
          : <GraphScreenRemove tree={tree} screenId={current.id} onCancel={() => setConfirmGraphRemoval(false)} onRemove={applyGraphRemoval} />)}
      </DialogContent>
    </Dialog>
    <Dialog open={addCapture} onOpenChange={setAddCapture}>
      <DialogContent className="wconvert-graph-insert" onCloseAutoFocus={event => {
        event.preventDefault();
        if (pendingRoute || addCapture) return;
        requestAnimationFrame(() => (insertedScreen.current ? settingsHeading.current : contextAddTrigger.current?.isConnected ? contextAddTrigger.current : addTrigger.current)?.focus());
      }}>
        {addCapture && <GraphCaptureInsert tree={tree} primaryChannel={primaryChannel} source={current.id} onCancel={() => setAddCapture(false)} onInsert={location => {
          const next = addGraphCapture(tree, primaryChannel, location);
          if (next === tree) return;
          insertedScreen.current = true;
          write(next, submissionScreen(next, next.submissions[1]?.id));
          setPanelSection('content'); setMobilePane('details'); setAddCapture(false);
          setSaid(__('Optional signup added. Review its consent and destinations before publishing. The primary signup stays saved when visitors skip this step.', 'wconvert'));
        }} />}
      </DialogContent>
    </Dialog>
    <Dialog open={addKind !== null} onOpenChange={value => { if (!value) setAddKind(null); }}>
      <DialogContent className="wconvert-graph-insert" onCloseAutoFocus={event => {
        event.preventDefault();
        if (pendingRoute || addCapture) return;
        requestAnimationFrame(() => (insertedScreen.current ? settingsHeading.current : contextAddTrigger.current?.isConnected ? contextAddTrigger.current : addTrigger.current)?.focus());
      }}>
        {addKind && !tree.graph && <>
          <DialogTitle>{__('Use the new Journey editor', 'wconvert')}</DialogTitle>
          <DialogDescription>{__('Enable flexible paths to add screens, conditional follow-ups and branches from the map. Your existing visitor paths are preserved.', 'wconvert')}</DialogDescription>
          <div className="wconvert-graph-insert__summary"><strong>{__('A change to this draft only', 'wconvert')}</strong><p>{__('Your published campaign is unaffected. You can Undo the upgrade, and cancelling here changes nothing. Ordered screen actions remain available if you want to keep the current model.', 'wconvert')}</p></div>
          <div className="wconvert-graph-insert__actions"><Button type="button" variant="outline" onClick={() => setAddKind(null)}>{__('Cancel', 'wconvert')}</Button><Button type="button" onClick={() => { onChange(upgradeToGraph(tree)); setSaid(__('Flexible paths enabled for this draft. Undo restores the ordered journey.', 'wconvert')); }}>{__('Enable flexible paths', 'wconvert')}</Button></div>
        </>}
        {addKind && tree.graph && <GraphScreenInsert tree={tree} source={current.id} kind={addKind} initialLocation={insertLocation} initialIntent={insertIntent} onCancel={() => setAddKind(null)}
          onEditCapture={screenId => { select(tree.steps.findIndex(screen => screen.id === screenId)); setAddKind(null); insertedScreen.current = true; }}
          onCapture={canAddGraphResultSignup || canAddGraphCapture ? () => { setAddKind(null); addOptional(); } : undefined}
          onExisting={(target, when, edgeId) => {
            let next = edgeId ? reconnectGraphEdge(tree, edgeId, target) : addGraphConnection(tree, current.id, target);
            if (next === tree) return;
            if (!edgeId && when) { const added = next.graph!.edges.at(-1)!; next = { ...next, graph: { ...next.graph!, edges: next.graph!.edges.map(edge => edge.id === added.id ? { ...edge, when } : edge) } }; }
            const impact = graphChangeImpact(tree, next);
            const from = edgeId ? tree.graph!.edges.find(edge => edge.id === edgeId)!.from : current.id;
            select(tree.steps.findIndex(screen => screen.id === from));
            setAddKind(null); setPanelSection('paths');
            if (impact) setPendingRoute({ tree: next, description: impact }); else onChange(next);
            setSaid(impact ? __('Review the proposed connection before applying it.', 'wconvert') : __('Connection updated. Review its priority and destination in Next screen.', 'wconvert'));
          }}
          onInsert={(location, kind, name, when, includeHidden, branch) => {
            let next = branch && when ? addGraphBranchScreen(tree, current.id, kind === 'ending' ? 'ending' : kind === 'content' ? 'content' : 'input', when) : addGraphScreen(tree, location, kind, when, includeHidden);
            if (next === tree) return;
            if (name) next = { ...next, steps: next.steps.map((screen, index) => index === next.steps.length - 1 ? { ...screen, name } : screen) };
            const impact = graphChangeImpact(tree, next);
            if (impact) { setAddKind(null); setPendingRoute({ tree: next, description: impact, selected: next.steps.length - 1 }); return; }
            insertedScreen.current = true;
            write(next, next.steps.length - 1);
            setPanelSection('content'); setMobilePane('details'); setSampleOpen(false); setAddKind(null);
            setSaid(__('Screen added at the chosen location. Review its content and continuation in screen settings.', 'wconvert'));
          }} />}
      </DialogContent>
    </Dialog>
    <Dialog open={previewScreen !== null} onOpenChange={value => { if (!value) setPreviewScreen(null); }}>
      <DialogContent className="wconvert-journey-screen-preview" onCloseAutoFocus={event => {
        event.preventDefault();
        if (previewAction.current === 'test') return;
        if (previewAction.current === 'edit') { requestAnimationFrame(() => settingsHeading.current?.focus()); return; }
        if (previewTrigger.current?.isConnected) previewTrigger.current.focus();
        else findInput.current?.focus();
      }}>
        {previewScreen !== null && tree.steps[previewScreen] && <JourneyScreenPreview template={{ tree, tokens }} step={previewScreen}
          onEdit={() => { previewAction.current = 'edit'; select(previewScreen); setPreviewScreen(null); }}
          onTest={() => { previewAction.current = 'test'; setPreviewScreen(null); returnToTestTrigger.current = true; setTestOpen(true); }} />}
      </DialogContent>
    </Dialog>
    <Dialog open={testOpen} onOpenChange={value => { setTestOpen(value); if (!value && !embedded) setOpen(true); }}>
      <DialogContent className="wconvert-journey-test-dialog" onOpenAutoFocus={event => event.preventDefault()}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const restore = () => (returnToTestTrigger.current ? testTrigger.current : settingsHeading.current)?.focus();
          // The embedded workspace stays mounted. Deferring its restoration can
          // steal focus from a subsequent Escape that leaves Focus journey.
          if (embedded) restore();
          else requestAnimationFrame(restore);
        }}>
        <DialogTitle>{__('Test journey', 'wconvert')}</DialogTitle>
        <DialogDescription>{__('Walk through the journey and inspect visited or skipped screens. Nothing is submitted.', 'wconvert')}</DialogDescription>
        <div className="wconvert-journey-test-dialog__body">
          <JourneyTest onShowPath={(screens, edges) => { setSamplePath(screens); setSampleEdges(tree.graph ? edges : null); setSampleOpen(false); setInspecting(false); setMobilePane('map'); setView('flow'); setTestOpen(false); setOpen(true); setSaid(__('The screens and connections visited in your test are highlighted. Future screens are not predicted.', 'wconvert')); }} template={{ tree, tokens }} deliveryMode={deliveryMode} destinationSummary={destinationSummary}
            onEdit={index => { returnToTestTrigger.current = false; select(index); setTestOpen(false); setOpen(true); }} />
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
