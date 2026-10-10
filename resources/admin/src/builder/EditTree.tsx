import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { CircleHelp, FileText, Flag, GitBranch, Mail, Sparkles, TriangleAlert } from 'lucide-react';
import { Disclosure } from '../shell/Disclosure';
import type { TemplateTree } from '@renderer/types';
import { graphDisplayOrder } from './structure/graph';
import { followupGroups, followupGroupSource } from './structure/followupGroups';
import { followupLabel } from './structure/followupLabel';
import { conditionText } from './structure/conditionText';
import { walkNodes, unreachableScreenIds } from './structure/journey';
import { issuesByScreen, type CampaignIssue } from './readiness/campaignIssues';
import { resolvedToken } from './panel';
import type { Template } from '@renderer/types';

/** The Look row's dots: background, text and button, as the design resolves them. */
export const lookColors = (template: Template): readonly string[] =>
  ['bg', 'fg', 'accent'].map(token => resolvedToken(template.tokens, token));

/** The campaign's format as one lowercase word: "popup", "bar". */
export function formatWordOf(displayType: string): string {
  const words: Record<string, string> = {
    popup: __('popup', 'wconvert'), floating_bar: __('bar', 'wconvert'), slide_in: __('slide-in', 'wconvert'),
    fullscreen: __('fullscreen', 'wconvert'), inline: __('inline form', 'wconvert'),
  };
  return words[displayType] ?? __('design', 'wconvert');
}

/** "Colors, fonts, popup position", naming the format the campaign uses. */
export function lookSummary(displayType: string): string {
  /* translators: %s: the campaign's format, e.g. “popup”. */
  return sprintf(__('Colors, fonts, %s position', 'wconvert'), formatWordOf(displayType));
}

/**
 * The Edit tab's left column: the campaign's **Look**, then its screens, the
 * open one unfolded into its elements (ADR 0134, D5).
 *
 * ============================================================================
 * ONE LIST FOR EVERYTHING A MERCHANT CAN POINT AT.
 * ============================================================================
 * The Design tab had a Layers pane, the Screens tab a screen list, and a
 * "Design settings" button sat beside both — three ways into one campaign.
 * Here the look is the pinned first row, each screen is a row, and the screen
 * being edited lists its elements under it, so choosing what to edit is one
 * column whatever is chosen.
 *
 * The rows are an inventory, not a claim about visit order: a screen shown
 * "Only if…" says so, a screen on one path says which, and the Flow map is
 * where order is drawn.
 */
export interface EditTreeLook {
  readonly open: boolean;
  /** The design's background, text and button colors, drawn as dots. */
  readonly colors: readonly string[];
  /** "Colors, fonts, popup position". */
  readonly summary: string;
  readonly onOpen: () => void;
}

export interface EditTreeRow {
  readonly key: string;
  readonly label: string;
  readonly current: boolean;
  readonly onSelect: () => void;
}

export function EditTree({ tree, step, editingScreen = true, issues = [], onIssue, onSelect, look, elements, extraRows = [], addScreen }: {
  tree: TemplateTree; step: number;
  /** Whether the open screen is what the panel shows; false while the Look or an extra row is open. */
  editingScreen?: boolean;
  /** The campaign's one issue list (ADR 0133): each screen shows how many are about it. */
  issues?: readonly CampaignIssue[]; onIssue?(issue: CampaignIssue): void;
  onSelect(index: number): void;
  look?: EditTreeLook;
  /** The open screen's elements, drawn under its row. */
  elements?: ReactNode;
  /** Rows that are not screens: the reopen button, the locked content preview. */
  extraRows?: readonly EditTreeRow[];
  /** "+ Add screen". */
  addScreen?: ReactNode;
}) {
  const groups = followupGroups(tree);
  const issuesHere = issuesByScreen(issues);
  const unreachable = new Set(unreachableScreenIds(tree));
  const owners = new Map(groups.flatMap(group => { const source = followupGroupSource(tree, group); return source === undefined ? [] : [[group.id, source] as const]; }));
  const item = (index: number, nested = false) => {
    const screen = tree.steps[index];
    const nodes = walkNodes(screen.content);
    const branches = tree.graph?.edges.filter(edge => edge.from === screen.id && edge.kind === 'answer').length ?? Math.max(0, (screen.paths?.length ?? 1) - 1);
    const incoming = tree.graph?.edges.filter(edge => edge.to === screen.id) ?? [];
    const path = incoming.length === 1 && incoming[0].kind !== 'hidden' && tree.graph?.edges.some(edge => edge.from === incoming[0].from && edge.kind === 'answer') ? incoming[0] : undefined;
    const Icon = screen.kind === 'result' ? Sparkles : screen.kind === 'acknowledgement' ? Flag
      : nodes.some(node => node.type === 'field') ? Mail : nodes.some(node => node.type === 'question') ? CircleHelp : FileText;
    const here = issuesHere.get(screen.id) ?? [];
    const current = step === index && editingScreen;
    const warning = here.length > 0 && <button type="button" className="wconvert-campaign-screens__issues" data-soft={here.every(issue => !issue.blocks) || undefined} onClick={() => onIssue?.(here[0])}
      aria-label={sprintf(_n('%1$d issue on “%2$s”: %3$s', '%1$d issues on “%2$s”: %3$s', here.length, 'wconvert'), here.length, screen.name, here[0].said)}>
      <TriangleAlert aria-hidden="true" size={12} />{here.length}</button>;
    return <div key={screen.id} className="wconvert-campaign-screens__row">
      <button type="button" aria-current={current ? 'true' : undefined} onClick={() => onSelect(index)}>
        <Icon aria-hidden="true" size={16} /><span>
          {path && <small className="wconvert-campaign-screens__path">{path.kind === 'answer' && path.when ? followupLabel(tree, path.when) : __('All other answers', 'wconvert')}</small>}
          {nested && screen.when && <small className="wconvert-campaign-screens__answer">{followupLabel(tree, screen.when)}</small>}
          <strong>{screen.name}</strong>
          {unreachable.has(screen.id) ? <small>{__('Not connected', 'wconvert')}</small> : screen.when && !nested ? <small>{sprintf(__('Only if %s', 'wconvert'), conditionText(tree, screen.when))}</small>
            : screen.id === (tree.graph?.entry ?? tree.steps[0].id) ? <small>{__('First screen', 'wconvert')}</small> : null}
          {branches > 0 && <small><GitBranch aria-hidden="true" size={12} />{__('Only one path is followed', 'wconvert')}</small>}
        </span>
      </button>{warning}
      {step === index && elements !== undefined && <div className="wconvert-edit-tree__elements" role="group" aria-label={sprintf(__('Elements on %s', 'wconvert'), screen.name)}>{elements}</div>}
    </div>;
  };
  const renderGroup = (group: typeof groups[number]) => <section key={group.id} aria-label={sprintf(__('Follow-ups: %s', 'wconvert'), owners.has(group.id) ? tree.steps[owners.get(group.id)!].name : tree.steps[group.screens[0]].name)}>
    <Disclosure variant="inline" open={group.screens.includes(step) || owners.get(group.id) === step} title={sprintf(_n('%d follow-up question', '%d follow-up questions', group.screens.length, 'wconvert'), group.screens.length)} summary={__('Asked one at a time, to each matching answer.', 'wconvert')}>
    {group.screens.map(index => item(index, true))}
    <p>{sprintf(__('Then: %s', 'wconvert'), tree.steps.find(screen => screen.id === group.next)?.name ?? '')}</p></Disclosure>
  </section>;
  return <nav className="wconvert-campaign-screens wconvert-edit-tree" aria-label={__('Campaign', 'wconvert')}>
    {look && <button type="button" className="wconvert-edit-tree__look" aria-current={look.open ? 'true' : undefined} onClick={look.onOpen}>
      <span className="wconvert-edit-tree__dots" aria-hidden="true">{look.colors.map((color, at) => <span key={at} style={{ background: color }} />)}</span>
      <span><strong>{__('Look', 'wconvert')}</strong><small>{look.summary}</small></span>
    </button>}
    <div className="wconvert-campaign-screens__heading"><strong>{__('Screens', 'wconvert')}</strong><span>{tree.steps.length}</span></div>
    <div className="wconvert-campaign-screens__items">{graphDisplayOrder(tree).map(index => {
      const group = groups.find(candidate => candidate.screens.includes(index));
      if (group) return !owners.has(group.id) && group.screens[0] === index ? renderGroup(group) : null;
      return <div key={tree.steps[index].id}>{item(index)}{groups.filter(candidate => owners.get(candidate.id) === index).map(renderGroup)}</div>;
    })}
    {extraRows.map(row => <div key={row.key} className="wconvert-campaign-screens__row">
      <button type="button" aria-current={row.current ? 'true' : undefined} onClick={row.onSelect}><FileText aria-hidden="true" size={16} /><span><strong>{row.label}</strong></span></button>
    </div>)}
    </div>
    {addScreen}
  </nav>;
}
