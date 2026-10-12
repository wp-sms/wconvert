import { createContext, useContext, useId, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { TriangleAlert } from 'lucide-react';
import { FactRow, PanelHint, PanelSection } from './PanelSection';
import type { QuestionNode, TemplateTree } from '@renderer/types';
import { addGraphConnection, canAddGraphConnection, canTargetGraphScreen, reconnectGraphEdge } from './structure/graphConnections';
import { upgradeToGraph, graphDisplayOrder } from './structure/graph';
import { nodesOf, type Block } from './structure/tree';
import { nameOfBlock } from './BlockRow';
import { conditionText } from './structure/conditionText';
import { followupGroups } from './structure/followupGroups';
import { answerColor, answerColors, flowModel } from './structure/flowModel';
import { walkNodes } from './structure/journey';
import type { Path } from './panel';
import type { CampaignIssue } from './readiness/campaignIssues';
import type { TemplateLabels } from '../templates/api';

/**
 * The slim screen panel's own sections (ADR 0134).
 *
 * ============================================================================
 * A SCREEN SAYS WHERE IT GOES, WHAT IT SAVES AND WHAT IS ON IT. NOTHING ELSE.
 * ============================================================================
 * The screen pane used to repeat every word on the screen in a column of
 * text boxes, explain "What happens to answers here?", summarize "Next: …"
 * and offer "Open Design" — four ways to reach things the element panel and
 * the Look already hold. What is left is what only a screen can answer.
 */

/** "Then → Thank you": where this screen goes next, and the one control that changes it. */
export function ScreenThen({ tree, step, editable, onChange, onEditPaths, onEditLine, onUpgrade, onBranch }: {
  tree: TemplateTree; step: number;
  /** Pro: a select. Free, or a screen whose answers decide: read-only. */
  editable: boolean;
  onChange(next: TemplateTree): void;
  /** For a question with paths: open the question, where its paths live. */
  onEditPaths?(): void;
  /** Opens one of the question's lines where it is edited, on the question. */
  onEditLine?(priority: number): void;
  /** A linear journey becomes a graph the moment one screen chooses its own next. */
  onUpgrade?(next: TemplateTree): void;
  /** A choice question with no answer lines yet: start one (ADR 0142). */
  onBranch?(): void;
}) {
  const id = useId();
  const screen = tree.steps[step];
  // A one-screen campaign goes nowhere next, so there is nothing to say (ADR 0134).
  if (tree.steps.length === 1) return null;
  if (screen.kind === 'acknowledgement') return <FactRow label={__('Then', 'wconvert')}>{__('The campaign ends here', 'wconvert')}</FactRow>;
  const graph = tree.graph;
  const answers = graph ? graph.edges.filter(edge => edge.from === screen.id && edge.kind === 'answer') : (screen.paths ?? []).filter(path => path.when);
  if (answers.length > 0) {
    // Each line as the map draws it: its answer's color, its words, where it goes (ADR 0142).
    const selected = walkNodes(screen.content).flatMap(node => node.type === 'question' && 'id' in node && typeof node.id === 'string' ? [node.id] : [])[0];
    const model = graph ? flowModel(tree, { selectedQuestion: selected }) : undefined;
    const lines = model?.lines.filter(line => line.from === screen.id && line.style !== 'skipped') ?? [];
    const name = (node: string) => model?.cards.find(card => card.id === node)?.name ?? model?.groups.find(group => group.id === node)?.title ?? '';
    return <>
      <FactRow label={__('Then', 'wconvert')} action={__('Edit lines', 'wconvert')} onAction={onEditPaths}>{__('First match wins, top to bottom', 'wconvert')}</FactRow>
      {lines.length > 0 && <ol className="wconvert-screen-lines">{lines.map(line => {
        const words = <><span className="wconvert-flow-dot" data-color={line.color} aria-hidden="true" /><span><bdi>{line.label ?? __('All other answers', 'wconvert')}</bdi>
          {' '}<span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span>{' '}<b><bdi>{name(line.to)}</bdi></b></span></>;
        const priority = line.select?.priority;
        return <li key={line.id}>{onEditLine && typeof priority === 'number'
          ? <button type="button" onClick={() => onEditLine(priority)}>{words}</button> : words}</li>;
      })}</ol>}
    </>;
  }
  const fallback = graph?.edges.find(edge => edge.from === screen.id && edge.kind === 'default');
  const nextId = graph ? fallback?.to : screen.paths?.[0]?.to ?? tree.steps[step + 1]?.id;
  const next = tree.steps.find(item => item.id === nextId);
  if (!editable) {
    return <>
      <FactRow label={__('Then', 'wconvert')}>{next?.name ?? __('The campaign ends here', 'wconvert')}</FactRow>
      {!graph && tree.steps.length > 2 && <PanelHint>{__('Change the order in the screen’s ⋯ menu.', 'wconvert')}</PanelHint>}
    </>;
  }
  const order = graphDisplayOrder(tree).filter(index => index !== step);
  // A graph screen with no path out yet gets one, unless nothing may follow it (a final result).
  if (graph && !fallback && !order.some(index => canAddGraphConnection(tree, screen.id, tree.steps[index].id))) {
    return <FactRow label={__('Then', 'wconvert')}>{__('The campaign ends here', 'wconvert')}</FactRow>;
  }
  const reachable = (target: string) => graph ? canTargetGraphScreen(tree, screen.id, target) : tree.steps.findIndex(item => item.id === target) > step;
  const choose = (target: string) => {
    if (graph) { onChange(fallback ? reconnectGraphEdge(tree, fallback.id, target) : addGraphConnection(tree, screen.id, target)); return; }
    // A straight journey choosing its own next screen becomes a graph first.
    const upgraded = upgradeToGraph(tree);
    const edge = upgraded.graph?.edges.find(item => item.from === screen.id && item.kind === 'default');
    if (edge) (onUpgrade ?? onChange)(reconnectGraphEdge(upgraded, edge.id, target));
  };
  const box = next ? followupGroups(tree).find(group => tree.steps[group.screens[0]].id === next.id) : undefined;
  // When the next screen has "Only if…", say who sees it and where everyone else goes (the prototype's panel, ADR 0142).
  const skipTo = graph && next?.when ? (graph.edges.find(edge => edge.from === next.id && edge.kind === 'hidden') ?? graph.edges.find(edge => edge.from === next.id && edge.kind === 'default'))?.to : undefined;
  return <>
    <FactRow label={__('Then', 'wconvert')} htmlFor={`${id}-then`}>
      <select id={`${id}-then`} data-then value={nextId ?? ''} onChange={event => choose(event.target.value)}>
        {nextId === undefined && <option value="">{__('Choose a screen', 'wconvert')}</option>}
        {order.map(index => <option key={tree.steps[index].id} value={tree.steps[index].id} disabled={!reachable(tree.steps[index].id)}>{tree.steps[index].name}</option>)}
      </select>
    </FactRow>
    {box ? <PanelHint>{sprintf(/* translators: %s: a screen's name. */ __('Visitors with any matching answer go through the follow-ups. The rest go straight to “%s”.', 'wconvert'), tree.steps.find(item => item.id === box.next)?.name ?? '')}</PanelHint>
      : next?.when && skipTo && <PanelHint>{sprintf(/* translators: 1: a rule. 2, 3: screen names. */ __('Only visitors with %1$s see “%2$s”. All other answers go to “%3$s”.', 'wconvert'),
        conditionText(tree, next.when), next.name, tree.steps.find(item => item.id === skipTo)?.name ?? '')}</PanelHint>}
    {onBranch && <button type="button" className="wconvert-panel-link" onClick={onBranch}>{__('Send some answers to a different screen', 'wconvert')}</button>}
  </>;
}

/**
 * A question screen's answers, each in the color its lines, chips and
 * results carry on the Flow map (ADR 0142), with the follow-ups it opens.
 */
export function ScreenAnswers({ tree, step, onSelect, onFollowup }: {
  tree: TemplateTree; step: number; onSelect(index: number): void;
  /** Starts a follow-up question for one answer; absent where follow-ups are not offered. */
  onFollowup?(question: string, value: string): void;
}) {
  const question = walkNodes(tree.steps[step].content).find((node): node is QuestionNode & { id: string } => node.type === 'question' && 'id' in node && typeof node.id === 'string' && node.answer_type !== 'text');
  if (!question?.options?.length) return null;
  const { colors, focusQuestion } = answerColors(tree, question.id);
  const followups = (value: string) => tree.steps.map((screen, index) => ({ screen, index }))
    .filter(({ screen }) => screen.when?.clauses.some(clause => clause.question === question.id && clause.values.includes(value)));
  const multi = question.answer_type === 'multi';
  return <PanelSection title={multi ? __('Answers · choose several', 'wconvert') : __('Answers · choose one', 'wconvert')}
    tip={multi ? __('Visitors can pick several. Every matching follow-up is asked, one at a time.', 'wconvert') : undefined}>
    <ul className="wconvert-screen-answers">{question.options.map(option => {
      const shown = followups(option.value);
      return <li key={option.value}>
        <span className="wconvert-flow-dot" data-color={answerColor(colors, question.id, option.value)} aria-hidden="true" />
        <span className="wconvert-screen-answers__label"><bdi>{option.label}</bdi></span>
        {shown.length ? <span className="wconvert-screen-answers__followups">{shown.map(({ screen, index }) =>
          <button key={screen.id} type="button" className="wconvert-panel-link" onClick={() => onSelect(index)}>{sprintf(/* translators: %s: a follow-up's name. */ __('Follow-up: %s', 'wconvert'), screen.name)}</button>)}</span>
          : onFollowup && <button type="button" className="wconvert-panel-link" onClick={() => onFollowup(question.id, option.value)}
            aria-label={sprintf(/* translators: %s: an answer. */ __('Add a follow-up for “%s”', 'wconvert'), option.label)}>{__('+ Follow-up', 'wconvert')}</button>}
      </li>;
    })}</ul>
    {focusQuestion && focusQuestion !== question.id && <PanelHint>{__('Too many answers to color them all. Select a question to color its answers.', 'wconvert')}</PanelHint>}
  </PanelSection>;
}

/** This screen's issues from the campaign's one list (ADR 0133), each a way to its fix. */
export function ScreenIssues({ issues, onIssue }: { issues: readonly CampaignIssue[]; onIssue?(issue: CampaignIssue): void }) {
  if (issues.length === 0) return null;
  return <PanelSection>
    <ul className="wconvert-screen-issues" aria-label={__('To fix on this screen', 'wconvert')}>
      {issues.map(issue => <li key={issue.key}><button type="button" onClick={() => onIssue?.(issue)}><TriangleAlert aria-hidden="true" />{issue.said}</button></li>)}
    </ul>
  </PanelSection>;
}

/** "On this screen": its elements as chips, each opening that element. */
export function ScreenChips({ tree, step, labels, onSelect }: { tree: TemplateTree; step: number; labels?: TemplateLabels; onSelect?(path: Path): void }) {
  if (!labels || !onSelect) return null;
  const blocks = nodesOf(tree).filter((block: Block) => block.path[0] === step && block.path.length > 1 && block.leaf && !block.hidden);
  if (blocks.length === 0) return null;
  return <PanelSection title={__('On this screen', 'wconvert')} className="wconvert-screen-chips">
    <div>{blocks.map(block => <button key={block.path.join('.')} type="button" onClick={() => onSelect(block.path)}>{nameOfBlock(block, labels)}</button>)}</div>
  </PanelSection>;
}

/**
 * The question element's panel, as the Edit tab draws it: the question's own
 * settings and "Where visitors go next". The journey editor owns the dialogs
 * those open (follow-ups, inserted screens), so it provides the panel and the
 * element inspector draws it (ADR 0134).
 */
export const QuestionPanelContext = createContext<((step: number) => ReactNode) | null>(null);
export const useQuestionPanel = () => useContext(QuestionPanelContext);
