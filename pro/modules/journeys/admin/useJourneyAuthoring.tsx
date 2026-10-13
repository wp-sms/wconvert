import { useId, useRef, useState } from 'react';
import { ListPlus, Plus, Workflow } from 'lucide-react';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { QuestionNode, TemplateNode, TemplateTree } from '@renderer/types';
import { NO_AUTHORING, type JourneyAuthoringUI, type JourneyEditorContext } from '@/journeyAuthoring';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { AdminDialogContent } from '@/components/ui/admin-dialog';
import { OptionGroup, OptionItem, refusal } from '@/components/ui/option-menu';
import { ConfirmDialog } from '@/shell/ConfirmDialog';
import { CheckRow } from '@/shell/CheckRow';
import { FactList, FactRow, PanelHint, PanelSection } from '@/builder/PanelSection';
import { addGraphResultSignup, freshScreen, graphResultAccessIssue, graphResultSignupTarget, resultAccess, submissionScreen, walkNodes } from '@/builder/structure/journey';
import { addGraphBranchScreen, addGraphScreen, type GraphScreenKind } from '@/builder/structure/graphInsertion';
import { addGraphCapture } from '@/builder/structure/graphCaptureInsertion';
import { addGraphConnection, reconnectGraphEdge } from '@/builder/structure/graphConnections';
import { graphChangeImpact } from '@/builder/structure/graphChangeImpact';
import { graphDisplayOrder, graphReaches, upgradeToGraph } from '@/builder/structure/graph';
import { followupInsertionEdge, moveFollowup } from '@/builder/structure/followupActions';
import { followupGroups, followupGroupSource } from '@/builder/structure/followupGroups';
import { GraphScreenInsert } from './GraphScreenInsert';
import { GraphCaptureInsert } from './GraphCaptureInsert';
import { GraphScreenActions } from './GraphScreenActions';
import { QuestionSettings, ResultSettings, ScreenConditionSettings } from './JourneySettings';
import { RouteEditor } from './RouteEditor';
import { ThenSelect } from './ThenSelect';
import { BranchNudge } from './BranchNudge';
import { AnswerFollowup } from './AnswerFollowup';

/**
 * Journey authoring inside free's screens editor (ADR 0147): adding questions
 * and follow-ups, answer lines, results and when they show — the state and
 * the dialogs those need. Free lends the draft and its own moves through the
 * context; everything that decides anything about a journey is here.
 */
export function useJourneyAuthoring(ctx: JourneyEditorContext): JourneyAuthoringUI {
  const { tree, step, primaryChannel, slim, pathFocus, repairRequest, resumeReview, addTrigger, settingsHeading, capRefusal, onChange, select, write, say } = ctx;
  const [addCapture, setAddCapture] = useState(false);
  const contextAddTrigger = useRef<HTMLElement | null>(null);
  const [followupAnswer, setFollowupAnswer] = useState<{ question: string; value: string }>();
  const [insertIntent, setInsertIntent] = useState<'branch' | undefined>();
  const [insertLocation, setInsertLocation] = useState<string | undefined>();
  const [addKind, setAddKind] = useState<GraphScreenKind | null>(null);
  const insertDialog = useRef<HTMLDivElement>(null);
  const insertedScreen = useRef(false);
  const [moving, setMoving] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<{ tree: TemplateTree; description: string; selected?: number } | null>(null);
  const id = useId();

  const current = tree.steps[step];
  const insertionTree = tree.graph ? tree : upgradeToGraph(tree);
  const canAddGraphResultSignup = !!graphResultSignupTarget(tree);
  const canAddGraphCapture = !!tree.graph && tree.submissions.length === 1 && ['email', 'phone', 'sms'].includes(primaryChannel ?? '');
  const resultAccessIssue = tree.graph && tree.submissions.length === 1 ? graphResultAccessIssue(tree, !tree.submissions[0].required) : null;
  const canCondition = !!current && tree.steps.some((screen, index) => (tree.graph
    ? screen.id === current.id || graphReaches(tree.graph, screen.id, current.id)
    : index <= step) && walkNodes(screen.content).some(node => node.type === 'question' && 'answer_type' in node && node.answer_type !== 'text'));
  const displayOrder = graphDisplayOrder(tree);

  const openAdd = (kind: GraphScreenKind, options: { location?: string; intent?: 'branch'; answer?: { question: string; value: string }; trigger?: boolean } = {}) => {
    contextAddTrigger.current = options.trigger && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFollowupAnswer(options.answer); setInsertLocation(options.location); insertedScreen.current = false; setInsertIntent(options.intent); setAddKind(kind);
  };
  const add = (kind: 'content' | 'input', conditional = false) => {
    if (tree.graph) { openAdd(conditional ? 'followup' : kind); return; }
    const question = conditional ? tree.steps.slice(0, step + 1).flatMap(item => walkNodes(item.content)).find(node => node.type === 'question'
      && 'id' in node && typeof node.id === 'string' && 'answer_type' in node && node.answer_type !== 'text') as (QuestionNode & { id: string }) | undefined : undefined;
    if (conditional && !question) { say(__('Add a choice question here or earlier before making a conditional follow-up.', 'wconvert')); return; }
    ctx.insertScreen(at => {
      const screen = freshScreen(tree, kind, at > 0);
      return question ? { ...screen, name: __('Relevant follow-up', 'wconvert'), when: { match: 'all', clauses: [{ question: question.id,
        operator: question.answer_type === 'multi' ? 'includes_any' : 'is', values: [''] }] } } : screen;
    });
    if (conditional) say(__('Follow-up added. Choose the matching answer under “Only if…”.', 'wconvert'));
  };
  const insertOnGraphPath = (edgeId: string, kind: 'content' | 'input') => {
    const next = addGraphScreen(tree, `edge:${edgeId}`, kind);
    if (next === tree) return;
    write(next, next.steps.length - 1);
    ctx.showSection('content');
    say(__('Screen added on this line. The line keeps its answer and its place in the order.', 'wconvert'));
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
    ctx.showSection('content');
    say(sprintf(__('Screen added on this line. Its answer and where it goes next (%s) are kept.', 'wconvert'), tree.steps.find(item => item.id === path.to)?.name ?? __('Removed screen', 'wconvert')));
  };
  const addOptional = () => {
    if (tree.graph && tree.submissions.length) { insertedScreen.current = false; setAddCapture(true); return; }
    const next = addGraphResultSignup(tree);
    if (next === tree) return;
    write(next, submissionScreen(next, next.submissions[0]?.id));
    say(__('Optional signup added after the result. Visitors may finish without submitting details.', 'wconvert'));
  };
  // "Send some answers to a different screen": the insert dialog, on its branch intent (ADR 0142).
  const branchFrom = (index: number) => {
    contextAddTrigger.current = document.activeElement as HTMLElement;
    if (index !== step) select(index);
    setFollowupAnswer(undefined); setInsertLocation(undefined); insertedScreen.current = false; setInsertIntent('branch'); setAddKind('input');
  };
  // "+ Follow-up" on an answer, from the question's settings or the screen's answers.
  const startFollowup = (question: string, value: string) => {
    setFollowupAnswer({ question, value }); contextAddTrigger.current = document.activeElement as HTMLElement;
    const edge = followupInsertionEdge(insertionTree, current.id, question, value);
    setInsertLocation(edge ? `edge:${edge.id}` : 'choose'); setInsertIntent(undefined); insertedScreen.current = false; setAddKind('followup');
  };
  const upgrade = () => {
    onChange(upgradeToGraph(tree));
    say(__('Answers can now choose the next screen. Undo goes back to one screen after another.', 'wconvert'));
  };

  if (!current) return { ...NO_AUTHORING, busy: !!(addKind || addCapture || pendingRoute) };

  const followupRefusal = capRefusal ?? (!tree.graph && !canCondition
    ? refusal(__('Needs a choice question first', 'wconvert'), __('Add a choice question here or earlier before making a conditional follow-up.', 'wconvert')) : null);
  const route = (titled: boolean) => <RouteEditor titled={titled} tree={tree} step={step} onSelect={index => { select(index); ctx.returnHere(); }} focusPath={pathFocus}
    focusTarget={repairRequest?.screenId === current.id && repairRequest.focus === 'route-target'} onChange={onChange} onInsertOnEdge={insertOnGraphPath} onInsertOnPath={insertOnPath}
    onAdd={intent => openAdd(intent === 'followup' ? 'followup' : 'input', { intent: intent === 'branch' ? 'branch' : undefined, trigger: true })}
    onOpenInsert={edgeId => openAdd('input', { location: `edge:${edgeId}`, trigger: true })} />;
  const question = <QuestionSettings resumeReview={resumeReview} onAction={say} onFollowup={startFollowup} tree={tree} step={step} onChange={onChange} onSelect={select}
    onNavigate={(repair, review) => { ctx.returnHere(review); ctx.openReference(repair); }} />;
  const isFirst = current.id === (tree.graph?.entry ?? tree.steps[0]?.id);
  const groups = followupGroups(tree);
  const currentFollowups = groups.find(group => group.screens.includes(step));
  const followupSource = currentFollowups ? followupGroupSource(tree, currentFollowups) : undefined;
  const remainingFollowups = currentFollowups?.screens.at(-1) !== step ? currentFollowups : undefined;
  const nextId = tree.graph?.edges.find(edge => edge.from === current.id && edge.kind === 'default')?.to;
  const nextGroup = groups.find(group => tree.steps[group.screens[0]].id === nextId);
  const branchCount = tree.graph ? tree.graph.edges.filter(edge => edge.from === current.id && edge.kind === 'answer').length : Math.max(0, (current.paths?.length ?? 1) - 1);
  const choiceQuestionHere = walkNodes(current.content).some(node => node.type === 'question' && 'answer_type' in node && node.answer_type !== 'text');
  const closeFocus = (event: Event) => {
    event.preventDefault();
    if (pendingRoute || addCapture) return;
    requestAnimationFrame(() => (insertedScreen.current ? settingsHeading.current : contextAddTrigger.current?.isConnected ? contextAddTrigger.current : addTrigger.current)?.focus());
  };

  return {
    busy: !!(addKind || addCapture || pendingRoute),
    reset: () => setMoving(false),
    add,
    addOptional,
    canAddOptional: canAddGraphResultSignup || canAddGraphCapture,
    capHelp: __('Without answer lines a campaign holds up to 7 screens. Let answers choose the next screen to add more.', 'wconvert'),
    treeAddItems: <>
      <OptionItem icon={ListPlus} name={__('Question', 'wconvert')} refused={capRefusal} onSelect={() => add('input')} />
      <OptionItem icon={ListPlus} name={__('Follow-up question', 'wconvert')} refused={followupRefusal} onSelect={() => add('input', true)} />
    </>,
    headerAddItems: <>
      <OptionItem icon={ListPlus} name={__('Add question screen', 'wconvert')} refused={capRefusal} onSelect={() => add('input')} />
      <OptionItem icon={ListPlus} name={__('Add relevant follow-up', 'wconvert')} refused={followupRefusal} onSelect={() => add('input', true)} />
    </>,
    answersGroup: !tree.graph && <OptionGroup>
      <OptionItem icon={Workflow} name={__('Let answers choose the next screen', 'wconvert')} onSelect={upgrade} />
    </OptionGroup>,
    headerAdd: <Button ref={addTrigger} type="button" variant="outline" onClick={() => openAdd('input')}><Plus aria-hidden="true" />{__('Add screen', 'wconvert')}</Button>,
    question,
    questionPanel: <>{question}{route(true)}</>,
    route: route(false),
    screenCondition: (!slim || !isFirst) && <ScreenConditionSettings key={`visibility:${current.id}`} reveal={repairRequest?.screenId === current.id && repairRequest.section === 'content' && !repairRequest.focus ? repairRequest.serial : undefined} tree={tree} step={step} onChange={onChange} onSelect={select} />,
    then: <ThenSelect tree={tree} step={step} onChange={onChange}
      onUpgrade={next => { onChange(next); say(__('This screen now chooses its own next screen. Undo goes back to one screen after another.', 'wconvert')); }}
      onBranch={tree.graph && choiceQuestionHere && !tree.graph.edges.some(edge => edge.from === current.id && edge.kind === 'answer') ? () => branchFrom(step) : undefined} />,
    followup: (questionId, option) => <AnswerFollowup question={questionId} option={option} onFollowup={startFollowup} />,
    followupOrder: currentFollowups && <PanelSection title={__('Follow-up order', 'wconvert')}
      tip={followupSource === undefined ? __('Other lines lead into these follow-ups. Check them in Flow before changing the order.', 'wconvert') : __('Visitors see matching questions in this order. Other lines stay the same.', 'wconvert')}>
      <FactList><FactRow label={__('Position', 'wconvert')}>{sprintf(/* translators: 1: this follow-up's place. 2: how many follow-ups match. */ __('%1$d of %2$d', 'wconvert'), currentFollowups.screens.indexOf(step) + 1, currentFollowups.screens.length)}</FactRow></FactList>
      <div className="wconvert-panel-actions">{([-1, 1] as const).map(direction => <Button key={direction} type="button" variant="outline" size="sm" disabled={moveFollowup(tree, current.id, direction) === tree} onClick={() => { onChange(moveFollowup(tree, current.id, direction)); say(__('Follow-up order updated. Try it with several answers picked.', 'wconvert')); }}>{direction === -1 ? __('Move up', 'wconvert') : __('Move down', 'wconvert')}</Button>)}
        {followupSource === undefined && <Button type="button" variant="ghost" size="sm" onClick={ctx.showFlow}>{__('Review in Flow', 'wconvert')}</Button>}</div>
    </PanelSection>,
    result: <>
      <ResultSettings key={current.id} onResultSelect={ctx.onResultSelect} tree={tree} step={step} onChange={onChange} onAction={say} repairRequest={repairRequest?.screenId === current.id ? repairRequest : undefined} />
      {current.kind === 'result' && <PanelSection title={__('When visitors see their result', 'wconvert')}
        tipLabel={__('About result access', 'wconvert')} tip={tree.submissions.length > 0 ? __('Changing this moves signup before or after the result, and you can undo the whole change. Mention required contact details on the first screen.', 'wconvert') : undefined}>
        <div role="radiogroup" aria-label={__('When visitors see their result', 'wconvert')} className="wconvert-panel-radios">
          <CheckRow type="radio" className="wconvert-check" name={`${id}-result-access`} label={__('Immediately after the questions', 'wconvert')} disabled={tree.graph ? tree.submissions.length > 0 && !!graphResultAccessIssue(tree, false) : tree.steps.some(screen => screen.paths?.length)} checked={tree.submissions.length === 0 || (tree.graph
            ? !tree.submissions[0].required : step < submissionScreen(tree, tree.submissions[0]?.id))}
            onChange={() => { if (tree.submissions.length) { const next = resultAccess(tree, false); write(next, next.steps.findIndex(s => s.id === current.id));
              if (next !== tree) say(__('Result moved before contact details. Signup is optional and visitors may finish without submitting.', 'wconvert')); } }} />
          <CheckRow type="radio" className="wconvert-check" name={`${id}-result-access`} label={__('After required contact details', 'wconvert')} disabled={tree.submissions.length !== 1 || (tree.graph ? !!graphResultAccessIssue(tree, true) : tree.steps.some(screen => screen.paths?.length))}
            checked={tree.submissions.length === 1 && (tree.graph ? tree.submissions[0].required : step > submissionScreen(tree, tree.submissions[0].id))}
            onChange={() => { const next = resultAccess(tree, true); write(next, next.steps.findIndex(s => s.id === current.id));
              if (next !== tree) say(__('Contact details are now required before the result. Tell visitors on the first screen.', 'wconvert')); }} />
        </div>
        {!tree.graph && tree.steps.some(screen => screen.paths?.length) && <PanelHint>{__('Remove answer lines before changing when results appear.', 'wconvert')}</PanelHint>}
        {tree.submissions.length === 0 && <PanelHint>{__('Add a signup screen first to make contact details required.', 'wconvert')} {(!tree.graph || canAddGraphResultSignup) && <button type="button" className="wconvert-panel-link" onClick={ctx.addOptional}>{__('Add optional signup', 'wconvert')}</button>}</PanelHint>}
        {resultAccessIssue && <div className="wconvert-panel-warn"><span>{resultAccessIssue.message}</span>{resultAccessIssue.screenId && <button type="button" className="wconvert-panel-link" onClick={() => {
          const index = tree.steps.findIndex(screen => screen.id === resultAccessIssue.screenId);
          if (index >= 0) { select(index); ctx.showSection(resultAccessIssue.section); requestAnimationFrame(() => settingsHeading.current?.focus()); }
        }}>{sprintf(__('Review %s', 'wconvert'), tree.steps.find(screen => screen.id === resultAccessIssue.screenId)?.name ?? '')}</button>}</div>}
      </PanelSection>}
    </>,
    nextSummary: !slim && (tree.graph ? tree.graph.edges.some(edge => edge.from === current.id) : step < tree.steps.length - 1) && <button type="button" className="wconvert-journey-next-summary" onClick={() => ctx.showSection('paths')}>
      <strong>{remainingFollowups ? __('Check remaining follow-ups', 'wconvert') : tree.graph ? branchCount ? sprintf(_n('%d answer line and all other answers', '%d answer lines and all other answers', branchCount, 'wconvert'), branchCount) : sprintf(__('Then: %s', 'wconvert'), nextGroup ? __('Every matching follow-up', 'wconvert') : tree.steps.find(item => item.id === nextId)?.name ?? __('Choose a line', 'wconvert'))
        : current.paths?.length && current.paths.length > 1 ? sprintf(_n('%d answer line and all other answers', '%d answer lines and all other answers', branchCount, 'wconvert'), branchCount)
          : sprintf(__('Then: %s', 'wconvert'), tree.steps.find(item => item.id === current.paths?.[0]?.to)?.name ?? tree.steps[step + 1].name)}</strong>
      <small>{remainingFollowups ? sprintf(__('Then: %s', 'wconvert'), tree.steps.find(item => item.id === remainingFollowups.next)?.name ?? '') : __('Review where visitors go next', 'wconvert')}</small>
    </button>,
    flowNudge: <BranchNudge tree={tree} onBranch={() => {
      const at = displayOrder.find(index => walkNodes(tree.steps[index].content).some(node => node.type === 'question' && 'answer_type' in node && node.answer_type !== 'text'));
      if (at !== undefined) branchFrom(at);
    }} />,
    flowAdd: tree.graph ? (index, edgeId) => {
      contextAddTrigger.current = document.activeElement as HTMLElement;
      select(index); setFollowupAnswer(undefined); setInsertLocation(`edge:${edgeId}`); insertedScreen.current = false; setInsertIntent(undefined); setAddKind('input');
    } : undefined,
    screenItems: tree.graph && <OptionItem icon={Workflow} name={__('Move to another line…', 'wconvert')} onSelect={() => setMoving(value => !value)} />,
    screenPanel: moving && tree.graph && <PanelSection><GraphScreenActions key={`actions:${current.id}`} tree={tree} step={step} onChange={(next, selected) => { setMoving(false); write(next, selected); requestAnimationFrame(() => settingsHeading.current?.focus()); }} /></PanelSection>,
    lines: true,
    dialogs: <>
      <Dialog open={addCapture} onOpenChange={setAddCapture}>
        <AdminDialogContent size="sm" className="wconvert-graph-insert" onCloseAutoFocus={closeFocus}>
          {addCapture && <GraphCaptureInsert tree={tree} primaryChannel={primaryChannel} source={current.id} onCancel={() => setAddCapture(false)} onInsert={location => {
            const next = addGraphCapture(tree, primaryChannel, location);
            if (next === tree) return;
            insertedScreen.current = true;
            write(next, submissionScreen(next, next.submissions[1]?.id));
            ctx.showSection('content'); ctx.showDetails(); setAddCapture(false);
            say(__('Optional signup added. Review its consent and destinations before publishing. The main signup stays saved when visitors skip this step.', 'wconvert'));
          }} />}
        </AdminDialogContent>
      </Dialog>
      <Dialog open={addKind !== null} onOpenChange={value => { if (!value) setAddKind(null); }}>
        <AdminDialogContent size="md" ref={insertDialog} onOpenAutoFocus={event => { if (followupAnswer) { event.preventDefault(); insertDialog.current?.querySelector<HTMLInputElement>('input')?.focus(); } }} className="wconvert-graph-insert" onCloseAutoFocus={closeFocus}>
          {addKind && <GraphScreenInsert tree={insertionTree} source={current.id} kind={addKind} initialLocation={insertLocation} initialIntent={insertIntent} initialAnswer={followupAnswer} onCancel={() => setAddKind(null)}
            onEditCapture={screenId => { select(tree.steps.findIndex(screen => screen.id === screenId)); setAddKind(null); insertedScreen.current = true; }}
            onCapture={canAddGraphResultSignup || canAddGraphCapture ? () => { setAddKind(null); ctx.addOptional(); } : undefined}
            onExisting={(target, when, edgeId) => {
              let next = edgeId ? reconnectGraphEdge(insertionTree, edgeId, target) : addGraphConnection(insertionTree, current.id, target);
              if (next === insertionTree) return;
              if (!edgeId && when) { const added = next.graph!.edges.at(-1)!; next = { ...next, graph: { ...next.graph!, edges: next.graph!.edges.map(edge => edge.id === added.id ? { ...edge, when } : edge) } }; }
              const impact = graphChangeImpact(insertionTree, next);
              const from = edgeId ? insertionTree.graph!.edges.find(edge => edge.id === edgeId)!.from : current.id;
              select(tree.steps.findIndex(screen => screen.id === from));
              setAddKind(null); ctx.showSection('paths');
              if (impact) setPendingRoute({ tree: next, description: impact }); else onChange(next);
              say(impact ? __('Check this change before applying it.', 'wconvert') : __('Line updated. Check its order under “Where visitors go next”.', 'wconvert'));
            }}
            onInsert={(location, kind, name, when, includeHidden, branch, answerType) => {
              let next = branch && when ? addGraphBranchScreen(insertionTree, current.id, kind === 'ending' ? 'ending' : kind === 'content' ? 'content' : 'input', when) : addGraphScreen(insertionTree, location, kind, when, includeHidden);
              if (next === insertionTree) return;
              if (name || answerType) next = { ...next, steps: next.steps.map((screen, index) => index === next.steps.length - 1 ? { ...screen, ...(name ? { name } : {}), content: (kind === 'input' || kind === 'followup') ? renameNewQuestion(screen.content, name, answerType) : screen.content } : screen) };
              const impact = graphChangeImpact(insertionTree, next);
              if (impact) { setAddKind(null); setPendingRoute({ tree: next, description: impact, selected: next.steps.length - 1 }); return; }
              insertedScreen.current = true;
              write(next, next.steps.length - 1);
              ctx.showSection('content'); ctx.showDetails(); setAddKind(null);
              say(__('Screen added at the chosen location. Review its content and where it continues in screen settings.', 'wconvert'), next.steps[next.steps.length - 1]);
            }} />}
        </AdminDialogContent>
      </Dialog>
      <ConfirmDialog variant="default" open={pendingRoute !== null} onOpenChange={value => { if (!value) setPendingRoute(null); }} title={__('Check this change', 'wconvert')} returnFocusTo={settingsHeading}
        description={pendingRoute?.description ?? ''}
        confirmLabel={__('Change anyway', 'wconvert')} onConfirm={() => { if (pendingRoute) { if (pendingRoute.selected !== undefined) write(pendingRoute.tree, pendingRoute.selected); else onChange(pendingRoute.tree); } setPendingRoute(null); }} />
    </>,
  };
}


function renameNewQuestion(node: TemplateNode, label: string, answerType?: QuestionNode['answer_type']): TemplateNode {
  if (node.type === 'question') return { ...node, ...(label ? { label } : {}), ...(answerType ? { answer_type: answerType, ...(answerType === 'text' ? { options: [] } : {}) } : {}) } as TemplateNode;
  const next = { ...node } as Record<string, unknown>;
  for (const key of ['children', 'start', 'end']) if (Array.isArray(next[key])) next[key] = (next[key] as TemplateNode[]).map(child => renameNewQuestion(child, label, answerType));
  return next as TemplateNode;
}
