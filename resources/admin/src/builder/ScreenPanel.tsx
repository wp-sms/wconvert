import { createContext, useContext, useId, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import type { TemplateTree } from '@renderer/types';
import { addGraphConnection, canAddGraphConnection, canTargetGraphScreen, reconnectGraphEdge } from './structure/graphConnections';
import { upgradeToGraph, graphDisplayOrder } from './structure/graph';
import { nodesOf, type Block } from './structure/tree';
import { nameOfBlock } from './BlockRow';
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
export function ScreenThen({ tree, step, editable, onChange, onEditPaths, onUpgrade }: {
  tree: TemplateTree; step: number;
  /** Pro: a select. Free, or a screen whose answers decide: read-only. */
  editable: boolean;
  onChange(next: TemplateTree): void;
  /** For a question with paths: open the question, where its paths live. */
  onEditPaths?(): void;
  /** A linear journey becomes a graph the moment one screen chooses its own next. */
  onUpgrade?(next: TemplateTree): void;
}) {
  const id = useId();
  const screen = tree.steps[step];
  // A one-screen campaign goes nowhere next, so there is nothing to say (ADR 0134).
  if (tree.steps.length === 1) return null;
  if (screen.kind === 'acknowledgement') return <ThenLine label={__('Then', 'wconvert')}>{__('The campaign ends here', 'wconvert')}</ThenLine>;
  const graph = tree.graph;
  const answers = graph ? graph.edges.filter(edge => edge.from === screen.id && edge.kind === 'answer') : (screen.paths ?? []).filter(path => path.when);
  if (answers.length > 0) {
    return <ThenLine label={__('Then', 'wconvert')}>
      <span>{__('Depends on the answer', 'wconvert')}</span>
      {onEditPaths && <button type="button" className="wconvert-screen-then__link" onClick={onEditPaths}>{__('Edit paths on the question', 'wconvert')}</button>}
    </ThenLine>;
  }
  const fallback = graph?.edges.find(edge => edge.from === screen.id && edge.kind === 'default');
  const nextId = graph ? fallback?.to : screen.paths?.[0]?.to ?? tree.steps[step + 1]?.id;
  const next = tree.steps.find(item => item.id === nextId);
  if (!editable) {
    return <ThenLine label={__('Then', 'wconvert')}>
      <span><ArrowRight aria-hidden="true" className="rtl:-scale-x-100" /> {next?.name ?? __('The campaign ends here', 'wconvert')}</span>
      {!graph && tree.steps.length > 2 && <small>{__('Change the order in the screen’s ⋯ menu.', 'wconvert')}</small>}
    </ThenLine>;
  }
  const order = graphDisplayOrder(tree).filter(index => index !== step);
  // A graph screen with no path out yet gets one, unless nothing may follow it (a final result).
  if (graph && !fallback && !order.some(index => canAddGraphConnection(tree, screen.id, tree.steps[index].id))) {
    return <ThenLine label={__('Then', 'wconvert')}>{__('The campaign ends here', 'wconvert')}</ThenLine>;
  }
  const reachable = (target: string) => graph ? canTargetGraphScreen(tree, screen.id, target) : tree.steps.findIndex(item => item.id === target) > step;
  const choose = (target: string) => {
    if (graph) { onChange(fallback ? reconnectGraphEdge(tree, fallback.id, target) : addGraphConnection(tree, screen.id, target)); return; }
    // A straight journey choosing its own next screen becomes a graph first.
    const upgraded = upgradeToGraph(tree);
    const edge = upgraded.graph?.edges.find(item => item.from === screen.id && item.kind === 'default');
    if (edge) (onUpgrade ?? onChange)(reconnectGraphEdge(upgraded, edge.id, target));
  };
  return <div className="wconvert-screen-then">
    <label htmlFor={`${id}-then`} className="wconvert-screen-then__label">{__('Then', 'wconvert')}</label>
    <div className="wconvert-screen-then__value">
      <ArrowRight aria-hidden="true" className="rtl:-scale-x-100" />
      <select id={`${id}-then`} value={nextId ?? ''} onChange={event => choose(event.target.value)}>
        {nextId === undefined && <option value="">{__('Choose a screen', 'wconvert')}</option>}
        {order.map(index => <option key={tree.steps[index].id} value={tree.steps[index].id} disabled={!reachable(tree.steps[index].id)}>{tree.steps[index].name}</option>)}
      </select>
    </div>
  </div>;
}

function ThenLine({ label, children }: { label: string; children: ReactNode }) {
  return <div className="wconvert-screen-then"><span className="wconvert-screen-then__label">{label}</span><div className="wconvert-screen-then__value">{children}</div></div>;
}

/** A fact the screen panel states and links to where it is changed: "When it opens · After 8 seconds". */
export function ScreenFact({ label, value, action, onAction }: { label: string; value: string; action: string; onAction?(): void }) {
  return <div className="wconvert-screen-fact">
    <span className="wconvert-screen-fact__label">{label}</span>
    <span className="wconvert-screen-fact__value">{value}</span>
    {onAction && <button type="button" onClick={onAction}>{action}</button>}
  </div>;
}

/** This screen's issues from the campaign's one list (ADR 0133), each a way to its fix. */
export function ScreenIssues({ issues, onIssue }: { issues: readonly CampaignIssue[]; onIssue?(issue: CampaignIssue): void }) {
  if (issues.length === 0) return null;
  return <ul className="wconvert-screen-issues" aria-label={__('To fix on this screen', 'wconvert')}>
    {issues.map(issue => <li key={issue.key}><button type="button" onClick={() => onIssue?.(issue)}><TriangleAlert aria-hidden="true" />{issue.said}</button></li>)}
  </ul>;
}

/** "On this screen": its elements as chips, each opening that element. */
export function ScreenChips({ tree, step, labels, onSelect }: { tree: TemplateTree; step: number; labels?: TemplateLabels; onSelect?(path: Path): void }) {
  if (!labels || !onSelect) return null;
  const blocks = nodesOf(tree).filter((block: Block) => block.path[0] === step && block.path.length > 1 && block.leaf && !block.hidden);
  if (blocks.length === 0) return null;
  return <section className="wconvert-screen-chips" aria-label={__('On this screen', 'wconvert')}>
    <h4>{__('On this screen', 'wconvert')}</h4>
    <div>{blocks.map(block => <button key={block.path.join('.')} type="button" onClick={() => onSelect(block.path)}>{nameOfBlock(block, labels)}</button>)}</div>
  </section>;
}

/**
 * The question element's panel, as the Edit tab draws it: the question's own
 * settings and "Where visitors go next". The journey editor owns the dialogs
 * those open (follow-ups, inserted screens), so it provides the panel and the
 * element inspector draws it (ADR 0134).
 */
export const QuestionPanelContext = createContext<((step: number) => ReactNode) | null>(null);
export const useQuestionPanel = () => useContext(QuestionPanelContext);
